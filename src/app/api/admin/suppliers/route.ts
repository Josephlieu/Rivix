import { NextRequest, NextResponse } from 'next/server';
import { adminCtx, bad, readJson } from '@/lib/catalog-route';
import { SUPPLIER_COLUMNS, createSupplier } from '@/lib/catalog-server';
import { SUPPLIER_SPEC, auditNames, checkFields } from '@/lib/catalog-fields';
import { audit } from '@/lib/audit';

// Suppliers (2026-11-21, admin only). GET: the list (?q= part of the name or code, ?active=true|false), with how many products
// each one supplies. POST: a new supplier; the server picks its random code. Contacts are a separate route.
export async function GET(req: NextRequest) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  let q = c.admin.from('suppliers').select(`${SUPPLIER_COLUMNS}, product_suppliers(count)`).order('name');
  const active = req.nextUrl.searchParams.get('active');
  if (active === 'true' || active === 'false') q = q.eq('active', active === 'true');
  const { data, error } = await q;
  if (error) return bad('Could not read the suppliers.', 500);
  const term = (req.nextUrl.searchParams.get('q') ?? '').trim().toLowerCase();
  const rows = (data ?? []).filter((s) => !term || String(s.name).toLowerCase().includes(term) || String(s.code).toLowerCase().includes(term));
  return NextResponse.json({ suppliers: rows.map(({ product_suppliers: ps, ...s }) => ({ ...s, productCount: (ps as unknown as Array<{ count: number }>)?.[0]?.count ?? 0 })) });
}

export async function POST(req: NextRequest) {
  const c = await adminCtx(); if (c instanceof NextResponse) return c;
  const body = await readJson(req); if (!body) return bad('Bad request');
  const f = checkFields(SUPPLIER_SPEC, body, 'create');
  if (f.errors.length) return bad(f.errors.join(' '));
  const r = await createSupplier(c.admin, f.values);
  if (!r.row) return bad(r.error ?? 'Could not create the supplier.', r.status ?? 400);
  const audited = await audit(c.admin, c.actor, { action: 'supplier.create', table: 'suppliers', id: r.row.id as string, route: 'POST /api/admin/suppliers', after: auditNames({ ...f.values, code: r.row.code }, 'supplier_code') });
  return NextResponse.json({ supplier: r.row, ...audited }, { status: 201 });
}
