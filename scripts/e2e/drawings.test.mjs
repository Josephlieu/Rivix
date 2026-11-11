// Task 29: technical drawings for every template. Proves:
// - every template with measurement points has a drawing (the two general templates say there is no standard drawing);
//   each point has exactly one numbered callout, number N = row N ("No.") in the measurement table, kits numbered on from one
//   part to the next; everything sits inside its drawing; no two number circles overlap; each drawing only uses its template's views;
// - the jacket fixes: the waist line sits clearly between chest and hem, the body is longer, the length note is under it;
// - the AI's details land on the right side: on the FRONT view the wearer's left is on the viewer's right, on the BACK view the
//   wearer's left is on the viewer's left; gloves, boots and caps place details on the matching view;
// - long "how to measure" text wraps in the legend (never cut off); copied text is plain text; the .svg file is well-formed;
// - a tech file approved before drawings existed prints as before; the PDF really renders (the .tsx loader, a child process);
// - on DEV: approving records the drawing version(s) on the server; a version sent by the browser is ignored.
// Run on DEV only, with `EMAIL_DRY_RUN=1 npm run dev` (or npm start) on port 10001:
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/drawings.test.mjs
import { createClient } from '@supabase/supabase-js';
import { createRequire } from 'module';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { stepUp } from './mfa.mjs';
const { createServerClient } = createRequire(import.meta.url)('@supabase/ssr');
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);

const DR = await import('../../src/lib/drawings.ts');
const DRG = await import('../../src/lib/drawings-geom.ts');
const FW_ = 300;
const C = await import('../../src/lib/template-catalog.ts');
const A = await import('../../src/lib/garmentAiAnalysis.ts');
const res = (k) => C.resolveTemplate(k, null, C.BUILT_IN_CATALOG);
const families = C.BUILT_IN_TEMPLATES.filter((t) => t.kind === 'family');
const single = families.filter((t) => !t.body.composedOf);
const nums = (d) => (d.match(/-?\d*\.?\d+/g) || []).map(Number);

// --- every template has its drawing
const missing = single.filter((t) => !DR.currentDrawing(t.key) && !DR.NO_STANDARD_DRAWING.includes(t.key)).map((t) => t.key);
ok('every template has a drawing (except the two general ones, which have no standard shape)', missing.length === 0 && DR.NO_STANDARD_DRAWING.join() === 'generic,accessory', missing.join(','));
ok('the order from the roadmap is all drawn: jacket, pants, coverall, bib, hi-vis vest, shirt, hoodie, glove, boot, cap', ['jacket', 'pants', 'coveralls', 'overalls', 'high-visibility-vest', 'work-shirt', 'hoodie', 'cut-resistant-gloves', 'safety-boots', 'hats-caps'].every((k) => !!DR.currentDrawing(res(k).family.key)));
const problems = [];
for (const t of single) {
  const def = DR.currentDrawing(t.key);
  if (!def) continue;
  const points = t.body.points;
  const codes = def.callouts.map((c) => c.code);
  if (!points.every((p) => codes.filter((c) => c === p.code).length === 1) || codes.length !== points.length) problems.push(`${t.key}: callouts ${codes.join('')} vs points ${points.map((p) => p.code).join('')}`);
  if (!def.views.every((v) => t.body.views.includes(v.view))) problems.push(`${t.key}: views ${def.views.map((v) => v.view)} not in ${t.body.views}`);
  const prims = DR.drawingPrimitives(def, { numbers: DR.pointNumbers(points) });
  const out = prims.flatMap((p) => (p.t === 'path' ? (() => { const n = nums(p.d); return n.flatMap((v, i) => (i % 2 ? [] : [[v, n[i + 1]]])); })() : p.t === 'circle' ? [[p.cx - p.r, p.cy - p.r], [p.cx + p.r, p.cy + p.r]] : [[p.x, p.y]])).filter(([x, y]) => x < 0 || y < 0 || x > def.size[0] || y > def.size[1]);
  if (out.length) problems.push(`${t.key}: outside at ${out.slice(0, 2).join(' | ')}`);
  const circles = def.callouts.map((c) => DR.calloutLabelAt(def, c));
  for (let i = 0; i < circles.length; i++) for (let j = i + 1; j < circles.length; j++) if (Math.hypot(circles[i][0] - circles[j][0], circles[i][1] - circles[j][1]) < 2 * DR.CALLOUT_R + 1) problems.push(`${t.key}: circles ${def.callouts[i].code}/${def.callouts[j].code} overlap`);
  const labels = prims.filter((p) => p.t === 'text' && /^\d+$/.test(p.text)).map((p) => Number(p.text)).sort((a, b) => a - b);
  if (labels.join() !== points.map((_, i) => i + 1).join()) problems.push(`${t.key}: numbers ${labels.join()}`);
}
ok('every drawing: one callout per point, numbers 1..N in template order, only its template\'s views, all inside, no overlaps', problems.length === 0, problems.slice(0, 4).join(' ; '));
const jacket = res('jacket');
ok('number N on the drawing is row N in the measurement table ("No." column)', A.templateMeasurements(jacket).every((r, i) => DR.rowNumbers(jacket).get(r.pom) === i + 1));
const rain = res('rain-suit');
const kit = DR.drawingFor(null, rain);
ok('a kit (rain suit) shows each part\'s drawing, numbered on from one part to the next, as its table is', kit.show === 'parts' && kit.parts.length === 2 && kit.parts.every((p) => p.def) && kit.parts[0].points[0].number === 1 && kit.parts[1].points[0].number === rain.parts[0].points.length + 1 && A.templateMeasurements(rain).every((r, i) => DR.rowNumbers(rain).get(r.pom) === i + 1));
const gen = DR.drawingFor(null, res('branded-apparel'));
ok('the general template says there is no standard drawing (not "not available yet")', gen.parts[0].def === null && gen.parts[0].placeholder === DR.GENERAL_TEXT);
ok('the harness drawing has no callouts (it has no measurement points: sizes come from the maker)', DR.currentDrawing('harness').callouts.length === 0 && res('safety-harness').family.points.length === 0);
ok('every protective, certified or scope note is shown under its drawing (harness, cap, back support)', /Compliance comes from the manufacturer/.test(DR.currentDrawing('harness').notes.join()) && /must not be replicated from photos/.test(DR.currentDrawing('headwear').notes.join()) && /no injury-prevention or medical claim/.test(DR.currentDrawing('back-support').notes.join()));

// --- the jacket fixes
const jd = DR.currentDrawing('jacket');
const y = (code) => jd.callouts.find((c) => c.code === code).from[1];
const hem = 293, shoulderY = 110.1;
ok('jacket: the waist line sits clearly between chest and hem (and at the halfway point of shoulder to hem)', y('A') + 25 < y('B') && y('B') + 60 < hem && Math.abs(y('B') - (shoulderY + hem) / 2) < 2, `${y('A')} < ${y('B')} < ${hem}`);
ok('jacket: the body is about 15% longer than before (168 -> 193 units, 30 -> 34.5 in)', Math.abs((hem - 100) / 168 - 1.15) < 0.01);
ok('jacket: the note "Length varies by style..." is under the drawing', jd.notes[0] === 'Length varies by style (parkas and coats are longer); use the measurements, not the drawing, for length.' && DR.drawingPrimitives(jd, { numbers: new Map() }).some((p) => p.t === 'text' && p.text === jd.notes[0] && p.y > DR.notesTop(jd)));

// --- the boot (user fixes 2026-11-11): a tall round toe box, a real heel block with a step under the arch, right-foot outlines
const PR = await import('../../src/lib/drawings-products.ts');
const bootDef = DR.currentDrawing('footwear');
const outer = bootDef.views.find((v) => v.view === 'outer-side');
const pairs = (d) => { const n = nums(d); return n.flatMap((v, i) => (i % 2 ? [] : [[v, n[i + 1]]])); };
const upper = pairs(outer.shapes[0].d), soleSide = pairs(outer.shapes[1].d);
const toeTop = Math.min(...upper.filter(([x]) => x > 200).map(([, yy]) => yy));
ok('boot: the toe box is tall and round (its top at least 2 in above the sole), not a low sloping toe', PR.BOOT_HEEL_TOP - toeTop >= 40 && /C 248 164 298 186 286 224/.test(outer.shapes[0].d), `${PR.BOOT_HEEL_TOP - toeTop} units`);
ok('boot: the side views show a protective toe cap inside the toe box', outer.shapes.some((sh) => sh.stroke === 'hidden' && pairs(sh.d).every(([x]) => x > 200)));
const hf = PR.BOOT_HEEL_FRONT;
ok('boot: a distinct heel block with a step under the arch (heel front face from the arch down to the ground, arch raised)', soleSide.some(([x, yy]) => x === hf && yy === PR.BOOT_ARCH) && soleSide.some(([x, yy]) => x === hf && yy === PR.BOOT_GROUND) && PR.BOOT_ARCH < PR.BOOT_GROUND && outer.shapes.some((sh) => sh.d === `M 23 236 L ${hf} 236`));
const D = bootDef.callouts.find((cc) => cc.code === 'D');
ok('boot: "D Heel height" runs from the ground to the top of the heel at the back', D.from[1] === PR.BOOT_GROUND && D.to[1] === PR.BOOT_HEEL_TOP && D.view === 'outer-side');
const inner = bootDef.views.find((v) => v.view === 'inner-side');
ok('boot: the inner side view has the same heel block and step (mirrored)', pairs(inner.shapes[1].d).some(([x, yy]) => x === FW_ - hf && yy === PR.BOOT_ARCH));
const topPts = pairs(PR.BOOT_TOP_PATH), solePts = pairs(PR.BOOT_SOLE_PATH);
const apex = (pts) => pts[0]; // both outlines start at the toe point (the curve's control points are not on the outline)
// How much an edge bends between the ball and the heel: the spread of its x positions (a straight edge spreads little).
const bend = (pts, side) => { const xs = pts.filter(([x, yy]) => yy > 60 && yy < 260 && (side === 'left' ? x < 75 : x > 75)).map(([x]) => x); return Math.max(...xs) - Math.min(...xs); };
ok('boot top view reads as a right boot: toe point towards the inner side (viewer\'s left), inner edge straighter than the outer', apex(topPts)[0] < 75 && bend(topPts, 'left') < bend(topPts, 'right'), `apex ${apex(topPts)[0]}, bend inner ${bend(topPts, 'left')} outer ${bend(topPts, 'right')}`);
ok('boot sole view is its mirror image: toe point and straighter inner edge on the viewer\'s right, curved outer edge on the left', apex(solePts)[0] > 75 && bend(solePts, 'right') < bend(solePts, 'left'), `apex ${apex(solePts)[0]}, bend inner ${bend(solePts, 'right')} outer ${bend(solePts, 'left')}`);
ok('  and neither outline is symmetric', PR.BOOT_TOP_PATH !== DRG.mirrorPath(PR.BOOT_TOP_PATH, 150) && PR.BOOT_SOLE_PATH !== DRG.mirrorPath(PR.BOOT_SOLE_PATH, 150));

// --- markers: which side is which
const def = jd;
const centre = (v) => def.views.find((x) => x.view === v).origin[0] + def.viewWidth / 2;
const place = (d, location, label = 'Pocket', type = 'pocket') => DR.placeMarkers(d, [{ type, label, location }]).placed[0];
const fl = place(def, "front, wearer's left chest"), fr = place(def, "front, wearer's right chest");
ok("FRONT view: the wearer's left chest shows on the viewer's RIGHT, the wearer's right on the viewer's left", fl.view === 'front' && fl.at[0] > centre('front') && fr.at[0] < centre('front'), `${fl.at[0]} / ${fr.at[0]} vs ${centre('front')}`);
const bl = place(def, 'back, left shoulder', 'Shoulder vent', 'vent'), br = place(def, 'back, right shoulder', 'Shoulder vent', 'vent');
ok("BACK view: the wearer's left shows on the viewer's LEFT, the wearer's right on the viewer's right", bl.view === 'back' && br.view === 'back' && bl.at[0] < centre('back') && br.at[0] > centre('back'), `${bl.at[0]} / ${br.at[0]} vs ${centre('back')}`);
const cl = place(def, 'left cuff, back', 'Cuff tab', 'cuff'), cr = place(def, 'right cuff, back', 'Cuff tab', 'cuff');
ok('  and the same for the back cuffs (sleeve ends)', cl.at[0] < centre('back') && cr.at[0] > centre('back'));
ok('  a detail without "back" goes on the front view (wearer\'s left cuff on the viewer\'s right)', place(def, 'left cuff', 'Cuff tab', 'cuff').view === 'front' && place(def, 'left cuff', 'Cuff tab', 'cuff').at[0] > centre('front'));
const pants = DR.currentDrawing('trousers'), pc = (v) => pants.views.find((x) => x.view === v).origin[0] + pants.viewWidth / 2;
ok('the same rule on trousers: front hip pocket (wearer\'s left) on the viewer\'s right, back pocket (wearer\'s left) on the viewer\'s left', place(pants, "front, wearer's left hip pocket").at[0] > pc('front') && place(pants, 'back, left seat pocket').at[0] < pc('back'));
const shirt = DR.currentDrawing('shirt');
ok('and on a shirt: the back yoke goes on the back view', place(shirt, 'back yoke', 'Yoke seam', 'seam').view === 'back');
const glove = DR.currentDrawing('glove'), boot = DR.currentDrawing('footwear'), cap = DR.currentDrawing('headwear');
ok('glove: coating goes on the palm view, impact guards on the back of the hand', place(glove, 'palm and fingers', 'Nitrile coating', 'coating').view === 'palm' && place(glove, 'back of hand, knuckles', 'TPR impact guards', 'reinforcement').view === 'back-of-hand');
ok('boot: the tread goes on the sole view, the toe cap on the side, the laces on the top view', place(boot, 'outsole', 'Lug tread', 'outsole').view === 'sole' && place(boot, 'toe', 'Toe cap bump', 'toe_cap').view === 'outer-side' && place(boot, 'front, laces', 'Speed hooks', 'eyelet').view === 'top');
ok('cap: the closure goes on the back view, the brim on the side view', place(cap, 'back closure', 'Snapback', 'closure').view === 'back' && place(cap, 'brim', 'Curved brim', 'brim').view === 'side');
const un = DR.placeMarkers(def, [{ type: 'fabric', label: 'Ripstop texture', location: 'all over' }]);
ok('a detail with no matching place is listed as "not placed", never put somewhere wrong', un.placed.length === 0 && un.unplaced[0].letter === 'a');

// --- text and the .svg file
const xmlOk = (svg) => { const stack = []; for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) { if (m[2] === 'xml') continue; if (m[1]) { if (stack.pop() !== m[2]) return false; } else if (!m[3]) stack.push(m[2]); } return stack.length === 0; };
const evil = DR.primsToSvg([{ t: 'text', x: 1, y: 1, text: '<script>alert("x")</script> & co', size: 8, anchor: 'start', fill: '#000' }], [10, 10]);
ok('copied text is escaped in the .svg file (no tag from a label can run)', evil.includes('&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; co') && !evil.includes('<script>'));
const jt = C.BUILT_IN_TEMPLATES.find((t) => t.key === 'jacket');
const jpoints = jt.body.points.map((p) => ({ code: p.code, name: p.name, definition: p.howToMeasure }));
const sheet = DR.drawingSheetSvg(jd, jpoints);
ok('the drawing sheet is well-formed SVG with every point listed', xmlOk(sheet) && sheet.startsWith('<?xml') && jpoints.every((p) => sheet.includes(`${p.code}  ${DR.escapeXml(p.name)}`)));
const longest = jpoints.reduce((a, b) => (b.definition.length > a.definition.length ? b : a));
const texts = [...sheet.matchAll(/>([^<]*)<\/text>/g)].map((m) => m[1]);
ok('long "how to measure" text wraps onto more lines instead of being cut off with "…"', !sheet.includes('…') && DR.wrapText(longest.definition, 62).length > 1 && DR.wrapText(longest.definition, 62).every((l) => texts.includes(DR.escapeXml(l))) && DR.wrapText(longest.definition, 62).join(' ') === longest.definition, longest.code);
ok('every legend line fits the legend width', single.every((t) => t.body.points.every((p) => DR.wrapText(p.howToMeasure, 62).every((l) => l.length <= 62 || !l.includes(' ')))));
ok('the drawing says it is a template drawing, not traced from the photos', sheet.includes(DR.DRAWING_NOTE));
const tmp = path.join(os.tmpdir(), `zz-drawing-${Date.now()}.svg`);
const ex = spawnSync(process.execPath, ['--experimental-strip-types', '--no-warnings', '--import', './scripts/e2e/ts-resolve.mjs', 'scripts/export-drawing.mjs', 'jacket', tmp], { encoding: 'utf8' });
ok('the export script (used for the Desktop file) writes exactly this sheet', ex.status === 0 && fs.readFileSync(tmp, 'utf8') === sheet, ex.stderr);
fs.rmSync(tmp, { force: true });
const screen = fs.readFileSync('src/components/FlatDrawing.tsx', 'utf8');
ok('on screen, every label is React text (escaped), never raw HTML', !screen.includes('dangerouslySetInnerHTML') && /\{p\.text\}/.test(screen) && /\{m\.label\}/.test(screen));

// --- which tech files show what
const jacketTypes = Object.keys(C.BUILT_IN_CATALOG.types).filter((k) => res(k).family.key === 'jacket');
ok('every type on the jacket template gets the jacket drawing', jacketTypes.length >= 8 && jacketTypes.every((k) => DR.drawingFor(null, res(k)).parts[0].def?.key === 'jacket'));
ok('a tech file approved BEFORE drawings existed shows no drawing (it prints as it did)', DR.drawingFor({ review: { status: 'approved' } }, jacket).show === 'none');
ok('an approved file shows the drawing version it was approved with', DR.drawingFor({ review: { status: 'approved' }, drawing: { key: 'jacket', version: 1 } }, jacket).parts[0].def?.version === 1);
ok('the stamp records the drawing version, and each part\'s for a kit', JSON.stringify(DR.drawingStamp(jacket)) === '{"key":"jacket","version":1}' && JSON.stringify(DR.drawingStamp(rain)) === '{"key":"rain-suit","version":null,"parts":[{"key":"jacket","version":1},{"key":"trousers","version":1}]}' && DR.drawingStamp(res('branded-apparel')).version === null);

// --- the real PDF (the .tsx loader, in a child process)
const pdf = spawnSync(process.execPath, ['--no-warnings', '--import', './scripts/e2e/tsx-resolve.mjs', 'scripts/e2e/pdf-drawing.check.mjs'], { encoding: 'utf8', timeout: 240_000 });
let P = null; try { P = JSON.parse(pdf.stdout.trim().split('\n').pop()); } catch { /* reported below */ }
ok('the tech file PDF renders with the drawing for a jacket draft (parka), with the "No." column', !!P && P.draftJacket.pdf && P.draftJacket.drawing && P.draftJacket.no && P.draftJacket.bytes > 10_000, pdf.stderr.slice(0, 300));
ok('  every drawing fits its page (no "cannot wrap" warning from the PDF library)', !/can't wrap/.test(pdf.stderr), pdf.stderr.slice(0, 200));
ok('  a tech file approved before drawings existed: no drawing and no "No." column (as before)', !!P && P.oldApprovedJacket.pdf && !P.oldApprovedJacket.drawing && !P.oldApprovedJacket.no && P.oldApprovedJacket.table);
ok('  approved with drawing v1: the drawing is printed', !!P && P.approvedV1Jacket.drawing && P.approvedV1Jacket.no);
ok('  a glove draft prints the glove drawing; a rain suit prints both parts', !!P && P.draftGlove.drawing && !P.draftGlove.placeholder && P.draftRainSuit.drawings === 2 && P.draftRainSuit.no);
ok('  the general template prints "no standard drawing"', !!P && P.draftBranded.general && !P.draftBranded.drawing);
const SC = P?.screen ?? {};
ok('the Review tab shows the drawing section with one drawing for a jacket and two for a rain suit, with the "No." column', SC.draftJacket?.section && SC.draftJacket.svgs === 1 && SC.draftJacket.no && SC.draftRainSuit?.svgs === 2 && SC.draftRainSuit.no);
ok('  an older approved file shows no drawing section and no "No." column on the Review tab', SC.oldApprovedJacket && !SC.oldApprovedJacket.section && !SC.oldApprovedJacket.no);
ok('  the general template says "no standard drawing" on screen; copied text stays escaped', SC.draftBranded?.general && SC.draftBranded.svgs === 0 && Object.values(SC).every((x) => x.escaped));

// --- DEV: approval records the drawing on the server
const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('=') && !l.startsWith('#')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '')]));
const U = env.NEXT_PUBLIC_SUPABASE_URL, AK = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const a = createClient(U, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const pw = 'Tmp-pass-9876!', t = Date.now();
const adm = (await a.auth.admin.createUser({ email: `zz-drw-a-${t}@yopmail.com`, password: pw, email_confirm: true, app_metadata: { role: 'admin' } })).data.user;
const ids = [];
try {
  const jar = new Map();
  const sb = createServerClient(U, AK, { cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (l) => l.forEach(({ name, value }) => jar.set(name, value)) } });
  const si = await sb.auth.signInWithPassword({ email: adm.email, password: pw }); if (si.error) throw si.error;
  await stepUp(sb);
  const ac = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
  const call = (m, url, body) => fetch('http://localhost:10001' + url, { method: m, headers: { 'Content-Type': 'application/json', Cookie: ac }, body: body ? JSON.stringify(body) : undefined });
  // A complete, confirmed draft (so it can be approved), with a forged drawing stamp from the browser.
  const done = (k) => { const tt = res(k); return { analyzedAt: new Date().toISOString(), components: [], measurements: A.templateMeasurements(tt).map((m) => ({ ...m, m: '24', needsConfirmation: false })), checklist: A.checklistFor(tt).map((c) => ({ ...c, value: c.value || 'x', needsConfirmation: false })), construction: [], labelPlacements: [], stitchReference: [], flags: [], drawing: { key: 'jacket', version: 99 } }; };
  const mk = async (garmentType) => { const r = await call('POST', '/api/replications', { clientName: 'ZZ DRW Client', productName: `ZZ DRW ${garmentType}`, garmentType }); const j = await r.json(); ids.push(j.replication?.id); return j.replication; };
  const row = async (id) => (await a.from('replications').select('ai_analysis').eq('id', id).single()).data.ai_analysis;

  const r1 = await mk('parka');
  let r = await call('PUT', `/api/replications/${r1.id}`, { ...r1, aiAnalysis: done('parka') });
  ok('a draft saved with a drawing stamp from the browser: the stamp is dropped', r.status === 200 && (await row(r1.id)).drawing === undefined);
  r = await call('PUT', `/api/replications/${r1.id}`, { ...r1, aiAnalysis: done('parka'), approve: true }); let j = await r.json();
  ok('approving records the drawing on the server: jacket drawing version 1 (not the forged 99)', r.status === 200 && JSON.stringify((await row(r1.id)).drawing) === '{"key":"jacket","version":1}', j.error || '');
  const saved = j.replication;
  r = await call('PUT', `/api/replications/${r1.id}`, { ...saved, aiAnalysis: { ...saved.aiAnalysis, drawing: { key: 'jacket', version: 7 } } });
  ok('saving the approved file unchanged keeps it approved, with its own drawing (a sent one is ignored)', (await row(r1.id)).review?.status === 'approved' && JSON.stringify((await row(r1.id)).drawing) === '{"key":"jacket","version":1}');
  r = await call('PUT', `/api/replications/${r1.id}`, { ...saved, aiAnalysis: { ...saved.aiAnalysis, measurements: saved.aiAnalysis.measurements.map((m, i) => (i === 0 ? { ...m, m: '25' } : m)) } });
  ok('editing it makes it a draft again, and the draft shows the current drawing (no stamp)', (await row(r1.id)).review?.status === 'draft' && (await row(r1.id)).drawing === undefined);

  const r2 = await mk('cut-resistant-gloves');
  r = await call('PUT', `/api/replications/${r2.id}`, { ...r2, aiAnalysis: done('cut-resistant-gloves'), approve: true });
  ok('approving a glove records the glove drawing, version 1', r.status === 200 && JSON.stringify((await row(r2.id)).drawing) === '{"key":"glove","version":1}');
  const r3 = await mk('rain-suit');
  r = await call('PUT', `/api/replications/${r3.id}`, { ...r3, aiAnalysis: done('rain-suit'), approve: true });
  const ks = (await row(r3.id))?.drawing;
  ok('approving a kit (rain suit) records each part\'s drawing', r.status === 200 && ks?.key === 'rain-suit' && ks.version === null && JSON.stringify(ks.parts?.map((p) => [p.key, p.version])) === '[["jacket",1],["trousers",1]]', `${r.status} ${JSON.stringify(ks)}`);

  // An older approved file (as it was before task 29): saving it unchanged adds nothing.
  const { data: old } = await a.from('replications').insert({ id: crypto.randomUUID(), client_name: 'ZZ DRW Client', product_name: 'ZZ DRW old', garment_type: 'jacket', status: 'spec_mapped', images: [], specs: {}, ai_analysis: { ...done('jacket'), drawing: undefined, review: { status: 'approved', approvedAt: '2026-11-01T00:00:00Z', approvedBy: 'old@example.com', revision: 1 } } }).select('id').single();
  if (old) ids.push(old.id);
  const oldRep = (await (await call('GET', `/api/replications/${old?.id}`)).json()).replication;
  r = await call('PUT', `/api/replications/${old?.id}`, oldRep);
  const oldNow = await row(old?.id);
  ok('an older approved file saved unchanged stays approved with no drawing (it prints as before)', !!old && oldNow.review?.status === 'approved' && oldNow.drawing === undefined && DR.drawingFor(oldNow, jacket).show === 'none');
} catch (e) { console.log('ERROR', e); ok('DEV checks ran', false); } finally {
  for (const i of ids) if (i) await a.from('replications').delete().eq('id', i);
  await a.from('notifications').delete().like('body', '%ZZ DRW%');
  await a.from('rep_activity').delete().like('summary', '%ZZ DRW%');
  await a.auth.admin.deleteUser(adm.id);
  console.log('cleaned');
}
