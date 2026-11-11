// Server only (task 30): records a revision on every admin save that changes a tech file, with what changed and the template
// and drawing versions it used; on approval, also makes the PDF of that exact revision and stores it with its SHA-256.
// The table is append-only (the database refuses edits). If the revisions table is missing (SQL not run), nothing is recorded
// and the save still works.
import type { SupabaseClient } from '@supabase/supabase-js';
import { techFileSnapshot, contentKey, describeChanges, type TechFileSnapshot } from '@/lib/revisions';
import { resolveTemplateChecked, TemplateUnavailableError } from '@/lib/template-catalog';
import { getTemplateCatalog } from '@/lib/template-store';
import { drawingStamp } from '@/lib/drawings';
import { renderRevisionPdf, storeRevisionPdf } from '@/lib/tech-file-pdf-server';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const snapshotOfRow = (r: Row): TechFileSnapshot => techFileSnapshot({ clientName: r.client_name, productName: r.product_name, garmentType: r.garment_type, specs: r.specs, analysis: r.ai_analysis });
export const isApproved = (a: unknown) => (a as Row | null)?.review?.status === 'approved';

export async function latestRevision(admin: SupabaseClient, replicationId: string): Promise<Row | null | 'missing'> {
  const { data, error } = await admin.from('replication_revisions').select('*').eq('replication_id', replicationId).order('seq', { ascending: false }).limit(1).maybeSingle();
  if (error) return /does not exist|schema cache/i.test(error.message) ? 'missing' : null;
  return data;
}

/** The template versions and the drawing a revision used: the ones the draft was made with, else today's for its type. */
async function versionsFor(admin: SupabaseClient, snap: TechFileSnapshot) {
  const pinned = Array.isArray(snap.analysis?.template?.versions) ? snap.analysis!.template.versions : null;
  try {
    const { data: gt } = await admin.from('garment_types').select('template_family, template_modules').eq('key', snap.garmentType).maybeSingle();
    const t = resolveTemplateChecked(snap.garmentType, (gt?.template_family as string | null) ?? null, await getTemplateCatalog(admin), pinned, gt ? { family: gt.template_family ?? null, modules: gt.template_modules ?? null } : null);
    return { templateVersions: pinned ?? t.versions, drawing: snap.analysis?.drawing ?? drawingStamp(t) };
  } catch (e) {
    // The templates could not be read (task 31: never a different template): record what the draft itself says, nothing more.
    if (e instanceof TemplateUnavailableError) return { templateVersions: pinned, drawing: snap.analysis?.drawing ?? null };
    throw e;
  }
}

/**
 * After a save: records a revision when the tech file changed (or was approved, or a new draft was started).
 * Returns a warning when the approved PDF could not be made (the approval itself stands; "Make PDF" can add it once later).
 */
export async function recordRevision(admin: SupabaseClient, row: Row, actor: { userId: string; email: string }, opts: { approved: boolean; repName: string | null }): Promise<{ recorded: boolean; pdfWarning?: string }> {
  const snap = snapshotOfRow(row);
  for (let attempt = 0; attempt < 2; attempt++) {
    const last = await latestRevision(admin, row.id);
    if (last === 'missing') return { recorded: false };
    const status = isApproved(row.ai_analysis) ? 'approved' : 'draft';
    const revision = Number(row.ai_analysis?.review?.revision) || 0;
    if (!last && !snap.analysis) return { recorded: false }; // nothing to keep yet
    const changed = !last || contentKey(last.snapshot as TechFileSnapshot) !== contentKey(snap) || last.status !== status || Number(last.revision) !== revision;
    if (!changed) return { recorded: false };
    let changes = describeChanges(last ? (last.snapshot as TechFileSnapshot) : null, snap);
    if (!changes.length) changes = [status === 'approved' ? `Approved as Rev ${revision}` : `New draft started from Rev ${revision}`];
    const v = await versionsFor(admin, snap);
    let pdf: { path: string; sha256: string } | null = null;
    let pdfWarning: string | undefined;
    if (opts.approved && status === 'approved') {
      try { pdf = await storeRevisionPdf(admin, row.id, revision, await renderRevisionPdf(admin, row, snap, opts.repName)); }
      catch (e) { pdfWarning = `The tech file is approved, but its PDF could not be stored (${e instanceof Error ? e.message.slice(0, 120) : 'unknown error'}). Use "Make PDF" in the history.`; }
    }
    const { error } = await admin.from('replication_revisions').insert({
      replication_id: row.id, seq: (last ? Number(last.seq) : 0) + 1, status, revision, snapshot: snap, changes,
      template_versions: v.templateVersions, drawing: v.drawing, pdf_path: pdf?.path ?? null, pdf_sha256: pdf?.sha256 ?? null,
      created_by: actor.userId, created_by_email: actor.email,
    });
    if (!error) return { recorded: true, ...(pdfWarning ? { pdfWarning } : {}) };
    if (pdf) await admin.storage.from('tech-files').remove([pdf.path]);
    if (error.code !== '23505') { console.error('revision not recorded:', error.message); return { recorded: false }; }
    // Another save took this number at the same moment: read the latest again and retry once.
  }
  return { recorded: false };
}
