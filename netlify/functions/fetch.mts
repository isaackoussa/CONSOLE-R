import type { Config } from "@netlify/functions";
import { env, json, store } from "../lib/common.mts";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

// Relais de téléchargement pour R : read.csv("https://…"), download.file(), scan(url)…
// Le navigateur bloque la plupart des sites de données (CORS) ; ici le serveur télécharge à la place de R.
const MAX_BYTES = 20 * 1024 * 1024;
const PER_HOUR = 300; // requêtes par adresse IP et par heure

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === "::1" || v === "::" || v.startsWith("fc") || v.startsWith("fd") || v.startsWith("fe80")) return true;
    const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return m ? privateIp(m[1]) : false;
  }
  const [a, b] = ip.split(".").map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function allowed(target: URL): Promise<boolean> {
  if (!["http:", "https:"].includes(target.protocol)) return false;
  if (target.username || target.password) return false;
  const host = target.hostname.replace(/^\[|\]$/g, "");
  const testing = env("FETCH_ALLOW_PRIVATE") === "1"; // réservé au serveur de test local (faux site sur localhost)
  if (!testing && /^(localhost|.*\.local|.*\.internal)$/i.test(host)) return false;
  const ips = isIP(host) ? [host] : (await lookup(host, { all: true }).catch(() => [])).map((r) => r.address);
  return ips.length > 0 && (testing || !ips.some(privateIp));
}

async function rateLimited(req: Request, context: { ip?: string }): Promise<boolean> {
  try {
    const ip = context.ip || req.headers.get("x-nf-client-connection-ip") || "inconnu";
    const key = `${ip}:${new Date().toISOString().slice(0, 13)}`;
    const s = store("cr-fetch-rate");
    const n = Number((await s.get(key)) || 0) + 1;
    await s.set(key, String(n));
    return n > PER_HOUR;
  } catch {
    return false; // le compteur ne doit jamais bloquer un téléchargement légitime
  }
}

export default async (req: Request, context: { ip?: string }) => {
  if (req.method !== "GET" && req.method !== "HEAD") return json(405, { error: "method_not_allowed" });
  let target: URL;
  try {
    target = new URL(new URL(req.url).searchParams.get("url") ?? "");
  } catch {
    return json(400, { error: "bad_url" });
  }
  if (!(await allowed(target))) return json(400, { error: "forbidden_url" });
  if (await rateLimited(req, context)) return json(429, { error: "too_many_requests" });

  let upstream: Response;
  try {
    upstream = await fetch(target, {
      method: req.method, redirect: "follow", signal: AbortSignal.timeout(25_000),
      headers: { "User-Agent": "Mozilla/5.0 (Console R; webR)", Accept: "*/*" },
    });
  } catch {
    return json(502, { error: "unreachable" });
  }
  // une redirection ne doit pas mener vers le réseau interne
  if (upstream.url && !(await allowed(new URL(upstream.url)))) return json(400, { error: "forbidden_url" });
  const size = Number(upstream.headers.get("content-length") || 0);
  if (size > MAX_BYTES) return json(413, { error: "too_large" });

  const headers = new Headers({ "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
  for (const h of ["content-type", "content-length", "last-modified", "content-disposition"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("X-Upstream-Status", String(upstream.status));
  return new Response(req.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
};

export const config: Config = { path: "/api/fetch" };
