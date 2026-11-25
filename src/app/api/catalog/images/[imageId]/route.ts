import { NextResponse } from 'next/server';
import { catalogViewer } from '@/lib/catalog-public';
import { isId } from '@/lib/catalog-route';
import { IMAGE_BUCKET } from '@/lib/image-files';

// A family image (2026-11-26): a redirect to a 5-minute signed link in the private bucket. Customers and reps only for a
// published, active family; a two-step admin for any family (the Sourcing pages). The bucket itself is never public.
export async function GET(_req: Request, { params }: { params: Promise<{ imageId: string }> }) {
  const v = await catalogViewer(); if ('denied' in v) return v.denied;
  const { imageId } = await params;
  const notFound = NextResponse.json({ error: 'Image not found.' }, { status: 404 });
  if (!isId(imageId)) return notFound;
  const { data } = await v.admin.from('family_images').select('id, file_path, family:product_families(visible_to_customers, active)').eq('id', imageId).maybeSingle();
  const fam = (data as unknown as { family: { visible_to_customers: boolean; active: boolean } | null } | null)?.family;
  if (!data || (v.kind !== 'admin' && !(fam?.visible_to_customers && fam?.active))) return notFound;
  const { data: link } = await v.admin.storage.from(IMAGE_BUCKET).createSignedUrl((data as { file_path: string }).file_path, 300);
  if (!link?.signedUrl) return NextResponse.json({ error: 'Could not open the image.' }, { status: 500 });
  return NextResponse.redirect(link.signedUrl, { status: 302, headers: { 'Cache-Control': 'private, max-age=240' } });
}
