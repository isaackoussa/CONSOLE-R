import type { Config } from "@netlify/functions";
import { cleanEmail, env, json, profiles, readJson, saveProfile, states, type Profile } from "../lib/common.mts";
import { timingSafeEqual } from "node:crypto";

// Console admin (page admin.html, séparée de l'application) : utilisateurs, progression, blocage, suppression.
function authorized(req: Request): boolean {
  const key = env("ADMIN_KEY");
  const given = req.headers.get("x-admin-key") ?? "";
  if (!key || !given) return false;
  const a = Buffer.from(key), b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

export default async (req: Request) => {
  if (!env("ADMIN_KEY")) return json(503, { error: "admin_not_configured" });
  if (!authorized(req)) return json(401, { error: "unauthorized" });

  if (req.method === "POST") {
    const body = await readJson<{ email?: string; action?: "block" | "unblock" | "delete" }>(req);
    const email = cleanEmail(body?.email);
    const p = (await profiles().get(email, { type: "json" })) as Profile | null;
    if (!p) return json(404, { error: "not_found" });
    if (body?.action === "delete") {
      // supprime le compte et sa progression ; ses sessions deviennent invalides (profil introuvable)
      await states().delete(email);
      await profiles().delete(email);
      return json(200, { ok: true });
    }
    if (body?.action !== "block" && body?.action !== "unblock") return json(400, { error: "bad_request" });
    p.blocked = body.action === "block";
    await saveProfile(p);
    return json(200, { ok: true });
  }
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" });

  const { blobs } = await profiles().list();
  const list = await Promise.all(blobs.map(({ key }) => profiles().get(key, { type: "json" }) as Promise<Profile | null>));
  const users = list
    .filter((p): p is Profile => !!p)
    .map((p) => ({
      email: p.email,
      createdAt: p.createdAt,
      lastSeen: p.lastSeen,
      updatedAt: p.updatedAt,
      opens: p.opens,
      blocked: !!p.blocked,
      summary: p.summary,
    }))
    .sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
  return json(200, { users });
};

export const config: Config = { path: "/api/admin" };
