import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyUsers } from '@/lib/notify';
import { sendEmail } from '@/lib/email';
import { repChangeEmails } from '@/lib/rep-change-emails';

// Tells the people involved when a customer's sales rep changes. In the app: the new rep, the old rep and the customer.
// By email: the customer, the new rep and the previous rep. Used by the Clients page (edit a customer) and by the admin "New order" form.
// Returns a warning text when an email could not be sent (the change itself has already happened and is never undone).
export async function announceRepChange(
  admin: SupabaseClient,
  c: { customerId: string; companyName: string | null; customerUserId: string | null; beforeRepId: string | null; afterRepId: string | null }
): Promise<{ emailWarning?: string }> {
  const ids = [c.afterRepId, c.beforeRepId].filter(Boolean) as string[];
  const { data: reps } = ids.length
    ? await admin.from('reps').select('id, name, title, email, phone, user_id').in('id', ids)
    : { data: [] as { id: string; name: string; title: string | null; email: string | null; phone: string | null; user_id: string | null }[] };
  const byId = new Map((reps || []).map((r) => [r.id, r]));
  const company = c.companyName || 'A customer';
  const newRep = c.afterRepId ? byId.get(c.afterRepId) : null;
  const oldRep = c.beforeRepId ? byId.get(c.beforeRepId) : null;
  if (newRep) {
    await notifyUsers(admin, [newRep.user_id], {
      kind: 'customer_assigned',
      title: `New customer assigned: ${company}`,
      body: 'You can now see their orders and create new ones.',
      link: `/rep/customers/${c.customerId}`,
    });
  }
  if (oldRep) {
    await notifyUsers(admin, [oldRep.user_id], {
      kind: 'customer_unassigned',
      title: `${company} is no longer assigned to you`,
      body: newRep ? `They were moved to ${newRep.name}.` : 'They are now handled directly by admin.',
      link: '/rep/customers',
    });
  }
  await notifyUsers(admin, [c.customerUserId], {
    kind: 'rep_changed',
    title: newRep ? `Your sales rep is now ${newRep.name}` : 'Your sales rep has changed',
    body: newRep ? 'Contact details are in the sidebar.' : null,
    link: '/portal',
  });

  // Email: the customer and the new rep.
  const { data: cust } = await admin.from('customers').select('contact_email, contact_phone').eq('id', c.customerId).maybeSingle();
  const mails = repChangeEmails({ company, customerEmail: cust?.contact_email ?? null, customerPhone: cust?.contact_phone ?? null, newRep: newRep ?? null, oldRep: oldRep ?? null });
  const results = await Promise.all([
    sendEmail(mails.customer).then((r) => ({ who: 'the customer', r })),
    mails.rep ? sendEmail(mails.rep).then((r) => ({ who: `the new rep (${newRep?.name})`, r })) : Promise.resolve(null),
    mails.previous ? sendEmail(mails.previous).then((r) => ({ who: `the previous rep (${oldRep?.name})`, r })) : Promise.resolve(null),
  ]);
  const failed = results.filter((x): x is { who: string; r: { ok: false; error: string } } => !!x && !x.r.ok);
  if (failed.length) console.error('rep change email failed:', failed.map((f) => `${f.who}: ${f.r.error}`).join(' | '));
  return failed.length
    ? { emailWarning: `The rep was changed and the in-app notifications were sent, but the email to ${failed.map((f) => f.who).join(' and ')} was not sent: ${failed[0].r.error}.` }
    : {};
}

// A brand-new customer was created with a sales rep already chosen: tell that rep, in the app and by email.
export async function announceNewCustomerToRep(
  admin: SupabaseClient,
  c: { customerId: string; companyName: string; customerEmail: string | null; customerPhone: string | null; repId: string }
): Promise<{ emailWarning?: string }> {
  const { data: rep } = await admin.from('reps').select('name, title, email, phone, user_id').eq('id', c.repId).maybeSingle();
  if (!rep) return {};
  await notifyUsers(admin, [rep.user_id], {
    kind: 'customer_assigned',
    title: `New customer assigned: ${c.companyName}`,
    body: 'You can now see their orders and create new ones.',
    link: `/rep/customers/${c.customerId}`,
  });
  const mails = repChangeEmails({ company: c.companyName, customerEmail: c.customerEmail, customerPhone: c.customerPhone, newRep: rep });
  const r = mails.rep ? await sendEmail(mails.rep) : null;
  if (r && !r.ok) {
    console.error('new customer email to rep failed:', r.error);
    return { emailWarning: `The client was created and ${rep.name} was notified in the app, but the email to ${rep.name} was not sent: ${r.error}.` };
  }
  return {};
}
