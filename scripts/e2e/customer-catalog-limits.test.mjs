// Customer catalogue limits (2026-11-26, approved), split from customer-catalog.test.mjs to keep each file short. Proves
// through the real routes that the server can add family images and cart lines up to the limits and is refused after them,
// and that the database refuses them too even with the server key: 10 images (the 11th refused), 25 cart lines (the 26th
// refused), 10 open sample requests per customer (the 11th refused; one more allowed once one is answered). Also the image
// size rules: a small file that decodes to 20000 x 20000 is refused with a clear message and nothing is stored; a photo's EXIF
// orientation is applied before the metadata is dropped; the longest side is at most 2400 px; small images are never enlarged.
// Test project only ("ZZ CTL" data, zz-ctl logins, deleted at the end; audit rows stay). Server on port 10001, EMAIL_DRY_RUN=1.
import { env as E2E_ENV } from './env.mjs'; // the test project only (guarded), never Development
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import { stepUp } from './mfa.mjs';
import zlib from 'zlib';
const require = createRequire(import.meta.url);
const { createServerClient } = require('@supabase/ssr');
const sharp = require('sharp');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);

const env = E2E_ENV;
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const a = createClient(U, env.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const anon = createClient(U, AK, { auth: { persistSession: false } });
const pw = 'Tmp-pass-9876!', t = Date.now(), tag = String(t).slice(-6), started = new Date(Date.now() - 5000).toISOString();
const users = [];
const mk = async (n, meta) => { const u = (await a.auth.admin.createUser({ email: `zz-ctl-${n}-${t}@yopmail.com`, password: pw, email_confirm: true, ...(meta ? { app_metadata: meta } : {}) })).data.user; users.push(u); return u; };
const signIn = async (email, two = false) => { const j = new Map(); const sb = createServerClient(U, AK, { cookies: { getAll: () => [...j].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => j.set(name, value)) } }); const x = await sb.auth.signInWithPassword({ email, password: pw }); if (x.error) throw x.error; if (two) await stepUp(sb); return { sb, cookie: [...j].map(([k, v]) => `${k}=${v}`).join('; ') }; };
const call = async (m, url, ck, body) => { const res = await fetch('http://localhost:10001' + url, { method: m, headers: { 'Content-Type': 'application/json', ...(ck ? { Cookie: ck } : {}) }, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' }); let j = {}; try { j = await res.json(); } catch { /* page */ } return { status: res.status, j }; };
const auditRows = async (action, id) => (await a.from('audit_log').select('id').eq('action', action).eq('record_id', String(id)).gte('at', started)).data ?? [];
const IMG_BUCKET = 'product-images';
let F = null, F2 = null, rep = null, cC = null;

try {
  const adm = await mk('a', { role: 'admin' }), ru = await mk('r', { role: 'rep' }), cuC = await mk('c');
  rep = (await a.from('reps').insert({ name: 'ZZ CTL Rep', email: ru.email, user_id: ru.id, active: true }).select('id').single()).data;
  cC = (await a.from('customers').insert({ user_id: cuC.id, company_name: 'ZZ CTL Co', contact_email: cuC.email, customer_code: '', rep_id: rep.id }).select('id').single()).data;
  const A = await signIn(adm.email, true), R1 = await signIn(ru.email), CC = await signIn(cuC.email);
  const ac = A.cookie;
  F = (await a.from('product_families').insert({ code: `ZZ${tag}-CTL`, name: 'ZZ CTL Glove', category: 'gloves', typical_sizes: ['M'], visible_to_customers: true }).select('id').single()).data;
  F2 = (await a.from('product_families').insert({ code: `ZZ${tag}-CTS`, name: 'ZZ CTL Sizes', category: 'gloves', visible_to_customers: false }).select('id').single()).data;
  const line = (fid, sizes) => ({ family_id: fid, sizes, spec: {} });
  const uploadImage = async (bytes, name, contentType, fam = F) => {
    const u = await call('POST', `/api/admin/families/${fam.id}/images/upload-url`, ac, { size: bytes.length });
    if (u.status !== 200) return u;
    const up = await anon.storage.from(IMG_BUCKET).uploadToSignedUrl(u.j.path, u.j.token, bytes, { contentType });
    if (up.error) return { status: 0, j: { error: up.error.message } };
    return call('POST', `/api/admin/families/${fam.id}/images`, ac, { path: u.j.path, file_name: name, alt_text: 'ZZ' });
  };
  const storedSize = async (imageId) => {
    const row = (await a.from('family_images').select('file_path').eq('id', imageId).single()).data;
    const blob = (await a.storage.from(IMG_BUCKET).download(row.file_path)).data;
    const m = await sharp(Buffer.from(await blob.arrayBuffer())).metadata();
    return { width: m.width, height: m.height, exif: !!m.exif, orientation: m.orientation };
  };
  let x;

  // ---- Image size rules (2026-11-26) -----------------------------------------------------------------------------------------
  // A small, valid PNG whose header says 20000 x 20000 (1-bit grey; the rows are all zeros, so it compresses to about 50 KB).
  const crc32 = (buf) => { let c = ~0; for (const b of buf) { c ^= b; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td)); return Buffer.concat([len, td, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(20000, 0); ihdr.writeUInt32BE(20000, 4); ihdr[8] = 1; ihdr[9] = 0; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const bomb = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(Buffer.alloc(20000 * 2501), { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  const bombMeta = await sharp(bomb, { limitInputPixels: false }).metadata();
  ok('the test PNG is small but decodes to 20000 x 20000', bomb.length < 1_000_000 && bombMeta.width === 20000 && bombMeta.height === 20000, `${bomb.length} bytes`);
  const rowsBefore = (await a.from('family_images').select('id', { count: 'exact', head: true }).eq('family_id', F2.id)).count;
  x = await uploadImage(bomb, 'zz-bomb.png', 'image/png', F2);
  const filesF2 = ((await a.storage.from(IMG_BUCKET).list(F2.id, { limit: 100 })).data ?? []).length;
  const pendingLeft = ((await a.storage.from(IMG_BUCKET).list(`pending/${adm.id}`, { limit: 100 })).data ?? []).length;
  ok('image: 20000 x 20000 is refused with a clear message (more than 40 million pixels); no row, no stored file, no pending file', x.status === 400 && /too large \(more than 40 million pixels\)/.test(x.j.error)
    && (await a.from('family_images').select('id', { count: 'exact', head: true }).eq('family_id', F2.id)).count === rowsBefore && filesF2 === 0 && pendingLeft === 0, `${x.status} ${x.j.error}; ${filesF2} files, ${pendingLeft} pending`);
  // A phone photo: stored 60 wide x 40 high, with EXIF orientation 6 (turn 90° clockwise to view), so it is really 40 x 60.
  const rotated = await sharp({ create: { width: 60, height: 40, channels: 3, background: { r: 10, g: 120, b: 200 } } }).jpeg().withMetadata({ orientation: 6 }).toBuffer();
  const rotMeta = await sharp(rotated).metadata();
  ok('the test JPEG is 60 x 40 with EXIF orientation 6', rotMeta.width === 60 && rotMeta.height === 40 && rotMeta.orientation === 6);
  x = await uploadImage(rotated, 'zz-phone.jpg', 'image/jpeg', F2);
  const rs = x.j.image ? await storedSize(x.j.image.id) : {};
  ok('image: the EXIF orientation is applied before the metadata goes: stored 40 x 60 (upright), no EXIF, no orientation tag', x.status === 201 && rs.width === 40 && rs.height === 60 && !rs.exif && !rs.orientation, `${x.status} ${JSON.stringify(rs)}`);
  const wide = await sharp({ create: { width: 3000, height: 1200, channels: 3, background: { r: 240, g: 240, b: 240 } } }).png().toBuffer();
  x = await uploadImage(wide, 'zz-wide.png', 'image/png', F2);
  const ws = x.j.image ? await storedSize(x.j.image.id) : {};
  ok('image: 3000 x 1200 is stored at 2400 x 960 (longest side at most 2400 px, shape kept)', x.status === 201 && ws.width === 2400 && ws.height === 960, `${x.status} ${JSON.stringify(ws)}`);
  const small = await sharp({ create: { width: 64, height: 48, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png().toBuffer();
  x = await uploadImage(small, 'zz-small.png', 'image/png', F2);
  const ss = x.j.image ? await storedSize(x.j.image.id) : {};
  ok('image: a small image is never enlarged (64 x 48 stays 64 x 48)', x.status === 201 && ss.width === 64 && ss.height === 48, `${x.status} ${JSON.stringify(ss)}`);
  // ---- Images: 10, then the 11th refused ------------------------------------------------------------------------------------
  const png = async (i) => sharp({ create: { width: 8, height: 8, channels: 3, background: { r: i * 20, g: 100, b: 100 } } }).png().toBuffer();
  const added = [];
  for (let i = 1; i <= 10; i++) added.push((await uploadImage(await png(i), `zz-${i}.png`, 'image/png')).status);
  ok('image: the server adds images 1 to 10', added.every((s) => s === 201) && (await a.from('family_images').select('id', { count: 'exact', head: true }).eq('family_id', F.id)).count === 10, added.join(','));
  x = await uploadImage(await png(11), 'zz-11.png', 'image/png');
  ok('image: the 11th is refused (409)', x.status === 409 && /at most 10 images/.test(x.j.error), `${x.status} ${x.j.error}`);
  const direct = await a.from('family_images').insert({ family_id: F.id, file_path: `zz-cat-direct-${tag}`, file_name: 'x', file_size: 1, mime_type: 'image/png', file_sha256: 'a'.repeat(64) });
  ok('image: the database itself refuses an 11th image row, even with the server key', /family_image_limit/.test(direct.error?.message ?? ''), direct.error?.message);
  const imgIds = (await a.from('family_images').select('id').eq('family_id', F.id)).data.map((i) => i.id);
  const lastImg = imgIds[imgIds.length - 1];
  x = await call('DELETE', `/api/admin/families/${F.id}/images/${lastImg}`, ac);
  ok('image: removing one writes one family_image.delete row', x.status === 200 && (await auditRows('family_image.delete', lastImg)).length === 1);


  // ---- Limits: 25 lines, 10 open samples -----------------------------------------------------------------------------------
  const lineStatuses = [];
  for (let i = 0; i < 25; i++) lineStatuses.push((await call('POST', '/api/portal/quote-cart/lines', CC.cookie, line(F.id, [{ size: 'M', qty: 50 + i }]))).status);
  ok('limits: the server adds cart lines 1 to 25', lineStatuses.every((s) => s === 201) && (await call('GET', '/api/portal/quote-cart', CC.cookie)).j.lines.length === 25, lineStatuses.join(','));
  x = await call('POST', '/api/portal/quote-cart/lines', CC.cookie, line(F.id, [{ size: 'M', qty: 60 }]));
  ok('limits: the 26th line is refused (409)', x.status === 409 && /at most 25 lines/.test(x.j.error), `${x.status} ${x.j.error}`);
  const draftC = (await a.from('quote_drafts').select('id').eq('customer_id', cC.id).single()).data;
  const d26 = await a.from('quote_draft_lines').insert({ draft_id: draftC.id, family_id: F.id, sizes: [{ size: 'M', qty: 60 }] });
  ok('limits: the database itself refuses a 26th line, even with the server key', /quote_line_limit/.test(d26.error?.message ?? ''), d26.error?.message);
  const sampleStatuses = [];
  for (let i = 0; i < 10; i++) sampleStatuses.push((await call('POST', '/api/portal/sample-requests', CC.cookie, { family_id: F.id, quantity: 1, spec: {} })).status);
  ok('limits: 10 open sample requests are accepted', sampleStatuses.every((s) => s === 201), sampleStatuses.join(','));
  x = await call('POST', '/api/portal/sample-requests', CC.cookie, { family_id: F.id, quantity: 1, spec: {} });
  ok('limits: the 11th open sample request is refused (409)', x.status === 409 && /10 open sample requests/.test(x.j.error), `${x.status} ${x.j.error}`);
  const s11 = await a.from('sample_requests').insert({ customer_id: cC.id, family_id: F.id, quantity: 1, created_by: cuC.id });
  ok('limits: the database itself refuses an 11th open sample request', /open_sample_limit/.test(s11.error?.message ?? ''), s11.error?.message);
  const oneC = (await a.from('sample_requests').select('id').eq('customer_id', cC.id).limit(1).single()).data;
  await call('PATCH', `/api/sample-requests/${oneC.id}`, R1.cookie, { action: 'sent' });
  ok('limits: once one is sent, a new one is accepted again', (await call('POST', '/api/portal/sample-requests', CC.cookie, { family_id: F.id, quantity: 1, spec: {} })).status === 201);

} catch (e) {
  ok('the customer-catalog limits test ran to the end', false, e instanceof Error ? e.stack?.split('\n').slice(0, 3).join(' | ') : String(e));
} finally {
  if (cC) { await a.from('sample_requests').delete().eq('customer_id', cC.id); await a.from('quote_drafts').delete().eq('customer_id', cC.id); }
  for (const fam of [F, F2].filter(Boolean)) {
    const { data: imgs } = await a.from('family_images').select('file_path').eq('family_id', fam.id);
    const real = (imgs ?? []).map((i) => i.file_path).filter((p) => !p.startsWith('zz-cat-'));
    if (real.length) await a.storage.from(IMG_BUCKET).remove(real);
    await a.from('family_images').delete().eq('family_id', fam.id);
    await a.from('product_families').delete().eq('id', fam.id);
  }
  for (const u of users.filter(Boolean)) { const { data: pend } = await a.storage.from(IMG_BUCKET).list(`pending/${u.id}`, { limit: 100 }); if (pend?.length) await a.storage.from(IMG_BUCKET).remove(pend.map((p) => `pending/${u.id}/${p.name}`)); }
  if (cC) await a.from('customers').delete().eq('id', cC.id);
  if (rep) { await a.from('rep_activity').delete().eq('rep_id', rep.id); await a.from('reps').delete().eq('id', rep.id); }
  const uids = users.map((u) => u?.id).filter(Boolean);
  if (uids.length) await a.from('notifications').delete().in('recipient_user_id', uids);
  for (const id of uids) await a.auth.admin.deleteUser(id);
  const left = (await a.from('product_families').select('id').like('name', 'ZZ CTL%')).data?.length ?? 0;
  const imgLeft = (await a.storage.from(IMG_BUCKET).list('', { limit: 100 })).data?.filter((f) => f.name !== 'pending' && f.name !== '.emptyFolderPlaceholder') ?? [];
  ok('cleaned up: no ZZ CTL family and no image file left (audit rows stay, by design)', left === 0 && imgLeft.length === 0, `${left} families, ${imgLeft.length} image folders`);
}
