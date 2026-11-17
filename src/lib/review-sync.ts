// What the Review tab shows when a new copy of the request arrives from the server (2026-11-18: after an approval the tab kept
// an old copy, showed every item unconfirmed and "Unsaved changes", although the stamps were saved).
//
// Rules (a person's work is never dropped silently):
// - after OUR save, with nothing typed while it was saving: show the server's copy (with its stamps, approval and drawing);
//   clicks made while it was saving stay pending;
// - after our save, with something typed while it was saving: keep those edits on screen on top of the server's copy
//   (its stamps on the unchanged rows, its review and drawing) and say so;
// - a copy from elsewhere (a scan, another save): show it when nothing is unsaved, or when it has the same content as the
//   screen; otherwise keep the unsaved edits on screen and say so.
// Content is compared without what only the server sets (review, scan time, drawing stamp, confirmation state).
// Pure, relative imports only (the e2e tests load it directly).
import { settleConfirmations, type ConfirmationRef } from './checklist-confirm';

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
export interface ReviewDraft { specs: Row; analysis: Row }
/** What a save sent: the content key of the screen at that moment and the confirmations it carried. */
export interface SentSave { key: string; pending: ConfirmationRef[] }
export interface SyncResult { kind: 'load' | 'merge' | 'keep'; draft: ReviewDraft; baseline: string; pending: ConfirmationRef[]; notice: string | null }

const STATE_KEYS = ['needsConfirmation', 'confirmedBy', 'confirmedAt', 'readFromPhoto'];
const SERVER_KEYS = ['review', 'analyzedAt', 'drawing'];
const stable = (v: unknown): string => JSON.stringify(v ?? null, (k, x) => (STATE_KEYS.includes(k) ? undefined : x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x as Row).sort(([a], [b]) => a.localeCompare(b))) : x));

/** The content of a draft: specs and analysis without what only the server sets. Equal keys = the person has nothing new. */
export function contentKeyOf(d: ReviewDraft): string {
  const a = d.analysis && typeof d.analysis === 'object' ? Object.fromEntries(Object.entries(d.analysis).filter(([k]) => !SERVER_KEYS.includes(k))) : null;
  return stable({ s: d.specs ?? {}, a });
}

export const isDirty = (draft: ReviewDraft, baseline: string, pending: ConfirmationRef[]) => contentKeyOf(draft) !== baseline || pending.length > 0;

/** The person's on-screen content on top of the server's copy: the server's stamps on rows the person did not change, and
 *  the server's review, scan time and drawing stamp. Never adds a stamp. */
export function mergeOnTop(onScreen: ReviewDraft, server: ReviewDraft): ReviewDraft {
  const settled = settleConfirmations(onScreen.analysis, server.analysis) ?? onScreen.analysis;
  const analysis: Row = { ...settled };
  for (const k of SERVER_KEYS) { if (server.analysis && k in server.analysis) analysis[k] = server.analysis[k]; else delete analysis[k]; }
  return { specs: onScreen.specs, analysis };
}

export const NOTICE_TYPED_WHILE_SAVING = 'Saved. You changed something while it was saving: those changes are still on screen and not saved yet.';
export const NOTICE_NEWER_COPY = 'A newer copy of this request arrived (for example a new scan) while you have unsaved changes. Your changes are kept on screen; saving them replaces the newer copy.';

export function nextReviewState(i: { draft: ReviewDraft; baseline: string; pending: ConfirmationRef[]; sent: SentSave | null; server: ReviewDraft }): SyncResult {
  const onScreen = contentKeyOf(i.draft), incoming = contentKeyOf(i.server);
  if (i.sent) {
    // Clicks sent with that save are now stamped by the server; clicks made while it was saving stay pending.
    const rest = i.pending.filter((p) => !i.sent!.pending.some((s) => s.list === p.list && s.ref === p.ref));
    if (onScreen === i.sent.key) return { kind: 'load', draft: i.server, baseline: incoming, pending: rest, notice: null };
    return { kind: 'merge', draft: mergeOnTop(i.draft, i.server), baseline: incoming, pending: rest, notice: NOTICE_TYPED_WHILE_SAVING };
  }
  if (onScreen === incoming) return { kind: 'load', draft: i.server, baseline: incoming, pending: i.pending, notice: null };
  if (onScreen === i.baseline && i.pending.length === 0) return { kind: 'load', draft: i.server, baseline: incoming, pending: [], notice: null };
  return { kind: 'keep', draft: i.draft, baseline: i.baseline, pending: i.pending, notice: NOTICE_NEWER_COPY };
}
