// Email to an admin whose two-step sign-in was reset by another admin. A pure builder (imports only the template), so
// the e2e test can check it without sending anything.
import { renderEmailHtml } from './email-template';
import { DEFAULT_TZ } from './format';

const when = (d: Date) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: DEFAULT_TZ, year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }).format(d);

export function mfaResetEmail(c: { to: string | null; by: string; at: Date }) {
  const lead = `Your two-step sign-in was reset by ${c.by} at ${when(c.at)}.`;
  const warn = "If you didn't ask for this, contact RIVIX now.";
  const next = 'You have been signed out. The next time you sign in to the RIVIX admin portal you will be asked to set up your authenticator app again.';
  return {
    to: c.to,
    subject: 'Your RIVIX two-step sign-in was reset',
    text: `${lead}\n\n${warn}\n\n${next}\n\nRIVIX`,
    html: renderEmailHtml({ preheader: lead, title: 'Your two-step sign-in was reset', paragraphs: [lead, warn, next] }),
  };
}
