import type { Config } from "@netlify/functions";
import { authenticate, hash, json, saveProfile, sessions, states } from "../lib/common.mts";

// GET : compte + progression sauvegardée (?state=1) · DELETE : déconnexion de cet appareil
export default async (req: Request) => {
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { profile } = auth;

  if (req.method === "DELETE") {
    const token = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
    await sessions().delete(hash(token));
    return json(200, { ok: true });
  }
  if (req.method !== "GET") return json(405, { error: "method_not_allowed" });

  profile.lastSeen = new Date().toISOString();
  await saveProfile(profile);
  const withState = new URL(req.url).searchParams.get("state") === "1";
  return json(200, {
    email: profile.email,
    updatedAt: profile.updatedAt,
    state: withState ? await states().get(profile.email, { type: "json" }) : undefined,
  });
};

export const config: Config = { path: "/api/me" };
