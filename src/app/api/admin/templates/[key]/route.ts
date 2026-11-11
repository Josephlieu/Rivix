import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { clearTemplateCache } from '@/lib/template-store';
import { readTemplates, usageOf, hasDrawing, validationContext } from '@/lib/template-admin-server';
import { recordCatalogChange, NOT_RECORDED } from '@/lib/catalog-log';

// Task 31 (two-step admins only): one template: its current version, every version (who, when, why), where it is used.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const { key } = await params;
  const d = await readTemplates(createAdminClient()).catch(() => null);
  if (!d) return NextResponse.json({ error: 'The templates could not be read. Try again in a minute.' }, { status: 503 });
  const t = d.templates.find((x) => x.key === key);
  if (!t) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
  return NextResponse.json({
    template: { key: t.key, kind: t.kind, label: t.label, description: t.description ?? '', version: t.current_version, active: t.active !== false, drawing: hasDrawing(t.key), usage: usageOf(t.key, d), context: validationContext(d, t.key) },
    versions: d.versions.filter((v) => v.template_key === key).map((v) => ({ version: v.version, body: v.body, by: v.created_by, at: v.created_at, note: v.change_note ?? '' })).reverse(),
  });
}

// Task 31: switch a template off or on. Templates are never deleted: one that is off is not offered for new product types;
// the types and tech files that use it keep working. Recorded.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const { key } = await params;
  const body = await req.json().catch(() => null);
  if (typeof body?.active !== 'boolean') return NextResponse.json({ error: 'Say whether to switch it on or off.' }, { status: 400 });
  const admin = createAdminClient();
  const { data: t } = await admin.from('templates').select('key, kind, active').eq('key', key).maybeSingle();
  if (!t) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
  if ((t.active !== false) === body.active) return NextResponse.json({ ok: true, unchanged: true });
  if (!body.active && (key === 'generic' || t.kind === 'base' && key === 'garment-base')) return NextResponse.json({ error: 'This template is the fallback for every product: it stays on.' }, { status: 400 });
  const { error } = await admin.from('templates').update({ active: body.active, updated_at: new Date().toISOString() }).eq('key', key);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  clearTemplateCache();
  const ok = await recordCatalogChange(admin, who, { kind: 'template', key, action: body.active ? 'switched on' : 'switched off', changes: [body.active ? 'Offered again for product types' : 'Not offered for new product types; types and tech files that use it keep working'] });
  return NextResponse.json({ ok: true, ...(ok ? {} : { warning: NOT_RECORDED }) });
}
