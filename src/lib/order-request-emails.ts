// The email sent to whoever handles a customer's order request (their rep, or each admin when there is no rep).
// A pure builder (it imports only the template), so it can be checked without sending anything.
import { renderEmailHtml } from './email-template';
import { specLines, type Spec } from './catalog-families';

type Item = { product_name: string; sizes: { size: string; qty: number }[]; branding?: string | null; spec?: Partial<Spec> | null };
const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');

export const itemLines = (items: Item[]) =>
  items.map((it) => {
    const total = it.sizes.reduce((n, s) => n + s.qty, 0);
    const spec = specLines(it.spec ? { ...it.spec, branding: null } : null).map((l) => `\n  ${l}`).join('');
    return `${it.product_name}: ${it.sizes.map((s) => `${s.size} x${s.qty}`).join(', ')} (${total} total)${it.branding ? `. Branding: ${it.branding}` : ''}${spec}`;
  });

export function orderRequestEmail(c: {
  to: string | null;
  handler: 'rep' | 'admin';
  company: string;
  kind: 'reorder' | 'quote';
  sourceBatch?: string | null;
  items: Item[];
  note?: string | null;
}) {
  const base = siteUrl();
  const link = base ? `${base}${c.handler === 'rep' ? '/rep/requests' : '/admin/requests'}` : '';
  const what = c.kind === 'reorder' ? `a reorder${c.sourceBatch ? ` of ${c.sourceBatch}` : ''}` : 'a quote';
  const intro = `${c.company} sent ${what}. Review it and turn it into an order, or decline it with a reason.`;
  const lines = itemLines(c.items);
  return {
    to: c.to,
    subject: c.kind === 'reorder' ? `Reorder request from ${c.company}` : `Quote request from ${c.company}`,
    text: [intro, lines.join('\n'), c.note ? `Note from the customer:\n${c.note}` : '', link ? `Open the requests: ${link}` : '', 'RIVIX portal'].filter(Boolean).join('\n\n'),
    html: renderEmailHtml({
      preheader: intro,
      title: c.kind === 'reorder' ? 'New reorder request' : 'New quote request',
      paragraphs: [intro],
      // What the customer typed (product names, spec, note) is plain text: escaped, never linkified.
      customerText: [lines.join('\n'), ...(c.note ? [`Note from the customer:\n${c.note}`] : [])],
      button: link ? { label: 'Review the request', url: link } : undefined,
    }),
  };
}

/** The email to whoever handles a customer's sample request (their rep, or each admin when there is no rep). */
export function sampleRequestEmail(c: { to: string | null; handler: 'rep' | 'admin'; company: string; family: string; quantity: number; spec?: Partial<Spec> | null; note?: string | null }) {
  const base = siteUrl();
  const link = base ? `${base}${c.handler === 'rep' ? '/rep/requests' : '/admin/requests'}` : '';
  const intro = `${c.company} asked for ${c.quantity} sample${c.quantity === 1 ? '' : 's'}. Mark it sent, or decline it with a reason.`;
  const lines = [`${c.family}: ${c.quantity} sample${c.quantity === 1 ? '' : 's'}`, ...specLines(c.spec).map((l) => `  ${l}`)].join('\n');
  return {
    to: c.to,
    subject: `Sample request from ${c.company}`,
    text: [intro, lines, c.note ? `Note from the customer:\n${c.note}` : '', link ? `Open the requests: ${link}` : '', 'RIVIX portal'].filter(Boolean).join('\n\n'),
    html: renderEmailHtml({
      preheader: intro, title: 'New sample request', paragraphs: [intro],
      customerText: [lines, ...(c.note ? [`Note from the customer:\n${c.note}`] : [])],
      button: link ? { label: 'Review the request', url: link } : undefined,
    }),
  };
}
