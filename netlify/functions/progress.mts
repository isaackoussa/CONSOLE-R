import type { Config } from "@netlify/functions";
import { authenticate, json, saveProfile, states, type Summary } from "../lib/common.mts";

const MAX_BYTES = 4_000_000;

// PUT { state, summary } : sauvegarde de la progression complète
export default async (req: Request) => {
  if (req.method !== "PUT") return json(405, { error: "method_not_allowed" });
  const auth = await authenticate(req);
  if (auth instanceof Response) return auth;
  const { profile, email } = auth;

  const raw = await req.text();
  if (raw.length > MAX_BYTES) return json(413, { error: "too_large" });
  let body: { state?: Record<string, unknown>; summary?: Summary };
  try {
    body = JSON.parse(raw);
  } catch {
    return json(400, { error: "bad_request" });
  }
  if (!body.state) return json(400, { error: "bad_request" });

  const updatedAt = new Date().toISOString();
  await states().setJSON(email, body.state);
  profile.summary = body.summary ?? profile.summary;
  profile.updatedAt = updatedAt;
  profile.lastSeen = updatedAt;
  await saveProfile(profile);
  return json(200, { ok: true, updatedAt });
};

export const config: Config = { path: "/api/progress" };
