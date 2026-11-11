// Task 29: flat drawings for gloves, footwear, headwear, hoods and face coverings, protective sleeves, back supports and
// harnesses. Original art, standard flat conventions: a left glove (palm and back of hand), a right 6-inch lace-up boot
// (outer side, inner side, top and sole), a six-panel cap (front, side, back, top). Each view has its own box and scale.
// A version is never changed once a tech file uses it: a change is a new version.
import type { DrawingDef, ViewDef, CalloutDef } from './drawings';
import { type XY, type Shape, poly, line, rect, ticks, mirrorPath, mx } from './drawings-geom';

const view = (v: string, title: string, origin: XY, w: number, shapes: Shape[], anchors: Record<string, XY>, match: string, dots?: XY[]): ViewDef => ({ view: v, title, origin, w, shapes, anchors, match, ...(dots ? { dots } : {}) });
const c = (code: string, v: string, from: XY, to: XY, extra: Partial<CalloutDef> = {}): CalloutDef => ({ code, view: v, from, to, ...extra });

// ---- glove (left hand; palm view: thumb on the viewer's left, back of hand: thumb on the right) ---------------------------
const GW = 220;
const GLOVE = 'M 62 300 L 62 255 L 60 215 Q 30 196 22 150 Q 24 122 44 130 L 62 168 L 60 80 Q 72 50 84 80 L 85 128 L 87 62 Q 98 30 110 62 L 111 126 L 113 74 Q 123 46 134 74 L 135 130 L 137 100 Q 147 78 158 100 L 160 150 L 160 255 L 158 300 Z';
const gloveCommon: Shape[] = [
  { d: line([61, 255], [160, 255]), stroke: 'seam' },
  { d: ticks(Array.from({ length: 11 }, (_, i) => [[68 + i * 8.5, 259], [68 + i * 8.5, 296]] as [XY, XY])), stroke: 'stitch' },
];
const PALM: Shape[] = [{ d: GLOVE, stroke: 'outline' }, ...gloveCommon, { d: 'M 61 232 Q 110 238 160 232', stroke: 'hidden' }, { d: line([62, 168], [64, 212]), stroke: 'seam' }];
const BACKHAND: Shape[] = [{ d: mirrorPath(GLOVE, GW), stroke: 'outline' }, ...gloveCommon.map((s) => ({ ...s, d: mirrorPath(s.d, GW) })), { d: 'M 64 132 Q 110 124 158 132', stroke: 'seam' }, { d: line([86, 128], [86, 132]), stroke: 'seam' }];
export const GLOVE_V1: DrawingDef = {
  key: 'glove', version: 1, label: 'Glove', viewWidth: GW, size: [2 * GW + 30, 360],
  notes: ['A left glove is shown; the right is its mirror image. The coating line (dotted) and cuff vary by style.'],
  views: [
    view('palm', 'Palm', [10, 6], GW, PALM, { 'palm:C': [110, 190], 'finger:C': [98, 70], 'thumb:C': [36, 150], 'cuff:C': [110, 280] }, ''),
    view('back-of-hand', 'Back of hand', [GW + 20, 6], GW, BACKHAND, { 'knuckle:C': [110, 150], 'finger:C': [122, 70], 'thumb:C': [184, 150], 'cuff:C': [110, 280], 'palm:C': [110, 200] }, 'back|knuckle|impact'),
  ],
  callouts: [
    c('A', 'palm', [178, 32], [178, 300], { at: 0.45 }),
    c('B', 'palm', [60.7, 140], [159.3, 140], { at: 0.62 }),
    c('C', 'back-of-hand', [GW - 98, 126], [GW - 98, 32], { at: 0.45 }),
    c('D', 'palm', [52, 176], [26, 128], { label: [18, 186] }),
    c('E', 'palm', [46, 255], [46, 300], { label: [30, 278] }),
  ],
};

// ---- footwear (right boot) -------------------------------------------------------------------------------------------------
// A right 6-inch lace-up safety boot at about 20 units per inch. Side views: a tall, round toe box over the toe cap, and a
// distinct heel block (about 1.3 in from the ground to the top of the heel at the back) with a step up under the arch.
// Top and sole views: a right foot, so the inner (big toe) edge is straighter and the outer edge more curved; seen from the
// top the inner edge is on the viewer's left, seen from below (the sole) it is on the viewer's right.
const FW = 300, FT = 150;
export const BOOT_GROUND = 250, BOOT_HEEL_TOP = 224, BOOT_ARCH = 237, BOOT_HEEL_FRONT = 88;
const BOOT_SIDE = 'M 32 224 L 42 98 L 118 92 L 126 140 Q 154 166 200 175 C 248 164 298 186 286 224 Z';
// Outsole and heel: forefoot sole on the ground, arch raised, a heel block whose front face is the step under the arch.
const SOLE_SIDE = `M 24 ${BOOT_HEEL_TOP} L 286 ${BOOT_HEEL_TOP} Q 298 237 284 ${BOOT_GROUND} L 128 ${BOOT_GROUND} Q 106 ${BOOT_GROUND} 94 ${BOOT_ARCH} L ${BOOT_HEEL_FRONT} ${BOOT_ARCH} L ${BOOT_HEEL_FRONT} ${BOOT_GROUND} L 28 ${BOOT_GROUND} Q 21 ${BOOT_GROUND} 22 242 Z`;
const sideShapes = (): Shape[] => [
  { d: BOOT_SIDE, stroke: 'outline' }, { d: SOLE_SIDE, stroke: 'outline' },
  { d: line([26, 230], [287, 230]), stroke: 'stitch' }, // welt stitch
  { d: line([23, 236], [BOOT_HEEL_FRONT, 236]), stroke: 'seam' }, // heel block (top lift)
  { d: 'M 34 196 Q 72 190 86 224', stroke: 'seam' }, // heel counter
  { d: 'M 222 224 Q 220 188 246 172', stroke: 'seam' }, // rubber toe guard edge
  { d: 'M 232 222 Q 231 196 252 186 Q 276 186 282 212', stroke: 'hidden' }, // protective toe cap inside
  { d: 'M 42 108 L 119 102', stroke: 'stitch' }, // padded collar
  { d: 'M 126 140 Q 146 148 156 166', stroke: 'seam' }, // vamp seam
  { d: rect(38, 88, 8, 14), stroke: 'seam' }, // pull tab
];
// Top view (toe up): inner edge (left) nearly straight, outer edge (right) curved; the toe point sits towards the inner side.
const BOOT_TOP = 'M 64 16 C 100 14 126 60 126 110 C 126 150 112 180 110 204 L 110 252 Q 108 290 74 292 Q 42 290 40 252 L 38 184 C 36 150 30 122 30 90 C 30 42 42 16 64 16 Z';
// Sole view (from below, toe up): the same footprint mirrored: the straighter inner edge on the right, the curved outer edge on the left.
const SOLE_BOT = mirrorPath(BOOT_TOP, FT);
export const BOOT_TOP_PATH = BOOT_TOP, BOOT_SOLE_PATH = SOLE_BOT;
export const FOOTWEAR_V1: DrawingDef = {
  key: 'footwear', version: 1, label: 'Footwear', viewWidth: FW, size: [2 * FW + 2 * FT + 50, 350],
  notes: ['A right 6-inch lace-up safety boot is shown. Shoes, rubber boots and taller boots differ: use the measurements, not the drawing.'],
  views: [
    view('outer-side', 'Outer side', [10, 20], FW, sideShapes(), { 'toe:C': [254, 204], 'heel:C': [56, 243], 'shaft:C': [80, 150], 'sole:C': [190, 240] }, '', [[121, 104], [123, 116], [125, 128]]),
    view('inner-side', 'Inner side', [FW + 20, 20], FW, [...sideShapes().map((s) => ({ ...s, d: mirrorPath(s.d, FW) })), { d: line([FW - 70, 110], [FW - 70, 218]), stroke: 'hidden' }], { 'shaft:C': [FW - 90, 150], 'toe:C': [FW - 254, 204], 'heel:C': [FW - 56, 243] }, 'inner|inside|medial|instep side'),
    view('top', 'Top', [2 * FW + 30, 20], FT, [
      { d: BOOT_TOP, stroke: 'outline' }, { d: 'M 50 200 Q 76 186 102 200 Q 104 238 75 250 Q 46 238 50 200 Z', stroke: 'seam' },
      { d: 'M 32 82 Q 72 62 124 86', stroke: 'seam' }, // toe guard edge
      { d: ticks([[[58, 110], [88, 120]], [[58, 120], [88, 110]], [[58, 135], [88, 145]], [[58, 145], [88, 135]], [[58, 160], [88, 170]], [[58, 170], [88, 160]]]), stroke: 'seam' },
    ], { 'lace:C': [73, 140], 'toe:C': [70, 44], 'shaft:C': [76, 224] }, 'lace|tongue|\\btop\\b|metatarsal|instep'),
    view('sole', 'Sole', [2 * FW + FT + 40, 20], FT, [
      { d: SOLE_BOT, stroke: 'outline' },
      { d: ticks([[46, 104], [38, 110], [32, 112], [30, 112], [30, 112], [30, 112], [32, 112], [38, 110], [40, 110]].map(([x0, x1], i) => [[x0, 44 + i * 16], [x1, 50 + i * 16]] as [XY, XY])), stroke: 'seam' },
      { d: line([41, 212], [109, 212]), stroke: 'seam' }, // heel breast
      { d: ticks([[[48, 228], [104, 228]], [[48, 248], [104, 248]], [[52, 268], [100, 268]]]), stroke: 'seam' },
    ], { 'sole:C': [73, 130], 'heel:C': [76, 252] }, 'sole|tread|bottom|lug'),
  ],
  callouts: [
    c('A', 'outer-side', [56, 222], [56, 97], { at: 0.45 }),
    c('B', 'sole', [136, 14], [136, 292], { at: 0.5 }),
    c('C', 'sole', [24.5, 110], [119.5, 110], { at: 0.5 }),
    c('D', 'outer-side', [14, BOOT_GROUND], [14, BOOT_HEEL_TOP], { label: [14, 280] }),
  ],
};

// ---- headwear (six-panel cap) ----------------------------------------------------------------------------------------------
const HW = 220;
export const HEADWEAR_V1: DrawingDef = {
  key: 'headwear', version: 1, label: 'Hat or cap', viewWidth: HW, size: [4 * HW + 50, 270],
  notes: ['Textile hats and caps only. Hard hats, bump caps and other head protection are out of scope and must not be replicated from photos.'],
  views: [
    view('front', 'Front', [10, 10], HW, [
      { d: 'M 30 170 C 30 70 190 70 190 170 Z', stroke: 'outline' }, { d: 'M 22 170 Q 110 206 198 170 Q 110 186 22 170 Z', stroke: 'outline' },
      { d: line([110, 96], [110, 170]), stroke: 'seam' }, { d: 'M 74 101 Q 80 130 70 170', stroke: 'seam' }, { d: 'M 146 101 Q 140 130 150 170', stroke: 'seam' },
      { d: 'M 34 160 Q 110 168 186 160', stroke: 'stitch' }, { d: 'M 30 179 Q 110 205 190 179', stroke: 'stitch' },
    ], { 'crown:C': [110, 125], 'brim:C': [110, 186], 'eyelet:C': [70, 112] }, '', [[110, 95], [78, 114], [142, 114]]),
    view('side', 'Side', [HW + 20, 10], HW, [
      { d: 'M 40 170 C 38 84 140 66 168 140 L 170 170 Z', stroke: 'outline' }, { d: 'M 164 168 Q 204 168 214 182 Q 192 186 162 176 Z', stroke: 'outline' },
      { d: 'M 100 76 Q 112 120 104 170', stroke: 'seam' }, { d: line([40, 166], [168, 166]), stroke: 'stitch' },
    ], { 'brim:C': [190, 177], 'crown:C': [80, 120] }, 'side|brim|visor|peak|sweat'),
    view('back', 'Back', [2 * HW + 30, 10], HW, [
      { d: 'M 30 170 C 30 70 190 70 190 170 L 136 170 Q 110 136 84 170 Z', stroke: 'outline' }, { d: line([110, 82], [110, 140]), stroke: 'seam' },
      { d: rect(80, 160, 60, 8), stroke: 'seam' }, { d: 'M 72 88 Q 80 130 70 170', stroke: 'seam' }, { d: 'M 148 88 Q 140 130 150 170', stroke: 'seam' },
    ], { 'strap:C': [110, 152], 'center:C': [110, 152], 'buckle:C': [110, 152], 'crown:C': [60, 130] }, 'back|closure|snap|strap|buckle'),
    view('top', 'Top', [3 * HW + 40, 10], HW, [
      { d: 'M 110 30 C 170 30 180 130 110 130 C 40 130 50 30 110 30 Z', stroke: 'outline' }, { d: 'M 46 122 Q 110 230 174 122 Q 110 150 46 122 Z', stroke: 'outline' },
      { d: ticks([[[110, 30], [110, 130]], [[60, 52], [160, 108]], [[160, 52], [60, 108]]]), stroke: 'seam' },
    ], { 'crown:C': [110, 60] }, 'top|button'),
  ],
  callouts: [
    c('A', 'side', [40, 180], [168, 180], { at: 0.3 }),
    c('B', 'side', [130, 166], [130, 84], { at: 0.5 }),
    c('C', 'side', [166, 190], [214, 192], { label: [196, 214] }),
    c('D', 'top', [48, 160], [172, 160], { at: 0.5 }),
  ],
};

// ---- hood, balaclava, face covering ----------------------------------------------------------------------------------------
const HFW = 200;
const HOOD_FRONT = 'M 100 30 C 150 30 160 80 158 130 Q 156 165 140 178 Q 175 200 190 282 L 10 282 Q 25 200 60 178 Q 44 165 42 130 C 40 80 50 30 100 30 Z';
const FACE = 'M 70 100 C 70 56 130 56 130 100 C 130 144 70 144 70 100 Z';
export const HOOD_FACE_V1: DrawingDef = {
  key: 'hood-face', version: 1, label: 'Hood, balaclava or face covering', viewWidth: HFW, size: [3 * HFW + 40, 350],
  notes: ['A hood with a bib is shown. Balaclavas and face coverings are shorter; check the face opening on the product.'],
  views: [
    view('front', 'Front', [10, 6], HFW, [{ d: HOOD_FRONT, stroke: 'outline' }, { d: FACE, stroke: 'seam' }, { d: 'M 66 100 C 66 50 134 50 134 100 C 134 150 66 150 66 100 Z', stroke: 'stitch' }, { d: 'M 60 178 Q 100 190 140 178', stroke: 'seam' }, { d: line([14, 276], [186, 276]), stroke: 'stitch' }],
      { 'face:C': [100, 150], 'bib:C': [100, 240], 'collar:C': [100, 186], 'hood:C': [100, 46] }, ''),
    view('side', 'Side', [HFW + 20, 6], HFW, [{ d: 'M 90 30 C 150 28 160 90 150 140 Q 146 168 132 180 Q 168 200 178 282 L 30 282 Q 36 200 60 182 Q 30 150 32 100 C 34 50 60 30 90 30 Z', stroke: 'outline' }, { d: 'M 150 70 Q 132 100 150 132', stroke: 'seam' }, { d: line([90, 30], [86, 182]), stroke: 'seam' }],
      { 'face:C': [140, 100] }, 'side'),
    view('back', 'Back', [2 * HFW + 30, 6], HFW, [{ d: HOOD_FRONT, stroke: 'outline' }, { d: line([100, 30], [100, 282]), stroke: 'seam' }, { d: 'M 60 178 Q 100 186 140 178', stroke: 'seam' }],
      { 'hood:C': [100, 90], 'bib:C': [70, 240] }, '\\bback\\b'),
  ],
  callouts: [
    c('A', 'front', [70, 100], [130, 100]),
    c('B', 'front', [146, 58], [146, 142]),
    c('C', 'side', [188, 30], [188, 282]),
    c('D', 'front', [10, 292], [190, 292]),
  ],
};

// ---- protective sleeve -----------------------------------------------------------------------------------------------------
export const SLEEVE_V1: DrawingDef = {
  key: 'sleeve', version: 1, label: 'Protective sleeve', viewWidth: 200, size: [220, 320],
  views: [view('front', 'Front', [10, 6], 200, [
    { d: poly([[67, 40], [133, 40], [124, 256], [76, 256]], true), stroke: 'outline' },
    { d: line([68, 52], [132, 52]), stroke: 'seam' }, { d: ticks(Array.from({ length: 7 }, (_, i) => [[72 + i * 9, 42], [72 + i * 9, 50]] as [XY, XY])), stroke: 'stitch' },
    { d: line([77, 244], [123, 244]), stroke: 'stitch' }, { d: 'M 88 250 Q 100 240 112 250', stroke: 'seam' },
  ], { 'cuff:C': [100, 232], 'sleeve:C': [100, 150], 'collar:C': [100, 60] }, '')],
  callouts: [c('A', 'front', [150, 40], [150, 256]), c('B', 'front', [67, 30], [133, 30]), c('C', 'front', [76, 266], [124, 266])],
};

// ---- back support ----------------------------------------------------------------------------------------------------------
const BW = 320;
export const BACK_SUPPORT_V1: DrawingDef = {
  key: 'back-support', version: 1, label: 'Back support', viewWidth: BW, size: [2 * BW + 30, 260],
  views: [
    view('front', 'Front', [10, 6], BW, [
      { d: rect(10, 120, 300, 46), stroke: 'outline' }, { d: rect(130, 116, 60, 54), stroke: 'outline' }, { d: line([160, 116], [160, 170]), stroke: 'seam' },
      { d: rect(110, 20, 16, 100), stroke: 'outline' }, { d: rect(194, 20, 16, 100), stroke: 'outline' }, { d: line([14, 143], [306, 143]), stroke: 'stitch' },
    ], { 'center:C': [160, 143], 'strap:C': [118, 60], 'hip:L': [250, 143], 'hip:R': [70, 143] }, ''),
    view('back', 'Back', [BW + 20, 6], BW, [
      { d: rect(10, 120, 300, 46), stroke: 'outline' }, { d: rect(100, 92, 120, 100), stroke: 'outline' },
      { d: ticks([[[130, 98], [130, 186]], [[150, 98], [150, 186]], [[170, 98], [170, 186]], [[190, 98], [190, 186]]]), stroke: 'stitch' },
      { d: rect(110, 20, 16, 72), stroke: 'outline' }, { d: rect(194, 20, 16, 72), stroke: 'outline' }, { d: poly([[40, 132], [100, 128]]), stroke: 'seam' }, { d: poly([[280, 132], [220, 128]]), stroke: 'seam' },
    ], { 'center:C': [160, 142], 'strap:C': [118, 50] }, '\\bback\\b|panel|stay'),
  ],
  callouts: [c('A', 'front', [10, 186], [310, 186], { at: 0.3 }), c('B', 'back', [236, 92], [236, 192])],
  notes: ['Describe the product only: make no injury-prevention or medical claim.'],
};

// ---- safety harness (no measurement points: sizes come from the maker's chart) ------------------------------------------------
const HAW = 260;
const harnessFront: Shape[] = [
  { d: poly([[90, 20], [104, 110], [96, 200]]), stroke: 'outline' }, { d: poly([[170, 20], [156, 110], [164, 200]]), stroke: 'outline' },
  { d: line([100, 104], [160, 104]), stroke: 'outline' }, { d: rect(122, 98, 16, 12), stroke: 'seam' },
  { d: 'M 96 200 Q 130 214 164 200', stroke: 'outline' },
  { d: 'M 96 200 Q 60 230 80 268 Q 110 280 124 236 Z', stroke: 'outline' }, { d: mirrorPath('M 96 200 Q 60 230 80 268 Q 110 280 124 236 Z', HAW), stroke: 'outline' },
  { d: rect(76, 240, 10, 8), stroke: 'seam' }, { d: rect(174, 240, 10, 8), stroke: 'seam' },
];
const harnessBack: Shape[] = [
  { d: poly([[90, 20], [130, 80], [170, 200]]), stroke: 'outline' }, { d: poly([[170, 20], [130, 80], [90, 200]]), stroke: 'outline' },
  { d: 'M 120 70 L 140 70 Q 146 86 130 92 Q 114 86 120 70 Z', stroke: 'seam' }, { d: line([90, 200], [170, 200]), stroke: 'outline' },
  { d: 'M 90 200 Q 70 236 92 264', stroke: 'outline' }, { d: mirrorPath('M 90 200 Q 70 236 92 264', HAW), stroke: 'outline' },
  { d: rect(110, 140, 40, 22), stroke: 'seam' },
];
export const HARNESS_V1: DrawingDef = {
  key: 'harness', version: 1, label: 'Safety harness', viewWidth: HAW, size: [2 * HAW + 30, 330],
  notes: ["Certified equipment: the drawing describes the webbing layout only. Compliance comes from the manufacturer's certification."],
  views: [
    view('front', 'Front', [10, 6], HAW, harnessFront, { 'buckle:C': [130, 120], 'dring:C': [130, 92], 'strap:C': [94, 60], 'thigh:L': [180, 250], 'thigh:R': [80, 250], 'shoulder:L': [166, 40], 'shoulder:R': [94, 40] }, ''),
    view('back', 'Back', [HAW + 20, 6], HAW, harnessBack, { 'dring:C': [130, 104], 'strap:C': [100, 160], 'center:C': [130, 151] }, '\\bback\\b|dorsal|label'),
  ],
  callouts: [],
};
void mx;

export const PRODUCT_DRAWINGS: DrawingDef[] = [GLOVE_V1, FOOTWEAR_V1, HEADWEAR_V1, HOOD_FACE_V1, SLEEVE_V1, BACK_SUPPORT_V1, HARNESS_V1];
