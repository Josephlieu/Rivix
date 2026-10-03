import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { createAdminClient } from '@/lib/supabase-admin';
import { isAdminUser } from '@/lib/admin-auth';
import { getCurrentRep } from '@/lib/current-rep';

// Returns a short-lived download link for one document — but only after checking
// that the caller is allowed to see it:
//   admin    -> any document
//   rep      -> documents of customers assigned to them
//   customer -> their own documents (database row security does this check)
export async function GET(req: NextRequest, { params }: { params: Promise<{ docId: string }> }) {
  const { docId } = await params;
  const wantDownload = new URL(req.url).searchParams.get('download') === '1';
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  const admin = createAdminClient();
  let filePath: string | null = null;
  let fileName: string | null = null;

  if (isAdminUser(user)) {
    const { data } = await admin.from('documents').select('file_path, file_name').eq('id', docId).maybeSingle();
    filePath = data?.file_path ?? null;
    fileName = data?.file_name ?? null;
  } else {
    const rep = await getCurrentRep();
    if (rep) {
      const { data } = await admin
        .from('documents')
        .select('file_path, file_name, customers!inner(rep_id)')
        .eq('id', docId)
        .eq('customers.rep_id', rep.id)
        .maybeSingle();
      filePath = data?.file_path ?? null;
      fileName = (data as any)?.file_name ?? null;
    } else {
      // Customer: the browser-session client only sees their own rows.
      const { data } = await supabase.from('documents').select('file_path, file_name').eq('id', docId).maybeSingle();
      filePath = data?.file_path ?? null;
      fileName = data?.file_name ?? null;
    }
  }

  // Same answer whether it doesn't exist or isn't yours, so ids can't be probed.
  if (!filePath) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data: signed, error } = await admin.storage.from('documents').createSignedUrl(filePath, 60 * 10, wantDownload && fileName ? { download: fileName } : undefined);
  if (error || !signed) return NextResponse.json({ error: 'Could not create the link' }, { status: 500 });
  return NextResponse.json({ url: signed.signedUrl });
}
