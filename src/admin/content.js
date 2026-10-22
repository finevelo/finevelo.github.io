// Read and write article Markdown files (YAML frontmatter + body) in the same shape as src/content.config.ts.
import yaml from 'js-yaml';

export const ARTICLES_DIR = 'src/content/articles';
export const SETTINGS_PATH = 'config/agent.json';
export const SOURCES_PATH = 'config/sources.json';

export const CATEGORIES = { road: 'Road', gravel: 'Gravel', mtb: 'MTB', 'e-bike': 'E-Bike', components: 'Components', custom: 'Custom & Craft' };
export const FORMATS = { 'launch-brief': 'Launch Brief', 'the-edit': 'The Edit', 'deep-dive': 'Deep Dive', 'pro-bike-check': 'Pro Bike Check' };
export const LICENSES = [
  { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' },
  { name: 'CC BY 4.0', url: 'https://creativecommons.org/licenses/by/4.0/' },
  { name: 'CC BY-SA 3.0', url: 'https://creativecommons.org/licenses/by-sa/3.0/' },
  { name: 'CC0 1.0', url: 'https://creativecommons.org/publicdomain/zero/1.0/' },
  { name: 'Unsplash License', url: 'https://unsplash.com/license' },
  { name: 'Pexels License', url: 'https://www.pexels.com/license/' },
  { name: 'Pressebild mit Freigabe', url: '' },
];

export function parseArticle(name, text, sha) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  const data = m ? yaml.load(m[1]) || {} : {};
  return { slug: name.replace(/\.md$/, ''), sha, data, body: (m ? m[2] : text).replace(/^\n+/, '') };
}

const clean = (v) => {
  if (Array.isArray(v)) return v.map(clean).filter((x) => x !== undefined);
  if (v && typeof v === 'object' && !(v instanceof Date)) {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      const c = clean(x);
      if (c !== undefined) out[k] = c;
    }
    return Object.keys(out).length ? out : undefined;
  }
  if (v === '' || v === null || v === undefined) return undefined;
  return v;
};

// Fixed key order so diffs stay readable.
const ORDER = ['title', 'seoTitle', 'description', 'dek', 'pubDate', 'updatedDate', 'category', 'format', 'author', 'draft', 'featured', 'bike', 'disclosure', 'hero', 'specs', 'source', 'tags', 'faq', 'sample'];

export function serializeArticle({ data, body }) {
  const d = clean({ ...data });
  const ordered = {};
  for (const k of ORDER) if (d[k] !== undefined) ordered[k] = d[k];
  for (const k of Object.keys(d)) if (!(k in ordered)) ordered[k] = d[k];
  // draft:false and featured:false are meaningful; keep booleans even when false
  if (data.draft !== undefined) ordered.draft = Boolean(data.draft);
  const front = yaml.dump(ordered, { lineWidth: -1, noRefs: true, quotingType: '"' });
  return `---\n${front}---\n\n${body.trim()}\n`;
}

export function slugify(s) {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'artikel'
  );
}

export const isDraft = (a) => a.data.draft === true;

export function validate(a) {
  const d = a.data;
  const errors = [];
  if (!d.title) errors.push('Titel fehlt.');
  if (!d.description) errors.push('Meta-Beschreibung fehlt.');
  if (d.description && d.description.length > 170) errors.push('Meta-Beschreibung ist länger als 170 Zeichen.');
  if (d.seoTitle && d.seoTitle.length > 60) errors.push('SEO-Titel ist länger als 60 Zeichen.');
  if (!d.category) errors.push('Rubrik fehlt.');
  if (!d.format) errors.push('Format fehlt.');
  if (!d.pubDate) errors.push('Datum fehlt.');
  if (!d.hero?.alt) errors.push('Alt-Text fürs Titelbild fehlt.');
  if (d.hero?.src && !d.hero?.credit) errors.push('Bild ohne Credit: Urheber angeben.');
  if (d.hero?.src && !d.hero?.license?.name) errors.push('Bild ohne Lizenz.');
  if (!a.body.trim()) errors.push('Text fehlt.');
  return errors;
}

// Next run time from the agent schedule (hourly trigger at :07).
export function nextRun(settings, from = new Date()) {
  if (!settings?.enabled) return null;
  const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: settings.timezone || 'Europe/Berlin', weekday: 'short', hour: '2-digit', hourCycle: 'h23' });
  const t = new Date(from);
  t.setMinutes(7, 0, 0);
  if (t <= from) t.setHours(t.getHours() + 1);
  for (let i = 0; i < 24 * 8; i++, t.setHours(t.getHours() + 1)) {
    const p = Object.fromEntries(fmt.formatToParts(t).map((x) => [x.type, x.value]));
    if (settings.days.includes(p.weekday.toLowerCase().slice(0, 3)) && settings.times.some((s) => s.slice(0, 2) === p.hour)) return new Date(t);
  }
  return null;
}
