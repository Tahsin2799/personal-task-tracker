import "server-only";
import nodemailer, { type Transporter } from "nodemailer";

/**
 * Outgoing mail over plain SMTP, so any free sender works: a Gmail app password, Brevo, or
 * the local Mailpit (127.0.0.1:54325) in development.
 */
let transport: Transporter | null = null;

function mailer() {
  if (!process.env.SMTP_HOST) throw new Error("SMTP_HOST is not set");
  transport ??= nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return transport;
}

export async function sendMail(to: string, subject: string, html: string, text: string) {
  await mailer().sendMail({ from: process.env.SMTP_FROM ?? "Bird-Watcher <no-reply@localhost>", to, subject, html, text });
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export type MailLine = { key: string; title: string; href: string; note?: string; quote?: string; late?: boolean };
export type MailSection = { caption: string; lines: MailLine[] };

/** The field-book page in email-safe HTML: cover-yellow band, ruled lines, mono keys. */
export function renderMail(heading: string, sections: MailSection[], footer: string) {
  const rows = sections
    .map(
      (s) => `
      <tr><td style="padding:20px 0 6px;font:600 11px/1 Arial,sans-serif;letter-spacing:.07em;text-transform:uppercase;color:#5c6762;border-bottom:1px solid #5f8f6e">${esc(s.caption)}</td></tr>
      ${s.lines
        .map(
          (l) => `
      <tr><td style="padding:10px 0;border-bottom:1px solid #c7dccc">
        <a href="${esc(l.href)}" style="text-decoration:none;color:#1b2420">
          <span style="font:12px/1.4 'Courier New',monospace;color:#5c6762">${esc(l.key)}</span>&nbsp;
          <span style="font:15px/1.4 Arial,sans-serif;color:#1b2420">${esc(l.title)}</span>
        </a>
        ${l.note ? `<div style="font:13px/1.4 Arial,sans-serif;color:${l.late ? "#8a4a22" : "#5c6762"};${l.late ? "font-weight:600;" : ""}margin-top:2px">${esc(l.note)}</div>` : ""}
        ${l.quote ? `<div style="font:14px/1.45 Arial,sans-serif;color:#1b2420;margin-top:6px;padding-left:10px;border-left:3px solid #c7dccc">${esc(l.quote)}</div>` : ""}
      </td></tr>`,
        )
        .join("")}`,
    )
    .join("");

  const html = `<!doctype html><html><body style="margin:0;background:#eef2ec">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2ec"><tr><td align="center" style="padding:24px 12px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fafbf8;border:1px solid #c7dccc">
      <tr><td style="background:#e2cc2a;padding:12px 24px;font:700 14px/1 Arial,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#1b2420">Bird-Watcher</td></tr>
      <tr><td style="padding:20px 24px 24px">
        <h1 style="margin:0;font:600 20px/1.3 Arial,sans-serif;color:#1b2420">${esc(heading)}</h1>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
        <p style="margin:20px 0 0;font:12px/1.5 Arial,sans-serif;color:#5c6762">${footer}</p>
      </td></tr>
    </table>
  </td></tr></table></body></html>`;

  const text = [
    heading,
    ...sections.flatMap((s) => ["", s.caption.toUpperCase(), ...s.lines.map((l) => `${l.key} ${l.title}${l.note ? ` (${l.note})` : ""}${l.quote ? `\n  "${l.quote}"` : ""}\n  ${l.href}`)]),
    "",
    footer.replace(/<[^>]+>/g, ""),
  ].join("\n");

  return { html, text };
}

export function settingsFooter() {
  return `You get these because email is on for your account. <a href="${siteUrl()}/account" style="color:#5c6762">Change email settings</a>.`;
}
