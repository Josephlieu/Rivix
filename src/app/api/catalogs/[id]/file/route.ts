import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { CATALOG_BUCKET } from '@/lib/catalogs';

// A short-lived link to one catalog, for any signed-in user (customer, rep or admin). The row is read with the
// caller's own session, so row security decides; the bucket is private, so only this link opens the file.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const wantDownload = new URL(req.url).searchParams.get('download') === '1';
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const { data: cat } = await supabase.from('catalogs').select('file_path, file_name').eq('id', id).maybeSingle();
  if (!cat) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: signed, error } = await createAdminClient()
    .storage.from(CATALOG_BUCKET)
    .createSignedUrl(cat.file_path, 60 * 10, wantDownload && cat.file_name ? { download: cat.file_name } : undefined);
  if (error || !signed) return NextResponse.json({ error: 'Could not create the link' }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl });
}
