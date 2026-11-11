// Task 29: flat drawings for the clothing templates, built from measured shapes so every garment is drawn to the same
// conventions and proportions as the jacket: 5.6 units per inch, front and back views in 400-wide boxes (centre x = 200),
// the wearer's left on the viewer's right on the front view and on the viewer's left on the back view.
// Each builder returns the views and the measuring lines it can draw; each template picks its lines by point code.
// Original art. A version is never changed once a tech file uses it: a change is a new version.
import type { DrawingDef, CalloutDef, ViewDef } from './drawings';
import { type XY, type Shape, add, sub, mul, lerp, unit, offsetSeg, xAt, poly, line, quad, rect, ticks, mirrorPath, mx, both, bezierLeftmost, pt } from './drawings-geom';

const K = 5.6, W = 400, CX = 200;
type Measure = Omit<CalloutDef, 'code'>;
interface Built { views: ViewDef[]; measures: Record<string, Measure>; height: number; extraWidth?: number }

const FRONT_MATCH = '';
const BACK_MATCH = '\\bback\\b|rear';

// ---- tops: shirts, jackets, coats, hoodies, vests, gowns ------------------------------------------------------------------
export interface TopOpts {
  len: number; chest?: number; shoulder?: number; neck?: number; armhole?: number;
  sleeve: 'long' | 'short' | 'none'; sleeveLen?: number; bicep?: number; cuff?: number; hem?: number;
  collar: 'stand' | 'shirt' | 'crew' | 'v' | 'lapel' | 'none' | 'high';
  hood?: 'none' | 'optional' | 'fixed';
  closure: 'zip' | 'buttons' | 'placket' | 'none' | 'flap';
  chestPockets?: 0 | 1 | 2; lowerPockets?: 'welt' | 'kangaroo' | 'patch' | 'none';
  hemStyle?: 'band' | 'rib' | 'plain'; cuffStyle?: 'band' | 'rib' | 'plain' | 'elastic';
  yoke?: boolean; tape?: boolean; backVent?: boolean; backTies?: boolean;
  /** One-piece suits: the left side of the outline below the underarm (hip, leg, down to the crotch), instead of a hem. */
  bottom?: XY[];
  /** Where the front closure ends (a suit's zip stops above the crotch). */
  closureEnd?: number;
}

// Sleeves hang at a fixed angle, as in a standard flat (the jacket's 46 degrees; short sleeves 44).
const SLEEVE_ANGLE = { long: (46 * Math.PI) / 180, short: (44 * Math.PI) / 180 };

export function topGarment(o: TopOpts): Built & { g: Record<string, XY | number> } {
  const Y0 = 100;
  const nh = ((o.neck ?? 8) / 2) * K;
  const N: XY = [CX - nh, Y0];
  const SP: XY = [CX - ((o.shoulder ?? 19) / 2) * K, Y0 + 1.8 * K];
  const side = CX - ((o.chest ?? 24) / 2) * K;
  const a = (o.armhole ?? 11) * K;
  const UA: XY = [side, SP[1] + Math.sqrt(Math.max(a * a - (SP[0] - side) ** 2, 400)) + (o.sleeve === 'none' ? K : 0)];
  const hemY = Y0 + o.len * K;
  const hemX = CX - ((o.hem ?? o.chest ?? 24) / 2) * K;
  const HEM: XY = [hemX, hemY];
  const chestHalf = CX - side;

  // Sleeves: the angle that gives the bicep its width, then the sleeve length along it.
  let E: XY = SP, Ci: XY = UA, u: XY = [0, 1], n: XY = [1, 0];
  if (o.sleeve !== 'none') {
    const th = SLEEVE_ANGLE[o.sleeve];
    u = [-Math.sin(th), Math.cos(th)]; n = [Math.cos(th), Math.sin(th)];
    E = add(SP, mul(u, (o.sleeveLen ?? (o.sleeve === 'long' ? 34 : 9)) * K));
    Ci = add(E, mul(n, (o.cuff ?? (o.sleeve === 'long' ? 5.5 : 7.5)) * K));
  }
  const left: XY[] = o.sleeve === 'none' ? [N, SP] : [N, SP, E, Ci, UA];
  const halfToHem: XY[] = o.bottom ?? (o.sleeve === 'none' ? [UA, HEM] : [HEM]);
  const rightPts: XY[] = [...left, ...halfToHem].map((p) => mx(p, W)).reverse();
  const outline = (neckFront: boolean): string => {
    const body = `M ${[...left, ...halfToHem, ...rightPts].map(pt).join(' L ')}`;
    let neck = '';
    if (o.collar === 'stand' || o.collar === 'high') { const h = o.collar === 'high' ? 4 * K : 2.5 * K; neck = ` L ${pt([W - N[0] - 0.9, Y0 - h])} Q ${pt([CX, Y0 - h - 4])} ${pt([N[0] + 0.9, Y0 - h])} L ${pt(N)} Z`; }
    else if (o.collar === 'shirt') neck = ` L ${pt([W - N[0] - 0.5, Y0 - 1.5 * K])} Q ${pt([CX, Y0 - 1.5 * K - 3])} ${pt([N[0] + 0.5, Y0 - 1.5 * K])} L ${pt(N)} Z`;
    else if (o.collar === 'v' && neckFront) neck = ` L ${pt([CX, Y0 + 6 * K])} L ${pt(N)} Z`;
    else if (o.collar === 'lapel' && neckFront) neck = ` L ${pt([CX + 4, Y0 + 2])} L ${pt(N)} Z`;
    else neck = ` Q ${pt([CX, Y0 + (neckFront ? 2.6 * K : 0.8 * K)])} ${pt(N)} Z`;
    return body + neck;
  };
  const common: Shape[] = [];
  if (o.sleeve !== 'none') {
    common.push(...both(quad(SP, [SP[0] - 6, (SP[1] + UA[1]) / 2 + 4], UA), 'seam', W)); // armhole
    const cb = (o.cuffStyle ?? 'band') === 'plain' ? 0.5 : 2.5;
    const cs1 = sub(E, mul(u, cb * K)), cs2 = sub(Ci, mul(u, cb * K));
    if ((o.cuffStyle ?? 'band') !== 'plain') common.push(...both(line(cs1, cs2), 'seam', W));
    if (o.cuffStyle === 'rib' || o.cuffStyle === 'elastic') {
      const pairs: Array<[XY, XY]> = [];
      for (let i = 1; i < 6; i++) { const p = lerp(E, Ci, i / 6), q = lerp(cs1, cs2, i / 6); pairs.push([p, q]); }
      common.push(...both(ticks(pairs), 'stitch', W));
    } else common.push(...both(line(sub(E, mul(u, 0.7 * K)), sub(Ci, mul(u, 0.7 * K))), 'stitch', W));
  } else {
    common.push(...both(quad(SP, [UA[0] + 16, UA[1] - 10], UA), 'seam', W)); // armhole binding
    common.push(...both(quad(add(SP, [2, 3]), [UA[0] + 19, UA[1] - 13], add(UA, [3, -2])), 'stitch', W));
  }
  const xSide = (y: number) => (o.sleeve === 'none' || y > UA[1] ? xAt(UA, HEM, Math.max(y, UA[1] + 0.01)) : UA[0]);
  const across = (y: number) => [[xSide(y), y], [W - xSide(y), y]] as [XY, XY];
  const hs = o.hemStyle ?? 'plain';
  if (o.bottom) { /* a suit: no hem */ } else if (hs === 'band' || hs === 'rib') {
    const by = hemY - (hs === 'rib' ? 2.5 : 2) * K;
    common.push({ d: line(...across(by)), stroke: 'seam' });
    if (hs === 'rib') { const pairs: Array<[XY, XY]> = []; for (let x = xSide(by) + 8; x < W - xSide(by) - 4; x += 8) pairs.push([[x, by + 2], [x, hemY - 2]]); common.push({ d: ticks(pairs), stroke: 'stitch' }); }
    else common.push({ d: line(...across(hemY - 0.6 * K)), stroke: 'stitch' });
  } else common.push({ d: line(...across(hemY - 0.7 * K)), stroke: 'stitch' });
  if (o.tape) {
    for (const y of o.bottom ? [UA[1] + 2 * K] : [UA[1] + 2 * K, hemY - 4 * K]) { common.push({ d: line(...across(y)), stroke: 'seam' }); common.push({ d: line(...across(y + 2 * K)), stroke: 'seam' }); }
    if (o.sleeve === 'long') for (const t of [0.72, 0.8]) common.push(...both(line(lerp(SP, E, t), lerp(UA, Ci, t)), 'seam', W));
  }

  // Front details
  const front: Shape[] = [{ d: outline(true), stroke: 'outline' }, ...common];
  const chestY = UA[1] + K;
  const waistY = Math.max((SP[1] + hemY) / 2, chestY + 4 * K); // the natural waist, clearly below the chest line
  if (o.collar === 'stand' || o.collar === 'high' || o.collar === 'shirt') front.push({ d: quad(N, [CX, Y0 + 10], mx(N, W)), stroke: 'seam' });
  if (o.collar === 'shirt') front.push(...both(poly([[N[0] + 1, Y0 - 2], [N[0] - 5, Y0 + 12], [CX - 2, Y0 + 15], [CX, Y0 + 4]]), 'seam', W));
  if (o.collar === 'crew') front.push({ d: quad(add(N, [3, 4]), [CX, Y0 + 2.6 * K + 7], add(mx(N, W), [-3, 4])), stroke: 'stitch' });
  if (o.collar === 'v') front.push(...both(line(add(N, [4, 2]), [CX, Y0 + 6 * K - 7]), 'stitch', W));
  if (o.collar === 'lapel') {
    front.push(...both(poly([N, [N[0] - 6, Y0 + 10], [CX - 30, Y0 + 30], [CX - 22, Y0 + 36], [CX - 2, Y0 + 12 * K]]), 'seam', W));
    front.push({ d: line([CX - 2, Y0 + 12 * K], [CX, hemY]), stroke: 'seam' });
  }
  const zipTop = o.collar === 'stand' || o.collar === 'high' ? Y0 - (o.collar === 'high' ? 4 : 2.5) * K + 2 : Y0 + 2.6 * K;
  const cEnd = o.closureEnd ?? hemY;
  if (o.closure === 'zip') {
    front.push({ d: line([CX, zipTop], [CX, cEnd]), stroke: 'seam' }, { d: line([CX - 4, Y0 + 4], [CX - 4, cEnd - 2]), stroke: 'stitch' }, { d: line([CX + 4, Y0 + 4], [CX + 4, cEnd - 2]), stroke: 'stitch' }, { d: rect(CX - 2.5, Y0 + 6, 5, 12), stroke: 'seam' });
  }
  const dots: XY[] = [];
  if (o.closure === 'buttons') {
    const top = o.collar === 'lapel' ? Y0 + 12 * K : Y0 + 3;
    front.push({ d: line([CX - 6, top], [CX - 6, hemY]), stroke: 'seam' }, { d: line([CX + 6, top], [CX + 6, hemY]), stroke: 'stitch' });
    for (let y = top + 10; y < hemY - 10; y += 4.5 * K) dots.push([CX, y]);
  }
  if (o.closure === 'placket') {
    const end = Y0 + 6 * K;
    front.push({ d: poly([[CX - 6, Y0 + 2.6 * K - 2], [CX - 6, end], [CX + 6, end], [CX + 6, Y0 + 2.6 * K - 2]]), stroke: 'seam' });
    dots.push([CX, Y0 + 3.4 * K], [CX, Y0 + 5 * K]);
  }
  if (o.closure === 'flap') {
    front.push({ d: line([CX, zipTop], [CX, cEnd]), stroke: 'hidden' }, { d: line([CX + 14, Y0 + 2], [CX + 14, cEnd]), stroke: 'seam' }, { d: line([CX + 10, Y0 + 4], [CX + 10, cEnd - 2]), stroke: 'stitch' });
    for (let y = Y0 + 16; y < cEnd - 10; y += 6 * K) dots.push([CX + 7, y]);
  }
  if (o.yoke) front.push(...both(line([SP[0] - 5.5, SP[1] + 18], [CX - 4, SP[1] + 23]), 'seam', W));
  const pkTop = Math.min(chestY - 32, UA[1] - 26);
  if (o.chestPockets === 2) {
    front.push(...both(poly([[CX - 50, pkTop], [CX - 14, pkTop], [CX - 14, pkTop + 9], [CX - 32, pkTop + 13], [CX - 50, pkTop + 9]], true), 'seam', W));
    front.push(...both(poly([[CX - 48, pkTop + 10], [CX - 48, pkTop + 25], [CX - 16, pkTop + 25], [CX - 16, pkTop + 10]]), 'seam', W));
    dots.push([CX - 32, pkTop + 8], [CX + 32, pkTop + 8]);
  } else if (o.chestPockets === 1) {
    front.push({ d: poly([[CX + 16, pkTop], [CX + 16, pkTop + 24], [CX + 31, pkTop + 29], [CX + 46, pkTop + 24], [CX + 46, pkTop]], true), stroke: 'seam' });
  }
  const lp = o.lowerPockets ?? 'none';
  const welt: [XY, XY] = [[CX - 50, waistY + 10], [CX - 40, waistY + 48]];
  if (lp === 'welt') front.push(...both(line(...welt), 'seam', W), ...both(line(add(welt[0], [4, -1]), add(welt[1], [4, -1])), 'seam', W));
  const kTop = hemY - (hs === 'rib' ? 2.5 : 1) * K - 62;
  if (lp === 'kangaroo') front.push({ d: poly([[CX - 50, hemY - 16], [CX - 34, kTop], [CX + 34, kTop], [CX + 50, hemY - 16]]), stroke: 'seam' }, ...both(line([CX - 34, kTop], [CX - 50, hemY - 16]), 'stitch', W));
  const patch = { x: CX - 56, y: waistY + 22, w: 38, h: 40 };
  if (lp === 'patch') front.push(...both(rect(patch.x, patch.y, patch.w, patch.h), 'seam', W), ...both(line([patch.x + 2, patch.y + 4], [patch.x + patch.w - 2, patch.y + 4]), 'stitch', W));

  // The hood: dotted when optional, solid when the garment always has one.
  const hoodPath = `M ${pt(N)} C ${pt([N[0] - 21.6, Y0 - 44])} ${pt([N[0] - 9.6, Y0 - 80])} ${pt([CX, Y0 - 80])} C ${pt([W - N[0] + 9.6, Y0 - 80])} ${pt([W - N[0] + 21.6, Y0 - 44])} ${pt(mx(N, W))}`;
  if (o.hood === 'fixed') {
    front.push({ d: hoodPath, stroke: 'outline' }, { d: `M ${pt(add(N, [5, 4]))} C ${pt([N[0] - 6, Y0 - 34])} ${pt([CX - 30, Y0 - 62])} ${pt([CX, Y0 - 62])} C ${pt([CX + 30, Y0 - 62])} ${pt([W - N[0] + 6, Y0 - 34])} ${pt(add(mx(N, W), [-5, 4]))}`, stroke: 'seam' });
  }

  // Back details
  const back: Shape[] = [{ d: outline(false), stroke: 'outline' }, ...common, { d: quad(N, [CX, Y0 + 6], mx(N, W)), stroke: 'seam' }];
  if (o.yoke) back.push({ d: quad([SP[0] - 6.8, SP[1] + 22], [CX, SP[1] + 32], [W - SP[0] + 6.8, SP[1] + 22]), stroke: 'seam' }, { d: quad([SP[0] - 7.4, SP[1] + 25.5], [CX, SP[1] + 35.5], [W - SP[0] + 7.4, SP[1] + 25.5]), stroke: 'stitch' });
  if (o.hood === 'optional' || o.hood === 'fixed') back.push({ d: hoodPath, stroke: o.hood === 'fixed' ? 'outline' : 'hidden' }, { d: line([CX, Y0 - 80], [CX, Y0 - (o.collar === 'stand' ? 16 : 0)]), stroke: 'hidden' });
  if (o.backVent) back.push({ d: line([CX, hemY - 8 * K], [CX, hemY]), stroke: 'seam' }, { d: line([CX + 4, hemY - 8 * K], [CX + 4, hemY - 2]), stroke: 'stitch' });
  if (o.backTies) back.push({ d: line([CX, Y0 + 2], [CX, hemY]), stroke: 'seam' }, { d: poly([[CX, Y0 + 8], [CX - 22, Y0 + 26]]), stroke: 'seam' }, { d: poly([[CX, waistY], [CX - 28, waistY + 46]]), stroke: 'seam' });
  if (!o.hood || o.hood === 'none') back.push({ d: poly([[CX - 4, Y0 + 1], [CX - 4, Y0 + 8], [CX + 4, Y0 + 8], [CX + 4, Y0 + 1]]), stroke: 'seam' });

  // Measuring lines
  const m: Record<string, Measure> = {};
  m.chest = { view: 'front', from: [side + 0.7, chestY], to: [W - side - 0.7, chestY] };
  m.waist = { view: 'front', from: [xSide(waistY) + 0.7, waistY], to: [W - xSide(waistY) - 0.7, waistY] };
  const hipY = Math.min(waistY + 7 * K, hemY - 12);
  m.hip = { view: 'front', from: [xSide(hipY) + 0.7, hipY], to: [W - xSide(hipY) - 0.7, hipY] };
  m.hem = { view: 'front', from: [hemX + 0.7, hemY + 11], to: [W - hemX - 0.7, hemY + 11] };
  m.shoulder = { view: 'back', from: SP, to: mx(SP, W), at: 0.3 };
  m.bodyLength = { view: 'back', from: [W - N[0], Y0], to: [W - N[0], hemY], at: 0.6 };
  m.neck = { view: 'front', from: N, to: mx(N, W), label: [W - SP[0] + 18, Y0 - 8] };
  if (o.sleeve !== 'none') {
    const [f1, f2] = offsetSeg(SP, E, 8);
    m.sleeveLength = { view: 'back', from: f1, to: f2, at: 0.45 };
    m.armhole = { view: 'back', from: mx(SP, W), to: mx(UA, W), label: [W - SP[0] - 10, UA[1] - 14] };
    const H1 = add(UA, mul(unit(sub(Ci, UA)), K));
    const t = (H1[0] - SP[0]) * u[0] + (H1[1] - SP[1]) * u[1];
    m.bicep = { view: 'back', from: add(SP, mul(u, t)), to: H1 };
    m.cuff = { view: 'back', from: add(E, mul(u, 10)), to: add(Ci, mul(u, 10)) };
  } else m.armhole = { view: 'back', from: mx(SP, W), to: mx(UA, W), label: [W - SP[0] - 16, UA[1] - 16] };
  if (o.hood === 'optional' || o.hood === 'fixed') {
    const wide = bezierLeftmost(N, [N[0] - 21.6, Y0 - 44], [N[0] - 9.6, Y0 - 80], [CX, Y0 - 80]);
    m.hoodHeight = { view: 'back', from: [CX + 50 + Math.max(0, chestHalf - 67), Y0], to: [CX + 50 + Math.max(0, chestHalf - 67), Y0 - 80] };
    m.hoodWidth = { view: 'back', from: wide, to: mx(wide, W) };
  }
  const ch = (o.collar === 'high' ? 4 : 2.5) * K;
  m.collarHeight = { view: 'back', from: [N[0] - 8, Y0], to: [N[0] - 8, Y0 - ch], label: [N[0] - 26, Y0 - 24] };
  m.frontOverlap = { view: 'front', from: [CX - 6, chestY - 26], to: [CX + 14, chestY - 26], label: [CX + 40, chestY - 44] };
  m.placket = { view: 'front', from: [CX - 14, Y0 + 2.6 * K], to: [CX - 14, Y0 + 6 * K], label: [CX - 40, Y0 + 40] };
  m.pocket = lp === 'welt' ? { view: 'front', from: offsetSeg(...welt, 7)[0], to: offsetSeg(...welt, 7)[1], label: [side - 15, waistY + 30] }
    : { view: 'front', from: [patch.x, patch.y - 6], to: [patch.x + patch.w, patch.y - 6], label: [side - 15, patch.y - 2] };
  if (o.backTies) m.tie = { view: 'back', from: [CX - 8, waistY - 5], to: [CX - 36, waistY + 41] };

  // Where the AI's details go (front: the wearer's left on the viewer's right; back: on the viewer's left).
  const sleeveMid = lerp(lerp(SP, E, 0.5), lerp(UA, Ci, 0.5), 0.5);
  const cuffMid = sub(lerp(E, Ci, 0.5), mul(u, 7));
  const lr = (k: string, p: XY, onFront: boolean): Record<string, XY> => ({ [`${k}:${onFront ? 'R' : 'L'}`]: p, [`${k}:${onFront ? 'L' : 'R'}`]: mx(p, W) });
  const anchorsFor = (onFront: boolean): Record<string, XY> => ({
    'collar:C': [CX, Y0 - 8], 'hood:C': onFront ? [CX, Y0 - 70] : [CX - 14, Y0 - 50], 'center:C': [CX, Y0 + 40], 'hem:C': [CX, hemY - 6], 'shoulder:C': [CX, SP[1] + 16],
    ...lr('chest', [CX - 32, UA[1] - 14], onFront), ...lr('hip', [CX - 48, (waistY + hemY) / 2 + 4], onFront), ...lr('shoulder', [CX - 36, SP[1] + 12], onFront),
    ...(o.sleeve !== 'none' ? { ...lr('cuff', cuffMid, onFront), ...lr('sleeve', sleeveMid, onFront) } : {}),
  });
  const views: ViewDef[] = [
    { view: 'front', title: 'Front', origin: [10, 0], shapes: front, dots, anchors: anchorsFor(true), match: FRONT_MATCH },
    { view: 'back', title: 'Back', origin: [W + 10, 0], shapes: back, anchors: anchorsFor(false), match: BACK_MATCH },
  ];
  return { views, measures: m, height: Math.max(hemY + 22, Ci[1] + 14, E[1] + 20), g: { Y0, hemY, waistY, chestY, UAy: UA[1] } };
}

// ---- trousers, shorts and the legs of one-piece suits ---------------------------------------------------------------------
export interface PantsOpts { waist?: number; hip?: number; rise?: number; inseam: number; knee?: number; opening?: number; style: 'trouser' | 'cargo' | 'elastic' | 'turnout' | 'plain'; top?: number }
function pantsShapes(o: PantsOpts) {
  const Y0 = o.top ?? 40;
  const waistHalf = ((o.waist ?? 17) / 2) * K, hipHalf = ((o.hip ?? 21) / 2) * K;
  const hipY = Y0 + 7 * K, crotchY = Y0 + (o.rise ?? 11.5) * K, hemY = crotchY + o.inseam * K;
  const short = o.inseam < 14;
  const kneeY = crotchY + (short ? o.inseam * 0.5 : o.inseam * 0.42) * K;
  const c0 = CX - hipHalf / 2, c1 = c0 - 2, c2 = c0 - (short ? 3 : 4);
  const kw = ((short ? (o.opening ?? 11.5) + 0.5 : o.knee ?? 9.5) / 2) * K, ow = ((o.opening ?? (short ? 11.5 : 8.5)) / 2) * K;
  const L = { waist: [CX - waistHalf, Y0] as XY, hip: [CX - hipHalf, hipY] as XY, crotchOut: [CX - hipHalf, crotchY] as XY, kneeOut: [c1 - kw, kneeY] as XY, hemOut: [c2 - ow, hemY] as XY, hemIn: [c2 + ow, hemY] as XY, kneeIn: [c1 + kw, kneeY] as XY, crotch: [CX, crotchY] as XY };
  const leftSide: XY[] = short ? [L.waist, L.hip, L.hemOut, L.hemIn, L.crotch] : [L.waist, L.hip, L.kneeOut, L.hemOut, L.hemIn, L.kneeIn, L.crotch];
  const silhouette = poly([...leftSide, ...leftSide.slice(0, -1).map((p) => mx(p, W)).reverse()], true);
  return { Y0, waistHalf, hipHalf, hipY, crotchY, hemY, kneeY, c0, c1, c2, kw, ow, L, short, silhouette };
}
/** Leg edges at height y (left leg), for measuring lines across a leg. */
function legAt(p: ReturnType<typeof pantsShapes>, y: number): [XY, XY] {
  const out = p.short ? xAt(p.L.hip, p.L.hemOut, y) : y < p.kneeY ? xAt(p.L.crotchOut, p.L.kneeOut, y) : xAt(p.L.kneeOut, p.L.hemOut, y);
  const inn = p.short ? xAt(p.L.crotch, p.L.hemIn, y) : y < p.kneeY ? xAt(p.L.crotch, p.L.kneeIn, y) : xAt(p.L.kneeIn, p.L.hemIn, y);
  return [[out + 0.7, y], [inn - 0.7, y]];
}
function pantsDetails(p: ReturnType<typeof pantsShapes>, o: PantsOpts, withWaistband = true) {
  const front: Shape[] = [], back: Shape[] = [];
  const wb = p.Y0 + 1.5 * K;
  const wbHalf = p.waistHalf + ((p.hipHalf - p.waistHalf) * 1.5) / 7;
  const hemLines = both(line(add(p.L.hemOut, [0.5, -0.7 * K]), add(p.L.hemIn, [-0.5, -0.7 * K])), 'stitch', W);
  for (const v of [front, back]) {
    if (withWaistband) v.push({ d: line([CX - wbHalf, wb], [CX + wbHalf, wb]), stroke: 'seam' });
    v.push(...hemLines);
  }
  if (withWaistband && o.style === 'elastic') {
    const pairs: Array<[XY, XY]> = []; for (let x = CX - wbHalf + 6; x < CX + wbHalf - 3; x += 6) pairs.push([[x, p.Y0 + 2], [x, wb - 2]]);
    front.push({ d: ticks(pairs), stroke: 'stitch' }, { d: `M ${pt([CX - 3, wb])} Q ${pt([CX - 12, wb + 14])} ${pt([CX - 6, wb + 22])} M ${pt([CX + 3, wb])} Q ${pt([CX + 12, wb + 14])} ${pt([CX + 6, wb + 22])}`, stroke: 'seam' });
    back.push({ d: ticks(pairs), stroke: 'stitch' });
  } else if (withWaistband) {
    for (const v of [front, back]) for (const x of [CX - wbHalf + 12, CX - 22]) v.push(...both(rect(x, p.Y0 - 1, 4, 1.5 * K + 4), 'seam', W));
  }
  if (o.style !== 'elastic' && o.style !== 'plain') {
    front.push({ d: line([CX, wb], [CX, p.crotchY]), stroke: 'seam' }, { d: `M ${pt([CX + 8, wb])} L ${pt([CX + 8, p.crotchY - 16])} Q ${pt([CX + 8, p.crotchY - 7])} ${pt([CX, p.crotchY - 5])}`, stroke: 'stitch' });
    front.push(...both(quad([CX - wbHalf + 18, wb], [CX - wbHalf + 14, wb + 18], [CX - p.hipHalf + 1, p.hipY - 8]), 'seam', W));
  } else front.push({ d: line([CX, withWaistband ? wb : p.Y0], [CX, p.crotchY]), stroke: 'seam' });
  back.push({ d: line([CX, withWaistband ? wb : p.Y0], [CX, p.crotchY]), stroke: 'seam' });
  if (o.style === 'trouser' || o.style === 'cargo') {
    back.push({ d: poly([[CX - wbHalf - 1, wb + 14], [CX, wb + 24], [CX + wbHalf + 1, wb + 14]]), stroke: 'seam' });
    back.push(...both(rect(CX - 46, wb + 30, 30, 34), 'seam', W));
  }
  if (o.style === 'cargo') front.push(...both(rect(p.c0 - p.hipHalf / 2 + 3, p.crotchY + 30, 30, 40), 'seam', W), ...both(rect(p.c0 - p.hipHalf / 2 + 1, p.crotchY + 24, 34, 9), 'seam', W));
  if (o.style === 'turnout') {
    front.push(...both(rect(p.c1 - p.kw + 6, p.kneeY - 22, 2 * p.kw - 12, 40), 'seam', W));
    for (const y of [p.hemY - 7 * K, p.hemY - 5 * K]) { const [a, b] = legAt(p, y); front.push(...both(line(a, b), 'seam', W)); back.push(...both(line(a, b), 'seam', W)); }
  }
  return { front, back };
}
function pantsMeasures(p: ReturnType<typeof pantsShapes>): Record<string, Measure> {
  const m: Record<string, Measure> = {};
  m.waist = { view: 'front', from: [CX - p.waistHalf + 0.7, p.Y0], to: [CX + p.waistHalf - 0.7, p.Y0], at: 0.25 };
  m.hip = { view: 'front', from: [CX - p.hipHalf + 0.7, p.hipY], to: [CX + p.hipHalf - 0.7, p.hipY], at: 0.25 };
  m.seat = { view: 'back', from: [CX - p.hipHalf + 0.7, p.crotchY - 3], to: [CX + p.hipHalf - 0.7, p.crotchY - 3], at: 0.25 };
  const [ta, tb] = legAt(p, p.crotchY + K + 2);
  m.thigh = { view: 'front', from: ta, to: tb };
  if (!p.short) { const [ka, kb] = legAt(p, p.kneeY); m.knee = { view: 'front', from: ka, to: kb }; }
  m.legOpening = { view: 'front', from: [p.L.hemOut[0] + 0.5, p.hemY + 10], to: [p.L.hemIn[0] - 0.5, p.hemY + 10] };
  m.frontRise = { view: 'front', from: [CX + 16, p.Y0], to: [CX + 16, p.crotchY], at: 0.55 };
  m.backRise = { view: 'back', from: [CX + 16, p.Y0], to: [CX + 16, p.crotchY], at: 0.75 };
  m.inseam = { view: 'front', from: [CX + 8, p.crotchY + 2], to: [W - p.L.hemIn[0] + 8, p.hemY - 2], at: 0.6 };
  const ox = CX - p.hipHalf - 9;
  m.outseam = { view: 'back', from: [ox, p.Y0], to: [ox, p.hemY] };
  return m;
}
function pantsAnchors(p: ReturnType<typeof pantsShapes>, onFront: boolean): Record<string, XY> {
  const lr = (k: string, q: XY): Record<string, XY> => ({ [`${k}:${onFront ? 'R' : 'L'}`]: q, [`${k}:${onFront ? 'L' : 'R'}`]: mx(q, W) });
  return {
    'center:C': [CX, p.Y0 + 30], 'hem:C': [p.c2, p.hemY - 8], 'collar:C': [CX, p.Y0 + 4],
    ...lr('hip', onFront ? [CX - 38, p.Y0 + 22] : [CX - 34, p.Y0 + 30]), ...lr('thigh', [p.c0, p.crotchY + 40]), ...(p.short ? {} : lr('knee', [p.c1, p.kneeY - 20])), ...lr('hem', [p.c2, p.hemY - 8]),
  };
}
export function trousers(o: PantsOpts): Built {
  const p = pantsShapes(o);
  const d = pantsDetails(p, o);
  return {
    views: [
      { view: 'front', title: 'Front', origin: [10, 0], shapes: [{ d: p.silhouette, stroke: 'outline' }, ...d.front], anchors: pantsAnchors(p, true), match: FRONT_MATCH },
      { view: 'back', title: 'Back', origin: [W + 10, 0], shapes: [{ d: p.silhouette, stroke: 'outline' }, ...d.back], anchors: pantsAnchors(p, false), match: BACK_MATCH },
    ],
    measures: pantsMeasures(p), height: p.hemY + 22,
  };
}

// ---- one-piece suits: coveralls, chemical suits, survival suits -----------------------------------------------------------
export interface SuitOpts { torso: number; inseam: number; collar: TopOpts['collar']; hood?: TopOpts['hood']; cuffStyle?: TopOpts['cuffStyle']; chestPockets?: 0 | 1 | 2; tape?: boolean; boots?: boolean; mitts?: boolean; flap?: boolean }
export function oneSuit(o: SuitOpts): Built {
  const torsoY = 100 + o.torso * K;
  const p = pantsShapes({ inseam: o.inseam, style: 'plain', top: torsoY - 11.5 * K, hip: 24, waist: 24 });
  const hipY = torsoY - 2.5 * K;
  const bottom: XY[] = [[CX - p.hipHalf, hipY], p.L.kneeOut, p.L.hemOut, p.L.hemIn, p.L.kneeIn, p.L.crotch];
  const top = topGarment({ len: o.torso, sleeve: 'long', collar: o.collar, hood: o.hood ?? 'none', closure: o.flap ? 'flap' : 'zip', chestPockets: o.chestPockets ?? 0, cuffStyle: o.cuffStyle ?? 'band', tape: o.tape, chest: 24, bottom, closureEnd: torsoY - 12 });
  const Y0 = top.g.Y0 as number, UAy = top.g.UAy as number;
  const waistY = UAy + (torsoY - UAy) * 0.45;
  const sideAt = (y: number) => xAt([CX - 12 * K, UAy], [CX - p.hipHalf, hipY], y);
  const legLines = both(line(add(p.L.hemOut, [0.5, -0.7 * K]), add(p.L.hemIn, [-0.5, -0.7 * K])), 'stitch', W);
  const front: Shape[] = [...top.views[0].shapes, ...legLines, { d: line([CX, torsoY - 12], [CX, torsoY]), stroke: 'seam' }];
  const ticksBack: Array<[XY, XY]> = []; for (let x = CX - 30; x <= CX + 30; x += 6) ticksBack.push([[x, waistY - 3], [x, waistY + 3]]);
  const back: Shape[] = [...top.views[1].shapes, ...legLines, { d: line([sideAt(waistY), waistY], [W - sideAt(waistY), waistY]), stroke: 'seam' }, { d: ticks(ticksBack), stroke: 'stitch' }];
  if (o.boots) for (const v of [front, back]) v.push(...both(`M ${pt(p.L.hemOut)} L ${pt([p.L.hemOut[0] - 2, p.hemY + 26])} Q ${pt([p.L.hemOut[0] - 22, p.hemY + 30])} ${pt([p.L.hemOut[0] - 20, p.hemY + 40])} L ${pt([p.L.hemIn[0], p.hemY + 40])} L ${pt(p.L.hemIn)}`, 'outline', W));
  // The sleeve end (the cuff line is drawn 10 units beyond it).
  const u = unit(sub(top.measures.sleeveLength.to as XY, top.measures.sleeveLength.from as XY));
  const E = sub(top.measures.cuff.from as XY, mul(u, 10)), Ci = sub(top.measures.cuff.to as XY, mul(u, 10));
  const pm = pantsMeasures(p);
  const m: Record<string, Measure> = { ...top.measures };
  if (o.mitts) {
    const mit = `M ${pt(E)} L ${pt(add(E, mul(u, 22)))} Q ${pt(add(lerp(E, Ci, 0.5), mul(u, 42)))} ${pt(add(Ci, mul(u, 22)))} L ${pt(Ci)}`;
    for (const v of [front, back]) v.push(...both(mit, 'outline', W), ...both(line(E, Ci), 'seam', W));
    m.cuff = { view: 'back', from: sub(E, mul(u, 8)), to: sub(Ci, mul(u, 8)) }; // the wrist seal, before the mitt
  }
  m.waist = { view: 'front', from: [sideAt(waistY) + 0.7, waistY], to: [W - sideAt(waistY) - 0.7, waistY] };
  m.hip = { view: 'front', from: [CX - p.hipHalf + 0.7, hipY], to: [CX + p.hipHalf - 0.7, hipY] };
  m.torso = { view: 'back', from: [W - (CX - 4 * K), Y0], to: [W - (CX - 4 * K), torsoY], at: 0.6 };
  m.crotchDepth = { view: 'back', from: [CX - 16, waistY], to: [CX - 16, torsoY], at: 0.5 };
  m.thigh = pm.thigh; m.knee = pm.knee; m.legOpening = pm.legOpening; m.inseam = pm.inseam;
  const topY = o.hood === 'fixed' ? Y0 - 80 : Y0 - 2.5 * K;
  m.heightRange = { view: 'front', from: [W + 12, topY], to: [W + 12, p.hemY + (o.boots ? 40 : 0)], at: 0.3 }; // between the two views
  m.hoodOpening = { view: 'front', from: [CX - 24, Y0 - 38], to: [CX + 24, Y0 - 38] };
  m.footLength = { view: 'front', from: [p.L.hemOut[0] - 21, p.hemY + 50], to: [p.L.hemIn[0], p.hemY + 50] };
  const strip = (a: Record<string, XY>) => { const c = { ...a }; delete c['hem:C']; return c; };
  return {
    views: [
      { ...top.views[0], shapes: front, anchors: { ...strip(top.views[0].anchors), ...pantsAnchors(p, true), 'center:C': [CX, Y0 + 40] } },
      { ...top.views[1], origin: [W + 34, 0], shapes: back, anchors: { ...strip(top.views[1].anchors), ...pantsAnchors(p, false), 'center:C': [CX, Y0 + 40] } },
    ],
    measures: m, height: p.hemY + (o.boots ? 62 : 22), extraWidth: 24,
  };
}

// ---- bib overalls ---------------------------------------------------------------------------------------------------------
export function bibOverall(): Built {
  const waistY = 150;
  const p = pantsShapes({ inseam: 30, style: 'trouser', top: waistY, waist: 19, hip: 22 });
  const bibTop = waistY - 13 * K, bibHalf = 5.5 * K;
  const d = pantsDetails(p, { inseam: 30, style: 'trouser' }, false);
  const bib = poly([[CX - p.waistHalf, waistY], [CX - bibHalf, bibTop + 10], [CX - bibHalf, bibTop], [CX + bibHalf, bibTop], [CX + bibHalf, bibTop + 10], [CX + p.waistHalf, waistY]]);
  const strapF = (s: number) => `M ${pt([CX + s * (bibHalf - 3), bibTop])} L ${pt([CX + s * (bibHalf + 8), bibTop - 52])} L ${pt([CX + s * (bibHalf + 18), bibTop - 52])} L ${pt([CX + s * (bibHalf + 8), bibTop])}`;
  const front: Shape[] = [{ d: p.silhouette, stroke: 'outline' }, { d: bib, stroke: 'outline' }, { d: strapF(-1), stroke: 'outline' }, { d: strapF(1), stroke: 'outline' }, ...d.front,
    { d: line([CX - p.waistHalf, waistY], [CX + p.waistHalf, waistY]), stroke: 'seam' }, { d: rect(CX - 20, bibTop + 14, 40, 30), stroke: 'seam' }, { d: line([CX - 20, bibTop + 20], [CX + 20, bibTop + 20]), stroke: 'stitch' },
    ...both(rect(CX - bibHalf - 3, bibTop - 2, 10, 8), 'seam', W)];
  const backTop = waistY - 4 * K;
  const back: Shape[] = [{ d: p.silhouette, stroke: 'outline' }, { d: poly([[CX - p.waistHalf, waistY], [CX - p.waistHalf + 4, backTop], [CX + p.waistHalf - 4, backTop], [CX + p.waistHalf, waistY]]), stroke: 'outline' }, ...d.back,
    { d: line([CX - p.waistHalf, waistY], [CX + p.waistHalf, waistY]), stroke: 'seam' },
    { d: poly([[CX - 30, backTop], [CX - 6, backTop - 40], [CX + 34, bibTop - 52]]), stroke: 'outline' }, { d: poly([[CX - 22, backTop], [CX + 2, backTop - 40]]), stroke: 'outline' },
    { d: poly([[CX + 30, backTop], [CX + 6, backTop - 40], [CX - 34, bibTop - 52]]), stroke: 'outline' }, { d: poly([[CX + 22, backTop], [CX - 2, backTop - 40]]), stroke: 'outline' }];
  const pm = pantsMeasures(p);
  const m: Record<string, Measure> = {
    waist: { view: 'front', from: [CX - p.waistHalf + 0.7, waistY + 4], to: [CX + p.waistHalf - 0.7, waistY + 4], at: 0.25 },
    seat: pm.seat, frontRise: { ...pm.frontRise, from: [CX + 16, waistY], to: [CX + 16, p.crotchY] }, backRise: { ...pm.backRise, from: [CX + 16, waistY], to: [CX + 16, p.crotchY] },
    thigh: pm.thigh, knee: pm.knee, inseam: pm.inseam, legOpening: pm.legOpening,
    bibHeight: { view: 'front', from: [CX + bibHalf + 12, waistY], to: [CX + bibHalf + 12, bibTop] },
    bibWidth: { view: 'front', from: [CX - bibHalf, bibTop - 8], to: [CX + bibHalf, bibTop - 8], at: 0.3 },
    strap: { view: 'back', from: [CX + 34, waistY - 4 * K - 2], to: [CX - 32, bibTop - 52], at: 0.3, label: [CX - 52, bibTop - 30] },
  };
  return {
    views: [
      { view: 'front', title: 'Front', origin: [10, 0], shapes: front, anchors: { ...pantsAnchors(p, true), 'chest:C': [CX, bibTop + 50], 'center:C': [CX, bibTop + 30], 'shoulder:L': [CX + bibHalf + 12, bibTop - 30], 'shoulder:R': [CX - bibHalf - 12, bibTop - 30] }, match: FRONT_MATCH },
      { view: 'back', title: 'Back', origin: [W + 10, 0], shapes: back, anchors: { ...pantsAnchors(p, false), 'shoulder:C': [CX, backTop - 30] }, match: BACK_MATCH },
    ],
    measures: m, height: p.hemY + 22,
  };
}

// ---- aprons ---------------------------------------------------------------------------------------------------------------
export function apron(): Built {
  const top = 100, chestEnd = top + 10 * K, sideY = top + 15 * K, bottom = top + 36 * K, topHalf = 5.5 * K, fullHalf = 12 * K;
  const out = poly([[CX - topHalf, top], [CX + topHalf, top], [CX + topHalf, chestEnd]]) + ` Q ${pt([CX + topHalf + 4, sideY - 6])} ${pt([CX + fullHalf, sideY])} L ${pt([CX + fullHalf, bottom])} L ${pt([CX - fullHalf, bottom])} L ${pt([CX - fullHalf, sideY])} Q ${pt([CX - topHalf - 4, sideY - 6])} ${pt([CX - topHalf, chestEnd])} Z`;
  const neck = `M ${pt([CX - topHalf + 2, top])} C ${pt([CX - 40, top - 70])} ${pt([CX + 40, top - 70])} ${pt([CX + topHalf - 2, top])}`;
  const tieL = poly([[CX - fullHalf, sideY + 4], [CX - fullHalf - 60, sideY + 40]]);
  const shapes: Shape[] = [{ d: out, stroke: 'outline' }, { d: neck, stroke: 'outline' }, { d: tieL, stroke: 'outline' }, { d: mirrorPath(tieL, W), stroke: 'outline' },
    { d: poly([[CX - fullHalf + 4, bottom - 4], [CX + fullHalf - 4, bottom - 4]]), stroke: 'stitch' }, { d: rect(CX - 30, sideY + 30, 60, 36), stroke: 'seam' }];
  const m: Record<string, Measure> = {
    widthTop: { view: 'front', from: [CX - topHalf, top - 8], to: [CX + topHalf, top - 8], at: 0.3 },
    widthBottom: { view: 'front', from: [CX - fullHalf, bottom + 10], to: [CX + fullHalf, bottom + 10] },
    length: { view: 'front', from: [CX + fullHalf + 12, top], to: [CX + fullHalf + 12, bottom] },
    neckStrap: { view: 'front', from: [CX - topHalf - 6, top - 4], to: [CX - 18, top - 52], label: [CX - 70, top - 40] },
    waistStrap: { view: 'front', from: offsetSeg([CX - fullHalf, sideY + 4], [CX - fullHalf - 60, sideY + 40], -8)[0], to: offsetSeg([CX - fullHalf, sideY + 4], [CX - fullHalf - 60, sideY + 40], -8)[1] },
    chestCoverage: { view: 'front', from: [CX - topHalf - 10, top], to: [CX - topHalf - 10, chestEnd], label: [CX - topHalf - 32, top + 20] },
  };
  return { views: [{ view: 'front', title: 'Front', origin: [10, 0], shapes, anchors: { 'chest:C': [CX, top + 30], 'center:C': [CX, sideY + 10], 'hip:C': [CX, sideY + 48], 'hem:C': [CX, bottom - 14] }, match: FRONT_MATCH }], measures: m, height: bottom + 24 };
}

// ---- the drawings ---------------------------------------------------------------------------------------------------------
function make(key: string, label: string, b: Built, map: Record<string, string>, notes?: string[], width = 2): DrawingDef {
  const callouts = Object.entries(map).map(([code, k]) => { const mm = b.measures[k]; if (!mm) throw new Error(`${key}: no measuring line "${k}"`); return { code, ...mm }; });
  return { key, version: 1, label, viewWidth: W, size: [W * width + 20 + (b.extraWidth ?? 0), Math.round(b.height + 26 + (notes?.length ?? 0) * 12)], views: b.views, callouts, ...(notes ? { notes } : {}) };
}

export const SHIRT_V1 = make('shirt', 'Shirt, polo and tee', topGarment({ len: 30, sleeve: 'long', sleeveLen: 33, bicep: 8.5, cuff: 4.8, chest: 23, shoulder: 18.5, armhole: 10, collar: 'shirt', closure: 'buttons', chestPockets: 1, hemStyle: 'plain', cuffStyle: 'band', yoke: true }),
  { A: 'chest', B: 'shoulder', C: 'bodyLength', D: 'sleeveLength', E: 'armhole', F: 'bicep', G: 'cuff', H: 'neck', I: 'hem', J: 'placket' },
  ['A long-sleeved work shirt is shown. T-shirts and polos have short sleeves and other necklines: use the measurements, not the drawing.']);
export const HOODIE_V1 = make('hoodie', 'Hoodie and sweatshirt', topGarment({ len: 28, sleeve: 'long', sleeveLen: 34, bicep: 9, cuff: 4.2, chest: 23, collar: 'crew', hood: 'fixed', closure: 'none', lowerPockets: 'kangaroo', hemStyle: 'rib', cuffStyle: 'rib' }),
  { A: 'chest', B: 'shoulder', C: 'bodyLength', D: 'sleeveLength', E: 'bicep', F: 'cuff', G: 'hem', H: 'neck', I: 'hoodHeight', J: 'hoodWidth' },
  ['A pullover hoodie is shown. Sweatshirts have no hood, and zip hoodies a front zip.']);
export const VEST_V1 = make('vest', 'Vest', topGarment({ len: 27, sleeve: 'none', chest: 23, armhole: 10.5, collar: 'crew', closure: 'zip', chestPockets: 2, lowerPockets: 'welt', hemStyle: 'plain' }),
  { A: 'chest', B: 'waist', C: 'hem', D: 'shoulder', E: 'armhole', F: 'bodyLength', G: 'neck' },
  ['Reflective tape is not drawn: record its layout and width in the checklist.']);
export const TROUSERS_V1 = make('trousers', 'Trousers', trousers({ inseam: 32, style: 'cargo' }),
  { A: 'waist', B: 'hip', C: 'seat', D: 'thigh', E: 'knee', F: 'legOpening', G: 'frontRise', H: 'backRise', I: 'inseam', J: 'outseam' },
  ['Cargo work trousers are shown. Plain trousers have no side pockets; leg shape varies by style.']);
export const SHORTS_V1 = make('shorts', 'Work shorts', trousers({ inseam: 9, style: 'trouser' }),
  { A: 'waist', B: 'hip', C: 'seat', D: 'thigh', E: 'legOpening', F: 'frontRise', G: 'backRise', H: 'inseam', I: 'outseam' });
export const COVERALL_V1 = make('coverall', 'Coverall', oneSuit({ torso: 30, inseam: 31, collar: 'stand', chestPockets: 2 }),
  { A: 'chest', B: 'waist', C: 'hip', D: 'shoulder', E: 'torso', F: 'crotchDepth', G: 'sleeveLength', H: 'armhole', I: 'thigh', J: 'knee', K: 'inseam', L: 'legOpening', M: 'cuff', N: 'neck' });
export const BIB_V1 = make('bib', 'Bib overall', bibOverall(),
  { A: 'waist', B: 'seat', C: 'bibHeight', D: 'bibWidth', E: 'strap', F: 'frontRise', G: 'backRise', H: 'thigh', I: 'knee', J: 'inseam', K: 'legOpening' });
export const LABCOAT_V1 = make('labcoat', 'Lab coat', topGarment({ len: 40, sleeve: 'long', sleeveLen: 33, bicep: 9, cuff: 5, chest: 23, hem: 25, collar: 'lapel', closure: 'buttons', chestPockets: 1, lowerPockets: 'patch', hemStyle: 'plain', cuffStyle: 'plain', backVent: true }),
  { A: 'chest', B: 'waist', C: 'hip', D: 'shoulder', E: 'bodyLength', F: 'sleeveLength', G: 'bicep', H: 'cuff', I: 'hem' });
export const SCRUB_TOP_V1 = make('scrub-top', 'Scrub top', topGarment({ len: 28, sleeve: 'short', sleeveLen: 9, bicep: 8.5, cuff: 7, chest: 23, armhole: 10, collar: 'v', closure: 'none', chestPockets: 1, lowerPockets: 'patch', hemStyle: 'plain', cuffStyle: 'plain' }),
  { A: 'chest', B: 'shoulder', C: 'bodyLength', D: 'sleeveLength', E: 'neck', F: 'hem', G: 'pocket' });
export const SCRUB_PANTS_V1 = make('scrub-pants', 'Scrub pants', trousers({ inseam: 31, style: 'elastic', opening: 9 }),
  { A: 'waist', B: 'hip', C: 'frontRise', D: 'backRise', E: 'thigh', F: 'knee', G: 'legOpening', H: 'inseam', I: 'outseam' });
export const APRON_V1 = make('apron', 'Apron', apron(), { A: 'widthTop', B: 'widthBottom', C: 'length', D: 'neckStrap', E: 'waistStrap', F: 'chestCoverage' }, undefined, 1);
export const TURNOUT_COAT_V1 = make('turnout-coat', 'Turnout coat', topGarment({ len: 32, sleeve: 'long', sleeveLen: 34, bicep: 10, cuff: 5.5, chest: 25, shoulder: 20, armhole: 12, collar: 'high', closure: 'flap', lowerPockets: 'patch', hemStyle: 'plain', cuffStyle: 'band', tape: true }),
  { A: 'chest', B: 'waist', C: 'hip', D: 'shoulder', E: 'bodyLength', F: 'sleeveLength', G: 'armhole', H: 'cuff', I: 'collarHeight', J: 'frontOverlap' },
  ['Reflective trim placement is drawn as a guide only: it comes from the certified design.']);
export const TURNOUT_PANTS_V1 = make('turnout-pants', 'Turnout pants', trousers({ inseam: 31, style: 'turnout', opening: 10.5, knee: 11 }),
  { A: 'waist', B: 'hip', C: 'seat', D: 'thigh', E: 'knee', F: 'legOpening', G: 'frontRise', H: 'inseam', I: 'outseam' });
export const CHEMICAL_SUIT_V1 = make('chemical-suit', 'Chemical protective suit', oneSuit({ torso: 30, inseam: 31, collar: 'none', hood: 'fixed', cuffStyle: 'elastic', flap: true }),
  { A: 'heightRange', B: 'chest', C: 'waist', D: 'hip', E: 'torso', F: 'sleeveLength', G: 'inseam', H: 'hoodOpening', I: 'cuff' });
export const SURVIVAL_SUIT_V1 = make('survival-suit', 'Immersion / survival suit', oneSuit({ torso: 31, inseam: 30, collar: 'none', hood: 'fixed', cuffStyle: 'plain', boots: true, mitts: true, tape: true }),
  { A: 'heightRange', B: 'chest', C: 'torso', D: 'sleeveLength', E: 'inseam', F: 'hoodOpening', G: 'cuff', H: 'footLength' },
  ['Attached boots and mitts are drawn as a guide. Size is set by the wearer height and weight range.']);
export const GOWN_V1 = make('gown', 'Disposable gown', topGarment({ len: 44, sleeve: 'long', sleeveLen: 32, bicep: 9.5, cuff: 4, chest: 26, hem: 30, collar: 'crew', closure: 'none', hemStyle: 'plain', cuffStyle: 'elastic', backTies: true }),
  { A: 'chest', B: 'bodyLength', C: 'sleeveLength', D: 'neck', E: 'cuff', F: 'tie' });

export const GARMENT_DRAWINGS: DrawingDef[] = [SHIRT_V1, HOODIE_V1, VEST_V1, TROUSERS_V1, SHORTS_V1, COVERALL_V1, BIB_V1, LABCOAT_V1, SCRUB_TOP_V1, SCRUB_PANTS_V1, APRON_V1, TURNOUT_COAT_V1, TURNOUT_PANTS_V1, CHEMICAL_SUIT_V1, SURVIVAL_SUIT_V1, GOWN_V1];
