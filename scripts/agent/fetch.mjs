// Polite fetching for the Finevelo agent: robots.txt, TDM reservations and noai signals are respected.
// A page is only read if every check allows it. When in doubt, the answer is "no".

export const UA_TOKEN = 'FineveloBot';
export const UA = `Mozilla/5.0 (compatible; ${UA_TOKEN}/1.0; +https://www.finevelo.com/about/)`;
// Our text ends up with an AI model, so rules aimed at AI crawlers count for us too.
const AGENTS = [UA_TOKEN.toLowerCase(), 'claudebot', 'claude-user', 'anthropic-ai', 'claude-web'];

export async function fetchText(url, { timeoutMs = 20000, accept = '*/*' } = {}) {
  const res = await fetch(url, { headers: { 'User-Agent': UA, Accept: accept }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return { text: await res.text(), headers: res.headers, url: res.url || url };
}

// ---------- robots.txt (RFC 9309) ----------
function parseRobots(txt) {
  const groups = [];
  let current = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    const m = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const value = m[2].trim();
    if (key === 'user-agent') {
      if (!lastWasAgent) groups.push((current = { agents: [], rules: [] }));
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
    } else {
      lastWasAgent = false;
      if (current && (key === 'allow' || key === 'disallow')) current.rules.push({ allow: key === 'allow', path: value });
    }
  }
  return groups;
}

const ruleMatches = (pattern, path) => {
  if (!pattern) return false;
  const anchored = pattern.endsWith('$');
  const body = anchored ? pattern.slice(0, -1) : pattern;
  const re = '^' + body.split('*').map((x) => x.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + (anchored ? '$' : '');
  return new RegExp(re).test(path);
};

// Usage terms in robots.txt beyond allow/disallow: Cloudflare Content Signals and licence pointers.
// ai-input=no forbids exactly what we do (feeding text to a model); an unknown licence counts as "no".
function usageRestriction(txt) {
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim().toLowerCase();
    if (line.startsWith('content-signal:') && /ai-input\s*=\s*no/.test(line)) return 'Content-Signal ai-input=no';
    if (/^(tdl|license|licence|tdm-policy)\s*:/.test(line)) return `licence terms in robots.txt (${line.split(':')[0]})`;
  }
  return null;
}

// Decision for one agent: the longest matching rule wins, allow wins a tie.
function allowedFor(groups, agent, path) {
  let rules = groups.filter((g) => g.agents.some((a) => a !== '*' && agent.includes(a))).flatMap((g) => g.rules);
  if (!rules.length) rules = groups.filter((g) => g.agents.includes('*')).flatMap((g) => g.rules);
  let best = null;
  for (const r of rules) {
    if (!ruleMatches(r.path, path)) continue;
    if (!best || r.path.length > best.path.length || (r.path.length === best.path.length && r.allow)) best = r;
  }
  return !best || best.allow;
}

const robotsCache = new Map();
async function robotsFor(origin) {
  if (!robotsCache.has(origin)) {
    robotsCache.set(
      origin,
      (async () => {
        try {
          const res = await fetch(`${origin}/robots.txt`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(15000) });
          if (res.status === 404 || res.status === 410) return { groups: [] }; // no robots.txt: no restrictions
          if (res.status === 401 || res.status === 403 || res.status === 429) return { error: `robots.txt refused (HTTP ${res.status}), site blocks bots` };
          if (!res.ok) return { error: `robots.txt HTTP ${res.status}` };
          const txt = await res.text();
          return { groups: parseRobots(txt), restriction: usageRestriction(txt) };
        } catch (e) {
          return { error: `robots.txt unreachable (${e.message})` };
        }
      })(),
    );
  }
  return robotsCache.get(origin);
}

// Machine-readable TDM reservation (W3C TDMRep) at /.well-known/tdmrep.json
const tdmCache = new Map();
async function tdmRepFor(origin) {
  if (!tdmCache.has(origin)) {
    tdmCache.set(
      origin,
      (async () => {
        try {
          const res = await fetch(`${origin}/.well-known/tdmrep.json`, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) });
          if (!res.ok) return [];
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        } catch {
          return [];
        }
      })(),
    );
  }
  return tdmCache.get(origin);
}

export async function robotsAllows(url) {
  const u = new URL(url);
  const robots = await robotsFor(u.origin);
  if (robots.error) return { ok: false, reason: robots.error };
  if (robots.restriction) return { ok: false, reason: robots.restriction };
  const path = u.pathname + u.search;
  const blocked = AGENTS.filter((a) => !allowedFor(robots.groups, a, path));
  if (blocked.length) return { ok: false, reason: `robots.txt blocks ${blocked.join(', ')}` };
  const tdm = await tdmRepFor(u.origin);
  const reserved = tdm.find((r) => String(r['tdm-reservation']) === '1' && ruleMatches(String(r.location || '/*'), path));
  if (reserved) return { ok: false, reason: 'TDM reservation (tdmrep.json)' };
  return { ok: true };
}

// Page-level signals: TDM-Reservation header/meta, noai in X-Robots-Tag or meta robots.
function pageOptOut(html, headers) {
  if (headers.get('tdm-reservation') === '1') return 'TDM reservation header';
  const xr = (headers.get('x-robots-tag') || '').toLowerCase();
  if (/\bnoai\b/.test(xr)) return 'X-Robots-Tag noai';
  const metas = html.match(/<meta[^>]+>/gi) || [];
  for (const m of metas) {
    const name = (m.match(/name\s*=\s*["']([^"']+)/i) || [])[1]?.toLowerCase();
    const content = (m.match(/content\s*=\s*["']([^"']*)/i) || [])[1]?.toLowerCase() || '';
    if (name === 'tdm-reservation' && content.trim() === '1') return 'TDM reservation meta tag';
    if ((name === 'robots' || AGENTS.includes(name)) && /\bnoai\b/.test(content)) return 'meta robots noai';
  }
  return null;
}

export const decode = (s = '') =>
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
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const tag = (xml, name) => {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? m[1] : '';
};

// Readable text of a page, only if robots.txt and the page itself allow it.
export async function readAllowedPage(url) {
  const check = await robotsAllows(url);
  if (!check.ok) throw new Error(check.reason);
  const { text: html, headers, url: finalUrl } = await fetchText(url, { timeoutMs: 30000, accept: 'text/html,*/*' });
  if (new URL(finalUrl).origin !== new URL(url).origin) {
    const again = await robotsAllows(finalUrl);
    if (!again.ok) throw new Error(`after redirect: ${again.reason}`);
  }
  const optOut = pageOptOut(html, headers);
  if (optOut) throw new Error(optOut);
  const main = tag(html, 'article') || tag(html, 'main') || html;
  return decode(main.replace(/<(script|style|nav|footer|header|aside|form|noscript)[\s\S]*?<\/\1>/gi, ' ')).slice(0, 40000);
}
