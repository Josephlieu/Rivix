// Who confirmed what (2026-11-18, RQ-0635: an AI scan showed seven checklist items as "Confirmed" though nobody had checked them).
//
// Only a PERSON confirms. A confirmation is a stamp the SERVER writes, `confirmedBy` (the signed-in admin's email) and
// `confirmedAt`, and only for the rows a save names in its explicit `confirmations` list (a single click or "Confirm all").
// `needsConfirmation: false` on its own, a stamp sent by the browser, or anything the AI sends never confirms anything.
//
// Confirmable rows: checklist items, measurements, markings, label rows and seams. Each is in one of three states:
//   'confirmed'  a person's stamp is on it (and its content has not changed since);
//   'read'       a checklist item the AI read from a photo (or an older item that said confirmed with no stamp): not checked;
//   'needs'      everything else: empty, the AI was unsure, a spec-sheet item, typed by hand and not confirmed yet.
// Approval needs a person's stamp on every row of those lists (checklist: every REQUIRED item).
// Pure, relative imports only (the e2e tests load it directly).
import { normalizeAnalysis } from './analysis-shape';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

export const CONFIRMABLE_LISTS = ['checklist', 'measurements', 'markings', 'labelPlacements', 'construction'] as const;
export type ConfirmableList = (typeof CONFIRMABLE_LISTS)[number];
export interface ConfirmationRef { list: ConfirmableList; ref: string }
export type ItemState = 'needs' | 'read' | 'confirmed';

const STATE_KEYS = ['needsConfirmation', 'confirmedBy', 'confirmedAt', 'readFromPhoto'];
const isObj = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const stable = (v: unknown): string => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Row).sort(([a], [b]) => a.localeCompare(b))) : x));
const hasValue = (r: Row) => String(r?.value ?? '').trim() !== '';

/** How a row is named in a save's `confirmations` list: a checklist item by its key, every other row by its position. */
export const rowRef = (list: ConfirmableList, row: Row, index: number): string => (list === 'checklist' ? String(row?.key ?? index) : String(index));

/** The row's content without its confirmation state: an edit changes it, a confirmation does not. */
export const fingerprint = (row: Row): string => stable(Object.fromEntries(Object.entries(row || {}).filter(([k]) => !STATE_KEYS.includes(k))));

/** A stamp the server wrote (who and when). */
export const isStamped = (row: unknown): boolean =>
  isObj(row) && row.needsConfirmation === false && typeof row.confirmedBy === 'string' && row.confirmedBy.trim() !== '' && typeof row.confirmedAt === 'string' && row.confirmedAt.trim() !== '';

/** 2026-11-20: a photo cannot show that tape or trim is reflective (grey or silver fabric looks the same). The words shown
 *  wherever such a value waits for a person: next to the value, never added to it (the stored value is never changed). */
export const REFLECTIVE_FLAG = 'Looks reflective: needs confirmation';
/** A checklist item about reflective (or retroreflective) tape, trim or material, by its key or its label. */
export const isReflectiveItem = (row: unknown): boolean =>
  isObj(row) && (/^(reflective|tape-layout)$/.test(String(row.key ?? '')) || /reflect/i.test(String(row.label ?? '')));

export function itemState(row: unknown, list: ConfirmableList = 'checklist'): ItemState {
  if (!isObj(row)) return 'needs';
  if (isStamped(row)) return 'confirmed';
  // A reflective item is never "read from photo", whatever an older file stored: only a person can confirm it.
  if (list === 'checklist' && !isReflectiveItem(row) && row.source !== 'document' && hasValue(row) && (row.readFromPhoto === true || row.needsConfirmation === false)) return 'read';
  return 'needs';
}

/** Checklist items a person can confirm with "Confirm all read-from-photo items": only 'read' ones, never spec-sheet items. */
export const readFromPhotoItems = (checklist: unknown): Row[] => (Array.isArray(checklist) ? checklist : []).filter((c) => itemState(c, 'checklist') === 'read');

/** The `confirmations` list from a request body: well-formed refs only, at most 2000. */
export function parseConfirmations(v: unknown): ConfirmationRef[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is ConfirmationRef => isObj(x) && (CONFIRMABLE_LISTS as readonly string[]).includes(String(x.list)) && (typeof x.ref === 'string' || typeof x.ref === 'number'))
    .slice(0, 2000).map((x) => ({ list: x.list, ref: String(x.ref) }));
}

/**
 * The analysis to store after a save, with its confirmation state decided by the server.
 * - `scan`: nothing is confirmed (a scan result never carries a confirmation, whatever it says).
 * - otherwise: a row keeps the saved stamp when its content is unchanged; a row named in `confirmations` and not already
 *   confirmed gets a new stamp for `actorEmail` at `now`; every other row is unconfirmed ('read' or 'needs').
 * Called with no actor, it only settles the state (keeps real stamps, ignores everything else): the canonical form used to
 * compare two copies of a tech file.
 */
export function settleConfirmations(next: unknown, saved: unknown, opts: { scan?: boolean; confirmations?: unknown; actorEmail?: string; now?: string } = {}): Row | null {
  const a = normalizeAnalysis<Row>(next);
  if (!a) return null;
  const s = normalizeAnalysis<Row>(saved);
  const wanted = new Set(!opts.scan && opts.actorEmail ? parseConfirmations(opts.confirmations).map((r) => `${r.list}\u0000${r.ref}`) : []);
  const now = opts.now || new Date().toISOString();
  for (const list of CONFIRMABLE_LISTS) {
    if (!Array.isArray(a[list])) continue;
    // Stamps already on the saved copy, matched by content (so a reordered row keeps its stamp, an edited one loses it).
    const pool = (!opts.scan && s && Array.isArray(s[list]) ? (s[list] as Row[]) : []).filter(isStamped).map((r) => ({ fp: fingerprint(r), r, used: false }));
    // A checklist value a person changed since the last save is theirs, not "read from photo" (only a scan reads from a photo).
    const savedValue = new Map<string, string>(!opts.scan && s && Array.isArray(s.checklist) ? (s.checklist as Row[]).map((c) => [String(c?.key), String(c?.value ?? '')]) : []);
    a[list] = (a[list] as Row[]).map((row, i) => {
      const clean: Row = Object.fromEntries(Object.entries(row).filter(([k]) => !STATE_KEYS.includes(k)));
      const fp = fingerprint(row);
      const kept = pool.find((p) => !p.used && p.fp === fp);
      if (kept) { kept.used = true; return { ...clean, needsConfirmation: false, confirmedBy: kept.r.confirmedBy, confirmedAt: kept.r.confirmedAt }; }
      if (wanted.has(`${list}\u0000${rowRef(list, row, i)}`)) return { ...clean, needsConfirmation: false, confirmedBy: opts.actorEmail, confirmedAt: now };
      // Not confirmed. A checklist value the AI read (or an older item that said "confirmed" with no stamp) is "read from photo".
      const typed = list === 'checklist' && savedValue.has(String(row.key)) && savedValue.get(String(row.key)) !== String(row.value ?? '');
      const read = list === 'checklist' && !typed && !isReflectiveItem(row) && row.source !== 'document' && hasValue(row) && (row.readFromPhoto === true || row.needsConfirmation === false);
      return { ...clean, needsConfirmation: true, ...(read ? { readFromPhoto: true } : {}) };
    });
  }
  return a;
}

/** Where the draft came from (2026-11-20), decided by the server on every admin save, never by the browser:
 *   'ai_scan' a scan save (`scan: true`): the values were drafted by the AI;
 *   'manual'  a person's save that created the request's FIRST analysis (none was saved before). A new request never carries
 *             an analysis (POST /api/replications drops it) and a rep cannot change one, so this can only be an admin's
 *             Review-tab draft: no scan was run.
 *   otherwise the saved marker is kept; an analysis saved before the marker existed stays unmarked (never guessed).
 *  Whatever `source` the browser sends is ignored. */
/** Audit log (2026-11-21): the items a save stamped (their confirmedAt is that save's time), as "list: label" lines. */
export function confirmedInSave(a: unknown, stamp: string): string[] {
  if (!isObj(a)) return [];
  const out: string[] = [];
  for (const list of CONFIRMABLE_LISTS) {
    const rows = Array.isArray(a[list]) ? (a[list] as Row[]) : [];
    rows.forEach((r, i) => {
      if (isStamped(r) && r.confirmedAt === stamp) out.push(`${list}: ${String(r.label ?? r.name ?? r.key ?? r.point ?? i + 1).slice(0, 120)}`);
    });
  }
  return out;
}

export type DraftSource = 'ai_scan' | 'manual';
export function settleSource(next: unknown, saved: unknown, opts: { scan?: boolean } = {}): Row | null {
  if (!isObj(next)) return null;
  const { source: _sent, ...rest } = next; // eslint-disable-line @typescript-eslint/no-unused-vars
  if (opts.scan) return { ...rest, source: 'ai_scan' };
  if (!isObj(saved)) return { ...rest, source: 'manual' };
  return saved.source === 'ai_scan' || saved.source === 'manual' ? { ...rest, source: saved.source } : rest;
}

/** The canonical form of a saved analysis: its real stamps kept, everything else unconfirmed. Never adds a stamp. */
export const canonicalAnalysis = (raw: unknown): Row | null => settleConfirmations(raw, raw);

/** Rows still waiting for a person's confirmation, by list (checklist: required items only). */
export function unconfirmedRows(a: unknown): Array<{ list: ConfirmableList; index: number; row: Row }> {
  const c = canonicalAnalysis(a);
  if (!c) return [];
  const out: Array<{ list: ConfirmableList; index: number; row: Row }> = [];
  for (const list of CONFIRMABLE_LISTS) {
    (Array.isArray(c[list]) ? (c[list] as Row[]) : []).forEach((row, index) => {
      if (list === 'checklist' && row.required !== true) return;
      if (!isStamped(row)) out.push({ list, index, row });
    });
  }
  return out;
}
