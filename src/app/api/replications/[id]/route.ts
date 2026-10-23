import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';
import { getReplicationActor, unauthorized, notFound, canAccess, repsByIds, requestLink } from '@/lib/replication-access';
import { isValidReplicationId, replicationToRow, rowToReplication, applyReview, approvalProblem, REPLICATION_BUCKET } from '@/lib/replication-server';
import { notifyUsers } from '@/lib/notify';

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
  return NextResponse.json({ replication: await rowToReplication(admin, data) });
}

// Save changes. Admin: everything (status, approval, tracking, which rep owns it). Rep: only the photo order, the
// specification and the scan result of their OWN request; status, approval, dispatch and ownership never change.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();

  const { id } = await params;
  if (!isValidReplicationId(id)) return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from('replications').select('*').eq('id', id).maybeSingle();
  if (!existing || !canAccess(actor, existing)) return notFound();

  const body = await req.json().catch(() => null);
  const parsed = replicationToRow(body ?? {}, id, Array.isArray(existing.images) ? existing.images : []);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const isAdmin = actor.kind === 'admin';
  // Approval: only an admin can ask for it; the server checks the draft and records who and when.
  const approve = isAdmin && body?.approve === true;
  if (approve) {
    const problem = approvalProblem(parsed.row.ai_analysis);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
  }
  parsed.row.ai_analysis = applyReview(parsed.row.ai_analysis, existing.ai_analysis, approve, actor.email);

  if (!isAdmin) {
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

  // Tell the owning rep about the steps they care about (approved, in production, shipped, handed to them).
  if (isAdmin) {
    const code = (data.request_code as string) || data.id;
    const reps = await repsByIds(admin, [data.rep_id]);
    const repUser = data.rep_id ? reps.get(data.rep_id as string)?.userId : null;
    const what = `${data.product_name} (${data.client_name})`;
    const was = (existing.ai_analysis as { review?: { status?: string } } | null)?.review?.status;
    const now = (data.ai_analysis as { review?: { status?: string } } | null)?.review?.status;
    const link = requestLink('rep', code);
    if (data.rep_id !== existing.rep_id) await notifyUsers(admin, [repUser], { kind: 'replication_assigned', title: `Replication request ${code} assigned to you`, body: what, link });
    else if (approve && now === 'approved' && was !== 'approved') await notifyUsers(admin, [repUser], { kind: 'replication_approved', title: `Tech file approved: ${code}`, body: what, link });
    else if (data.status !== existing.status && data.status === 'sample_production') await notifyUsers(admin, [repUser], { kind: 'replication_status', title: `${code} is in sample production`, body: what, link });
    else if (data.status !== existing.status && data.status === 'sample_shipped') await notifyUsers(admin, [repUser], { kind: 'replication_status', title: `${code}: sample shipped`, body: what, link });
  }

  return NextResponse.json({ replication: await rowToReplication(admin, data) });
}

// Delete a request and its photos (admin only).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const actor = await getReplicationActor();
  if (!actor) return unauthorized();
  if (actor.kind !== 'admin') return NextResponse.json({ error: 'Only an admin can delete a request.' }, { status: 403 });

  const { id } = await params;
  if (!isValidReplicationId(id)) return NextResponse.json({ error: 'Invalid request id.' }, { status: 400 });

  const admin = createAdminClient();
  const { data: existing } = await admin.from('replications').select('images').eq('id', id).maybeSingle();
  if (!existing) return notFound();

  const { error } = await admin.from('replications').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const paths = Array.isArray(existing.images) ? (existing.images as string[]) : [];
  if (paths.length) await admin.storage.from(REPLICATION_BUCKET).remove(paths);
  return NextResponse.json({ ok: true });
}
