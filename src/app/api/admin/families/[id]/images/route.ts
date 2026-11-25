import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminCtx, bad, isId, readJson } from '@/lib/catalog-route';
import { IMAGE_BUCKET, IMAGE_EXT, checkImageFile } from '@/lib/image-files';
import { reencodeImage } from '@/lib/image-reencode';
import { isOwnPendingPath, safeName } from '@/lib/certificate-files';
import { IMAGE_COLUMNS, MAX_IMAGES } from '@/lib/catalog-families';
import { audit } from '@/lib/audit';

// Family image upload, step 2 (2026-11-26, two-step admins): { path, file_name, alt_text }. Only this admin's own pending
// file is accepted (anything else is refused untouched). The file is checked by its content (JPEG, PNG or WebP; PDF and
// anything else refused), RE-ENCODED with sharp so no EXIF, GPS or other metadata survives, and only the re-encoded copy is
// stored. The pending upload is always removed. At most 10 images per family (also enforced by the database).
const LIMIT = `A family can have at most ${MAX_IMAGES} images. Remove one first.`;
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Family not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  const path = String(body.path ?? '');
  if (!isOwnPendingPath(path, c.who.userId)) return bad('Upload the file first.');
  const drop = () => c.admin.storage.from(IMAGE_BUCKET).remove([path]);
  const alt = typeof body.alt_text === 'string' ? body.alt_text.trim() : '';
  if (alt.length > 200) { await drop(); return bad('The description is longer than 200 characters.'); }
  const { data: fam } = await c.admin.from('product_families').select('id, code').eq('id', id).maybeSingle();
  if (!fam) { await drop(); return bad('Family not found.', 404); }
  const { count } = await c.admin.from('family_images').select('id', { count: 'exact', head: true }).eq('family_id', id);
  if ((count ?? 0) >= MAX_IMAGES) { await drop(); return bad(LIMIT, 409); }
  const { data: blob } = await c.admin.storage.from(IMAGE_BUCKET).download(path);
  if (!blob) return bad('The upload did not finish. Please try again.');
  const chk = checkImageFile(new Uint8Array(await blob.arrayBuffer()));
  if ('error' in chk) { await drop(); return bad(`Refused: ${chk.error}.`); }
  const clean = await reencodeImage(new Uint8Array(await blob.arrayBuffer()), chk.type);
  await drop(); // the original (with whatever metadata it had) is never kept
  if ('error' in clean) return bad(`Refused: ${clean.error}.`);
  const finalPath = `${id}/${crypto.randomUUID()}.${IMAGE_EXT[clean.type]}`;
  const up = await c.admin.storage.from(IMAGE_BUCKET).upload(finalPath, clean.bytes, { contentType: clean.type, upsert: false });
  if (up.error) return bad('The image could not be stored.', 500);
  const row = {
    family_id: id, file_path: finalPath, file_name: safeName(String(body.file_name ?? `image.${IMAGE_EXT[clean.type]}`)).replace(/\.[a-z0-9]+$/i, '') + `.${IMAGE_EXT[clean.type]}`,
    file_size: clean.bytes.length, mime_type: clean.type, file_sha256: crypto.createHash('sha256').update(clean.bytes).digest('hex'),
    sort: count ?? 0, alt_text: alt || null, uploaded_by: c.who.userId, uploaded_by_email: c.who.email,
  };
  const { data, error } = await c.admin.from('family_images').insert(row).select(IMAGE_COLUMNS).single();
  if (error) { await c.admin.storage.from(IMAGE_BUCKET).remove([finalPath]); return /family_image_limit/.test(error.message) ? bad(LIMIT, 409) : bad(error.message, 500); }
  const audited = await audit(c.admin, c.actor, { action: 'family_image.upload', table: 'family_images', id: data.id, route: 'POST /api/admin/families/[id]/images', after: { family_code: fam.code, file_name: row.file_name, file_sha256: row.file_sha256, mime_type: row.mime_type, width: clean.width, height: clean.height } });
  return NextResponse.json({ image: data, ...audited }, { status: 201 });
}
