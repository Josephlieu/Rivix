// Server only (task 30): the PDF of an approved revision, made from that revision's own copy of the tech file, so the stored
// PDF never changes afterwards. Photos come from private storage (shrunk to 1000 px JPEG, as the browser download does).
// The PDF is uploaded once to the private "tech-files" bucket (no overwrite) with its SHA-256 fingerprint.
import { createHash, randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { renderToBuffer } from '@react-pdf/renderer';
import { TechPackPDF, buildTechFileData } from '@/lib/TechPackPDF';
import { resolveTemplateChecked, TemplateUnavailableError } from '@/lib/template-catalog';
import { getTemplateCatalog } from '@/lib/template-store';
import { REPLICATION_BUCKET } from '@/lib/replication-server';
import type { ReplicationRequest } from '@/lib/replicationStorage';
import type { TechFileSnapshot } from '@/lib/revisions';

export const TECH_FILES_BUCKET = 'tech-files';
export const sha256 = (b: Buffer | Uint8Array) => createHash('sha256').update(b).digest('hex');

async function photoDataUrls(admin: SupabaseClient, images: unknown): Promise<string[]> {
  const out: string[] = [];
  const sharp = (await import('sharp')).default;
  for (const p of (Array.isArray(images) ? images : []).filter((x): x is string => typeof x === 'string').slice(0, 7)) {
    const { data } = await admin.storage.from(REPLICATION_BUCKET).download(p);
    if (!data) continue;
    try {
      const jpg = await sharp(Buffer.from(await data.arrayBuffer())).rotate().resize({ width: 1000, height: 1000, fit: 'inside', withoutEnlargement: true }).flatten({ background: '#ffffff' }).jpeg({ quality: 82 }).toBuffer();
      out.push(`data:image/jpeg;base64,${jpg.toString('base64')}`);
    } catch { /* a photo that cannot be read is left out */ }
  }
  return out;
}
async function logoDataUrl(): Promise<string | undefined> {
  try { return `data:image/png;base64,${(await fs.readFile(path.join(process.cwd(), 'public', 'logo.png'))).toString('base64')}`; } catch { return undefined; }
}

/** Makes the PDF of one revision copy (`row` gives the request's code, rep, date and photos). */
export async function renderRevisionPdf(admin: SupabaseClient, row: Record<string, unknown>, snap: TechFileSnapshot, repName: string | null): Promise<Buffer> {
  const { data: gt, error: gtErr } = await admin.from('garment_types').select('template_family, template_modules').eq('key', snap.garmentType).maybeSingle();
  if (gtErr) throw new TemplateUnavailableError();
  // The template versions the tech file was made with (task 31); never quietly a different template.
  const t = resolveTemplateChecked(snap.garmentType, (gt?.template_family as string | null) ?? null, await getTemplateCatalog(admin), snap.analysis?.template?.versions, gt ? { family: gt.template_family ?? null, modules: gt.template_modules ?? null } : null);
  const rep = {
    id: String(row.id), requestCode: (row.request_code as string) || String(row.id), clientName: snap.clientName, productName: snap.productName,
    garmentType: snap.garmentType, status: row.status, submissionDate: (row.submission_date as string) || String(row.created_at || '').slice(0, 10),
    images: [], specs: snap.specs, messages: [], aiAnalysis: snap.analysis, repName,
  } as unknown as ReplicationRequest;
  const d = buildTechFileData(rep, await photoDataUrls(admin, row.images), await logoDataUrl(), {
    family: { key: t.family.key }, parts: t.parts.map((p) => ({ key: p.key, label: p.label, points: p.points.map((x) => ({ code: x.code, name: x.name })) })),
  });
  return renderToBuffer(TechPackPDF({ d }));
}

/** Uploads a PDF once (never overwriting) and returns where it is and its fingerprint. */
export async function storeRevisionPdf(admin: SupabaseClient, replicationId: string, revision: number, pdf: Buffer): Promise<{ path: string; sha256: string }> {
  const p = `${replicationId}/revisions/rev-${revision}-${randomUUID()}.pdf`;
  const { error } = await admin.storage.from(TECH_FILES_BUCKET).upload(p, pdf, { contentType: 'application/pdf', upsert: false });
  if (error) throw new Error(error.message);
  return { path: p, sha256: sha256(pdf) };
}
