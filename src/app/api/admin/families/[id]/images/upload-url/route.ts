import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminCtx, bad, isId, readJson } from '@/lib/catalog-route';
import { IMAGE_BUCKET, IMAGE_MAX_BYTES } from '@/lib/image-files';
import { newPendingPath } from '@/lib/certificate-files';

// Family image upload, step 1 (2026-11-26, two-step admins): a one-time link into pending/<this admin's user id>/<uuid> of
// the private bucket. Step 2 (POST ../images) accepts only that admin's own pending path, re-encodes the image and stores it.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const { id } = await params; if (!isId(id)) return bad('Family not found.', 404);
  const body = await readJson(req); if (!body) return bad('Bad request');
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) return bad('Choose an image.');
  if (size > IMAGE_MAX_BYTES) return bad('Images must be 5 MB or smaller.');
  const path = newPendingPath(c.who.userId, crypto.randomUUID());
  const { data, error } = await c.admin.storage.from(IMAGE_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return bad('Could not start the upload.', 500);
  return NextResponse.json({ path: data.path, token: data.token });
}
