// Task 29: the jacket flat drawing, version 1 (template family "jacket": jackets, parkas, coats, winter, softshell, rain,
// hi-vis and FR jackets...). Original art: a generic work jacket with a stand collar, centre-front zip, flapped chest pockets,
// slanted hand pockets, set-in sleeves with cuffs, a hem band and a back yoke. The hood is dotted: "if any".
// Proportions follow a men's size L at 5.6 units per inch: chest 24 in (flat), body length 34.5 in (15% longer than a 30 in
// waist-length jacket, so the waist line sits clearly between chest and hem), shoulder 19 in, sleeve 34 in, armhole 9.2 in
// (underarm raised), bicep 9.5 in, cuff 5.5 in, neck 8 in, hood 14 in high. The sleeves hang at 46 degrees, as in a standard flat.
// Each view is drawn in its own 400-wide box (centre x = 200); `origin` places it on the sheet. Paths use absolute M L Q C Z only.
// A version is never changed once a tech file uses it: a change is JACKET_V2.
import type { DrawingDef } from './drawings';
import type { Shape } from './drawings-geom';

const W = 400;
/** Mirror a path left to right inside the view box. */
const mirror = (d: string) => {
  const tokens = d.match(/[MLQCZ]|-?\d*\.?\d+/g) ?? [];
  let i = 0;
  return tokens.map((tk) => {
    if (/^[MLQCZ]$/.test(tk)) { i = 0; return tk; }
    return String(Math.round((i++ % 2 === 0 ? W - Number(tk) : Number(tk)) * 100) / 100);
  }).join(' ');
};
const both = (d: string, stroke: Shape['stroke']): Shape[] => [{ d, stroke }, { d: mirror(d), stroke }];

// Body and sleeves in one outline: neck, shoulder, sleeve, cuff, underarm, side, hem, and up the other side to the collar.
const SILHOUETTE = 'M 177.6 100 L 146.8 110.1 L 9.8 242.4 L 31.2 264.5 L 132.8 160 L 132.8 293 L 267.2 293 L 267.2 160 L 368.8 264.5 L 390.2 242.4 L 253.2 110.1 L 222.4 100 L 221.5 86 Q 200 82 178.5 86 L 177.6 100 Z';
const COMMON: Shape[] = [
  { d: SILHOUETTE, stroke: 'outline' },
  ...both('M 146.8 110.1 Q 140.8 139 132.8 160', 'seam'), // armhole
  ...both('M 19.9 232.6 L 41.3 254.8', 'seam'), // cuff seam
  ...both('M 12.7 239.6 L 34.1 261.7', 'stitch'), // cuff topstitch
  { d: 'M 132.8 281.8 L 267.2 281.8', stroke: 'seam' }, // hem band
  { d: 'M 132.8 290 L 267.2 290', stroke: 'stitch' },
];

const FRONT: Shape[] = [
  ...COMMON,
  { d: 'M 177.6 100 Q 200 110 222.4 100', stroke: 'seam' }, // neck seam
  { d: 'M 200 84 L 200 293', stroke: 'seam' }, // centre-front zip
  { d: 'M 196 104 L 196 291', stroke: 'stitch' },
  { d: 'M 204 104 L 204 291', stroke: 'stitch' },
  { d: 'M 197.5 106 L 202.5 106 L 202.5 118 L 197.5 118 Z', stroke: 'seam' }, // zip pull
  ...both('M 141 128 L 196 133', 'seam'), // front yoke
  ...both('M 150 134 L 186 134 L 186 143 Q 168 148 150 143 Z', 'seam'), // chest pocket flap
  ...both('M 152 144 L 152 159 L 184 159 L 184 144', 'seam'), // chest pocket
  ...both('M 155 146 L 155 156 L 181 156 L 181 146', 'stitch'),
  ...both('M 150 230 L 160 268', 'seam'), // hand pocket welt
  ...both('M 154 229 L 164 267', 'seam'),
];

const BACK: Shape[] = [
  ...COMMON,
  { d: 'M 177.6 100 Q 200 106 222.4 100', stroke: 'seam' }, // back neck seam
  { d: 'M 196 101 L 196 108 L 204 108 L 204 101', stroke: 'seam' }, // hanger loop
  { d: 'M 140 132 Q 200 142 260 132', stroke: 'seam' }, // back yoke
  { d: 'M 139.4 135.5 Q 200 145.5 260.6 135.5', stroke: 'stitch' },
  { d: 'M 177.6 100 C 156 56 168 20 200 20 C 232 20 244 56 222.4 100', stroke: 'hidden' }, // hood, if any
  { d: 'M 200 20 L 200 84', stroke: 'hidden' },
];

export const JACKET_V1: DrawingDef = {
  key: 'jacket',
  version: 1,
  label: 'Jacket, parka and coat',
  viewWidth: W,
  size: [820, 356],
  notes: ['Length varies by style (parkas and coats are longer); use the measurements, not the drawing, for length.'],
  views: [
    {
      view: 'front', title: 'Front', origin: [10, 0], shapes: FRONT, dots: [[168, 142], [232, 142]], match: '',
      // Front view: the wearer's LEFT is on the viewer's RIGHT.
      anchors: {
        'collar:C': [200, 92], 'hood:C': [200, 92], 'center:C': [200, 248], 'hem:C': [200, 286],
        'chest:R': [168, 152], 'chest:L': [232, 152], 'hip:R': [150, 252], 'hip:L': [250, 252],
        'cuff:R': [25.5, 248.6], 'cuff:L': [374.5, 248.6], 'sleeve:R': [80, 195], 'sleeve:L': [320, 195],
        'shoulder:R': [165, 120], 'shoulder:L': [235, 120], 'shoulder:C': [200, 124],
      },
    },
    {
      view: 'back', title: 'Back', origin: [410, 0], shapes: BACK, match: '\\bback\\b|rear',
      // Back view: the wearer's LEFT is on the viewer's LEFT.
      anchors: {
        'hood:C': [186, 40], 'collar:C': [200, 92], 'center:C': [200, 245], 'hem:C': [200, 286],
        'shoulder:L': [165, 124], 'shoulder:R': [235, 124], 'shoulder:C': [200, 126],
        'chest:L': [165, 172], 'chest:R': [235, 175], 'hip:L': [165, 252], 'hip:R': [235, 252],
        'cuff:L': [25.5, 248.6], 'cuff:R': [374.5, 248.6], 'sleeve:L': [80, 195], 'sleeve:R': [320, 195],
      },
    },
  ],
  // One measuring line per template point (A to M). Front: chest, waist, hem sweep, neck, pocket. Back: the rest.
  callouts: [
    { code: 'A', view: 'front', from: [133.5, 166], to: [266.5, 166] },
    { code: 'B', view: 'front', from: [133.5, 202], to: [266.5, 202] },
    { code: 'C', view: 'front', from: [133.5, 304], to: [266.5, 304] },
    { code: 'D', view: 'back', from: [146.8, 110.1], to: [253.2, 110.1], at: 0.3 },
    { code: 'E', view: 'back', from: [222.4, 100], to: [222.4, 293], at: 0.6 },
    { code: 'F', view: 'back', from: [141.2, 104.3], to: [4.3, 236.6], at: 0.45 },
    { code: 'G', view: 'back', from: [253.2, 110.1], to: [267.2, 160], label: [243, 146] },
    { code: 'H', view: 'back', from: [110.6, 145], to: [128.9, 164] },
    { code: 'I', view: 'back', from: [2.6, 249.3], to: [24, 271.5] },
    { code: 'J', view: 'front', from: [177.6, 100], to: [222.4, 100], label: [242, 74] },
    { code: 'K', view: 'back', from: [250, 100], to: [250, 20] },
    { code: 'L', view: 'back', from: [166.7, 58.5], to: [233.3, 58.5] },
    { code: 'M', view: 'front', from: [143.2, 231.8], to: [153.2, 269.8], label: [118, 254] },
  ],
};
