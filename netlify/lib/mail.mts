// Envoi d'e-mails via Brevo (comme Éloquence) + gabarits HTML de Console R.
import { env } from "./common.mts";

/** MAIL_DRY_RUN=1 : les e-mails sont écrits dans les logs au lieu d'être envoyés (tests locaux). */
const dryRun = () => env("MAIL_DRY_RUN") === "1";

export function mailConfigured(): boolean {
  return dryRun() || !!(env("BREVO_API_KEY") && env("MAIL_FROM"));
}

export function appUrl(): string {
  return (env("APP_URL") ?? env("URL") ?? "").replace(/\/$/, "");
}

export async function sendMail(to: string, subject: string, html: string): Promise<{ ok: boolean; status?: number }> {
  if (dryRun()) {
    console.log(`[MAIL_DRY_RUN] à ${to} — ${subject}\n${html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 400)}`);
    return { ok: true };
  }
  const key = env("BREVO_API_KEY");
  const from = env("MAIL_FROM");
  if (!key || !from) return { ok: false };
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": key, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ sender: { email: from, name: env("MAIL_FROM_NAME") ?? "Console R" }, to: [{ email: to }], subject, htmlContent: html }),
  });
  if (!res.ok) {
    console.error("Brevo : échec d'envoi", res.status, await res.text().catch(() => ""));
    return { ok: false, status: res.status };
  }
  return { ok: true };
}

const ACCENT = "#2851c8";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string, preheader: string): string {
  const url = appUrl();
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title></head>
<body style="margin:0;padding:0;background:#f5f6f8;font-family:Segoe UI,Helvetica,Arial,sans-serif;color:#141821">
<span style="display:none;max-height:0;overflow:hidden">${esc(preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f6f8;padding:24px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dcdfe6">
<tr><td style="background:#1b2f5c;padding:24px 28px;color:#ffffff">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:38px;height:38px;border-radius:10px;background:#0b1226;text-align:center;font-weight:700;font-size:20px;color:#fff">R</td>
<td style="padding-left:12px;font-weight:700;font-size:18px;color:#fff">Console R</td></tr></table>
<h1 style="margin:16px 0 0;font-size:22px;line-height:1.3;color:#ffffff">${esc(title)}</h1></td></tr>
<tr><td style="padding:24px 28px 28px;font-size:16px;line-height:1.6">${body}</td></tr>
</table>
${url ? `<p style="font-size:12px;color:#6f7686;margin:14px 0 0"><a href="${url}" style="color:${ACCENT}">Ouvrir Console R</a></p>` : ""}
</td></tr></table></body></html>`;
}

export function codeEmail(code: string) {
  return {
    subject: `${code} — votre code Console R`,
    html: layout("Votre code de connexion", `<p>Voici votre code pour vous connecter à Console R :</p>
<p style="font-size:34px;font-weight:800;letter-spacing:8px;text-align:center;margin:20px 0;color:${ACCENT}">${code}</p>
<p style="color:#6f7686;font-size:14px">Il est valable 10 minutes. Si vous n'avez pas demandé ce code, ignorez cet e-mail.</p>`, `Votre code : ${code}`),
  };
}

export function welcomeEmail() {
  return {
    subject: "Bienvenue sur Console R",
    html: layout("Bienvenue !", `<p>Votre compte Console R est créé.</p>
<p>Vos scripts, onglets, notes, historique et paquets sont maintenant <b>sauvegardés en ligne automatiquement</b>.
Connectez-vous avec cette adresse sur un autre téléphone ou un ordinateur pour tout retrouver.</p>`, "Votre progression est sauvegardée en ligne."),
  };
}
