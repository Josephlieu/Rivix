// RIVIX branded email layout (HTML). No imports, so it can be checked without sending anything.
// Built the way email clients need it: tables, inline styles, 600px wide. The logo is embedded by email.ts as an inline
// attachment (cid:rivix-logo); if a mail app blocks it, the "RIVIX" text (alt) shows instead.

export const LOGO_CID = 'rivix-logo';
const RED = '#c61213';

export const esc = (v: unknown) =>
  String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Web addresses typed in the text become real links. Long ones are shown shortened (the full address is still the link).
const linkify = (escaped: string) =>
  escaped.replace(/https?:\/\/[^\s<]+/g, (m) => {
    const trail = (m.match(/[.,;:!?)]+$/) || [''])[0]; // punctuation at the end belongs to the sentence, not the link
    const url = trail ? m.slice(0, -trail.length) : m;
    const shown = url.replace(/^https?:\/\//, '');
    const label = shown.length > 48 ? `${shown.slice(0, 45)}...` : shown;
    return `<a href="${url}" style="color:${RED};text-decoration:underline;word-break:break-all;">${label}</a>${trail}`;
  });
const nl = (v: string) => linkify(esc(v)).replace(/\r?\n/g, '<br>');

export type EmailLayout = {
  preheader?: string;                         // the grey preview line next to the subject in the inbox
  title: string;                              // big heading
  paragraphs: string[];                       // body text (line breaks kept)
  card?: { heading: string; name: string; lines: { label: string; value: string; href?: string }[] }; // a contact box
  button?: { label: string; url: string };
  closing?: string;                           // small text under the button
};

export function renderEmailHtml(o: EmailLayout): string {
  const p = (t: string) => `<p style="margin:0 0 16px;font-size:15px;line-height:24px;color:#374151;">${nl(t)}</p>`;
  const card = o.card
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr>
        <td style="background:#f8f8f8;border-left:4px solid ${RED};border-radius:6px;padding:16px 18px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:#9ca3af;margin-bottom:6px;">${esc(o.card.heading)}</div>
          <div style="font-size:17px;font-weight:700;color:#111827;margin-bottom:6px;">${esc(o.card.name)}</div>
          ${o.card.lines
            .filter((l) => l.value)
            .map((l) => `<div style="font-size:14px;line-height:22px;color:#4b5563;"><span style="color:#9ca3af;">${esc(l.label)}:</span> ${l.href ? `<a href="${esc(l.href)}" style="color:${RED};text-decoration:none;">${esc(l.value)}</a>` : esc(l.value)}</div>`)
            .join('')}
        </td></tr></table>`
    : '';
  const button = o.button
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 22px;"><tr>
        <td style="background:${RED};border-radius:8px;"><a href="${esc(o.button.url)}" style="display:inline-block;padding:13px 26px;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">${esc(o.button.label)}</a></td></tr></table>`
    : '';
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(o.title)}</title></head>
<body style="margin:0;padding:0;background:#f2f2f2;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:#f2f2f2;">${esc(o.preheader || '')}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f2f2f2;"><tr><td align="center" style="padding:28px 12px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;border-top:5px solid ${RED};font-family:-apple-system,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr><td style="padding:26px 32px 8px;"><img src="cid:${LOGO_CID}" alt="RIVIX" width="130" style="display:block;border:0;width:130px;height:auto;font-size:22px;font-weight:800;color:${RED};"></td></tr>
    <tr><td style="padding:14px 32px 6px;"><h1 style="margin:0;font-size:22px;line-height:30px;color:#111827;">${esc(o.title)}</h1></td></tr>
    <tr><td style="padding:12px 32px 4px;">${o.paragraphs.map(p).join('')}${card}${button}${o.closing ? `<p style="margin:0 0 8px;font-size:13px;line-height:20px;color:#6b7280;">${nl(o.closing)}</p>` : ''}</td></tr>
    <tr><td style="padding:18px 32px 26px;border-top:1px solid #eeeeee;"><p style="margin:0;font-size:12px;line-height:18px;color:#9ca3af;">RIVIX &middot; Canadian apparel manufacturing<br>Uniform, workwear and PPE programs &middot; one point of contact for every order</p></td></tr>
  </table>
</td></tr></table></body></html>`;
}
