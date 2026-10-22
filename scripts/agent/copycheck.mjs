// Mechanical copy check: does the draft reuse word sequences from a source?
// Tables, headings and numbers-only runs are ignored; spec values may match by nature.

const N = 8; // words per sequence
export const LIMITS = { longestRun: 12, sharedShare: 0.04 };

const words = (text) =>
  text
    .toLowerCase()
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[’‘]/g, "'")
    .match(/[\p{L}\p{N}][\p{L}\p{N}'.-]*/gu) || [];

// Prose only: drop Markdown tables, headings and the source footer.
const prose = (md) =>
  md
    .split('\n')
    .filter((l) => !/^\s*(\||#|\*source|\*sources)/i.test(l))
    .join('\n');

const isNumeric = (ws) => ws.filter((w) => /\d/.test(w)).length >= ws.length / 2;

export function copyCheck(draft, sources) {
  const d = words(prose(draft));
  const grams = new Set();
  for (const s of sources) {
    const w = words(s);
    for (let i = 0; i + N <= w.length; i++) grams.add(w.slice(i, i + N).join(' '));
  }
  const hits = [];
  let shared = 0;
  let total = 0;
  for (let i = 0; i + N <= d.length; i++) {
    const g = d.slice(i, i + N);
    if (isNumeric(g)) continue;
    total++;
    if (grams.has(g.join(' '))) {
      shared++;
      hits.push(i);
    }
  }
  // Merge overlapping hits into runs of copied words.
  const runs = [];
  for (const i of hits) {
    const last = runs[runs.length - 1];
    if (last && i <= last.end) last.end = i + N;
    else runs.push({ start: i, end: i + N });
  }
  const passages = runs.map((r) => d.slice(r.start, r.end).join(' '));
  const longestRun = runs.reduce((m, r) => Math.max(m, r.end - r.start), 0);
  const share = total ? shared / total : 0;
  return {
    ok: longestRun < LIMITS.longestRun && share < LIMITS.sharedShare,
    longestRun,
    share: Math.round(share * 1000) / 10,
    passages: passages.filter((p) => p.split(' ').length >= 10),
  };
}
