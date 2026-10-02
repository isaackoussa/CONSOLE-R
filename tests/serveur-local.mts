// Serveur de test local : sert le site et exécute les vraies fonctions Netlify avec un stockage Blobs local.
// Les e-mails ne partent pas : le code de connexion s'affiche dans ce terminal (MAIL_DRY_RUN).
// Lancer : npm install puis npm run dev (http://localhost:8767)
import { BlobsServer } from "@netlify/blobs/server";
import http from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

const DIR = process.argv[2] ?? ".netlify/blobs-local";
const blobs = new BlobsServer({ directory: DIR, token: "tok", port: 8798 });
await blobs.start();
process.env.NETLIFY_BLOBS_CONTEXT = Buffer.from(JSON.stringify({ edgeURL: "http://localhost:8798", uncachedEdgeURL: "http://localhost:8798", token: "tok", siteID: "site" })).toString("base64");
process.env.MAIL_DRY_RUN = "1";
process.env.ADMIN_KEY ??= "admin-local"; // clé admin du serveur de test
process.env.FETCH_ALLOW_PRIVATE = "1"; // le relais de téléchargement accepte localhost en test
process.env.URL = "http://localhost:8767";

const routes: Record<string, (r: Request) => Promise<Response>> = {};
for (const f of ["auth-send-code", "auth-verify", "progress", "account", "admin", "fetch"]) {
  const m = await import(`../netlify/functions/${f}.mts`);
  routes[m.config.path] = m.default;
}
const types: Record<string, string> = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".webmanifest": "application/manifest+json" };
http.createServer(async (req, res) => {
  const url = new URL(req.url!, "http://localhost:8767");
  const fn = routes[url.pathname];
  if (fn) {
    const chunks: Buffer[] = []; for await (const c of req) chunks.push(c as Buffer);
    const r = await (fn as (r: Request, c: unknown) => Promise<Response>)(new Request(url, { method: req.method, headers: req.headers as HeadersInit, body: ["GET", "HEAD"].includes(req.method!) ? undefined : Buffer.concat(chunks) }), { ip: "127.0.0.1" });
    res.writeHead(r.status, Object.fromEntries(r.headers)); res.end(Buffer.from(await r.arrayBuffer())); return;
  }
  const p = path.join(process.cwd(), url.pathname === "/" ? "index.html" : url.pathname);
  try { const b = await readFile(p); res.writeHead(200, { "Content-Type": types[path.extname(p)] || "application/octet-stream" }); res.end(b); }
  catch { res.writeHead(404, { "Content-Type": "text/html" }); res.end("<h1>404</h1>"); }
}).listen(8767, () => console.log("prêt sur 8767"));
