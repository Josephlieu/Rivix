// Emails about account change requests. Pure builders (they import only the template), so the e2e test can check
// them without sending anything.
import { renderEmailHtml } from './email-template';
import { FIELD_LABELS, type RequestField } from './account-fields';

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

// Sent to the OLD login address when a change is requested, and again when it is approved, so the real owner
// notices if someone else asked for it.
export function loginEmailChangeEmail(c: { oldEmail: string | null; newEmail: string; company?: string | null; stage: 'requested' | 'approved' }) {
  const hello = c.company ? `Hello ${c.company},` : 'Hello,';
  const what =
    c.stage === 'requested'
      ? `Your RIVIX login email is changing to ${c.newEmail}. The change was asked for from your portal account and is waiting for RIVIX to approve it.`
      : `Your RIVIX login email is changing to ${c.newEmail}. RIVIX has approved the change, so from now on you sign in with ${c.newEmail}.`;
  const warn = "If this wasn't you, contact RIVIX right away.";
  const subject = c.stage === 'requested' ? `Your RIVIX login email is changing to ${c.newEmail}` : `Your RIVIX login email is now ${c.newEmail}`;
  return {
    to: c.oldEmail,
    subject,
    text: `${hello}\n\n${what}\n\n${warn}\n\nRIVIX`,
    html: renderEmailHtml({ preheader: what, title: 'Your login email is changing', paragraphs: [hello, what, warn], closing: 'You can reply to this email to reach RIVIX.' }),
  };
}

// Sent to each admin when a customer asks for account changes.
export function changeRequestAdminEmail(c: { to: string | null; company: string; customerId: string; changes: { field: RequestField; oldValue: string | null; newValue: string }[] }) {
  const base = siteUrl();
  const link = base ? `${base}/admin/clients/${c.customerId}` : '';
  const lines = c.changes.map((x) => `${FIELD_LABELS[x.field]}: ${x.oldValue || '(empty)'} -> ${x.newValue}`);
  const intro = `${c.company} asked to change their account details. Approve or reject the change on their client page.`;
  return {
    to: c.to,
    subject: `Account change request: ${c.company}`,
    text: `${intro}\n\n${lines.join('\n')}\n\n${link ? `Open the client: ${link}\n\n` : ''}RIVIX portal`,
    html: renderEmailHtml({
      preheader: intro,
      title: 'Account change request',
      paragraphs: [intro, lines.join('\n')],
      button: link ? { label: 'Review the request', url: link } : undefined,
    }),
  };
}
