import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';

// Every order from every rep, for the admin Orders list.
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { data, error } = await createAdminClient()
    .from('orders')
    .select('id, batch_number, product_name, quantity, status, created_at, customers(id, company_name, customer_code, rep:reps(name))')
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    orders: (data || []).map((o: any) => ({
      id: o.id,
      batch_number: o.batch_number,
      product_name: o.product_name,
      quantity: o.quantity,
      status: o.status,
      created_at: o.created_at,
      customer_id: o.customers?.id ?? null,
      customer: o.customers?.company_name ?? '',
      customer_code: o.customers?.customer_code ?? '',
      rep: o.customers?.rep?.name ?? null,
    })),
  });
}
