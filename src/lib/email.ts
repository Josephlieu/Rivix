// Sends one plain-text email through Resend. It NEVER throws: callers get { ok, error } and decide what to do, so a
// failed email can never break the action that triggered it (for example changing a customer's sales rep).
//
// Needs RESEND_API_KEY and a sender (NOTIFY_FROM_EMAIL, or HIRING_FROM_EMAIL as a fallback). Sending only works once
// the sender's domain is verified in Resend (the exact domain: info@mail.rivix.ca needs mail.rivix.ca verified).
// EMAIL_REPLY_TO (for example info@rivix.ca) is where replies go when the sending domain has no mailbox. EMAIL_DRY_RUN=1 skips the real send (it logs instead), for local testing.
export type EmailResult = { ok: true; dryRun?: boolean } | { ok: false; error: string };

// "Name<a@b.com>" (no space) is tidied to "Name <a@b.com>", the form email services expect.
const tidySender = (v: string) => {
  const m = v.trim().match(/^(.*?)\s*<\s*([^>\s]+)\s*>$/);
  return m ? (m[1].trim() ? `${m[1].trim()} <${m[2]}>` : m[2]) : v.trim();
};
export const emailSender = () => tidySender(process.env.NOTIFY_FROM_EMAIL || process.env.HIRING_FROM_EMAIL || '');
export const emailConfigured = () => Boolean(process.env.RESEND_API_KEY && emailSender());

// The RIVIX logo, embedded in the email itself (so it shows without any public website). Null if the file cannot be read:
// the email then shows the word RIVIX instead.
let logoCache: string | null | undefined;
async function logoBase64(): Promise<string | null> {
  if (logoCache !== undefined) return logoCache;
  try {
    const { readFile } = await import('node:fs/promises');
    const { join } = await import('node:path');
    logoCache = (await readFile(join(process.cwd(), 'public', 'logo.png'))).toString('base64');
  } catch {
    logoCache = null;
  }
  return logoCache;
}

export async function sendEmail(msg: { to: string | null | undefined; subject: string; text: string; html?: string; from?: string }): Promise<EmailResult> {
  const to = (msg.to || '').trim();
  if (!to) return { ok: false, error: 'no email address on file' };
  if (process.env.EMAIL_DRY_RUN === '1') {
    console.log(`[email dry run] to=${to} subject=${msg.subject}`);
    return { ok: true, dryRun: true };
  }
  const from = tidySender(msg.from || '') || emailSender();
  if (!process.env.RESEND_API_KEY || !from) return { ok: false, error: 'email is not set up (RESEND_API_KEY and a sender address are missing)' };
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [to],
        subject: msg.subject.slice(0, 200),
        text: msg.text, // plain-text version for mail apps that do not show HTML
        ...(msg.html ? { html: msg.html } : {}),
        ...(msg.html?.includes('cid:rivix-logo') && (await logoBase64())
          ? { attachments: [{ filename: 'rivix-logo.png', content: await logoBase64(), content_id: 'rivix-logo', content_type: 'image/png' }] }
          : {}),
        ...(process.env.EMAIL_REPLY_TO ? { reply_to: process.env.EMAIL_REPLY_TO } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: typeof data?.message === 'string' ? data.message : `Resend error (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'could not reach the email service' };
  }
}
