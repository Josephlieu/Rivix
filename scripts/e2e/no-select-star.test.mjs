// H1 (2026-11-20): reads made with a signed-in user's own session name their columns, and never ask for a staff-only
// column. Offline: reads the source only (no database, no server). Run: node scripts/e2e/no-select-star.test.mjs
//
// "A signed-in user's own session" = the browser client (supabaseBrowser, or `supabase` from '@/lib/supabase') or a
// server client made from the user's cookies (createSupabaseServerClient / createServerClient / createBrowserClient).
// Reads through the service role (createAdminClient / `admin`) run on the server and are checked by the API's own rules.
// Every other client name counts as the user's session, so an unknown client fails until it is looked at.
//
// Checks:
//   1. no select('*') and no empty select() on a user-session query;
//   2. no user-session query names a flagged column (embedded tables too, e.g. rep:reps(...));
//   3. the column lists the customer pages use leave out the flagged columns;
//   4. getOrders is gone, and the customer's order type has none of the flagged fields.
import fs from 'fs';
import path from 'path';

const ok = (n, c, x = '') => console.log(c ? 'PASS' : 'FAIL', n, x);
const ROOT = 'src';

// The staff-only columns (H2 will refuse them to customers and reps in the database too).
const FLAGGED = {
  orders: ['pricing', 'special_requirements', 'inspector_name'],
  order_events: ['created_by'],
  documents: ['uploaded_by'],
  catalogs: ['uploaded_by'],
  document_requests: ['requested_by', 'done_by'],
  account_change_requests: ['decided_by'],
  order_requests: ['decided_by'],
  template_versions: ['created_by'],
  reps: ['territory'],
};

const files = [];
const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.(ts|tsx|js|jsx|mjs)$/.test(e.name)) files.push(p); } };
walk(ROOT);
ok(`source files found under ${ROOT}/`, files.length > 100, `${files.length} files`);

// Column-list constants (export const X = '...' + '...') from these files, so .select(X) can be resolved.
const constants = {};
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8');
  for (const m of s.matchAll(/export const ([A-Z_]+_COLUMNS)\s*=\s*((?:\s*'[^']*'\s*\+?)+);/g)) constants[m[1]] = [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]).join('');
}

/** Columns per table in a PostgREST select string: top-level ones for `table`, embedded ones for their own table. */
function columnsByTable(table, sel) {
  const out = { [table]: [] };
  let depth = 0, cur = '', stack = [table];
  const push = (c) => { c = c.trim(); if (!c) return; const name = c.split(':').pop().split('::')[0].trim(); (out[stack[stack.length - 1]] ??= []).push(name); };
  for (const ch of sel) {
    if (ch === '(') { const emb = cur.trim().split(':').pop().split('!')[0].trim(); stack.push(emb); out[emb] ??= []; cur = ''; depth++; }
    else if (ch === ')') { push(cur); cur = ''; stack.pop(); depth--; }
    else if (ch === ',') { push(cur); cur = ''; }
    else cur += ch;
  }
  push(cur);
  return out;
}

/** Comments blanked out (whole-line comments and trailing " // ..." ones), so the line numbers stay the same. */
const noComments = (src) => src.split('\n').map((l) => (/^\s*(\/\/|\/\*|\*)/.test(l) ? '' : l.replace(/\s\/\/\s.*$/, ''))).join('\n');

/** Every query in one file: user-session ones with their columns, and what is wrong with them. */
function scan(f, raw) {
  const s = noComments(raw);
  const out = { queries: [], star: [], flagged: [], unresolved: [], serviceRole: 0 };
  // The select's argument: a quoted string, a name (a *_COLUMNS constant), or nothing.
  for (const m of s.matchAll(/\.select\(\s*('[^']*'|"[^"]*"|`[^`]*`|[\w.]+|)\s*[,)]/g)) {
    // The query this select belongs to: the nearest .from('table') before it, in the same statement.
    const before = s.slice(Math.max(0, m.index - 800), m.index);
    const fromAt = before.lastIndexOf('.from(');
    if (fromAt < 0) continue;
    const between = before.slice(fromAt);
    if (/;|=>|\bfunction\b/.test(between)) continue; // a different statement (e.g. an input's .select())
    const tm = between.match(/^\.from\(\s*['"`](\w+)['"`]\s*\)/);
    if (!tm) continue;
    const table = tm[1];
    // The service role: a name containing "admin" (admin, ctx.admin, supabaseAdmin) or createAdminClient() itself.
    // Anything else counts as the user's session.
    const head = before.slice(0, fromAt).trimEnd();
    if (/[\w.]*admin\w*$/i.test(head) || /createAdminClient\(\s*\)$/.test(head)) { out.serviceRole++; continue; }
    const where = `${f}:${s.slice(0, m.index).split('\n').length}`;
    const arg = m[1].trim();
    let sel;
    if (arg === '' || /^['"`]\*['"`]$/.test(arg)) { out.star.push(`${where} (${table})`); continue; }
    if (/^['"`]/.test(arg)) sel = arg.slice(1, -1);
    else if (constants[arg] !== undefined) sel = constants[arg];
    else { out.unresolved.push(`${where} ${arg}`); continue; }
    out.queries.push({ where, table, sel });
    for (const [t, list] of Object.entries(columnsByTable(table, sel))) {
      if (list.includes('*')) out.star.push(`${where} (${t}: *)`);
      for (const c of list) if ((FLAGGED[t] || []).includes(c)) out.flagged.push(`${where} ${t}.${c}`);
    }
  }
  return out;
}

// The scanner itself: it must catch a bad query and pass a good one (made-up source, not a real file).
const bad = scan('selftest', [
  "const a = await supabaseBrowser.from('orders').select('*');",
  "const b = await supabaseBrowser\n  .from('orders')\n  .select('id, pricing')\n  .eq('id', x);",
  "const c = await sb.from('customers').select('id, rep:reps(name, territory)');",
  "const d = await supabase.from('order_events').insert(row).select();",
  "const e = await admin.from('orders').select('*');",
  "// supabaseBrowser.from('orders').select('*') in a comment",
].join('\n'));
ok('self-check: the scanner catches select(*) and an empty select() through the browser client', bad.star.length === 2, bad.star.join('; '));
ok('self-check: the scanner catches a flagged column, also inside an embedded table', bad.flagged.length === 2 && bad.flagged.some((x) => x.endsWith('reps.territory')), bad.flagged.join('; '));
ok('self-check: the service role and comments are skipped', bad.serviceRole === 1);
const good = scan('selftest', "const a = await supabaseBrowser.from('orders').select('id, batch_number', { count: 'exact' });");
ok('self-check: a named-column query passes', good.star.length + good.flagged.length === 0 && good.queries.length === 1);

const userQueries = [];
const problems = { star: [], flagged: [], unresolved: [] };
let serviceRole = 0;
for (const f of files) {
  const r = scan(f, fs.readFileSync(f, 'utf8'));
  userQueries.push(...r.queries); serviceRole += r.serviceRole;
  for (const k of Object.keys(problems)) problems[k].push(...r[k]);
}

ok('user-session queries were found (the scan works)', userQueries.length >= 10 && serviceRole >= 10, `${userQueries.length} user-session, ${serviceRole} service-role queries`);
ok('no user-session query uses select(\'*\') or an empty select()', problems.star.length === 0, problems.star.join('; '));
ok('no user-session query names a staff-only column', problems.flagged.length === 0, problems.flagged.join('; '));
ok('every user-session column list could be read (a string or a *_COLUMNS constant)', problems.unresolved.length === 0, problems.unresolved.join('; '));

// The pages H1 changed, one by one.
const storage = fs.readFileSync('src/lib/storage.ts', 'utf8');
const batch = fs.readFileSync('src/app/portal/orders/[batch]/page.tsx', 'utf8');
const certs = fs.readFileSync('src/app/portal/certificates/page.tsx', 'utf8');
const has = (where, table) => userQueries.some((q) => q.where.startsWith(where) && q.table === table);
ok('storage.ts reads customers, orders and product_specs with named columns', has('src/lib/storage.ts', 'customers') && has('src/lib/storage.ts', 'orders') && has('src/lib/storage.ts', 'product_specs'));
ok('the order page reads order_items, order_events and documents with named columns', ['order_items', 'order_events', 'documents'].every((t) => has('src/app/portal/orders/[batch]/page.tsx', t)));
ok('the documents page reads documents with named columns', has('src/app/portal/certificates/page.tsx', 'documents'));
ok('no select(\'*\') left in those three files (comments aside)', ![storage, batch, certs].some((s) => /select\(\s*['"`]\*['"`]\s*\)/.test(noComments(s))));
const orderCols = (constants.ORDER_COLUMNS || '').split(',').map((c) => c.trim());
ok('ORDER_COLUMNS leaves out pricing, special_requirements and inspector_name', orderCols.length > 5 && !orderCols.some((c) => FLAGGED.orders.includes(c)), orderCols.join(' '));
ok('DOCUMENT_COLUMNS leaves out uploaded_by', !!constants.DOCUMENT_COLUMNS && !constants.DOCUMENT_COLUMNS.includes('uploaded_by'));
ok('the order page\'s order_events read leaves out created_by', userQueries.some((q) => q.table === 'order_events' && q.where.startsWith('src/app/portal/orders/[batch]/page.tsx') && !q.sel.includes('created_by')));

// getOrders and the customer's order type.
ok('getOrders is gone from storage.ts', !/getOrders\b/.test(storage));
ok('nothing in src/ still uses getOrders', !files.some((f) => /\bgetOrders\b/.test(fs.readFileSync(f, 'utf8'))));
const type = storage.match(/export interface OrderData \{([\s\S]*?)\n\}/)?.[1] ?? '';
ok('the customer\'s order type (OrderData) was found', type.length > 0);
ok('OrderData has none of pricing, special_requirements, inspector_name', type.length > 0 && !FLAGGED.orders.some((c) => new RegExp(`\\b${c}\\b`).test(type)));
