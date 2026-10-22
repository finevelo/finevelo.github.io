// Thin GitHub API client for the Finevelo backend. Everything is stored in the repo.
// Normal path: calls go through the Supabase function "github", which holds the token.
// Emergency path: a personal GitHub token typed into the login page talks to GitHub directly.
import sodium from 'libsodium-wrappers';
import * as auth from './auth.js';

export const REPO = 'finevelo/finevelo.github.io';
export const BRANCH = 'main';
const API = 'https://api.github.com';
const KEY = 'fv-admin-token';

let token = '';
try {
  token = sessionStorage.getItem(KEY) || localStorage.getItem(KEY) || '';
} catch {}

export const hasToken = () => Boolean(token);
export const signedIn = () => hasToken() || auth.signedIn();

export function setToken(value, remember) {
  token = value;
  try {
    sessionStorage.setItem(KEY, value);
    if (remember) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
  } catch {}
}

export function signOut() {
  token = '';
  auth.signOut();
  try {
    sessionStorage.removeItem(KEY);
    localStorage.removeItem(KEY);
  } catch {}
}

export class GitHubError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function send(path, method, body) {
  if (token || !auth.configured)
    return fetch(`${API}${path}`, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  return fetch(auth.FUNCTION_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${await auth.accessToken()}`, apikey: auth.KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, method, body }),
  });
}

async function request(path, { method = 'GET', body, raw = false } = {}) {
  let res;
  try {
    res = await send(path, method, body);
  } catch {
    throw new GitHubError(0, 'Keine Verbindung zum Server. Bitte Internet prüfen und neu laden.');
  }
  if (res.status === 404) return null;
  if (!res.ok) {
    let msg = `${res.status}`;
    try {
      msg = (await res.json()).message || msg;
    } catch {}
    if (res.status === 401) msg = token ? 'Token ungültig oder abgelaufen.' : 'Sitzung abgelaufen. Bitte neu anmelden.';
    if (res.status === 403) msg = token ? `Keine Berechtigung (${msg}). Fehlt dem Token ein Recht?` : msg === 'Dieses Konto ist nicht freigeschaltet.' ? msg : `Keine Berechtigung (${msg}).`;
    if (res.status === 409) msg = 'Die Datei wurde inzwischen geändert. Bitte neu laden.';
    throw new GitHubError(res.status, msg);
  }
  if (res.status === 204 || raw) return res;
  return res.json();
}

const repo = (p) => `/repos/${REPO}${p}`;

// UTF-8 safe base64
const toB64 = (text) => {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromB64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\n/g, '')), (c) => c.charCodeAt(0)));

export const checkAccess = () => request(repo(''));

export async function getFile(path) {
  const f = await request(repo(`/contents/${encodeURI(path)}?ref=${BRANCH}`));
  return f ? { text: fromB64(f.content), sha: f.sha } : null;
}

export async function putFile(path, text, sha, message) {
  const r = await request(repo(`/contents/${encodeURI(path)}`), {
    method: 'PUT',
    body: { message, content: toB64(text), branch: BRANCH, ...(sha ? { sha } : {}) },
  });
  return r.content.sha;
}

export async function putBinary(path, base64, message) {
  const existing = await request(repo(`/contents/${encodeURI(path)}?ref=${BRANCH}`));
  await request(repo(`/contents/${encodeURI(path)}`), {
    method: 'PUT',
    body: { message, content: base64, branch: BRANCH, ...(existing ? { sha: existing.sha } : {}) },
  });
}

export const deleteFile = (path, sha, message) =>
  request(repo(`/contents/${encodeURI(path)}`), { method: 'DELETE', body: { message, sha, branch: BRANCH } });

// All files of a folder with their text, in one GraphQL request.
export async function readFolder(folder) {
  const query = `query($owner:String!,$name:String!,$expr:String!){repository(owner:$owner,name:$name){object(expression:$expr){... on Tree{entries{name oid object{... on Blob{text}}}}}}}`;
  const [owner, name] = REPO.split('/');
  const res = await request('/graphql', {
    method: 'POST',
    body: { query, variables: { owner, name, expr: `${BRANCH}:${folder}` } },
  });
  if (res.errors) throw new GitHubError(400, res.errors[0].message);
  return (res.data.repository.object?.entries || []).map((e) => ({ name: e.name, sha: e.oid, text: e.object?.text ?? '' }));
}

export async function readJson(path) {
  const f = await getFile(path);
  return f ? { data: JSON.parse(f.text), sha: f.sha } : { data: null, sha: null };
}

export const writeJson = (path, data, sha, message) => putFile(path, JSON.stringify(data, null, 2) + '\n', sha, message);

// ---- Actions ----
export const listRuns = (workflow, n = 10) => request(repo(`/actions/workflows/${workflow}/runs?per_page=${n}`));
export const dispatch = (workflow, inputs) =>
  request(repo(`/actions/workflows/${workflow}/dispatches`), { method: 'POST', body: { ref: BRANCH, inputs } });

// ---- Secrets ----
export const getSecret = (name) => request(repo(`/actions/secrets/${name}`));

export async function setSecret(name, value) {
  await sodium.ready;
  const pk = await request(repo('/actions/secrets/public-key'));
  const sealed = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(pk.key, sodium.base64_variants.ORIGINAL));
  await request(repo(`/actions/secrets/${name}`), {
    method: 'PUT',
    body: { encrypted_value: sodium.to_base64(sealed, sodium.base64_variants.ORIGINAL), key_id: pk.key_id },
  });
}
