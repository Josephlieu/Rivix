// Server-only helpers for the Replication Queue API: turn a database row into what the page
// uses, and clean whatever the browser sends before it is saved.
import type { SupabaseClient } from '@supabase/supabase-js';
import { repsByIds, type RepInfo } from '@/lib/replication-access';

export const REPLICATION_BUCKET = 'replication-photos';
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024; // stays under the request size limit on the host
export const MAX_PHOTOS = 12;
export const REPLICATION_STATUSES = ['received', 'spec_mapped', 'sample_production', 'sample_shipped'] as const;
export const GARMENT_TYPES = ['overalls', 'parka', 'jacket', 'pants', 'vest', 'hoodie', 'coat'] as const;
export const PHOTO_TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export const isValidReplicationId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v);

const text = (v: unknown, max: number) => String(v ?? '').trim().slice(0, max);
const optText = (v: unknown, max: number) => { const t = text(v, max); return t || null; };

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** Photos are stored as paths; the page gets short-lived private links, in the same order. */
export async function rowToReplication(admin: SupabaseClient, r: Row, reps?: Map<string, RepInfo>) {
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
    specs: r.specs && typeof r.specs === 'object' ? r.specs : {},
    clientTrackingCarrier: r.client_tracking_carrier ?? undefined,
    clientTrackingNumber: r.client_tracking_number ?? undefined,
    rivixTrackingCarrier: r.rivix_tracking_carrier ?? undefined,
    rivixTrackingNumber: r.rivix_tracking_number ?? undefined,
    messages: [], // the old in-row chat is no longer used: see /api/replications/[id]/messages
    aiAnalysis: r.ai_analysis ?? null,
  };
}

/** The photo paths a request may keep: only ones that already belong to it (reorder or remove, never add). */
const cleanPaths = (raw: unknown, id: string, current: string[]): string[] =>
  Array.isArray(raw) ? raw.filter((p): p is string => typeof p === 'string' && p.startsWith(`${id}/`) && current.includes(p)) : current;

/** Validates and cleans a request sent by the browser. `current` = saved photo paths (for updates). */
export function replicationToRow(body: Row, id: string, current: string[] = []): { error: string } | { row: Row } {
  const clientName = text(body?.clientName, 200);
  const productName = text(body?.productName, 200);
  if (!clientName) return { error: 'Customer name is required.' };
  if (!productName) return { error: 'Product name is required.' };
  const garmentType = GARMENT_TYPES.includes(body?.garmentType) ? body.garmentType : 'jacket';
  const status = REPLICATION_STATUSES.includes(body?.status) ? body.status : 'received';
  const specs = body?.specs && typeof body.specs === 'object' && !Array.isArray(body.specs) ? body.specs : {};
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
  return null;
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
