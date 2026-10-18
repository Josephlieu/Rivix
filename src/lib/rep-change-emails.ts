// The two emails sent when a customer's rep changes: a branded HTML version plus a plain-text fallback.
// Pure builders (they import only the template), so they can be checked without sending anything.
import { renderEmailHtml } from './email-template';

type RepInfo = { name: string; title?: string | null; email?: string | null; phone?: string | null };

const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '');
const contactLines = (r: RepInfo) =>
  [r.name + (r.title ? `, ${r.title}` : ''), r.email ? `Email: ${r.email}` : '', r.phone ? `Phone: ${r.phone}` : ''].filter(Boolean).join('\n');

// The two emails sent when a customer's rep changes: one to the customer, one to the NEW rep (if there is one).
// Pure text builders, so they can be checked without sending anything.
export function repChangeEmails(c: {
  company: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  newRep: RepInfo | null;
  oldRep?: RepInfo | null; // the rep who just lost the customer (gets a short "no longer assigned" email)
}) {
  const base = siteUrl();
  const customerText = c.newRep
    ? `Hello ${c.company},\n\nYour RIVIX sales representative has changed. Your new contact is:\n\n${contactLines(c.newRep)}\n\nThey will look after your orders from now on. Their details are also shown in your portal${base ? `: ${base}/portal` : '.'}\n\nRIVIX`
    : `Hello ${c.company},\n\nYour RIVIX sales representative has changed, and you do not have a dedicated representative at the moment. RIVIX will look after your orders directly. Just reply to this email or sign in to your portal${base ? `: ${base}/portal` : '.'}\n\nRIVIX`;
  const customer = {
    to: c.customerEmail ?? null,
    subject: c.newRep ? `Your RIVIX sales rep is now ${c.newRep.name}` : 'Your RIVIX sales rep has changed',
    text: customerText,
    html: renderEmailHtml(
      c.newRep
        ? {
            preheader: `${c.newRep.name} will look after your orders from now on.`,
            title: 'Your sales representative has changed',
            paragraphs: [`Hello ${c.company},`, 'Your RIVIX sales representative has changed. Here is your new contact. They will look after your orders from now on.'],
            card: {
              heading: 'Your new sales rep',
              name: c.newRep.name + (c.newRep.title ? `, ${c.newRep.title}` : ''),
              lines: [
                { label: 'Email', value: c.newRep.email || '', href: c.newRep.email ? `mailto:${c.newRep.email}` : undefined },
                { label: 'Phone', value: c.newRep.phone || '', href: c.newRep.phone ? `tel:${c.newRep.phone.replace(/[^\d+]/g, '')}` : undefined },
              ],
            },
            button: base ? { label: 'Open your portal', url: `${base}/portal` } : undefined,
            closing: 'Their details are also shown in your portal. If you have any questions, just reply to this email.',
          }
        : {
            preheader: 'RIVIX will look after your orders directly.',
            title: 'Your sales representative has changed',
            paragraphs: [`Hello ${c.company},`, 'Your RIVIX sales representative has changed, and you do not have a dedicated representative at the moment. RIVIX will look after your orders directly.'],
            button: base ? { label: 'Open your portal', url: `${base}/portal` } : undefined,
            closing: 'Just reply to this email if you need anything.',
          }
    ),
  };
  const rep = c.newRep
    ? {
        to: c.newRep.email ?? null,
        subject: `New customer assigned: ${c.company}`,
        text: `Hello ${c.newRep.name},\n\n${c.company} has been assigned to you. You can now see their orders and create new ones${base ? `: ${base}/rep/customers` : '.'}\n\nCustomer contact:\n${c.customerEmail ? `Email: ${c.customerEmail}\n` : ''}${c.customerPhone ? `Phone: ${c.customerPhone}\n` : ''}\nRIVIX`,
        html: renderEmailHtml({
          preheader: `${c.company} is now one of your customers.`,
          title: 'A new customer was assigned to you',
          paragraphs: [`Hello ${c.newRep.name},`, `${c.company} has been assigned to you. You can now see their orders and create new ones.`],
          card: {
            heading: 'Customer',
            name: c.company,
            lines: [
              { label: 'Email', value: c.customerEmail || '', href: c.customerEmail ? `mailto:${c.customerEmail}` : undefined },
              { label: 'Phone', value: c.customerPhone || '', href: c.customerPhone ? `tel:${c.customerPhone.replace(/[^\d+]/g, '')}` : undefined },
            ],
          },
          button: base ? { label: 'Open your customers', url: `${base}/rep/customers` } : undefined,
        }),
      }
    : null;
  const previous = c.oldRep
    ? {
        to: c.oldRep.email ?? null,
        subject: `${c.company} is no longer assigned to you`,
        text: `Hello ${c.oldRep.name},\n\n${c.company} is no longer assigned to you. ${c.newRep ? `They were moved to ${c.newRep.name}.` : 'They are now handled directly by admin.'} You will no longer see their orders.\n\nRIVIX`,
        html: renderEmailHtml({
          preheader: `${c.company} was moved${c.newRep ? ` to ${c.newRep.name}` : ' to admin'}.`,
          title: 'A customer is no longer assigned to you',
          paragraphs: [
            `Hello ${c.oldRep.name},`,
            `${c.company} is no longer assigned to you. ${c.newRep ? `They were moved to ${c.newRep.name}.` : 'They are now handled directly by admin.'} You will no longer see their orders.`,
          ],
          button: base ? { label: 'Open your customers', url: `${base}/rep/customers` } : undefined,
          closing: 'If you think this is a mistake, please contact the admin team.',
        }),
      }
    : null;
  return { customer, rep, previous };
}
