// Supabase Edge Function "github": proxies the Finevelo backend's GitHub API calls.
// Only signed-in users whose email is in ALLOWED_EMAILS get through; the GitHub token never reaches the browser.
// Secrets (Edge Functions → Secrets): GITHUB_TOKEN (fine-grained PAT of the finevelo account), ALLOWED_EMAILS (comma-separated).
import { createClient } from 'jsr:@supabase/supabase-js@2';

const REPO = 'finevelo/finevelo.github.io';
const ORIGINS = ['https://www.finevelo.com', 'https://finevelo.com', 'https://finevelo.github.io', 'http://localhost:4321', 'http://localhost:4393'];

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin') ?? '';
  const cors = {
    'Access-Control-Allow-Origin': ORIGINS.includes(origin) ? origin : ORIGINS[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ message: 'Method not allowed' }, 405);

  // Who is calling?
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY') ?? req.headers.get('apikey') ?? '', {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data } = await supabase.auth.getUser();
  const email = data.user?.email?.toLowerCase();
  const allowed = (Deno.env.get('ALLOWED_EMAILS') ?? '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
  if (!email || !allowed.includes(email)) return json({ message: 'Dieses Konto ist nicht freigeschaltet.' }, 403);

  // What may they do? Only this one repository, plus GraphQL reads (the token itself is limited to the repo).
  let payload: { path?: string; method?: string; body?: unknown };
  try {
    payload = await req.json();
  } catch {
    return json({ message: 'Invalid JSON' }, 400);
  }
  const { path, method = 'GET', body } = payload;
  const okPath = typeof path === 'string' && (path === `/repos/${REPO}` || path.startsWith(`/repos/${REPO}/`) || path === '/graphql');
  if (!okPath || !['GET', 'POST', 'PUT', 'DELETE'].includes(method)) return json({ message: 'Not allowed' }, 400);

  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${Deno.env.get('GITHUB_TOKEN')}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'finevelo-admin',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  return new Response(res.status === 204 ? null : text, {
    status: res.status,
    headers: { ...cors, 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
});
