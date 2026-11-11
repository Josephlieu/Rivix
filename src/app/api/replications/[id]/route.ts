import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { logRepActivity } from '@/lib/rep-activity';
import { allowedGarmentKeys } from '@/lib/garment-types';
import { getReplicationActor, unauthorized, notFound, canAccess, repsByIds, requestLink } from '@/lib/replication-access';
import { isValidReplicationId, replicationToRow, rowToReplication, applyReview, approvalProblem, repSafeUpdate, keepTypeCheck, REPLICATION_BUCKET } from '@/lib/replication-server';
import { notifyUsers } from '@/lib/notify';
import { resolveTemplate } from '@/lib/template-catalog';
import { getTemplateCatalog } from '@/lib/template-store';
import { drawingStamp } from '@/lib/drawings';
import { techFileSnapshot, contentKey } from '@/lib/revisions';
import { recordRevision, snapshotOfRow, isApproved } from '@/lib/revision-server';

// An approval also makes and stores the PDF of that revision (task 30).
export const maxDuration = 60;

// One request, found by its id or by its readable number (RQ-0001). A rep only gets their own.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();

  const { id } = await params;
  if (!isValidReplicationId(id)) return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });

  const admin = createAdminClient();
  const byCode = /^RQ-\d+$/i.test(id);
  const { data, error } = await admin.from('replications').select('*').eq(byCode ? 'request_code' : 'id', byCode ? id.toUpperCase() : id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || !canAccess(actor, data)) return notFound();
  return NextResponse.json({ replication: await rowToReplication(admin, data, actor.kind) });
}

// Save changes. Admin: everything (status, approval, tracking, which rep owns it). Rep (their OWN request only): the
// names, the photo order and the inbound parcel. The AI draft and spec details are admin only (task 33): whatever a rep
// sends for them is ignored, and status, approval, dispatch and ownership never change.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();

  const { id } = await params;
  if (!isValidReplicationId(id)) return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from('replications').select('*').eq('id', id).maybeSingle();
  if (!existing || !canAccess(actor, existing)) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = replicationToRow(body ?? {}, id, Array.isArray(existing.images) ? existing.images : [], {
    allowed: await allowedGarmentKeys(admin, existing.garment_type as string | null),
    currentType: existing.garment_type as string | undefined,
  });
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  keepTypeCheck(parsed.row, existing); // the product type confirmation is the server's (task 28)

  const isAdmin = actor.kind === 'admin';
  // Task 30: an approved tech file is locked. Changing it needs "Start a new draft" (newDraft); the approved revision and its
  // PDF stay as they were. Saves that do not change the tech file (status, tracking, the rep) are not affected.
  const newDraft = isAdmin && body?.newDraft === true;
  if (isAdmin && isApproved(existing.ai_analysis) && !newDraft && body?.approve !== true) {
    const next = techFileSnapshot({ clientName: parsed.row.client_name, productName: parsed.row.product_name, garmentType: parsed.row.garment_type, specs: parsed.row.specs, analysis: parsed.row.ai_analysis });
    if (contentKey(next) !== contentKey(snapshotOfRow(existing))) {
      const rev = Number(existing.ai_analysis?.review?.revision) || 0;
      return NextResponse.json({ error: `This tech file is approved (Rev ${rev}) and locked. Start a new draft to change it; Rev ${rev} stays as it was.`, code: 'locked' }, { status: 409 });
    }
  }
  // Approval: only an admin can ask for it; the server checks the draft and records who and when.
  const approve = isAdmin && body?.approve === true;
  if (approve) {
    const problem = approvalProblem(parsed.row.ai_analysis);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }
  // Task 29: an approved tech file records the drawing of its template family (version null = no drawing yet for that template).
  let stamp = null;
  if (approve) {
    const { data: gt } = await admin.from('garment_types').select('template_family').eq('key', parsed.row.garment_type).maybeSingle();
    stamp = drawingStamp(resolveTemplate(parsed.row.garment_type as string, (gt?.template_family as string | null) ?? null, await getTemplateCatalog(admin)));
  }
  parsed.row.ai_analysis = applyReview(parsed.row.ai_analysis, existing.ai_analysis, approve, actor.email, stamp);
  // "Start a new draft" from an approved tech file: it is a draft now, even before anything is changed.
  if (newDraft && !approve && parsed.row.ai_analysis && isApproved(existing.ai_analysis)) {
    const { drawing: _d, ...rest } = parsed.row.ai_analysis; // eslint-disable-line @typescript-eslint/no-unused-vars
    parsed.row.ai_analysis = { ...rest, review: { status: 'draft', revision: Number(existing.ai_analysis?.review?.revision) || 0 } };
  }

  if (!isAdmin) {
    repSafeUpdate(parsed.row, existing); // the AI draft and spec details stay as the admin saved them
    // A rep never moves the request along, changes who owns it, or touches the dispatch details.
    parsed.row.status = existing.status;
    parsed.row.rivix_tracking_carrier = existing.rivix_tracking_carrier ?? null;
    parsed.row.rivix_tracking_number = existing.rivix_tracking_number ?? null;
  } else {
    // Approving the spec is what moves a new request from Received to Mapped.
    if (approve && existing.status === 'received' && parsed.row.status === 'received') parsed.row.status = 'spec_mapped';
    // Moving past "Received" needs an approved review.
    if (parsed.row.status !== existing.status && parsed.row.status !== 'received' && parsed.row.ai_analysis?.review?.status !== 'approved') {
      return NextResponse.json({ error: 'Review and approve the specification first (Review & Approve tab).' }, { status: 400 });
    }
    // The admin may give the request to a sales rep (or keep it: "handled directly").
    const wanted = typeof body?.repId === 'string' && body.repId ? body.repId : null;
    if ('repId' in (body ?? {}) && wanted !== (existing.rep_id ?? null)) { // only when it really changes
      if (wanted) {
        const { data: rep } = await admin.from('reps').select('id, active').eq('id', wanted).maybeSingle();
        if (!rep || !rep.active) return NextResponse.json({ error: 'That sales rep was not found or is disabled.' }, { status: 400 });
      }
      parsed.row.rep_id = wanted;
    }
  }

  const { data, error } = await admin.from('replications').update(parsed.row).eq('id', id).select('*').single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // A photo left out of the saved list is removed from storage too.
  const removed = (existing.images as string[]).filter(p => !(parsed.row.images as string[]).includes(p));
  if (removed.length) await admin.storage.from(REPLICATION_BUCKET).remove(removed);

  // Task 30: keep a revision of the tech file when this save changed it (an approval also stores its PDF).
  let pdfWarning: string | undefined;
  if (isAdmin) {
    const repInfo = data.rep_id ? (await repsByIds(admin, [data.rep_id])).get(data.rep_id as string) : undefined;
    pdfWarning = (await recordRevision(admin, data, actor, { approved: approve, repName: repInfo?.name ?? null })).pdfWarning;
  }

  // Tell the owning rep about the steps they care about (approved, in production, shipped, handed to them).
  if (isAdmin) {
    const code = (data.request_code as string) || data.id;
    const reps = await repsByIds(admin, [data.rep_id]);
    const repUser = data.rep_id ? reps.get(data.rep_id as string)?.userId : null;
    const what = `${data.product_name} (${data.client_name})`;
    const was = (existing.ai_analysis as { review?: { status?: string } } | null)?.review?.status;
    const now = (data.ai_analysis as { review?: { status?: string } } | null)?.review?.status;
    const link = requestLink('rep', code);
    const adminLink = requestLink('admin', code);
    const log = (repId: unknown, summary: string) => logRepActivity(admin, { repId: repId as string | null, kind: 'replication', by: actor.name, summary, link: adminLink });
    if (data.rep_id !== existing.rep_id) { await log(data.rep_id, `Replication request ${code} assigned to this rep: ${what}`); await log(existing.rep_id, `Replication request ${code} taken away from this rep: ${what}`); }
    else if (approve && now === 'approved' && was !== 'approved') await log(data.rep_id, `Tech file approved for ${code}: ${what}`);
    else if (data.status !== existing.status && (data.status === 'sample_production' || data.status === 'sample_shipped')) await log(data.rep_id, `${code} ${data.status === 'sample_production' ? 'moved to sample production' : 'sample shipped'}: ${what}`);
    if (data.rep_id !== existing.rep_id) await notifyUsers(admin, [repUser], { kind: 'replication_assigned', title: `Replication request ${code} assigned to you`, body: what, link });
    else if (approve && now === 'approved' && was !== 'approved') await notifyUsers(admin, [repUser], { kind: 'replication_approved', title: `Tech file approved: ${code}`, body: what, link });
    else if (data.status !== existing.status && data.status === 'sample_production') await notifyUsers(admin, [repUser], { kind: 'replication_status', title: `${code} is in sample production`, body: what, link });
    else if (data.status !== existing.status && data.status === 'sample_shipped') await notifyUsers(admin, [repUser], { kind: 'replication_status', title: `${code}: sample shipped`, body: what, link });
  }

  return NextResponse.json({ replication: await rowToReplication(admin, data, actor.kind), ...(pdfWarning ? { pdfWarning } : {}) });
}

// Delete a request and its photos (admin only). A request with an approved tech file revision or a customer approval cannot be
// deleted (task 30): it is archived instead. The database refuses it too (task-30b SQL).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();
  if (actor.kind !== 'admin') return NextResponse.json({ error: 'Only an admin can delete a request.' }, { status: 403 });

  const { id } = await params;
  if (!isValidReplicationId(id)) return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from('replications').select('images').eq('id', id).maybeSingle();
  if (!existing) return notFound();

  const ARCHIVE = 'This request has an approved tech file or a customer approval, so it cannot be deleted. Archive it instead: everything is kept and it leaves the queue.';
  const [{ count: approvedRevs }, { count: approvals }] = await Promise.all([
    admin.from('replication_revisions').select('id', { count: 'exact', head: true }).eq('replication_id', id).eq('status', 'approved'),
    admin.from('replication_customer_approvals').select('id', { count: 'exact', head: true }).eq('replication_id', id),
  ]);
  if ((approvedRevs ?? 0) > 0 || (approvals ?? 0) > 0) return NextResponse.json({ error: ARCHIVE, code: 'archive-instead' }, { status: 409 });
  const { error } = await admin.from('replications').delete().eq('id', id);
  if (error) {
    if (/archive it instead/i.test(error.message)) return NextResponse.json({ error: ARCHIVE, code: 'archive-instead' }, { status: 409 });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const paths = Array.isArray(existing.images) ? (existing.images as string[]) : [];
  if (paths.length) await admin.storage.from(REPLICATION_BUCKET).remove(paths);
  return NextResponse.json({ ok: true });
}
