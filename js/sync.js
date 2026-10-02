/*
 * sync.js — compte par e-mail et sauvegarde en ligne (Supabase : authentification + une ligne JSON par utilisateur).
 * Appels REST directs, sans bibliothèque. Configuration dans js/config.js ; voir README, section « Compte ».
 */
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

const AUTH_KEY = 'consoler:auth';
function cfg() {
  let url = SUPABASE_URL, key = SUPABASE_ANON_KEY;
  try { // surcharge locale (tests, ou projet personnel sans modifier le code)
    const o = JSON.parse(localStorage.getItem('consoler:supabase') || 'null');
    if (o && o.url && o.key) { url = o.url; key = o.key; }
  } catch (e) { /* ignoré */ }
  return { url: String(url || '').replace(/\/+$/, ''), key: key || '' };
}
export const configured = () => { const c = cfg(); return !!(c.url && c.key); };

let session = null;
try { session = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null'); } catch (e) { session = null; }
function saveSession(s) {
  session = s;
  try { if (s) localStorage.setItem(AUTH_KEY, JSON.stringify(s)); else localStorage.removeItem(AUTH_KEY); } catch (e) { /* ignoré */ }
}
export const user = () => (session && session.user) || null;

async function call(path, { method = 'GET', body, auth = false, headers = {} } = {}) {
  const c = cfg();
  const h = { apikey: c.key, 'Content-Type': 'application/json', ...headers };
  if (auth) h.Authorization = `Bearer ${await accessToken()}`;
  const payload = body === undefined ? undefined : JSON.stringify(body);
  // keepalive (envoi même si l'application se ferme) est limité à 64 Ko par le navigateur
  const res = await fetch(c.url + path, { method, headers: h, body: payload, keepalive: method !== 'GET' && (payload || '').length < 60000 });
  const text = await res.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!res.ok) {
    const msg = (data && (data.msg || data.error_description || data.message || data.error)) || `erreur ${res.status}`;
    const err = new Error(msg); err.status = res.status; throw err;
  }
  return data;
}
function fromTokens(d, fallbackUser) {
  return {
    access_token: d.access_token, refresh_token: d.refresh_token,
    expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (Number(d.expires_in) || 3600),
    user: d.user ? { id: d.user.id, email: d.user.email } : fallbackUser,
  };
}
async function accessToken() {
  if (!session) throw new Error('non connecté');
  if (session.expires_at - 60 > Date.now() / 1000) return session.access_token;
  try {
    const d = await call('/auth/v1/token?grant_type=refresh_token', { method: 'POST', body: { refresh_token: session.refresh_token } });
    saveSession(fromTokens(d, session.user));
  } catch (e) {
    if (e.status === 400 || e.status === 401) saveSession(null); // session expirée : se reconnecter
    throw e;
  }
  return session.access_token;
}

// Étape 1 : un e-mail est envoyé (code à 6 chiffres et/ou lien de connexion)
export async function sendCode(email) {
  const back = location.origin + location.pathname;
  await call(`/auth/v1/otp?redirect_to=${encodeURIComponent(back)}`, { method: 'POST', body: { email, create_user: true } });
}
// Étape 2 : le code reçu par e-mail
export async function verifyCode(email, token) {
  let last = null;
  for (const type of ['email', 'magiclink', 'signup']) {
    try { const d = await call('/auth/v1/verify', { method: 'POST', body: { type, email, token } }); saveSession(fromTokens(d)); return user(); }
    catch (e) { last = e; }
  }
  throw last;
}
// Ou : retour par le lien de l'e-mail (#access_token=…)
export async function handleRedirect() {
  if (!location.hash.includes('access_token=')) return null;
  const p = new URLSearchParams(location.hash.slice(1));
  history.replaceState(null, '', location.pathname + location.search);
  const d = { access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: p.get('expires_in'), expires_at: Number(p.get('expires_at')) || 0 };
  saveSession(fromTokens(d, null));
  const u = await call('/auth/v1/user', { auth: true });
  session.user = { id: u.id, email: u.email }; saveSession(session);
  return user();
}
export function signOut() {
  const s = session;
  saveSession(null);
  if (s) fetch(`${cfg().url}/auth/v1/logout`, { method: 'POST', headers: { apikey: cfg().key, Authorization: `Bearer ${s.access_token}` } }).catch(() => {});
}

// Sauvegarde en ligne : une ligne par utilisateur dans la table « backups »
export async function pull() {
  const rows = await call(`/rest/v1/backups?select=data,updated_at&user_id=eq.${user().id}`, { auth: true });
  return rows && rows[0] ? rows[0].data : null;
}
export async function push(data) {
  await call('/rest/v1/backups', {
    method: 'POST', auth: true, headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: { user_id: user().id, data, updated_at: new Date().toISOString() },
  });
}
