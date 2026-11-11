// Server-only helpers for the Replication Queue API: turn a database row into what the page
// uses, and clean whatever the browser sends before it is saved.
import type { SupabaseClient } from '@supabase/supabase-js';
import { repsByIds, type RepInfo } from '@/lib/replication-access';
import { outstandingConfirmations } from '@/lib/garmentAiAnalysis';

export const REPLICATION_BUCKET = 'replication-photos';
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // stays under the request size limit on the host
export const MAX_PHOTOS = 12;
export const REPLICATION_STATUSES = ['received', 'spec_mapped', 'sample_production', 'sample_shipped'] as const;
export const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const isValidReplicationId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);

const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const optText = (v: unknown, max: number) => { const t = text(v, max); return t || null; };

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// Tech files are ADMIN ONLY (task 33). A rep gets the request, its photos, its status and the inbound parcel, but never
// the AI draft, the measurements or any spec detail (the AI fills spec fields after a scan, so none of them can be shown).
// These are the only spec keys a rep may receive or change: they are about the parcel, not the garment.
export const REP_SPEC_KEYS = ['garmentPosted', 'inboundReceivedAt'] as const;
export type ReplicationViewer = 'admin' | 'rep';

/** Where the tech file is, without any of its content: safe for a rep. */
export function techFileSummary(analysis: Row | null | undefined): { status: 'none' | 'draft' | 'approved'; revision: number } {
  if (!analysis || typeof analysis !== 'object') return { status: 'none', revision: 0 };
  const review = (analysis as Row).review;
  return { status: review?.status === 'approved' ? 'approved' : 'draft', revision: Number(review?.revision) || 0 };
}

const repSpecs = (specs: unknown): Row => {
  const s = specs && typeof specs === 'object' && !Array.isArray(specs) ? (specs as Row) : {};
  return Object.fromEntries(REP_SPEC_KEYS.filter(k => s[k] !== undefined).map(k => [k, s[k]]));
};

/** Photos are stored as paths; the page gets short-lived private links, in the same order.
 *  `viewer` decides what is sent: a rep never receives the AI draft or spec details. */
export async function rowToReplication(admin: SupabaseClient, r: Row, viewer: ReplicationViewer, reps?: Map<string, RepInfo>) {
  const repMap = reps ?? (await repsByIds(admin, [r.rep_id]));
  const rep = r.rep_id ? repMap.get(r.rep_id as string) : undefined;
  const paths: string[] = Array.isArray(r.images) ? r.images.filter((p: unknown) => typeof p === 'string') : [];
  let urls: string[] = [];
  if (paths.length) {
    const { data } = await admin.storage.from(REPLICATION_BUCKET).createSignedUrls(paths, 60 * 60);
    urls = paths.map((p, i) => data?.[i]?.signedUrl || '');
  }
  return {
    id: r.id as string,
    // RQ-0001 style number from the database; until the SQL for it has been run, a short code from the id.
    requestCode: (r.request_code as string) || `RQ-${String(r.id).replace(/[^A-Za-z0-9]/g, '').slice(0, 6).toUpperCase()}`,
    // The sales rep who owns the request (empty = the admin handles it directly). Customers are never connected to it.
    repId: (r.rep_id as string | null) ?? null,
    repName: rep?.name ?? null,
    createdByRole: (r.created_by_role as string | null) ?? null,
    createdByName: (r.created_by_name as string | null) ?? null,
    clientName: r.client_name ?? '',
    productName: r.product_name ?? '',
    garmentType: r.garment_type,
    status: r.status,
    submissionDate: r.submission_date || String(r.created_at || '').slice(0, 10),
    images: urls,
    imagePaths: paths,
    specs: viewer === 'admin' ? (r.specs && typeof r.specs === 'object' ? r.specs : {}) : repSpecs(r.specs),
    clientTrackingCarrier: r.client_tracking_carrier ?? undefined,
    clientTrackingNumber: r.client_tracking_number ?? undefined,
    rivixTrackingCarrier: r.rivix_tracking_carrier ?? undefined,
    rivixTrackingNumber: r.rivix_tracking_number ?? undefined,
    messages: [], // the old in-row chat is no longer used: see /api/replications/[id]/messages
    aiAnalysis: viewer === 'admin' ? r.ai_analysis ?? null : null,
    techFile: techFileSummary(r.ai_analysis),
  };
}

/** The photo paths a request may keep: only ones that already belong to it (reorder or remove, never add). */
const cleanPaths = (raw: unknown, id: string, current: string[]): string[] =>
  Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string' && p.startsWith(`${id}/`) && current.includes(p)) : current;

/** Validates and cleans a request sent by the browser. `current` = saved photo paths (for updates). */
export function replicationToRow(
  body: Row,
  id: string,
  current: string[] = [],
  garment: { allowed: string[]; currentType?: string } = { allowed: [] }
): { error: string } | { row: Row } {
  const clientName = text(body?.clientName, 200);
  const productName = text(body?.productName, 200);
  if (!clientName) return { error: 'Customer name is required.' };
  if (!productName) return { error: 'Product name is required.' };
  // A new request defaults to Jacket; an update keeps the saved type when none is sent. A type that is not on the list is refused.
  const sent = typeof body?.garmentType === 'string' && body.garmentType ? body.garmentType : null;
  if (sent && !garment.allowed.includes(sent)) return { error: 'Choose a garment type from the list.' };
  const garmentType = sent ?? garment.currentType ?? 'jacket';
  const status = REPLICATION_STATUSES.includes(body?.status) ? body.status : 'received';
  const sentSpecs: Row = body?.specs && typeof body.specs === 'object' && !Array.isArray(body.specs) ? body.specs : {};
  // The product type confirmation (task 28) is set by the server only: whatever the browser sends for it is dropped here,
  // and an update puts back the saved one (keepTypeCheck).
  const { typeCheck: _typeCheck, ...specs } = sentSpecs; // eslint-disable-line @typescript-eslint/no-unused-vars
  if (JSON.stringify(specs).length > 500_000) return { error: 'The specification is too large.' };
  const analysis = body?.aiAnalysis && typeof body.aiAnalysis === 'object' ? body.aiAnalysis : null;
  if (analysis && JSON.stringify(analysis).length > 1_000_000) return { error: 'The AI analysis is too large.' };
  return {
    row: {
      client_name: clientName,
      product_name: productName,
      garment_type: garmentType,
      status,
      images: cleanPaths(body?.imagePaths, id, current),
      specs,
      client_tracking_carrier: optText(body?.clientTrackingCarrier, 80),
      client_tracking_number: optText(body?.clientTrackingNumber, 120),
      rivix_tracking_carrier: optText(body?.rivixTrackingCarrier, 80),
      rivix_tracking_number: optText(body?.rivixTrackingNumber, 120),
      ai_analysis: analysis,
      updated_at: new Date().toISOString(),
    },
  };
}

// ---- Review and approval -------------------------------------------------------------------------
// A person checks the AI draft and approves it. The browser can only ASK for approval; who approved and
// when are set here, and any change to the draft afterwards turns it back into a draft.

const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, val) =>
    val && typeof val === 'object' && !Array.isArray(val)
      ? Object.fromEntries(Object.entries(val as Row).sort(([a], [b]) => a.localeCompare(b)))
      : val
  );
const withoutReview = (a: Row | null) => { if (!a) return null; const { review: _r, ...rest } = a; return rest; }; // eslint-disable-line @typescript-eslint/no-unused-vars

/** Why a draft cannot be approved yet, or null when it can. */
export function approvalProblem(analysis: Row | null): string | null {
  const m = analysis && Array.isArray(analysis.measurements) ? analysis.measurements : [];
  if (!analysis) return 'Run the AI analysis (or enter the details) before approving.';
  if (m.length === 0) return 'Add at least one measurement before approving.';
  if (m.some((r: Row) => !String(r?.pom ?? '').trim() || !String(r?.description ?? '').trim())) return 'Every measurement needs a point code and a description.';
  const open = outstandingConfirmations(analysis);
  if (open.length) return `${open.length} item${open.length > 1 ? 's' : ''} still need confirmation: ${open.slice(0, 5).join(', ')}${open.length > 5 ? '…' : ''}. Check each against the garment and confirm it.`;
  return null;
}

/** An update keeps the product type confirmation exactly as the server saved it (task 28). */
export function keepTypeCheck(row: Row, existing: Row): void {
  const saved = existing.specs && typeof existing.specs === 'object' ? (existing.specs as Row).typeCheck : undefined;
  if (saved !== undefined && row.specs && typeof row.specs === 'object') row.specs = { ...(row.specs as Row), typeCheck: saved };
}

/** A rep's save: the AI draft and every spec detail stay exactly as saved; only the parcel keys may change.
 *  The tracking number changing clears the received date (the parcel is a new one), as the inbound parcel card does. */
export function repSafeUpdate(row: Row, existing: Row): void {
  row.ai_analysis = existing.ai_analysis ?? null;
  const saved = existing.specs && typeof existing.specs === 'object' && !Array.isArray(existing.specs) ? { ...(existing.specs as Row) } : {};
  const sent = row.specs && typeof row.specs === 'object' ? (row.specs as Row) : {};
  if (typeof sent.garmentPosted === 'boolean') saved.garmentPosted = sent.garmentPosted;
  if ((row.client_tracking_number ?? null) !== (existing.client_tracking_number ?? null)) delete saved.inboundReceivedAt;
  row.specs = saved;
}

/** The analysis to store, with its review state worked out from the saved copy. */
export function applyReview(next: Row | null, saved: Row | null, approve: boolean, email: string): Row | null {
  if (!next) return null;
  const clean = withoutReview(next) as Row;
  const revision = Number(saved?.review?.revision) || 0;
  if (approve) return { ...clean, review: { status: 'approved', approvedAt: new Date().toISOString(), approvedBy: email, revision: revision + 1 } };
  const savedReview = saved?.review;
  if (savedReview?.status === 'approved' && stable(withoutReview(saved)) === stable(clean)) return { ...clean, review: savedReview };
  return { ...clean, review: { status: 'draft', revision } };
}
