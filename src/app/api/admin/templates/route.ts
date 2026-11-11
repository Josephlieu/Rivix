import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { clearTemplateCache } from '@/lib/template-store';
import { readTemplates, usageOf, hasDrawing } from '@/lib/template-admin-server';
import { cleanText, newTemplateKey, validateTemplate, describeTemplateChanges, type Kind } from '@/lib/template-admin';
import { recordCatalogChange, NOT_RECORDED } from '@/lib/catalog-log';
import type { TemplateBody } from '@/lib/template-catalog';

// Task 31 (two-step admins only): every template with its kind, current version, where it is used, and whether it has a drawing.
export async function GET() {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const d = await readTemplates(createAdminClient()).catch(() => null);
  if (!d) return NextResponse.json({ error: 'The templates could not be read. Try again in a minute.' }, { status: 503 });
  return NextResponse.json({
    templates: d.templates.map((t) => ({ key: t.key, kind: t.kind, label: t.label, description: t.description, version: t.current_version, active: t.active !== false, usage: usageOf(t.key, d), drawing: hasDrawing(t.key), certification: (d.versions.find((v) => v.template_key === t.key && v.version === t.current_version)?.body as TemplateBody)?.certification })),
  });
}

// Task 31: a new template, copied from an existing one (its current version), with a new name, as version 1. Recorded.
export async function POST(req: NextRequest) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const body = await req.json().catch(() => null);
  const label = cleanText(body?.label, 80);
  const fromKey = String(body?.fromKey ?? '');
  if (!label) return NextResponse.json({ error: 'Give the new template a name.' }, { status: 400 });
  const admin = createAdminClient();
  const d = await readTemplates(admin).catch(() => null);
  if (!d) return NextResponse.json({ error: 'The templates could not be read. Try again in a minute.' }, { status: 503 });
  const src = d.templates.find((t) => t.key === fromKey);
  if (!src) return NextResponse.json({ error: 'Choose the template to copy.' }, { status: 400 });
  if (d.templates.some((t) => t.label.toLowerCase() === label.toLowerCase())) return NextResponse.json({ error: 'There is already a template with that name.' }, { status: 409 });
  const srcBody = d.versions.find((v) => v.template_key === src.key && v.version === src.current_version)?.body as TemplateBody;
  const checked = validateTemplate(src.kind as Kind, { label, description: String(src.description ?? ''), body: srcBody }, { baseKeys: [], families: d.templates.filter((t) => t.kind === 'family').map((t) => t.key) });
  if (!checked.ok) return NextResponse.json({ error: checked.errors.join(' ') }, { status: 400 });
  const key = newTemplateKey(label, d.templates.map((t) => t.key), /^zz-/i.test(who.email));
  const v1 = { ...checked.draft.body, label: checked.draft.label, description: checked.draft.description };
  // The template and its version 1 point at each other, so they are created together in one transaction (task-31c SQL).
  const ins = await admin.rpc('create_template', { p_key: key, p_kind: src.kind, p_label: checked.draft.label, p_description: checked.draft.description, p_body: v1, p_created_by: who.email, p_note: `Copied from ${src.label} (${src.key} v${src.current_version})` });
  if (ins.error) return NextResponse.json({ error: /create_template/.test(ins.error.message) ? 'Creating templates is not set up yet: run task-31c-create-template-function.sql in Supabase.' : ins.error.message }, { status: 500 });
  clearTemplateCache();
  const ok = await recordCatalogChange(admin, who, { kind: 'template', key, action: `created "${label}" (version 1), copied from ${src.key} v${src.current_version}`, changes: describeTemplateChanges(null, checked.draft) });
  return NextResponse.json({ key, ...(ok ? {} : { warning: NOT_RECORDED }) }, { status: 201 });
}
