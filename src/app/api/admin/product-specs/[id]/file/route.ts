import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { SPEC_BUCKET } from '@/lib/product-specs';

// A 10-minute link to a spec's file, for the admin screen.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  const admin = createAdminClient();
  const { data: spec } = await admin.from('product_specs').select('file_url').eq('id', id).maybeSingle();
  if (!spec?.file_url) return NextResponse.json({ error: 'No file attached.' }, { status: 404 });
  const { data, error } = await admin.storage.from(SPEC_BUCKET).createSignedUrl(spec.file_url, 60 * 10);
  if (error || !data) return NextResponse.json({ error: 'Could not create the link' }, { status: 500 });
  return NextResponse.json({ url: data.signedUrl });
}
