// Finevelo news agent: scout RSS feeds -> score -> write -> fact-check -> save articles (draft or published).
// Runs on GitHub Actions (hourly); config/agent.json decides whether this hour is a run slot.
// FORCE=1 runs regardless of the schedule. DRY_RUN=1 scores only and writes nothing.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { existsSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { EDITORIAL, SCORE_TASK, WRITE_TASK, QA_TASK } from './prompts.mjs';

const ROOT = new URL('../../', import.meta.url).pathname;
const read = (p) => JSON.parse(readFileSync(ROOT + p, 'utf8'));
const settings = read('config/agent.json');
const sources = read('config/sources.json');
const STATE_FILE = 'config/agent-state.json';
const state = existsSync(ROOT + STATE_FILE) ? read(STATE_FILE) : { processed: {}, runs: [] };
const FORCE = process.env.FORCE === '1' || process.env.FORCE === 'true';
const DRY_RUN = process.env.DRY_RUN === '1';
const ARTICLES = ROOT + 'src/content/articles/';
const summary = [];
const log = (line) => {
  console.log(line);
  summary.push(line);
};

// ---------- schedule ----------
function isRunSlot(now = new Date()) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone, weekday: 'short', hour: '2-digit', hourCycle: 'h23' })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  const day = parts.weekday.toLowerCase().slice(0, 3);
  const hour = parts.hour.padStart(2, '0');
  return settings.days.includes(day) && settings.times.some((t) => t.slice(0, 2) === hour);
}

// ---------- feeds ----------
const decode = (s = '') =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&#8217;|&rsquo;/g, "'")
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8212;|&mdash;/g, '—')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};
const UA = 'Mozilla/5.0 (compatible; FineveloBot/1.0; +https://www.finevelo.com/about/)';

async function fetchText(url, timeoutMs = 20000) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: '*/*' }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function readFeed(source) {
  const xml = await fetchText(source.rss);
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    const atomLink = b.match(/<link[^>]*href="([^"]+)"/i);
    return {
      source: source.name,
      title: decode(tag(b, 'title')),
      url: decode(tag(b, 'link')) || (atomLink ? atomLink[1] : ''),
      date: new Date(decode(tag(b, 'pubDate')) || decode(tag(b, 'published')) || decode(tag(b, 'updated')) || 0),
      summary: decode(tag(b, 'description') || tag(b, 'summary')).slice(0, 400),
    };
  });
}

// Readable text from an article page, without scripts, navigation and markup.
async function readPage(url) {
  const html = await fetchText(url, 30000);
  const main = tag(html, 'article') || tag(html, 'main') || html;
  return decode(main.replace(/<(script|style|nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, ' ')).slice(0, 60000);
}

// ---------- existing content ----------
function existingArticles() {
  return readdirSync(ARTICLES)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const text = readFileSync(ARTICLES + f, 'utf8');
      return {
        slug: f.replace(/\.md$/, ''),
        title: (text.match(/^title:\s*"?(.*?)"?\s*$/m) || [])[1] || '',
        sourceUrl: (text.match(/^\s+url:\s*"?(https?:[^"\s]+)"?/m) || [])[1] || '',
      };
    });
}

// ---------- Claude ----------
const client = new Anthropic(); // reads ANTHROPIC_API_KEY
const MODEL = settings.model || 'claude-opus-5-5';

// Structured call with server-side fallback on refusals.
async function ask(schema, system, user, { effort = 'medium', maxTokens = 16000 } = {}) {
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: maxTokens,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system,
    output_config: { effort, format: zodOutputFormat(schema) },
    messages: [{ role: 'user', content: user }],
  });
  if (response.stop_reason === 'refusal') throw new Error(`refused (${response.stop_details?.category ?? 'unknown'})`);
  if (!response.parsed_output) throw new Error(`no structured output (stop_reason ${response.stop_reason})`);
  return response.parsed_output;
}

const CATEGORY = z.enum(['road', 'gravel', 'mtb', 'e-bike', 'components', 'custom']);
const FORMAT = z.enum(['launch-brief', 'the-edit', 'deep-dive', 'pro-bike-check']);
const ScoreSchema = z.object({
  items: z.array(z.object({ id: z.number(), score: z.number(), category: CATEGORY, format: FORMAT, reason: z.string() })),
});
const ArticleSchema = z.object({
  slug: z.string(),
  title: z.string(),
  seoTitle: z.string(),
  description: z.string(),
  dek: z.string(),
  category: CATEGORY,
  format: FORMAT,
  hero_alt: z.string(),
  specs: z
    .object({ price: z.string(), weight: z.string(), groupset: z.string().nullable(), availability: z.string().nullable() })
    .nullable(),
  tags: z.array(z.string()),
  faq: z.array(z.object({ q: z.string(), a: z.string() })),
  body: z.string(),
});
const QaSchema = z.object({
  pass: z.boolean(),
  issues: z.array(z.object({ claim: z.string(), problem: z.string() })),
  fixed_body: z.string().nullable(),
  fixed_fields: z
    .object({ title: z.string().nullable(), description: z.string().nullable(), dek: z.string().nullable(), price: z.string().nullable(), weight: z.string().nullable() })
    .nullable(),
});

// ---------- writing files ----------
const q = (s) => JSON.stringify(String(s)); // JSON strings are valid YAML scalars
function toMarkdown(a, item, draft) {
  const lines = [
    '---',
    `title: ${q(a.title)}`,
    `seoTitle: ${q(a.seoTitle.slice(0, 60))}`,
    `description: ${q(a.description.slice(0, 170))}`,
    `dek: ${q(a.dek)}`,
    `pubDate: ${new Date().toISOString()}`,
    `category: ${a.category}`,
    `format: ${a.format}`,
    'author: editorial',
    `draft: ${draft}`,
    'hero:',
    `  alt: ${q(a.hero_alt)}`,
  ];
  if (a.specs) {
    lines.push('specs:', `  price: ${q(a.specs.price)}`, `  weight: ${q(a.specs.weight)}`);
    if (a.specs.groupset) lines.push(`  groupset: ${q(a.specs.groupset)}`);
    if (a.specs.availability) lines.push(`  availability: ${q(a.specs.availability)}`);
  }
  lines.push('source:', `  name: ${q(item.source)}`, `  url: ${q(item.url)}`);
  lines.push(`tags: [${a.tags.map(q).join(', ')}]`);
  if (a.faq.length) {
    lines.push('faq:');
    for (const f of a.faq) lines.push(`  - q: ${q(f.q)}`, `    a: ${q(f.a)}`);
  }
  lines.push('---', '', a.body.trim(), '', `*Source: [${item.source}](${item.url}). Drafted with AI assistance and checked against the source.*`, '');
  return lines.join('\n');
}

function uniqueSlug(slug, taken) {
  let s = slug.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'article';
  let n = 2;
  const base = s;
  while (taken.has(s)) s = `${base}-${n++}`;
  taken.add(s);
  return s;
}

// ---------- main ----------
async function main() {
  if (!FORCE && !settings.enabled) return log('Agent is switched off (config/agent.json → enabled: false).');
  if (!FORCE && !isRunSlot()) return console.log('Not a scheduled slot, nothing to do.');
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set. Add it in the backend under Agent.');

  log(`## Finevelo agent run ${new Date().toISOString()} (model ${MODEL}${FORCE ? ', manual' : ''}${DRY_RUN ? ', dry run' : ''})`);
  const existing = existingArticles();
  const knownUrls = new Set(existing.map((a) => a.sourceUrl).filter(Boolean));
  const since = Date.now() - settings.lookbackHours * 3600 * 1000;

  // 1. Scout
  const candidates = [];
  for (const s of sources.filter((x) => x.active && x.rss)) {
    try {
      const items = await readFeed(s);
      const fresh = items.filter((i) => i.url && i.date.getTime() >= since && !state.processed[i.url] && !knownUrls.has(i.url));
      candidates.push(...fresh);
      log(`- ${s.name}: ${items.length} items, ${fresh.length} new`);
    } catch (e) {
      log(`- ${s.name}: feed failed (${e.message})`);
    }
  }
  if (!candidates.length) return log('No new items.');

  // 2. Score
  const list = candidates.map((c, i) => `${i}. [${c.source}] ${c.title} (${c.date.toISOString().slice(0, 10)})\n   ${c.summary}`).join('\n');
  const recent = existing.slice(-60).map((a) => `- ${a.title}`).join('\n');
  const scored = await ask(ScoreSchema, `${EDITORIAL}\n\n${SCORE_TASK}`, `Already published:\n${recent}\n\nCandidates:\n${list}`, { effort: 'low' });
  for (const s of scored.items) {
    const c = candidates[s.id];
    if (c) state.processed[c.url] = { at: new Date().toISOString(), score: s.score };
  }
  const picks = scored.items
    .filter((s) => candidates[s.id] && s.score >= settings.minScore && settings.categories.includes(s.category))
    .sort((a, b) => b.score - a.score)
    .slice(0, settings.maxArticlesPerRun);
  log(`Scored ${scored.items.length} items, ${picks.length} at or above ${settings.minScore}.`);
  for (const p of picks) log(`  - ${p.score} · ${candidates[p.id].title} — ${p.reason}`);
  if (DRY_RUN || !picks.length) return;

  // 3. Write and 4. check
  const taken = new Set(existing.map((a) => a.slug));
  const created = [];
  for (const p of picks) {
    const item = candidates[p.id];
    try {
      const source = await readPage(item.url);
      if (source.length < 800) throw new Error('source page too short or blocked');
      const brief = `Category: ${p.category}. Format: ${p.format}. Source outlet: ${item.source}. Source URL: ${item.url}\n\nSOURCE TEXT:\n${source}`;
      let article = await ask(ArticleSchema, `${EDITORIAL}\n\n${WRITE_TASK}`, brief, { effort: 'high' });
      const qa = await ask(QaSchema, `${EDITORIAL}\n\n${QA_TASK}`, `SOURCE TEXT:\n${source}\n\nDRAFT (JSON):\n${JSON.stringify(article)}`, { effort: 'high' });
      if (!qa.pass && qa.fixed_body) {
        const f = qa.fixed_fields || {};
        article = {
          ...article,
          body: qa.fixed_body,
          title: f.title || article.title,
          description: f.description || article.description,
          dek: f.dek || article.dek,
          specs: article.specs && { ...article.specs, price: f.price || article.specs.price, weight: f.weight || article.specs.weight },
        };
      }
      if (!qa.pass && !qa.fixed_body) {
        log(`  ✗ QA failed, skipped: ${item.title} — ${qa.issues.map((i) => i.problem).join('; ')}`);
        continue;
      }
      const publish = settings.autoPublish && qa.pass;
      const slug = uniqueSlug(article.slug, taken);
      writeFileSync(`${ARTICLES}${slug}.md`, toMarkdown(article, item, !publish));
      created.push({ slug, publish });
      log(`  ✓ ${publish ? 'published' : 'draft'}: ${slug}${qa.pass ? '' : ' (corrected by QA)'}`);
    } catch (e) {
      log(`  ✗ ${item.title}: ${e.message}`);
    }
  }
  state.runs = [...(state.runs || []), { at: new Date().toISOString(), created: created.length }].slice(-30);
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `published=${created.some((c) => c.publish)}\n`);
}

try {
  await main();
} finally {
  // Keep the processed list from growing forever: 30 days.
  const cutoff = Date.now() - 30 * 86400 * 1000;
  for (const [url, v] of Object.entries(state.processed)) if (Date.parse(v.at) < cutoff) delete state.processed[url];
  if (!DRY_RUN) writeFileSync(ROOT + STATE_FILE, JSON.stringify(state, null, 2) + '\n');
  if (process.env.GITHUB_STEP_SUMMARY && summary.length) appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join('\n') + '\n');
}
