// Task 29: technical flat drawings for the templates. Each drawing is plain data (paths in its own coordinates), so the same
// drawing is shown on screen (React SVG), printed in the PDF (react-pdf SVG) and saved as a standalone .svg file.
// Conventions (standard tech-pack flats; the Ontario Parks reference pages were not available): views side by side, laid flat;
// solid lines for the outline and seams, dashed for topstitching, dotted for hidden or optional parts. Numbered callouts sit on
// measuring lines with arrowheads; number N is row N ("No.") in the measurement table. A kit (rain suit, scrubs...) shows the
// drawing of each part, numbered on from one part to the next, as its table is. Template drawings are original art, never
// traced from the customer's photos. Client-safe, relative imports only (the tests and the export script load this directly).
import type { XY, Stroke, Shape } from './drawings-geom';
import { JACKET_V1 } from './drawings-jacket';
import { GARMENT_DRAWINGS } from './drawings-garments';
import { PRODUCT_DRAWINGS } from './drawings-products';

export type { XY, Stroke, Shape };
export type ViewKey = string;
export interface ViewDef {
  view: ViewKey; // front, back, palm, back-of-hand, outer-side, inner-side, top, sole, side
  title: string;
  origin: XY; // where the view's own (0, 0) sits on the drawing
  w?: number; // the view's width (default: the drawing's viewWidth)
  shapes: Shape[];
  dots?: XY[]; // snaps and buttons
  /** Where a detail found by the AI goes, by region and wearer's side: e.g. "chest:L" = the wearer's left chest. */
  anchors: Record<string, XY>;
  /** Which details go on this view: a pattern for their location text (the first view takes the rest). */
  match?: string;
}
export interface CalloutDef { code: string; view: ViewKey; from: XY; to: XY; at?: number; label?: XY }
export interface DrawingDef { key: string; version: number; label: string; viewWidth: number; size: XY; views: ViewDef[]; callouts: CalloutDef[]; notes?: string[] }

/** Every drawing, by template family key, oldest version first. A version is never changed once a tech file uses it. */
export const DRAWINGS: Record<string, DrawingDef[]> = Object.fromEntries([JACKET_V1, ...GARMENT_DRAWINGS, ...PRODUCT_DRAWINGS].map((d) => [d.key, [d]]));
/** General templates: any product, so there is no standard drawing to show. */
export const NO_STANDARD_DRAWING = ['generic', 'accessory'];
export const currentDrawing = (family: string | null | undefined): DrawingDef | null => {
  const list = family ? DRAWINGS[family] : undefined;
  return list?.length ? list[list.length - 1] : null;
};
export const drawingByRef = (ref: { key: string; version: number | null } | null | undefined): DrawingDef | null =>
  ref?.version ? DRAWINGS[ref.key]?.find((d) => d.version === ref.version) ?? null : null;

/** The template shape the drawings need: its family, and its parts (a kit has several; a garment has one, itself). */
export interface DrawingTemplate { family: { key: string }; parts: Array<{ key: string; label: string; points: Array<{ code: string; name: string }> }> }

/** The drawing(s) a tech file records when it is approved (version null = no drawing for that template yet). */
export interface DrawingStamp { key: string; version: number | null; parts?: DrawingStamp[] }
export function drawingStamp(t: DrawingTemplate): DrawingStamp {
  if (t.parts.length > 1) return { key: t.family.key, version: null, parts: t.parts.map((p) => ({ key: p.key, version: currentDrawing(p.key)?.version ?? null })) };
  return { key: t.family.key, version: currentDrawing(t.family.key)?.version ?? null };
}

/** Row numbers of the measurement table, by point code ("A", or "2.A" in a kit), 1-based, in template order. */
export function rowNumbers(t: DrawingTemplate): Map<string, number> {
  const out = new Map<string, number>();
  let n = 0;
  t.parts.forEach((p, i) => p.points.forEach((pt) => out.set(t.parts.length > 1 ? `${i + 1}.${pt.code}` : pt.code, ++n)));
  return out;
}

export interface PartDrawing { label: string; def: DrawingDef | null; numbers: Map<string, number>; points: Array<{ code: string; name: string; number: number }>; placeholder: string }
/**
 * What a tech file shows. A draft: the template's current drawing(s), or "not available yet". An approved file: the drawing(s)
 * it was approved with. A file approved before drawings existed (no stamp) shows nothing, so it prints exactly as it did.
 */
export function drawingFor(analysis: { review?: { status?: string }; drawing?: DrawingStamp } | null | undefined, t: DrawingTemplate):
  { show: 'none' } | { show: 'parts'; parts: PartDrawing[] } {
  const approved = analysis?.review?.status === 'approved';
  if (approved && !analysis?.drawing) return { show: 'none' };
  const rows = rowNumbers(t);
  const stampParts = approved ? (analysis!.drawing!.parts ?? [analysis!.drawing!]) : null;
  const parts = t.parts.map((p, i): PartDrawing => {
    const key = t.parts.length > 1 ? p.key : t.family.key;
    const def = stampParts ? drawingByRef(stampParts[i] ?? null) : currentDrawing(key);
    const numbers = new Map(p.points.map((pt) => [pt.code, rows.get(t.parts.length > 1 ? `${i + 1}.${pt.code}` : pt.code) ?? 0]));
    return { label: t.parts.length > 1 ? p.label : '', def, numbers, points: p.points.map((pt) => ({ code: pt.code, name: pt.name, number: numbers.get(pt.code)! })), placeholder: NO_STANDARD_DRAWING.includes(key) ? GENERAL_TEXT : NO_DRAWING_TEXT };
  });
  return { show: 'parts', parts };
}
export const DRAWING_NOTE = 'Template drawing: not traced from the photos.';
export const NO_DRAWING_TEXT = 'Drawing not available yet for this product type.';
export const GENERAL_TEXT = 'General template: there is no standard drawing. Attach a sketch or the customer\'s reference images.';

/** Number of each measurement point of one template: its position (1-based). */
export const pointNumbers = (points: Array<{ code: string }>): Map<string, number> => new Map(points.map((p, i) => [p.code, i + 1]));

// ---- details the AI found, as markers --------------------------------------------------------------------------------------
export interface PlacedMarker { letter: string; view: ViewKey; at: XY; label: string; location: string }
const REGIONS: Array<[string, RegExp]> = [
  ['hood', /\bhood/], ['collar', /collar|neck/], ['cuff', /cuff|wrist|gauntlet/], ['sleeve', /sleeve|\barm\b|elbow|forearm/],
  ['thumb', /thumb/], ['finger', /finger|fingertip/], ['knuckle', /knuckle|back of (the )?hand|impact|guard/], ['palm', /palm|grip|coating/],
  ['toe', /\btoe/], ['heel', /heel/], ['sole', /sole|tread|lug/], ['lace', /lace|eyelet|hook|tongue/], ['shaft', /shaft|ankle|upper/],
  ['brim', /brim|visor|peak/], ['crown', /crown|panel|logo|front of the cap/], ['face', /face|eye|opening/], ['bib', /\bbib/],
  ['dring', /d.?ring|dorsal|sternal|attachment/], ['buckle', /buckle|connector/], ['strap', /strap|webbing|suspender/],
  ['chest', /chest|breast/], ['knee', /knee/], ['thigh', /thigh|cargo|leg/], ['hip', /hip|hand|waist|lower|side|kangaroo|seat/], ['hem', /\bhem|bottom/],
  ['shoulder', /shoulder|yoke/], ['center', /cent(er|re)|placket|zip|closure|front opening|fly/],
];
const TYPE_REGION: Record<string, string> = {
  zipper: 'center', closure: 'center', button: 'center', snap: 'center', hood: 'hood', collar: 'collar', cuff: 'cuff', pocket: 'chest', drawcord: 'hem', vent: 'shoulder', reflective: 'chest', knee_pad: 'knee',
  coating: 'palm', reinforcement: 'palm', toe_cap: 'toe', outsole: 'sole', upper: 'shaft', lining: 'shaft', eyelet: 'lace', brim: 'brim', panel: 'crown', d_ring: 'dring', buckle: 'buckle', strap: 'strap', webbing: 'strap',
};

/**
 * Places each detail on the matching view from its location text ("left chest pocket, front"). Left and right are the WEARER'S:
 * on the front view the wearer's left is on the viewer's right; on the back view it is on the viewer's left (the anchors are
 * defined per view by the wearer's side, so this follows from the data). A detail with no matching place is returned as unplaced.
 */
export function placeMarkers(def: DrawingDef, components: Array<{ type?: string; label?: string; location?: string }>): { placed: PlacedMarker[]; unplaced: Array<{ letter: string; label: string; location: string }> } {
  const placed: PlacedMarker[] = [];
  const unplaced: Array<{ letter: string; label: string; location: string }> = [];
  const used = new Map<string, number>();
  components.slice(0, 26).forEach((c, i) => {
    const letter = String.fromCharCode(97 + i);
    const label = String(c.label ?? '').slice(0, 120);
    const location = String(c.location ?? '').slice(0, 120);
    const text = `${label} ${location}`.toLowerCase();
    const side = /\bleft\b/.test(text) ? 'L' : /\bright\b/.test(text) ? 'R' : 'C';
    const region = REGIONS.find(([, re]) => re.test(text))?.[0] ?? TYPE_REGION[String(c.type ?? '')];
    // The view: the first one whose pattern matches the location, else one that has this region, else the first view.
    const byText = def.views.find((x) => x.match && new RegExp(x.match).test(location.toLowerCase()));
    const v = byText ?? (region ? def.views.find((x) => Object.keys(x.anchors).some((k) => k.startsWith(`${region}:`))) : undefined) ?? def.views[0];
    const anchor = region ? v.anchors[`${region}:${side}`] ?? v.anchors[`${region}:C`] ?? v.anchors[`${region}:L`] : undefined;
    if (!anchor) { unplaced.push({ letter, label, location }); return; }
    const key = `${v.view}:${anchor.join(',')}`;
    const n = used.get(key) ?? 0;
    used.set(key, n + 1);
    placed.push({ letter, view: v.view, at: [v.origin[0] + anchor[0] + n * 11, v.origin[1] + anchor[1]], label, location });
  });
  return { placed, unplaced };
}

// ---- drawing primitives, shared by the screen, the PDF and the .svg file ------------------------------------------------------
export type Prim =
  | { t: 'path'; d: string; stroke: string; width: number; dash?: string; fill?: string }
  | { t: 'circle'; cx: number; cy: number; r: number; fill: string; stroke: string; width: number }
  | { t: 'text'; x: number; y: number; text: string; size: number; bold?: boolean; anchor: 'start' | 'middle' | 'end'; fill: string };

export const INK = '#1e293b';
export const CALLOUT = '#c61213';
export const MARKER = '#7c3aed';
const STROKES: Record<Stroke, { width: number; dash?: string }> = { outline: { width: 1.6 }, seam: { width: 0.9 }, stitch: { width: 0.6, dash: '2.5 2' }, hidden: { width: 0.8, dash: '1 2.5' } };

/** Moves every coordinate of a path that uses only absolute M, L, Q, C and Z commands. */
export function offsetPath(d: string, [ox, oy]: XY): string {
  const tokens = d.match(/[MLQCZ]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  return tokens.map((tk) => {
    if (/^[MLQCZ]$/.test(tk)) { i = 0; return tk; }
    const n = Number(tk) + (i++ % 2 === 0 ? ox : oy);
    return String(Math.round(n * 100) / 100);
  }).join(' ').replace(/ ([MLQCZ])/g, ' $1');
}

const r2 = (n: number) => Math.round(n * 100) / 100;
function arrowHead(tip: XY, from: XY, size = 4): string {
  const [dx, dy] = [tip[0] - from[0], tip[1] - from[1]];
  const len = Math.hypot(dx, dy) || 1;
  const [ux, uy] = [dx / len, dy / len];
  const base: XY = [tip[0] - ux * size, tip[1] - uy * size];
  const [px, py] = [-uy * size * 0.45, ux * size * 0.45];
  return `M ${r2(base[0] + px)} ${r2(base[1] + py)} L ${r2(tip[0])} ${r2(tip[1])} L ${r2(base[0] - px)} ${r2(base[1] - py)} Z`;
}

/** Where callout `c`'s number circle goes (on the drawing's own coordinates). */
export function calloutLabelAt(def: DrawingDef, c: CalloutDef): XY {
  const o = def.views.find((v) => v.view === c.view)!.origin;
  if (c.label) return [o[0] + c.label[0], o[1] + c.label[1]];
  const f = c.at ?? 0.5;
  return [o[0] + c.from[0] + (c.to[0] - c.from[0]) * f, o[1] + c.from[1] + (c.to[1] - c.from[1]) * f];
}
export const CALLOUT_R = 7.5;
/** Notes sit under the view titles, one line each. */
export const notesTop = (def: DrawingDef) => def.size[1] - (def.notes?.length ?? 0) * 12 - 4;

export function drawingPrimitives(def: DrawingDef, opts: { numbers: Map<string, number>; markers?: PlacedMarker[]; note?: boolean }): Prim[] {
  const out: Prim[] = [];
  const titleY = notesTop(def) - 8;
  for (const v of def.views) {
    out.push({ t: 'text', x: v.origin[0] + (v.w ?? def.viewWidth) / 2, y: titleY, text: v.title.toUpperCase(), size: 9, bold: true, anchor: 'middle', fill: '#64748b' });
    for (const s of v.shapes) out.push({ t: 'path', d: offsetPath(s.d, v.origin), stroke: INK, width: STROKES[s.stroke].width, ...(STROKES[s.stroke].dash ? { dash: STROKES[s.stroke].dash } : {}), fill: 'none' });
    for (const [x, y] of v.dots ?? []) out.push({ t: 'circle', cx: v.origin[0] + x, cy: v.origin[1] + y, r: 1.6, fill: INK, stroke: INK, width: 0.5 });
  }
  (def.notes ?? []).forEach((n, i) => out.push({ t: 'text', x: def.size[0] / 2, y: notesTop(def) + 10 + i * 12, text: n, size: 8, anchor: 'middle', fill: '#475569' }));
  for (const c of def.callouts) {
    const n = opts.numbers.get(c.code);
    if (!n) continue;
    const o = def.views.find((v) => v.view === c.view)!.origin;
    const a: XY = [o[0] + c.from[0], o[1] + c.from[1]];
    const b: XY = [o[0] + c.to[0], o[1] + c.to[1]];
    out.push({ t: 'path', d: `M ${r2(a[0])} ${r2(a[1])} L ${r2(b[0])} ${r2(b[1])}`, stroke: CALLOUT, width: 0.8, fill: 'none' });
    out.push({ t: 'path', d: arrowHead(a, b), stroke: CALLOUT, width: 0.5, fill: CALLOUT });
    out.push({ t: 'path', d: arrowHead(b, a), stroke: CALLOUT, width: 0.5, fill: CALLOUT });
    const at = calloutLabelAt(def, c);
    if (c.label) {
      const mid: XY = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      out.push({ t: 'path', d: `M ${r2(at[0])} ${r2(at[1])} L ${r2(mid[0])} ${r2(mid[1])}`, stroke: CALLOUT, width: 0.5, dash: '1.5 1.5', fill: 'none' });
    }
    out.push({ t: 'circle', cx: r2(at[0]), cy: r2(at[1]), r: CALLOUT_R, fill: '#ffffff', stroke: CALLOUT, width: 1 });
    out.push({ t: 'text', x: r2(at[0]), y: r2(at[1] + 3.2), text: String(n), size: n > 99 ? 6.5 : 8.5, bold: true, anchor: 'middle', fill: CALLOUT });
  }
  for (const m of opts.markers ?? []) {
    const [x, y] = m.at;
    out.push({ t: 'path', d: `M ${r2(x)} ${r2(y - 6)} L ${r2(x + 6)} ${r2(y)} L ${r2(x)} ${r2(y + 6)} L ${r2(x - 6)} ${r2(y)} Z`, stroke: MARKER, width: 0.8, fill: MARKER });
    out.push({ t: 'text', x: r2(x), y: r2(y + 2.6), text: m.letter, size: 7, bold: true, anchor: 'middle', fill: '#ffffff' });
  }
  if (opts.note !== false) out.push({ t: 'text', x: def.size[0] / 2, y: 12, text: DRAWING_NOTE, size: 8, anchor: 'middle', fill: '#94a3b8' });
  return out;
}

// ---- a standalone .svg file ------------------------------------------------------------------------------------------------
export const escapeXml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function primsToSvg(prims: Prim[], size: XY, extra = ''): string {
  const body = prims.map((p) => {
    if (p.t === 'path') return `<path d="${p.d}" fill="${p.fill ?? 'none'}" stroke="${p.stroke}" stroke-width="${p.width}"${p.dash ? ` stroke-dasharray="${p.dash}"` : ''} stroke-linejoin="round" stroke-linecap="round"/>`;
    if (p.t === 'circle') return `<circle cx="${p.cx}" cy="${p.cy}" r="${p.r}" fill="${p.fill}" stroke="${p.stroke}" stroke-width="${p.width}"/>`;
    return `<text x="${p.x}" y="${p.y}" font-family="Helvetica, Arial, sans-serif" font-size="${p.size}"${p.bold ? ' font-weight="bold"' : ''} text-anchor="${p.anchor}" fill="${p.fill}">${escapeXml(p.text)}</text>`;
  }).join('\n  ');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${size[0]}" height="${size[1]}" viewBox="0 0 ${size[0]} ${size[1]}">\n  <rect width="100%" height="100%" fill="#ffffff"/>\n  ${body}${extra}\n</svg>\n`;
}

/** Breaks text into lines of at most `max` characters, at spaces (a word longer than a line is kept whole). */
export function wrapText(text: string, max: number): string[] {
  const lines: string[] = [];
  let cur = '';
  for (const w of text.split(/\s+/).filter(Boolean)) {
    if (cur && (cur + ' ' + w).length > max) { lines.push(cur); cur = w; } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  return lines;
}

/** A full sheet for the .svg file: the drawing, plus the list of measurement points (number, code, name, how to measure, wrapped). */
export function drawingSheetSvg(def: DrawingDef, points: Array<{ code: string; name: string; definition: string }>, numbers = pointNumbers(points)): string {
  const listW = 330;
  const x0 = def.size[0] + 10;
  const list: Prim[] = [
    { t: 'text', x: x0, y: 28, text: `RIVIX  ·  ${def.label}`, size: 12, bold: true, anchor: 'start', fill: INK },
    { t: 'text', x: x0, y: 44, text: `Flat drawing v${def.version}. ${DRAWING_NOTE}`, size: 7.5, anchor: 'start', fill: '#64748b' },
  ];
  let y = 72;
  for (const p of points) {
    list.push({ t: 'circle', cx: x0 + 8, cy: y - 3, r: CALLOUT_R, fill: '#ffffff', stroke: CALLOUT, width: 1 });
    list.push({ t: 'text', x: x0 + 8, y: y + 0.2, text: String(numbers.get(p.code)), size: 8.5, bold: true, anchor: 'middle', fill: CALLOUT });
    list.push({ t: 'text', x: x0 + 22, y, text: `${p.code}  ${p.name}`, size: 9, bold: true, anchor: 'start', fill: INK });
    const lines = wrapText(p.definition, 62);
    lines.forEach((l, i) => list.push({ t: 'text', x: x0 + 22, y: y + 11 + i * 9, text: l, size: 7, anchor: 'start', fill: '#64748b' }));
    y += 22 + lines.length * 9;
  }
  const prims = drawingPrimitives(def, { numbers });
  return primsToSvg([...prims, ...list], [def.size[0] + listW, Math.max(def.size[1], y)]);
}
