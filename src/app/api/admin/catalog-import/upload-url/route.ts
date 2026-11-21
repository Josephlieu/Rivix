import { NextResponse } from 'next/server';
import { adminCtx, bad, readJson } from '@/lib/catalog-route';
import { CERT_BUCKET, CERT_MAX_BYTES, isBatchId, safeName, stagingPrefix } from '@/lib/certificate-files';

// Import step 1 (2026-11-21, admin only): a one-time link for each certificate file, into this import's private staging folder
// (import/<batch>/<file name>). The dry run then reads the staged files by name; confirming copies each one to its final place.
export async function POST(req: Request) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const body = await readJson(req); if (!body) return bad('Bad request');
  if (!isBatchId(body.batch)) return bad('Bad import batch.');
  const name = safeName(String(body.file_name ?? ''));
  const size = Number(body.size);
  if (!Number.isFinite(size) || size <= 0) return bad(`${name}: the file is empty.`);
  if (size > CERT_MAX_BYTES) return bad(`${name}: certificate files must be 10 MB or smaller.`);
  const { data, error } = await c.admin.storage.from(CERT_BUCKET).createSignedUploadUrl(`${stagingPrefix(body.batch)}/${name}`, { upsert: true });
  if (error || !data) return bad('Could not start the upload.', 500);
  return NextResponse.json({ path: data.path, token: data.token, name });
}
