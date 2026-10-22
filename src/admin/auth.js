// Sign-in for the backend: Supabase Auth (email + password, login link, reset).
// The GitHub token lives only in the Supabase function; the browser holds a Supabase session.
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_KEY } from './supabase.config.js';

export const KEY = SUPABASE_KEY;
export const configured = Boolean(SUPABASE_URL && SUPABASE_KEY);
export const FUNCTION_URL = configured ? `${SUPABASE_URL}/functions/v1/github` : '';
const REDIRECT = `${location.origin}/admin/`;

export const supabase = configured
  ? createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: true, detectSessionInUrl: true, flowType: 'implicit' } })
  : null;

let session = null;
// Set when the user arrives from a "reset password" mail; the app then asks for a new password.
export let recovering = /type=recovery/.test(location.hash);

export async function init() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  session = data.session;
  supabase.auth.onAuthStateChange((event, s) => {
    session = s;
    if (event === 'PASSWORD_RECOVERY') recovering = true;
  });
  // Tokens from a login link sit in the URL hash; clear them once the session is stored.
  if (/access_token=|error_description=/.test(location.hash)) history.replaceState(null, '', `${location.pathname}${recovering ? '#/password' : '#/'}`);
  return session;
}

export const signedIn = () => Boolean(session);
export const email = () => session?.user?.email ?? '';

export async function accessToken() {
  const { data } = await supabase.auth.getSession();
  session = data.session;
  return session?.access_token ?? '';
}

const msg = (error) => {
  const m = error?.message || String(error);
  if (/invalid login credentials/i.test(m)) return 'E-Mail oder Passwort stimmt nicht.';
  if (/email not confirmed/i.test(m)) return 'Die E-Mail-Adresse ist noch nicht bestätigt.';
  if (/rate limit|only request this after/i.test(m)) return 'Zu viele Versuche. Bitte kurz warten.';
  if (/signups not allowed|user not found/i.test(m)) return 'Für diese Adresse gibt es keinen Zugang.';
  if (/password should be|weak/i.test(m)) return 'Das Passwort ist zu schwach (mindestens 10 Zeichen).';
  if (/same.*password/i.test(m)) return 'Das neue Passwort muss sich vom alten unterscheiden.';
  return m;
};
const check = ({ data, error }) => {
  if (error) throw new Error(msg(error));
  return data;
};

export async function signInWithPassword(mail, password) {
  const data = check(await supabase.auth.signInWithPassword({ email: mail, password }));
  session = data.session;
}
// shouldCreateUser:false: a login link never creates new accounts.
export const sendLoginLink = async (mail) =>
  check(await supabase.auth.signInWithOtp({ email: mail, options: { shouldCreateUser: false, emailRedirectTo: REDIRECT } }));
export const sendReset = async (mail) => check(await supabase.auth.resetPasswordForEmail(mail, { redirectTo: REDIRECT }));
export async function setPassword(password) {
  check(await supabase.auth.updateUser({ password }));
  recovering = false;
}
export async function signOut() {
  session = null;
  if (supabase) await supabase.auth.signOut().catch(() => {});
}
