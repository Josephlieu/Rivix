// Task 29: small geometry helpers for the flat drawings (paths with absolute M, L, Q, C and Z only). No imports.
export type XY = [number, number];
export type Stroke = 'outline' | 'seam' | 'stitch' | 'hidden';
export interface Shape { d: string; stroke: Stroke }

export const r1 = (n: number) => Math.round(n * 10) / 10;
export const pt = ([x, y]: XY) => `${r1(x)} ${r1(y)}`;
export const add = (a: XY, b: XY): XY => [a[0] + b[0], a[1] + b[1]];
export const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]];
export const mul = (a: XY, k: number): XY => [a[0] * k, a[1] * k];
export const lerp = (a: XY, b: XY, t: number): XY => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
export const unit = (a: XY): XY => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
/** Moves the segment a-b sideways by `d` (positive = to the left of the direction a -> b, on screen). */
export const offsetSeg = (a: XY, b: XY, d: number): [XY, XY] => { const [ux, uy] = unit(sub(b, a)); const n: XY = [uy * d, -ux * d]; return [add(a, n), add(b, n)]; };
/** x on the segment a-b at height y (a and b must differ in y). */
export const xAt = (a: XY, b: XY, y: number) => a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]);

export const poly = (pts: XY[], close = false) => `M ${pts.map(pt).join(' L ')}${close ? ' Z' : ''}`;
export const line = (a: XY, b: XY) => `M ${pt(a)} L ${pt(b)}`;
export const quad = (a: XY, c: XY, b: XY) => `M ${pt(a)} Q ${pt(c)} ${pt(b)}`;
export const rect = (x: number, y: number, w: number, h: number) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], true);
/** Several short strokes in one path (rib knit, gathers, tread). */
export const ticks = (pairs: Array<[XY, XY]>) => pairs.map(([a, b]) => line(a, b)).join(' ');

/** Mirror a path left to right inside a box of width w. */
export function mirrorPath(d: string, w: number): string {
  const tokens = d.match(/[MLQCZ]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  return tokens.map((tk) => {
    if (/^[MLQCZ]$/.test(tk)) { i = 0; return tk; }
    return String(r1(i++ % 2 === 0 ? w - Number(tk) : Number(tk)));
  }).join(' ');
}
export const mx = ([x, y]: XY, w: number): XY => [w - x, y];
export const both = (d: string, stroke: Stroke, w: number): Shape[] => [{ d, stroke }, { d: mirrorPath(d, w), stroke }];

/** The point of a cubic Bezier furthest to the left (sampled). */
export function bezierLeftmost(p0: XY, p1: XY, p2: XY, p3: XY): XY {
  let best: XY = p0;
  for (let i = 0; i <= 200; i++) {
    const t = i / 200, s = 1 - t;
    const p: XY = [s ** 3 * p0[0] + 3 * s * s * t * p1[0] + 3 * s * t * t * p2[0] + t ** 3 * p3[0], s ** 3 * p0[1] + 3 * s * s * t * p1[1] + 3 * s * t * t * p2[1] + t ** 3 * p3[1]];
    if (p[0] < best[0]) best = p;
  }
  return best;
}
