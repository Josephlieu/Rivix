// Task 11: the AI fallback (gemini-3.1-flash-lite when the main model, gemini-3-flash-preview, is busy; also for the hiring tools), Google Search off by default, time limits
// and the "web means needs confirmation" rule. No database, no server, no AI call:
// the model is a fake function, so this uses no Gemini quota.
//   node --experimental-strip-types --no-warnings --import ./scripts/e2e/ts-resolve.mjs scripts/e2e/gemini-fallback.test.mjs
const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const G = await import('../../src/lib/gemini-model.ts');
const A = await import('../../src/lib/garmentAiAnalysis.ts');
const C = await import('../../src/lib/template-catalog.ts');
const resolveTemplate = (k, f) => C.resolveTemplate(k, f, C.BUILT_IN_CATALOG); // task 26: built-in catalog

const quota = () => new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED","message":"quota exceeded"}}');
const notFound = () => new Error('{"error":{"code":404,"status":"NOT_FOUND"}}');
const hung = () => { const e = new Error('The operation was aborted due to timeout'); e.name = 'TimeoutError'; return e; };
const headersTimeout = () => { const e = new TypeError('fetch failed'); e.cause = { code: 'UND_ERR_HEADERS_TIMEOUT' }; return e; };
// A fake model: `plan` says what each (model, withSearch) call does.
const fake = (plan) => { const calls = []; const ask = async (m, s) => { calls.push(`${m}${s ? '+search' : ''}`); const r = plan[`${m}${s ? '+search' : ''}`]; if (r instanceof Error) throw r; if (typeof r === 'function') throw r(); return r ?? 'answer'; }; return { ask, calls }; };
const models = ['vision-model', 'standard-model'];

let f = fake({});
let r = await G.askWithFallback(models, f.ask);
ok('normal case: the vision model with search answers first, nothing to say', r.model === 'vision-model' && r.searchSkipped === false && f.calls.join() === 'vision-model+search' && G.scanNote(models, r.model, r.searchSkipped) === '');

f = fake({ 'vision-model+search': quota });
r = await G.askWithFallback(models, f.ask);
ok('search out of quota: asked again without search, same model', r.model === 'vision-model' && r.searchSkipped === 'quota' && f.calls.join() === 'vision-model+search,vision-model');
ok('  and the note says the photos only were used', /Google Search was out of quota/.test(G.scanNote(models, r.model, r.searchSkipped)));

f = fake({ 'vision-model+search': hung });
r = await G.askWithFallback(models, f.ask);
ok('search did not answer in time: asked again without search (the task 11 hang)', r.model === 'vision-model' && r.searchSkipped === 'timeout' && f.calls.join() === 'vision-model+search,vision-model');
ok('  and the note says the first try timed out', /did not answer in time/.test(G.scanNote(models, r.model, r.searchSkipped)));

f = fake({ 'vision-model+search': headersTimeout });
r = await G.askWithFallback(models, f.ask);
ok('a connection that gave up waiting (fetch failed, headers timeout) counts as a timeout too', r.searchSkipped === 'timeout');

f = fake({ 'vision-model+search': quota, 'vision-model': quota });
r = await G.askWithFallback(models, f.ask);
const note = G.scanNote(models, r.model, r.searchSkipped);
ok('vision model out of quota: the standard model answers', r.model === 'standard-model' && f.calls.join() === 'vision-model+search,vision-model,standard-model+search');
ok('  and the fallback model message names both models', /main image model \(vision-model\) was not available/.test(note) && /used standard-model/.test(note), note);

f = fake({ 'vision-model+search': hung, 'vision-model': hung });
r = await G.askWithFallback(models, f.ask);
ok('vision model hangs both times: the standard model answers', r.model === 'standard-model');

f = fake({ 'vision-model+search': notFound });
r = await G.askWithFallback(models, f.ask);
ok('vision model name not found: the standard model answers', r.model === 'standard-model' && /was not available/.test(G.scanNote(models, r.model, r.searchSkipped)));

f = fake({ 'vision-model+search': () => new Error('{"error":{"code":400,"status":"INVALID_ARGUMENT","message":"API key not valid"}}') });
let thrown = null; try { await G.askWithFallback(models, f.ask); } catch (e) { thrown = e; }
ok('a refused key is not "busy": no fallback, the error goes to the admin', thrown && f.calls.length === 1);

f = fake({ 'vision-model+search': hung, 'vision-model': hung, 'standard-model+search': hung, 'standard-model': hung });
thrown = null; try { await G.askWithFallback(models, f.ask); } catch (e) { thrown = e; }
ok('everything times out: the timeout reaches the admin as a timeout', thrown && G.isTimeoutError(thrown));
const busy = new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later.","status":"UNAVAILABLE"}}');
ok('Google\'s "high demand" (503) is recognised as busy, not as a timeout or quota', G.isBusyError(busy) && !G.isTimeoutError(busy) && !G.isQuotaError(busy));
f = fake({ 'vision-model+search': () => busy });
r = await G.askWithFallback(models, f.ask);
ok('  a busy vision model falls back to the standard model', r.model === 'standard-model');
f = fake({ 'same+search': () => busy });
thrown = null; try { await G.askWithFallback(['same'], f.ask); } catch (e) { thrown = e; }
ok('  with only one model (the current default), the busy error reaches the admin as busy (the task 11 retry)', thrown && G.isBusyError(thrown));
ok('isTimeoutError is not fooled by quota or key errors', !G.isTimeoutError(quota()) && !G.isTimeoutError(new Error('API key not valid')));

// search off by default (task 11) and the scan's own fallback model
ok('Google Search is OFF unless GEMINI_SCAN_SEARCH=1', (() => { const before = process.env.GEMINI_SCAN_SEARCH; delete process.env.GEMINI_SCAN_SEARCH; const off = !G.scanSearchEnabled(); process.env.GEMINI_SCAN_SEARCH = '1'; const on = G.scanSearchEnabled(); if (before === undefined) delete process.env.GEMINI_SCAN_SEARCH; else process.env.GEMINI_SCAN_SEARCH = before; return off && on; })());
f = fake({});
r = await G.askWithFallback(models, f.ask, { search: false });
ok('search off: one call per model, never with search', f.calls.join() === 'vision-model' && r.searchSkipped === false && G.scanNote(models, r.model, r.searchSkipped) === '');
const busy503 = () => new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}');
f = fake({ 'gemini-3.8-flash': busy503 });
r = await G.askWithFallback(['gemini-3.8-flash', 'gemini-3.1-flash-lite'], f.ask, { search: false });
ok('search off and gemini-3.8-flash busy: gemini-3.1-flash-lite answers', r.model === 'gemini-3.1-flash-lite' && f.calls.join() === 'gemini-3.8-flash,gemini-3.1-flash-lite' && /gemini-3\.8-flash\) was not available/.test(G.scanNote(['gemini-3.8-flash', 'gemini-3.1-flash-lite'], r.model, r.searchSkipped)));
f = fake({ 'vision-model': hung });
r = await G.askWithFallback(models, f.ask, { search: false });
ok('search off and the vision model hangs: the fallback model answers', r.model === 'standard-model' && f.calls.join() === 'vision-model,standard-model');
// the code defaults (2026-11-12: gemini-3.8-flash did not answer, so both main models moved to gemini-3-flash-preview)
const gsrc = (await import('node:fs')).readFileSync(new URL('../../src/lib/gemini-model.ts', import.meta.url), 'utf8');
ok('code defaults: scan and hiring tools start with gemini-3-flash-preview, the fallback is gemini-3.1-flash-lite',
  /GEMINI_MODEL = process\.env\.GEMINI_MODEL \|\| 'gemini-3-flash-preview'/.test(gsrc)
  && /GEMINI_VISION_MODEL = process\.env\.GEMINI_VISION_MODEL \|\| 'gemini-3-flash-preview'/.test(gsrc)
  && /GEMINI_FALLBACK_MODEL = process\.env\.GEMINI_FALLBACK_MODEL \|\| 'gemini-3\.1-flash-lite'/.test(gsrc)
  && !/\|\| 'gemini-3\.8-flash'/.test(gsrc));
ok('without the env vars the main models are gemini-3-flash-preview', G.GEMINI_MODEL === (process.env.GEMINI_MODEL || 'gemini-3-flash-preview') && G.GEMINI_VISION_MODEL === (process.env.GEMINI_VISION_MODEL || 'gemini-3-flash-preview'));
ok('the fallback is gemini-3.1-flash-lite by default (gemini-2.5-flash is retired), a different model from the vision model', G.GEMINI_FALLBACK_MODEL === (process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.1-flash-lite') && G.GEMINI_FALLBACK_MODEL !== G.GEMINI_VISION_MODEL);
const P = await import('../../src/lib/garmentAiPrompt.ts');
const base = { photoCount: 1, typeName: 'High Visibility Vest', customerNotes: '', checklistText: '- x', flagList: '', suggestList: '' };
ok('search off: the prompt says there is no web search and never mentions Google Search', /You have no web search/.test(P.buildGarmentPrompt(base)) && !/Google Search/.test(P.buildGarmentPrompt(base)));
ok('search on: the prompt keeps the brand/model check rule', /Use Google Search only to check a printed brand and model/.test(P.buildGarmentPrompt({ ...base, searchAvailable: true })));

// the admin's message when no model answered (task 11 real scan: a timeout, then a retired fallback)
const retired = () => new Error('{"error":{"code":404,"message":"This model models/gemini-2.5-flash is no longer available to new users.","status":"NOT_FOUND"}}');
f = fake({ 'gemini-3.8-flash': hung, 'gemini-2.5-flash': retired });
thrown = null; try { await G.askWithFallback(['gemini-3.8-flash', 'gemini-2.5-flash'], f.ask, { search: false }); } catch (e) { thrown = e; }
const msg = G.noModelAnsweredMessage(thrown);
ok('timeout then a retired fallback: the message names both and what happened to each', msg === 'The AI could not do the scan: gemini-3.8-flash did not answer in time; gemini-2.5-flash is no longer available to this key (retired by Google). Set the model settings (GEMINI_VISION_MODEL, GEMINI_MODEL or GEMINI_FALLBACK_MODEL) to a model that runs.', msg);
f = fake({ 'gemini-3.8-flash': busy503, 'gemini-3-flash-preview': busy503 });
thrown = null; try { await G.askWithFallback(['gemini-3.8-flash', 'gemini-3-flash-preview'], f.ask, { search: false }); } catch (e) { thrown = e; }
ok('both busy: the message says so and to try again later', /gemini-3\.8-flash is busy.*gemini-3-flash-preview is busy.*Try again in a few minutes/.test(G.noModelAnsweredMessage(thrown)));
ok('an error that did not come from the model loop gets no model message', G.noModelAnsweredMessage(new Error('x')) === null);
ok('a model that answered is not mentioned (the note covers that case)', G.noModelAnsweredMessage(null) === null);

// the hiring tools (resume reader, interview questions): same fallback, own time limits
const hm = G.hiringModels();
ok('hiring tools try GEMINI_MODEL, then the same fallback as the scan', hm[0] === G.GEMINI_MODEL && hm.includes(G.GEMINI_FALLBACK_MODEL) && (hm.length === 2 || G.GEMINI_MODEL === G.GEMINI_FALLBACK_MODEL), hm.join(' -> '));
const hcalls = []; const hsignals = [];
const hcall = (plan) => async (model, signal) => { hcalls.push(model); hsignals.push(signal); const p = plan[model]; if (typeof p === 'function') throw p(); return p ?? `answer from ${model}`; };
let h = await G.askHiringModels(hcall({}), Date.now() + G.HIRING_BUDGET_MS, ['main', 'fallback']);
ok('hiring: the main model answers, no note', h.model === 'main' && h.response === 'answer from main' && G.hiringNote(['main', 'fallback'], h.model) === '');
ok('  every call gets a time limit', hsignals.every((sg) => sg instanceof AbortSignal && !sg.aborted));
hcalls.length = 0;
h = await G.askHiringModels(hcall({ main: busy503 }), Date.now() + G.HIRING_BUDGET_MS, ['main', 'fallback']);
ok('hiring: main model busy -> the fallback answers, with a note for the admin', h.model === 'fallback' && hcalls.join() === 'main,fallback' && /main AI model \(main\) was not available, so fallback was used/.test(G.hiringNote(['main', 'fallback'], h.model)));
h = await G.askHiringModels(hcall({ main: hung }), Date.now() + G.HIRING_BUDGET_MS, ['main', 'fallback']);
ok('hiring: main model too slow -> the fallback answers', h.model === 'fallback');
thrown = null; try { await G.askHiringModels(hcall({ main: busy503, fallback: retired }), Date.now() + G.HIRING_BUDGET_MS, ['main', 'fallback']); } catch (e) { thrown = e; }
ok('hiring: neither answers -> a plain message naming both, worded for the hiring tool', /^The AI could not read the resume: main is busy.*fallback is no longer available/.test(G.noModelAnsweredMessage(thrown, 'read the resume') || ''), G.noModelAnsweredMessage(thrown, 'read the resume'));
thrown = null; hcalls.length = 0; try { await G.askHiringModels(hcall({}), Date.now() + 10_000, ['main', 'fallback']); } catch (e) { thrown = e; }
ok('hiring: no call starts when the budget is nearly used up (it reports a timeout)', hcalls.length === 0 && G.isTimeoutError(thrown));
ok('hiring: each call is limited to 55 s inside a 110 s budget, so both models fit in maxDuration 120 s', G.HIRING_CALL_LIMIT_MS === 55_000 && G.HIRING_BUDGET_MS === 110_000 && 2 * G.HIRING_CALL_LIMIT_MS <= G.HIRING_BUDGET_MS && G.HIRING_BUDGET_MS < 120_000);
const fsm = await import('fs');
for (const [n, f] of [['resume reader', 'src/app/api/analyze-resume/route.ts'], ['interview questions', 'src/app/api/admin/hiring/candidates/[id]/questions/route.ts']]) {
  const src = fsm.readFileSync(f, 'utf8');
  ok(`the ${n} route uses the fallback helper, a time limit and maxDuration 120`, /askHiringModels\(/.test(src) && /abortSignal: signal/.test(src) && /export const maxDuration = 120/.test(src) && /noModelAnsweredMessage\(/.test(src) && !/model: GEMINI_MODEL/.test(src));
}

// time limits
const now = Date.now();
ok('no call starts with under 20 s of the budget left', G.callSignal(now + 15_000) === null);
const sg = G.callSignal(now + 270_000);
ok('a call gets a signal (the 120 s per-call limit)', sg instanceof AbortSignal && !sg.aborted && G.AI_CALL_LIMIT_MS === 120_000);
const short = G.callSignal(now + 26_000);
ok('near the end of the budget the signal is shorter than 120 s', short instanceof AbortSignal);
// (AbortSignal.timeout does not keep Node running on its own, so a plain timer keeps the test alive while it waits)
const keepAlive = setTimeout(() => {}, 1000);
const real = await new Promise((resolve) => { const s = AbortSignal.timeout(30); s.addEventListener('abort', () => resolve(s.reason)); });
clearTimeout(keepAlive);
ok('a real abort signal\'s error is recognised as a timeout', G.isTimeoutError(real), real?.name);
ok('the "no time left" error is recognised as a timeout', G.isTimeoutError(new G.OutOfTimeError()));
const budget = 2 * G.AI_CALL_LIMIT_MS + 10_000;
ok('worst case on the main path (first try + retry without search) fits in the 270 s budget and the 300 s maxDuration', budget <= 270_000 && 270_000 < 300_000, `${budget / 1000}s`);

// anything from the web needs confirmation
const vest = resolveTemplate('high-visibility-vest');
const fromPhoto = A.applyTemplate({ productIdentification: { mode: 'visual', brand: null, model: null, source: 'photos' }, colorway: { bodyColor: 'yellow', reflectiveTape: 'silver bands at hem and both front panels' }, checklist: [{ key: 'colour', value: 'Yellow body' }] }, vest);
ok('photo only: what the photo shows is not flagged', !fromPhoto.flags.includes('colorway.bodyColor') && fromPhoto.checklist.find((c) => c.key === 'colour').needsConfirmation === false);
const web = A.applyTemplate({ productIdentification: { mode: 'retail', brand: 'Acme', model: 'HV-1', source: 'https://example.com/hv-1' }, colorway: { bodyColor: 'yellow', reflectiveTape: '3M Scotchlite 8906, 50 mm' }, checklist: [{ key: 'colour', value: 'Yellow body' }, { key: 'garment-class', value: 'CSA Z96 Class 2' }] }, vest);
ok('a web (retail) match: every value is flagged', Object.keys(A.FLAGGABLE).every((p) => web.flags.includes(p)));
ok('  and every checklist item needs confirmation, including the claimed class', web.checklist.every((c) => c.needsConfirmation) && web.checklist.find((c) => c.key === 'garment-class').needsConfirmation);
ok('  so approval is blocked until a person confirms them', A.outstandingConfirmations(web).length >= Object.keys(A.FLAGGABLE).length);
ok('a web address as the source also counts as from the web', A.fromWeb({ productIdentification: { mode: 'visual', source: 'https://shop.example/x' } }) && !A.fromWeb({ productIdentification: { mode: 'visual', source: 'photos' } }));
