import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminCtx, bad, readJson } from '@/lib/catalog-route';
import { CERT_BUCKET, CERT_MAX_BYTES, newPendingPath } from '@/lib/certificate-files';

// Step 1 of a certificate upload (2026-11-21, admin only): a one-time link to put the file straight into the private bucket
// under pending/<this admin's user id>/. Step 2 (POST /api/admin/certificates) accepts only a path in the same admin's
// pending folder (pendingPathFor), checks the file's content and records it; a refused file is removed. So step 2 never
// reads, moves or deletes a file another admin started (2026-11-26).
export async function POST(req: Request) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const body = await readJson(req); if (!body) return bad('Bad request');
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) return bad('Choose a file.');
  if (size > CERT_MAX_BYTES) return bad('Certificate files must be 10 MB or smaller.');
  const path = newPendingPath(c.who.userId, crypto.randomUUID());
  const { data, error } = await c.admin.storage.from(CERT_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return bad('Could not start the upload.', 500);
  return NextResponse.json({ path: data.path, token: data.token });
}
