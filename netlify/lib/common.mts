// Fonctions partagées par les fonctions Netlify de Console R (même principe qu'Éloquence et Anglais 365).
import { getStore } from "@netlify/blobs";
import { createHash, randomBytes } from "node:crypto";

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const SESSION_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000; // 1 an

export interface Summary {
  scripts: number; // scripts enregistrés
  tabs: number; // onglets ouverts
  history: number; // entrées d'historique
  packages: number; // paquets installés
}

export interface Profile {
  email: string;
  createdAt: string;
  lastSeen: string;
  opens: number;
  blocked?: boolean;
  summary: Summary | null;
  updatedAt: string | null; // dernière sauvegarde de progression
}

/** Magasin Netlify Blobs, isolé entre production et aperçus. */
export function store(name: string) {
  const ctx = (globalThis as { Netlify?: { context?: { deploy?: { context?: string } } } }).Netlify?.context?.deploy?.context;
  const full = ctx && ctx !== "production" ? `preview-${name}` : name;
  const siteID = env("NETLIFY_SITE_ID");
  const token = env("NETLIFY_BLOBS_TOKEN");
  // Contournement si l'accès automatique aux Blobs n'est pas injecté
  if (siteID && token) return getStore({ name: full, siteID, token, consistency: "strong" });
  return getStore({ name: full, consistency: "strong" });
}

export const profiles = () => store("cr-profiles");
export const states = () => store("cr-states");
export const sessions = () => store("cr-sessions");
export const codes = () => store("cr-codes");

export function env(name: string): string | undefined {
  const n = (globalThis as { Netlify?: { env: { get(k: string): string | undefined } } }).Netlify;
  return n?.env.get(name) ?? process.env[name];
}

export function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export const cleanEmail = (e: unknown) => String(e ?? "").trim().toLowerCase();

export async function readJson<T>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}

/** Vérifie le jeton « Authorization: Bearer … ». */
export async function authenticate(req: Request): Promise<{ email: string; profile: Profile } | Response> {
  const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) return json(401, { error: "no_session" });
  const session = (await sessions().get(hash(token), { type: "json" })) as { email: string; createdAt: string } | null;
  if (!session || Date.now() - new Date(session.createdAt).getTime() > SESSION_MAX_AGE_MS) {
    return json(401, { error: "invalid_session" });
  }
  const profile = (await profiles().get(session.email, { type: "json" })) as Profile | null;
  if (!profile) return json(401, { error: "invalid_session" });
  if (profile.blocked) return json(403, { error: "blocked" });
  return { email: session.email, profile };
}

export async function saveProfile(p: Profile) {
  await profiles().setJSON(p.email, p);
}
