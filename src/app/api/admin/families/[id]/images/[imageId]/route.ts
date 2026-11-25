import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, beforeAfter, isId, readJson } from '@/lib/catalog-route';
import { IMAGE_BUCKET } from '@/lib/image-files';
import { IMAGE_COLUMNS } from '@/lib/catalog-families';
import { audit } from '@/lib/audit';

// One family image (2026-11-26, two-step admins). PATCH { sort?, alt_text? }. DELETE removes the row and the stored file.
type P = { params: Promise<{ id: string; imageId: string }> };
export async function PATCH(req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id, imageId } = await params; if (!isId(id) || !isId(imageId)) return bad('Image not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  const { data: before } = await c.admin.from('family_images').select(IMAGE_COLUMNS).eq('id', imageId).eq('family_id', id).maybeSingle();
  if (!before) return bad('Image not found.', 404);
  const values: Record<string, unknown> = {};
  if ('sort' in body) { const n = Number(body.sort); if (!Number.isInteger(n) || Math.abs(n) > 1000) return bad('Sort must be a whole number.'); values.sort = n; }
  if ('alt_text' in body) { const t = typeof body.alt_text === 'string' ? body.alt_text.trim() : ''; if (t.length > 200) return bad('The description is longer than 200 characters.'); values.alt_text = t || null; }
  const d = beforeAfter(before, values);
  if (!d.changed) return NextResponse.json({ image: before, changed: false });
  const { data, error } = await c.admin.from('family_images').update(d.after).eq('id', imageId).select(IMAGE_COLUMNS).single();
  if (error) return bad(error.message);
  const audited = await audit(c.admin, c.actor, { action: 'family_image.edit', table: 'family_images', id: imageId, route: 'PATCH /api/admin/families/[id]/images/[imageId]', before: d.before, after: d.after });
  return NextResponse.json({ image: data, changed: true, ...audited });
}
export async function DELETE(_req: NextRequest, { params }: P) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id, imageId } = await params; if (!isId(id) || !isId(imageId)) return bad('Image not found.', 404);
  const { data: img } = await c.admin.from('family_images').select('id, file_path, file_name, file_sha256').eq('id', imageId).eq('family_id', id).maybeSingle();
  if (!img) return bad('Image not found.', 404);
  const { error } = await c.admin.from('family_images').delete().eq('id', imageId);
  if (error) return bad(error.message, 500);
  await c.admin.storage.from(IMAGE_BUCKET).remove([img.file_path]);
  const audited = await audit(c.admin, c.actor, { action: 'family_image.delete', table: 'family_images', id: imageId, route: 'DELETE /api/admin/families/[id]/images/[imageId]', before: { file_name: img.file_name, file_sha256: img.file_sha256 }, after: null });
  return NextResponse.json({ ok: true, ...audited });
}
