/*
 * cloud.js — compte Console R : connexion par code e-mail (Brevo) et progression sauvegardée en ligne
 * (fonctions Netlify + Netlify Blobs), sur le modèle d'Éloquence. Sans serveur (GitHub Pages, local),
 * available() renvoie false et l'application fonctionne sans compte.
 */
const SESSION_KEY = 'consoler:session';

let session = null;
try { session = JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch (e) { session = null; }
function setSession(s) {
  session = s;
  try { if (s) localStorage.setItem(SESSION_KEY, JSON.stringify(s)); else localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignoré */ }
}
export const user = () => (session ? { email: session.email } : null);

export class ApiError extends Error {
  constructor(status, code, data = {}) { super(code); this.status = status; this.code = code; this.data = data; }
}

async function api(path, init = {}) {
  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (session) headers.set('Authorization', `Bearer ${session.token}`);
  let res;
  try { res = await fetch(`./api/${path}`, { ...init, headers }); } catch (e) { throw new ApiError(0, 'network'); }
  // Hébergement sans fonctions serveur (GitHub Pages, serveur local) : pas de réponse JSON
  if (!(res.headers.get('content-type') || '').includes('application/json')) throw new ApiError(res.status, 'no_server');
  const data = await res.json();
  if (!res.ok) {
    if (res.status === 401 && session) setSession(null); // session expirée : se reconnecter
    throw new ApiError(res.status, String(data.error || 'error'), data);
  }
  return data;
}

// Le serveur répond-il ? (une seule vérification par lancement)
let probe = null;
export function available() {
  if (!probe) {
    probe = fetch('./api/me', { headers: session ? { Authorization: `Bearer ${session.token}` } : {} })
      .then((r) => (r.headers.get('content-type') || '').includes('application/json'))
      .catch(() => !!session); // hors ligne : on garde le compte si l'on était connecté
  }
  return probe;
}

const ERRORS = {
  network: 'Connexion impossible. Vérifiez votre connexion internet.',
  no_server: 'Le compte en ligne n’est pas disponible sur cette version de l’application.',
  mail_not_configured: 'L’envoi d’e-mails n’est pas encore configuré (BREVO_API_KEY et MAIL_FROM dans Netlify).',
  mail_send_failed: 'L’e-mail n’a pas pu être envoyé. Vérifiez l’adresse et réessayez.',
  invalid_email: 'Cette adresse e-mail n’est pas valide.',
  too_soon: 'Patientez 30 secondes avant de redemander un code.',
  no_code: 'Aucun code en cours pour cette adresse : redemandez un code.',
  expired: 'Ce code a expiré : redemandez un code.',
  wrong_code: 'Code incorrect.',
  too_many_attempts: 'Trop d’essais : redemandez un nouveau code.',
  blocked: 'Ce compte est suspendu.',
  bad_request: 'Le code doit comporter 6 chiffres.',
};
export function errorText(e) {
  if (e instanceof ApiError) {
    if (e.code === 'wrong_code' && typeof e.data.remaining === 'number') {
      const n = e.data.remaining;
      return `Code incorrect (${n} essai${n > 1 ? 's' : ''} restant${n > 1 ? 's' : ''}).`;
    }
    return ERRORS[e.code] || `Erreur (${e.status}).`;
  }
  return String((e && e.message) || e || 'Erreur inattendue.');
}

export const sendCode = (email) => api('auth/send-code', { method: 'POST', body: JSON.stringify({ email }) });

// Renvoie la progression sauvegardée en ligne (ou null pour un nouveau compte)
export async function verifyCode(email, code) {
  const res = await api('auth/verify', { method: 'POST', body: JSON.stringify({ email, code }) });
  setSession({ email: res.email, token: res.token });
  return { state: res.state || null, isNew: res.isNew };
}
export async function pull() { return (await api('me?state=1')).state || null; }
export async function push(state, summary) {
  return api('progress', { method: 'PUT', body: JSON.stringify({ state, summary }), keepalive: JSON.stringify(state).length < 60000 });
}
export async function logout() {
  try { if (session) await api('me', { method: 'DELETE' }); } catch (e) { /* session déjà expirée */ }
  setSession(null);
}
