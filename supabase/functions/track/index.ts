// Supabase Edge Function "track": records one page view for Finevelo's own analytics.
// No cookies, nothing stored on the device. The IP address is only used, together with the browser string and a
// salt that changes daily, to build a short hash for counting unique visitors; the IP itself is never stored.
// Deploy with "Verify JWT" switched off: readers are not signed in.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const ORIGINS = ['https://www.finevelo.com', 'https://finevelo.com', 'http://localhost:4321', 'http://localhost:4393'];
const OWN_HOSTS = ['www.finevelo.com', 'finevelo.com', 'localhost'];
const BOTS = /bot|crawl|spider|slurp|preview|headless|lighthouse|pingdom|uptime|monitor|curl|wget|python|httpclient|facebookexternalhit|embedly|quora|whatsapp|telegram/i;

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

const berlinDay = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date());

async function saltFor(day: string) {
  const { data } = await db.from('fv_salts').select('salt').eq('day', day).maybeSingle();
  if (data) return data.salt as string;
  const salt = crypto.randomUUID() + crypto.randomUUID();
  await db.from('fv_salts').upsert({ day, salt }, { onConflict: 'day', ignoreDuplicates: true });
  const again = await db.from('fv_salts').select('salt').eq('day', day).single();
  return again.data!.salt as string;
}

async function hash(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].slice(0, 10).map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') ?? '';
  const cors = { 'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0], Vary: 'Origin' };
  const done = (status = 204) => new Response(null, { status, headers: cors });
  if (req.method === 'OPTIONS') return new Response(null, { headers: { ...cors, 'Access-Control-Allow-Methods': 'POST', 'Access-Control-Allow-Headers': 'content-type' } });
  if (req.method !== 'POST' || !ORIGINS.includes(origin)) return done(400);

  const ua = req.headers.get('User-Agent') ?? '';
  if (!ua || BOTS.test(ua)) return done();

  let body: { p?: string; r?: string; w?: number };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return done(400);
  }
  let url: URL;
  try {
    url = new URL(String(body.p ?? ''), 'https://www.finevelo.com');
  } catch {
    return done(400);
  }
  const path = url.pathname.slice(0, 200);
  if (!path.startsWith('/') || path.startsWith('/admin')) return done();

  let ref = (url.searchParams.get('utm_source') ?? url.searchParams.get('ref') ?? '').toLowerCase().slice(0, 60);
  if (!ref && body.r) {
    try {
      const host = new URL(body.r).hostname.replace(/^www\./, '');
      if (!OWN_HOSTS.includes(host) && !OWN_HOSTS.includes(`www.${host}`)) ref = host.slice(0, 100);
    } catch {}
  }

  const w = Number(body.w) || 0;
  const device = w && w < 768 ? 'mobile' : w && w < 1100 ? 'tablet' : 'desktop';
  const lang = (req.headers.get('Accept-Language') ?? '').slice(0, 2).toLowerCase().replace(/[^a-z]/g, '');
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim();
  const day = berlinDay();
  const visitor = await hash(`${await saltFor(day)}|${ip}|${ua}`);

  await db.from('fv_pageviews').insert({ path, ref, visitor, device, lang });

  // Housekeeping now and then: salts older than two days go, page views after 13 months.
  if (Math.random() < 0.02) {
    const cutoff = new Date(Date.now() - 2 * 86400e3).toISOString().slice(0, 10);
    await db.from('fv_salts').delete().lt('day', cutoff);
    await db.from('fv_pageviews').delete().lt('ts', new Date(Date.now() - 400 * 86400e3).toISOString());
  }
  return done();
});
