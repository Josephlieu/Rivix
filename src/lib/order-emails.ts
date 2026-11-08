// The email sent to a customer when an admin moves their order to a new stage or adds shipping details.
// A pure builder (it imports only the template), so it can be checked without sending anything.
import { renderEmailHtml } from './email-template';

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

export function orderUpdateEmail(c: {
  company?: string | null;
  to?: string | null;
  batch: string;
  stage?: string | null;    // the new stage, when the stage changed
  note?: string | null;     // the admin's note on the stage change
  carrier?: string | null;  // shipping details, when they are set
  tracking?: string | null;
}) {
  const base = siteUrl();
  const link = base ? `${base}/portal/orders/${encodeURIComponent(c.batch)}` : '';
  const hello = c.company ? `Hello ${c.company},` : 'Hello,';
  const hasShipping = Boolean(c.carrier || c.tracking);
  const subject = c.stage ? `Order ${c.batch} is now ${c.stage}` : `Shipping details for order ${c.batch}`;
  const lead = c.stage
    ? `Your RIVIX order ${c.batch} has moved to a new stage: ${c.stage}.`
    : `Shipping details have been added to your RIVIX order ${c.batch}.`;
  const shipLines = [c.carrier ? `Carrier: ${c.carrier}` : '', c.tracking ? `Tracking number: ${c.tracking}` : ''].filter(Boolean);

  const text = [
    hello,
    lead,
    c.note ? `Note from RIVIX:\n${c.note}` : '',
    hasShipping ? `Shipping details:\n${shipLines.join('\n')}` : '',
    link ? `See the order in your portal: ${link}` : 'You can see the order in your RIVIX portal.',
    'RIVIX',
  ].filter(Boolean).join('\n\n');

  const html = renderEmailHtml({
    preheader: lead,
    title: c.stage ? `Order ${c.batch}: ${c.stage}` : `Order ${c.batch}: shipping details`,
    paragraphs: [hello, lead, ...(c.note ? [`Note from RIVIX:\n${c.note}`] : [])],
    card: hasShipping
      ? { heading: 'Shipping details', name: `Order ${c.batch}`, lines: [{ label: 'Carrier', value: c.carrier || '' }, { label: 'Tracking number', value: c.tracking || '' }] }
      : undefined,
    button: link ? { label: 'View your order', url: link } : undefined,
    closing: 'If you have any questions, just reply to this email.',
  });

  return { to: c.to ?? null, subject, text, html };
}
