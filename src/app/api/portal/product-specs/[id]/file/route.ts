import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createSupabaseServerClient } from '@/lib/supabase-server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // RLS-scoped client (reads the caller's own cookies) — this is what
  // proves the requester actually owns this spec. Never skip this check
  // in favor of just trusting the id in the URL.
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const { data: spec, error: specError } = await supabase
    .from('product_specs')
    .select('file_url')
    .eq('id', id)
    .maybeSingle();

  if (specError || !spec) {
    // Either it doesn't exist, or RLS correctly hid it because it belongs
    // to someone else — same response either way, don't leak which.
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  if (!spec.file_url) {
    return NextResponse.json({ error: 'No file attached to this spec' }, { status: 404 });
  }

  // The bucket is private, so a signed URL has to come from the service
  // role — this only runs after the RLS-scoped check above confirmed
  // ownership.
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: signed, error: signError } = await admin.storage
    .from('product-specs')
    .createSignedUrl(spec.file_url, 60 * 10); // 10 minutes

  if (signError || !signed) {
    return NextResponse.json({ error: 'Could not generate file link' }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl });
}
