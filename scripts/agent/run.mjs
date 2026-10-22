// Finevelo news agent: magazine RSS feeds are only tips -> score -> find the manufacturer's primary source ->
// write from that source -> fact-check -> copy check -> save as draft. Publishing is always done by a person in the backend.
// Runs on GitHub Actions (hourly); config/agent.json decides whether this hour is a run slot.
// FORCE=1 runs regardless of the schedule. DRY_RUN=1 scores only and writes nothing.
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import { existsSync, readdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { EDITORIAL, SCORE_TASK, SEARCH_TASK, WRITE_TASK, QA_TASK, REWRITE_TASK } from './prompts.mjs';
import { fetchText, robotsAllows, readAllowedPage, decode, tag } from './fetch.mjs';
import { copyCheck } from './copycheck.mjs';

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

// ---------- feeds (tips only) ----------
async function readFeed(source) {
  const check = await robotsAllows(source.rss);
  if (!check.ok) throw new Error(`skipped: ${check.reason}`);
  const { text: xml } = await fetchText(source.rss);
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  return blocks.map((b) => {
    const atomLink = b.match(/<link[^>]*href="([^"]+)"/i);
    return {
      source: source.name,
      title: decode(tag(b, 'title')),
      url: decode(tag(b, 'link')) || (atomLink ? atomLink[1] : ''),
      date: new Date(decode(tag(b, 'pubDate')) || decode(tag(b, 'published')) || decode(tag(b, 'updated')) || 0),
      summary: decode(tag(b, 'description') || tag(b, 'summary')).slice(0, 200),
    };
  });
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
        urls: [...text.matchAll(/^\s+url:\s*"?(https?:[^"\s]+)"?/gm)].map((m) => m[1]),
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

// ---------- primary sources ----------
// Domains that are never a primary source: every outlet in config/sources.json plus common media, retail and social sites.
const NOT_PRIMARY = [
  ...sources.filter((s) => s.type === 'outlet').map((s) => new URL(s.website).hostname.replace(/^www\./, '')),
  'bikeradar.com', 'velonews.com', 'outsideonline.com', 'cyclingtips.com', 'bicycling.com', 'tour-magazin.de', 'roadbike.de',
  'mtb-news.de', 'bike-magazin.de', 'gravel-bike.de', 'cyclist.co.uk', 'singletracks.com', 'vitalmtb.com', 'enduro-mtb.com',
  'granfondo-cycling.com', 'youtube.com', 'instagram.com', 'facebook.com', 'reddit.com', 'x.com', 'strava.com',
  'amazon.com', 'amazon.de', 'bike-discount.de', 'bike24.de', 'wiggle.com', 'competitivecyclist.com',
];
const hostOf = (url) => new URL(url).hostname.replace(/^www\./, '');
const isNotPrimary = (url) => NOT_PRIMARY.some((d) => hostOf(url) === d || hostOf(url).endsWith(`.${d}`));
const brandSites = sources.filter((s) => s.type === 'brand' && s.active && s.website).map((s) => `${s.name}: ${s.website}`).join('\n');

const SearchSchema = z.object({
  found: z.boolean(),
  brand: z.string().nullable().optional(),
  urls: z.array(z.object({ url: z.string().url(), publisher: z.string(), kind: z.string() })).default([]),
  note: z.string().nullable().optional(),
});

// Claude searches the web for the manufacturer's own announcement; we only get URLs back and fetch them ourselves.
async function findPrimary(item) {
  const messages = [
    {
      role: 'user',
      content: `TIP (from ${item.source}, ${item.date.toISOString().slice(0, 10)}): ${item.title}\n${item.summary}\n\nKnown brand websites:\n${brandSites}`,
    },
  ];
  let response;
  for (let i = 0; i < 4; i++) {
    response = await client.messages.create({
      model: MODEL,
      max_tokens: 4000,
      system: SEARCH_TASK,
      tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 5, blocked_domains: NOT_PRIMARY }],
      messages,
    });
    if (response.stop_reason !== 'pause_turn') break;
    messages.push({ role: 'assistant', content: response.content });
  }
  const text = response.content.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const json = (text.match(/```json\s*([\s\S]*?)```/) || text.match(/(\{[\s\S]*\})/) || [])[1];
  if (!json) throw new Error('search gave no usable answer');
  return SearchSchema.parse(JSON.parse(json));
}

// Fetch the candidate URLs ourselves, respecting robots.txt, TDM reservations and noai signals.
async function readPrimary(found) {
  const pages = [];
  for (const u of found.urls.slice(0, 3)) {
    if (isNotPrimary(u.url)) {
      log(`    · ${u.url}: not a primary source, ignored`);
      continue;
    }
    try {
      const text = await readAllowedPage(u.url);
      if (text.length < 400) throw new Error('page too short');
      pages.push({ ...u, text });
    } catch (e) {
      log(`    · ${u.url}: not used (${e.message})`);
    }
  }
  return pages;
}

// ---------- writing files ----------
const q = (s) => JSON.stringify(String(s)); // JSON strings are valid YAML scalars
function toMarkdown(a, item, primary) {
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
    // Always a draft: a person reviews and publishes in the backend.
    'draft: true',
    'hero:',
    `  alt: ${q(a.hero_alt)}`,
  ];
  if (a.specs) {
    lines.push('specs:', `  price: ${q(a.specs.price)}`, `  weight: ${q(a.specs.weight)}`);
    if (a.specs.groupset) lines.push(`  groupset: ${q(a.specs.groupset)}`);
    if (a.specs.availability) lines.push(`  availability: ${q(a.specs.availability)}`);
  }
  lines.push('source:', `  name: ${q(primary[0].publisher)}`, `  url: ${q(primary[0].url)}`);
  lines.push('tip:', `  name: ${q(item.source)}`, `  url: ${q(item.url)}`);
  lines.push(`tags: [${a.tags.map(q).join(', ')}]`);
  if (a.faq.length) {
    lines.push('faq:');
    for (const f of a.faq) lines.push(`  - q: ${q(f.q)}`, `    a: ${q(f.a)}`);
  }
  const links = primary.map((p) => `[${p.publisher}](${p.url})`).join(', ');
  lines.push(
    '---',
    '',
    a.body.trim(),
    '',
    `*Sources: ${links}. First spotted via [${item.source}](${item.url}). Drafted with AI assistance from the manufacturer's information and reviewed by the Finevelo editors.*`,
    '',
  );
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
  const knownUrls = new Set(existing.flatMap((a) => a.urls));
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
  if (!picks.length) return;
  // Dry run: also look for the primary sources, but write nothing.
  if (DRY_RUN) {
    for (const p of picks) {
      const item = candidates[p.id];
      try {
        const found = await findPrimary(item);
        const primary = found.found ? await readPrimary(found) : [];
        log(`  ${primary.length ? '✓' : '✗'} ${item.title}: ${primary.length ? primary.map((pg) => pg.url).join(', ') : found.note || 'no readable primary source'}`);
      } catch (e) {
        log(`  ✗ ${item.title}: ${e.message}`);
      }
    }
    return;
  }

  // 3. Primary source, 4. write, 5. fact check, 6. copy check
  const taken = new Set(existing.map((a) => a.slug));
  const created = [];
  for (const p of picks) {
    const item = candidates[p.id];
    try {
      const found = await findPrimary(item);
      if (!found.found || !found.urls.length) {
        log(`  ✗ no primary source, skipped: ${item.title}${found.note ? ` (${found.note})` : ''}`);
        continue;
      }
      const primary = await readPrimary(found);
      if (!primary.length) {
        log(`  ✗ primary source not readable, skipped: ${item.title}`);
        continue;
      }
      const sourceText = primary.map((pg, i) => `[${i + 1}] ${pg.publisher} (${pg.kind}) ${pg.url}\n${pg.text}`).join('\n\n');
      const tip = `TIP: ${item.source} reported "${item.title}". Do not use the tip's wording or content.`;
      const brief = `Category: ${p.category}. Format: ${p.format}.\n${tip}\n\nPRIMARY SOURCE TEXT:\n${sourceText}`;
      let article = await ask(ArticleSchema, `${EDITORIAL}\n\n${WRITE_TASK}`, brief, { effort: 'high' });
      const qa = await ask(QaSchema, `${EDITORIAL}\n\n${QA_TASK}`, `PRIMARY SOURCE TEXT:\n${sourceText}\n\nDRAFT (JSON):\n${JSON.stringify(article)}`, { effort: 'high' });
      if (!qa.pass && !qa.fixed_body) {
        log(`  ✗ QA failed, skipped: ${item.title} — ${qa.issues.map((i) => i.problem).join('; ')}`);
        continue;
      }
      if (!qa.pass) {
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
      // Compare against everything the model saw: primary pages and the tip's headline and teaser.
      const compareWith = [...primary.map((pg) => pg.text), `${item.title}. ${item.summary}`];
      const fullText = (a) => [a.title, a.dek, a.description, a.body, ...a.faq.map((f) => `${f.q} ${f.a}`)].join('\n\n');
      let copy = copyCheck(fullText(article), compareWith);
      if (!copy.ok) {
        log(`    · copy check: longest run ${copy.longestRun} words, ${copy.share}% shared — rewriting`);
        article = await ask(
          ArticleSchema,
          `${EDITORIAL}\n\n${REWRITE_TASK}`,
          `COPIED PASSAGES:\n${copy.passages.map((x) => `- ${x}`).join('\n')}\n\nDRAFT (JSON):\n${JSON.stringify(article)}`,
          { effort: 'medium' },
        );
        copy = copyCheck(fullText(article), compareWith);
      }
      if (!copy.ok) {
        log(`  ✗ copy check failed twice, skipped: ${item.title} (longest run ${copy.longestRun} words)`);
        continue;
      }
      const slug = uniqueSlug(article.slug, taken);
      writeFileSync(`${ARTICLES}${slug}.md`, toMarkdown(article, item, primary));
      created.push(slug);
      log(`  ✓ draft: ${slug} — sources: ${primary.map((pg) => hostOf(pg.url)).join(', ')}${qa.pass ? '' : ' (corrected by QA)'}`);
    } catch (e) {
      log(`  ✗ ${item.title}: ${e.message}`);
    }
  }
  state.runs = [...(state.runs || []), { at: new Date().toISOString(), created: created.length }].slice(-30);
  if (created.length) log(`${created.length} draft(s) waiting for review in the backend.`);
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
