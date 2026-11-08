import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { SPEC_BUCKET, SPEC_COLUMNS, checkSpecFields, checkUploadedSpecFile } from '@/lib/product-specs';

// Every product spec with its customer, for the admin screen.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  const admin = createAdminClient();
  const [{ data: specs, error }, { data: customers }] = await Promise.all([
    admin.from('product_specs').select(`${SPEC_COLUMNS}, customers(company_name, customer_code)`).order('created_at', { ascending: false }),
    admin.from('customers').select('id, company_name, customer_code').order('company_name'),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ specs: specs || [], customers: customers || [] });
}

// Create a spec for one customer, optionally with a file already uploaded through upload-url.
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const body = await req.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const checked = checkSpecFields(body, false);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 });

  const admin = createAdminClient();
  const { data: customer } = await admin.from('customers').select('id').eq('id', String(body.customer_id ?? '')).maybeSingle();
  if (!customer) return NextResponse.json({ error: 'Choose a customer.' }, { status: 400 });

  const path = body.path ? String(body.path) : null;
  if (path) {
    const f = await checkUploadedSpecFile(admin, customer.id, path);
    if (!f.ok) return NextResponse.json({ error: f.error }, { status: 400 });
  }
  const { data, error } = await admin.from('product_specs').insert({ ...checked.values, customer_id: customer.id, file_url: path }).select('id').single();
  if (error) {
    if (path) await admin.storage.from(SPEC_BUCKET).remove([path]);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id }, { status: 201 });
}
