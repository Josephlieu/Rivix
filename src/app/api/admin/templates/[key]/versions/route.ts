import { NextRequest, NextResponse } from 'next/server';
import { getAdminIdentity } from '@/lib/require-admin';
import { createAdminClient } from '@/lib/supabase-admin';
import { clearTemplateCache } from '@/lib/template-store';
import { clearGarmentCache } from '@/lib/garment-types';
import { readTemplates, validationContext } from '@/lib/template-admin-server';
import { cleanText, validateTemplate, describeTemplateChanges, lowersCertification, CERT_WORDS, type Kind } from '@/lib/template-admin';
import { recordCatalogChange, NOT_RECORDED } from '@/lib/catalog-log';
import { adminUserIds, notifyUsers } from '@/lib/notify';
import type { TemplateBody } from '@/lib/template-catalog';

// Task 31: publish a template change as a NEW version (two-step admins only). A version is never edited in place (the
// database refuses it); existing tech files keep the versions they were made with. The version is checked (name, at least
// one section, unique field keys and measurement codes, size limits so the AI scan still fits), needs a change note, and
// is refused when someone else published since this editor was opened (baseVersion). Lowering the certification level
// needs a typed reason and alerts all admins. Every publication is recorded.
export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const who = await getAdminIdentity();
  if ('denied' in who) return who.denied;
  const { key } = await params;
  const input = await req.json().catch(() => null);
  if (!input || typeof input.body !== 'object') return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  const admin = createAdminClient();
  const d = await readTemplates(admin).catch(() => null);
  if (!d) return NextResponse.json({ error: 'The templates could not be read. Try again in a minute.' }, { status: 503 });
  const t = d.templates.find((x) => x.key === key);
  if (!t) return NextResponse.json({ error: 'Template not found.' }, { status: 404 });
  if (Number(input.baseVersion) !== Number(t.current_version)) return NextResponse.json({ error: `Someone published version ${t.current_version} of this template while you were editing. Reload it and make your changes again.`, code: 'stale' }, { status: 409 });
  const note = cleanText(input.note, 2000);
  if (note.length < 3) return NextResponse.json({ error: 'Say why you are changing the template (the change note).' }, { status: 400 });

  const checked = validateTemplate(t.kind as Kind, { label: input.label, description: input.description, body: input.body }, validationContext(d, key));
  if (!checked.ok) return NextResponse.json({ error: checked.errors.join(' '), errors: checked.errors }, { status: 400 });
  const curBody = d.versions.find((v) => v.template_key === key && v.version === t.current_version)?.body as TemplateBody;
  const changes = describeTemplateChanges({ label: t.label, description: t.description ?? '', body: curBody }, checked.draft);
  if (!changes.length) return NextResponse.json({ error: 'Nothing has changed: there is no new version to publish.' }, { status: 400 });
  const lowered = lowersCertification(curBody.certification, checked.draft.body.certification);
  const reason = cleanText(input.certificationReason, 1000);
  if (lowered && reason.length < 10) return NextResponse.json({ error: `Lowering the certification level (${CERT_WORDS[curBody.certification]} → ${CERT_WORDS[checked.draft.body.certification]}) needs a reason: type why.`, code: 'reason-required' }, { status: 400 });

  const next = Number(t.current_version) + 1;
  const ins = await admin.from('template_versions').insert({ template_key: key, version: next, body: { ...checked.draft.body, label: checked.draft.label, description: checked.draft.description }, created_by: who.email, change_note: lowered ? `${note} | Certification lowered: ${reason}` : note });
  if (ins.error) return NextResponse.json({ error: /duplicate|unique/i.test(ins.error.message) ? 'Someone published a version of this template at the same moment. Reload it and try again.' : ins.error.message, code: 'stale' }, { status: 409 });
  const up = await admin.from('templates').update({ current_version: next, label: checked.draft.label, description: checked.draft.description, updated_at: new Date().toISOString() }).eq('key', key);
  if (up.error) return NextResponse.json({ error: up.error.message }, { status: 500 });
  clearTemplateCache(); clearGarmentCache();
  const ok = await recordCatalogChange(admin, who, { kind: 'template', key, action: `published version ${next}${lowered ? ' (certification lowered)' : ''}`, changes, note: lowered ? `${note}\nReason for lowering the certification level: ${reason}` : note });
  if (lowered) {
    await notifyUsers(admin, await adminUserIds(admin), {
      kind: 'template_certification_lowered',
      title: `Certification lowered: ${checked.draft.label}`,
      body: `${who.email} published version ${next}: ${CERT_WORDS[curBody.certification]} → ${CERT_WORDS[checked.draft.body.certification]}. Reason: ${reason}`.slice(0, 500),
      link: `/admin/replication/templates/${encodeURIComponent(key)}`,
    });
  }
  return NextResponse.json({ ok: true, version: next, changes, ...(ok ? {} : { warning: NOT_RECORDED }) });
}
