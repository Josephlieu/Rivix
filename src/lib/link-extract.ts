// Task 21: reading a product page. Nothing on the page is ever run: there is no browser and no script execution; the HTML is
// read as text. Structured product data (<script type="application/ld+json">) is read with JSON.parse only; every other
// script, style, template, noscript, svg, iframe and comment is removed before the visible text is read. What is found is
// plain text (see link-source.ts) and is data only.
// Pure, relative imports (the tests load this file directly).
import { cleanFound, plain, type WebFound } from './link-source';

type Json = unknown;
const MAX_LD = 500_000; // per structured-data block
const MAX_TEXT_LINES = 6000;

// ---- Small HTML helpers -------------------------------------------------------------------------------------------------

const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—', deg: '°', reg: '®', trade: '™', copy: '©', frac12: '½', frac14: '¼', frac34: '¾', times: '×', hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', eacute: 'é', egrave: 'è', ecirc: 'ê', agrave: 'à', ccedil: 'ç', ocirc: 'ô', sup2: '²', middot: '·', bull: '•', minus: '−' };
export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]{1,6}|#\d{1,7}|[a-z][a-z0-9]{1,10});/gi, (m, e: string) => {
    if (e[0] === '#') {
      const n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return n > 0 && n < 0x110000 && !(n >= 0xd800 && n <= 0xdfff) ? String.fromCodePoint(n) : ' ';
    }
    return NAMED[e.toLowerCase()] ?? m;
  });
}

/** The attributes of one tag, lower-case names, decoded values. */
export function attrs(tag: string): Record<string, string> {
  const out: Record<string, string> = {};
  const body = tag.replace(/^<\s*[a-z0-9-]+/i, '').replace(/\/?>$/, '');
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) { const k = m[1].toLowerCase(); if (!(k in out)) out[k] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? ''); }
  return out;
}

const stripBlocks = (html: string) =>
  html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|noscript|template|svg|iframe|object|embed|canvas|math)\b[\s\S]*?<\/\1\s*>/gi, ' ')
    .replace(/<(script|style|noscript|template|svg|iframe|object|embed|canvas|math)\b[^>]*\/?>/gi, ' ');

/** The visible text of the page, one line per block, tags removed, entities decoded. */
export function visibleLines(html: string): string[] {
  const body = stripBlocks(html).replace(/<head\b[\s\S]*?<\/head\s*>/i, ' ');
  const text = body
    .replace(/<\s*(br|hr)\b[^>]*>/gi, '\n')
    .replace(/<\/\s*(p|div|li|ul|ol|h[1-6]|tr|table|section|article|header|footer|dd|dt|dl|option|blockquote|figcaption|label|summary|details)\s*>/gi, '\n')
    .replace(/<\s*(li|tr|p|h[1-6]|dt|dd)\b[^>]*>/gi, '\n')
    .replace(/<\/\s*(td|th)\s*>/gi, ' | ')
    .replace(/<[^>]*>/g, ' ');
  return decodeEntities(text).split('\n').map((l) => plain(l, 400).replace(/(\s*\|\s*)+$/, '')).filter(Boolean).slice(0, MAX_TEXT_LINES);
}

// ---- Structured data ------------------------------------------------------------------------------------------------------

const isType = (node: Record<string, Json>, ...types: string[]) => {
  const t = node['@type'];
  const list = Array.isArray(t) ? t : [t];
  return list.some((x) => typeof x === 'string' && types.includes(x.replace(/^.*[/#]/, '')));
};
const str = (v: Json): string => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : v && typeof v === 'object' && !Array.isArray(v) && typeof (v as Record<string, Json>).name === 'string' ? ((v as Record<string, Json>).name as string) : '');
const strs = (v: Json): string[] => (Array.isArray(v) ? v.flatMap(strs) : str(v) ? [str(v)] : []);
const imageUrls = (v: Json): string[] => {
  if (typeof v === 'string') return [v];
  if (Array.isArray(v)) return v.flatMap(imageUrls);
  if (v && typeof v === 'object') { const o = v as Record<string, Json>; return [o.url, o.contentUrl].filter((x): x is string => typeof x === 'string'); }
  return [];
};

/** Every Product / ProductGroup node in the page's structured data (also inside @graph, arrays and mainEntity). */
export function ldProducts(html: string): Array<Record<string, Json>> {
  const out: Array<Record<string, Json>> = [];
  const re = /<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script\s*>/gi;
  let m: RegExpExecArray | null;
  let seen = 0;
  const walk = (n: Json, depth: number) => {
    if (depth > 8 || ++seen > 5000 || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach((x) => walk(x, depth + 1)); return; }
    const o = n as Record<string, Json>;
    if (isType(o, 'Product', 'ProductGroup', 'IndividualProduct', 'ProductModel')) out.push(o);
    for (const k of ['@graph', 'mainEntity', 'mainEntityOfPage', 'itemListElement', 'item']) if (o[k]) walk(o[k], depth + 1);
  };
  while ((m = re.exec(html)) && out.length < 10) {
    const raw = m[1].trim();
    if (!raw || raw.length > MAX_LD) continue;
    try { walk(JSON.parse(raw.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g, '')), 0); } catch { /* a broken block is skipped */ }
  }
  return out;
}

// ---- Patterns in the text -------------------------------------------------------------------------------------------------

const COMPOSITION = /\b\d{1,3}(?:[.,]\d+)?\s?%\s?(?:[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ-]+)/;
const MATERIAL_LABEL = /^(materials?|fabric|fabrication|shell|outer|outer shell|lining|liner|insulation|fill|composition|content|body|upper|sole|outsole|palm|coating)\s*(\([^)]*\))?\s*[:\-–]\s*\S/i;
const FIBRE = /\b(polyester|cotton|nylon|polyamide|elastane|spandex|lycra|wool|merino|acrylic|modacrylic|aramid|kevlar|nomex|viscose|rayon|polypropylene|polyethylene|leather|cowhide|goatskin|pigskin|suede|nitrile|neoprene|latex|rubber|pvc|polyurethane|PU[- ]coated|oxford|ripstop|denim|canvas|fleece|softshell|gore-tex)\b/i;
const MATERIAL_CONTEXT = /\b(fabric|material|made (?:of|from)|crafted from|constructed (?:of|from)|shell|lining|outer|body|blend|coated|coating|\d\s?%)/i;
const WEIGHT = /\b\d+(?:[.,]\d+)?\s?(?:-\s?\d+(?:[.,]\d+)?\s?)?(?:oz\.?(?:\s?\/\s?(?:sq\.?\s?)?yd(?:2|²)?)?|ounces?|gsm|g\/m2|g\/m²|grams? per square metre)(?![a-z])/i;
const SIZE_LABEL = /^(sizes?|available sizes|size range|sizing|fits?)\s*(\([^)]*\))?\s*[:\-–]\s*\S/i;
const SIZE_TOKEN = /^(?:XXS|XS|S|M|L|XL|XXL|XXXL|[2-8]XL|[2-8]X|LT|XLT|[2-6]XLT|OS|One Size|\d{1,2}(?:\.5)?|\d{2}[RSLT]?|(?:X{1,3}[- ]?|[2-8]X[- ]?)?(?:Small|Large)|Medium|Extra[- ]Small|Extra[- ]Large)$/i;
const COLOUR_LABEL = /^(colou?rs?|available colou?rs?)\s*[:\-–]\s*\S/i;
const CARE = /\b(machine wash|hand wash|wash (?:cold|warm|separately|inside out|at \d+)|tumble dry|do not (?:bleach|tumble|iron|dry clean|wring)|dry clean|line dry|drip dry|hang (?:to )?dry|iron (?:low|medium|on)|non-chlorine bleach|lay flat to dry)\b/i;
const STANDARD = /\b(CSA[\s-]*Z\d{2,3}(?:\.\d+)?|ANSI(?:\s*\/\s*ISEA)?\s*\d{3}|ISEA\s*\d{3}|(?:EN\s*)?ISO\s*\d{4,5}|EN\s*\d{3,5}|NFPA\s*\d{3,4}[A-Z]?|ASTM\s*[A-Z]\s?\d{3,4}|IEC\s*\d{5}|CAN\s*\/\s*CGSB[\s-]*[\d.]+|CAN\s*\/\s*ULC[\s-]*S?\d+|UL\s*\d{3,4}|HRC\s*\d|ATPV|ARC\s*rated|arc[\s-]*flash|flame[\s-]*resistant|FR\s+rated|Class\s*[1-4]\b|Type\s*[ORP]\b|Category\s*[1-4]|CAT\s*[1-4]|CE\s*(?:certified|marked|category)|certified|compliant|meets\s+(?:or\s+exceeds\s+)?(?:the\s+)?(?:requirements|standards?)|approved\b)/i;

const pushUnique = (list: string[], v: string, max: number) => {
  const t = plain(v, 200);
  if (t && list.length < max && !list.some((x) => x.toLowerCase() === t.toLowerCase())) list.push(t);
};

/** Values of option buttons (radio inputs) named like `nameRe` (e.g. Size, Colour), as many shops use instead of a list. */
const radioValues = (html: string, nameRe: RegExp): string[] => {
  const out: string[] = [];
  for (const tag of html.match(/<input\b[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    if ((a.type ?? '').toLowerCase() !== 'radio' || !a.value || ![a.name, a['data-option-name'], a['aria-label']].some((v) => v && nameRe.test(v))) continue;
    out.push(plain(a.value, 60));
    if (out.length >= 40) break;
  }
  return out;
};

const selectOptions = (html: string, nameRe: RegExp): string[] => {
  const out: string[] = [];
  const re = /<select\b([^>]*)>([\s\S]*?)<\/select\s*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const a = attrs(`<select ${m[1]}>`);
    if (![a.name, a.id, a['aria-label'], a['data-option-name']].some((v) => v && nameRe.test(v))) continue;
    for (const o of m[2].match(/<option\b[^>]*>[\s\S]*?<\/option\s*>/gi) ?? []) {
      const text = plain(decodeEntities(o.replace(/<[^>]*>/g, ' ')), 60);
      if (text && !/^(choose|select|pick)\b/i.test(text)) out.push(text);
    }
  }
  return out;
};

// ---- Images ---------------------------------------------------------------------------------------------------------------

const SKIP_IMAGE = /(logo|icon|sprite|badge|payment|flag|avatar|placeholder|spinner|loader|loading|blank|pixel|tracking|banner|social|facebook|twitter|instagram|pinterest|youtube|linkedin|tiktok|wechat|whatsapp|qr[-_ ]?code|rating|stars?[-_.]|cart|arrow|chevron|close)/i;
const largestFromSrcset = (srcset: string): string => {
  let best = '', bestW = -1;
  for (const part of srcset.split(',')) {
    const [u, d] = part.trim().split(/\s+/);
    const w = d ? parseFloat(d) * (d.endsWith('x') ? 1000 : 1) : 0;
    if (u && w > bestW) { best = u; bestW = w; }
  }
  return best;
};

/** Image links in order of trust: structured data, Open Graph and Twitter tags, image_src, then product <img> tags. */
export function imageCandidates(html: string, base: URL, ld: Array<Record<string, Json>>, max = 20): string[] {
  const raw: string[] = [];
  for (const p of ld) raw.push(...imageUrls(p.image));
  // Shops often put the photos on each variant (size or colour) rather than on the product.
  for (const p of ld) for (const v of Array.isArray(p.hasVariant) ? p.hasVariant.slice(0, 50) : []) if (v && typeof v === 'object') raw.push(...imageUrls((v as Record<string, Json>).image));
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (['og:image', 'og:image:url', 'og:image:secure_url', 'twitter:image', 'twitter:image:src', 'image'].includes(key) && a.content) raw.push(a.content);
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) { const a = attrs(tag); if (/\bimage_src\b/i.test(a.rel ?? '') && a.href) raw.push(a.href); }
  for (const tag of stripBlocks(html).match(/<img\b[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    const src = (a['data-zoom-image'] || a['data-large-image'] || (a.srcset && largestFromSrcset(a.srcset)) || (a['data-srcset'] && largestFromSrcset(a['data-srcset'])) || a['data-src'] || a.src || '').trim();
    if (!src) continue;
    const w = parseInt(a.width ?? '', 10), h = parseInt(a.height ?? '', 10);
    if ((w && w < 200) || (h && h < 200)) continue;
    if (SKIP_IMAGE.test(`${src} ${a.class ?? ''} ${a.alt ?? ''} ${a.id ?? ''}`)) continue;
    raw.push(src);
  }
  const out: string[] = [], later: string[] = [];
  const seen = new Set<string>();
  for (const r of raw) {
    const s = r.trim().replace(/^\/\//, 'https://');
    if (!s || /^data:/i.test(s) || s.length > 2000 || /[{}]/.test(s)) continue; // {width} = a lazy-load template, not a link
    let u: URL;
    try { u = new URL(s, base); } catch { continue; }
    // An http image link is tried over https only (never http); the guard checks it like any other link.
    if (u.protocol === 'http:' && (!u.port || u.port === '80')) { u.protocol = 'https:'; u.port = ''; }
    if (u.protocol !== 'https:' || /\.(svg|svgz|ico|bmp|tiff?)$/i.test(u.pathname)) continue;
    let path = u.pathname;
    try { path = decodeURIComponent(path); } catch { /* keep as is */ }
    if (SKIP_IMAGE.test(path)) continue; // read decoded, so "WeChat%20QR%20Code.png" is caught
    const key = `${u.host}${u.pathname}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    u.hash = '';
    // A link named .gif is tried last, not dropped: some shops store their photos as .gif files and their image server
    // sends JPEG or WebP for them (seen on a real Shopify shop, 2026-11-12). Only the bytes decide: a real GIF is refused.
    (/\.gif$/i.test(u.pathname) ? later : out).push(u.toString());
    if (out.length >= max) break;
  }
  return [...out, ...later].slice(0, max);
}

// ---- The whole page -------------------------------------------------------------------------------------------------------

/** Everything found on the page, as plain-text data, plus the image links to try. */
export function extractProduct(html: string, base: URL): { found: WebFound; imageLinks: string[] } {
  const ld = ldProducts(html);
  const meta: Record<string, string> = {};
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const a = attrs(tag);
    const key = (a.property || a.name || a.itemprop || '').toLowerCase();
    if (key && a.content && !(key in meta)) meta[key] = a.content;
  }
  const title = plain(decodeEntities((html.match(/<title\b[^>]*>([\s\S]*?)<\/title\s*>/i)?.[1] ?? '').replace(/<[^>]*>/g, ' ')), 200);
  const p = ld[0] ?? {};
  const variants = ld.flatMap((n) => (Array.isArray(n.hasVariant) ? (n.hasVariant as Json[]) : [])).filter((v): v is Record<string, Json> => !!v && typeof v === 'object' && !Array.isArray(v)).slice(0, 200);
  const props = ld.flatMap((n) => (Array.isArray(n.additionalProperty) ? (n.additionalProperty as Json[]) : [])).filter((v): v is Record<string, Json> => !!v && typeof v === 'object').slice(0, 60);

  const materials: string[] = [], weights: string[] = [], sizes: string[] = [], colours: string[] = [], care: string[] = [], claims: string[] = [], details: string[] = [];
  for (const n of ld) for (const v of strs(n.material)) pushUnique(materials, v, 8);
  for (const n of [...ld, ...variants]) for (const v of strs(n.size)) pushUnique(sizes, v, 30);
  for (const n of [...ld, ...variants]) for (const v of strs(n.color)) pushUnique(colours, v, 20);
  for (const prop of props) {
    const name = plain(str(prop.name), 80), value = plain(strs(prop.value).join(', ') || str(prop.value), 200);
    if (!name || !value) continue;
    const line = `${name}: ${value}`;
    if (/certif|standard|complian|rating|class|approv/i.test(name) || STANDARD.test(value)) pushUnique(claims, line, 10);
    else if (/weight/i.test(name) && WEIGHT.test(value)) pushUnique(weights, line, 4);
    else if (/material|fabric|shell|lining|composition|content/i.test(name)) pushUnique(materials, line, 8);
    else if (/colou?r/i.test(name)) pushUnique(colours, value, 20);
    else if (/size/i.test(name)) pushUnique(sizes, value, 30);
    else if (/care|wash/i.test(name)) pushUnique(care, line, 8);
    else pushUnique(details, line, 20);
  }
  for (const v of [...selectOptions(html, /size/i), ...radioValues(html, /size/i)]) pushUnique(sizes, v, 30);
  for (const v of [...selectOptions(html, /colou?r/i), ...radioValues(html, /colou?r/i)]) pushUnique(colours, v, 20);
  // Variant names such as "Parka - Small / Yellow": the parts after the product name, sorted into sizes and colours.
  const productName = str(p.name);
  for (const v of variants) {
    const name = str(v.name);
    const tail = productName && name.startsWith(productName) ? name.slice(productName.length) : name.includes(' - ') ? name.slice(name.lastIndexOf(' - ')) : '';
    for (const part of tail.replace(/^\s*[-–:]\s*/, '').split(/\s*\/\s*/).map((x) => x.trim()).filter(Boolean)) {
      if (SIZE_TOKEN.test(part)) pushUnique(sizes, part, 30);
      else if (/^[A-Za-z][A-Za-z /-]{2,30}$/.test(part) && !/\d/.test(part)) pushUnique(colours, part, 20);
    }
  }

  const lines = visibleLines(html);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (l.length > 300) continue;
    if (COMPOSITION.test(l) || MATERIAL_LABEL.test(l) || (l.length <= 200 && FIBRE.test(l) && MATERIAL_CONTEXT.test(l))) pushUnique(materials, l, 8);
    if (WEIGHT.test(l)) pushUnique(weights, l, 4);
    if (SIZE_LABEL.test(l)) pushUnique(sizes, l, 30);
    if (COLOUR_LABEL.test(l)) pushUnique(colours, l, 20);
    if (CARE.test(l)) pushUnique(care, l, 8);
    if (STANDARD.test(l) && l.length <= 200) pushUnique(claims, l, 10);
  }
  // A run of size tokens on its own lines (size buttons): XS, S, M, L, XL…
  if (sizes.length === 0) {
    let run: string[] = [];
    for (const l of [...lines, '']) {
      if (SIZE_TOKEN.test(l)) run.push(l);
      else { if (run.length >= 3) { run.forEach((s) => pushUnique(sizes, s, 30)); break; } run = []; }
    }
  }

  const descRaw = str(p.description) || meta['og:description'] || meta.description || meta['twitter:description'] || '';
  // Sentences of the description that say what it is made of (shops often write it only there).
  // A long run-on sentence (a flattened bullet list) gives the words around the match only.
  const around = (t: string, re: RegExp) => {
    if (t.length <= 200) return t;
    const i = t.search(re);
    const from = Math.max(0, t.lastIndexOf(' ', Math.max(0, i - 80)));
    const to = t.indexOf(' ', Math.min(t.length, i + 110));
    return `${from > 0 ? '…' : ''}${t.slice(from, to < 0 ? t.length : to).trim()}${to >= 0 && to < t.length ? '…' : ''}`;
  };
  for (const sentence of decodeEntities(descRaw.replace(/<[^>]*>/g, '\n')).split(/(?<=[.!?])\s+|\n+/)) {
    const t = sentence.trim();
    if (FIBRE.test(t) && MATERIAL_CONTEXT.test(around(t, FIBRE))) pushUnique(materials, around(t, FIBRE), 8);
    if (CARE.test(t)) pushUnique(care, around(t, CARE), 8);
    if (WEIGHT.test(t)) pushUnique(weights, around(t, WEIGHT), 4);
  }
  const found = cleanFound({
    name: str(p.name) || meta['og:title'] || meta['twitter:title'] || title,
    brand: str(p.brand) || meta['og:brand'] || meta['product:brand'] || '',
    sku: str(p.sku) || str(p.mpn) || str(p.productID) || str(variants[0]?.sku) || str(variants[0]?.mpn) || '',
    description: decodeEntities(descRaw.replace(/<[^>]*>/g, ' ')),
    materials, weights, sizes, colours, care, claims, details,
    structured: ld.length > 0,
  });
  return { found, imageLinks: imageCandidates(html, base, ld) };
}

/** The page's text encoding (header first, then the page's own meta tag); utf-8 when unknown or unsupported. */
export function decodeHtml(body: Buffer, contentType: string): string {
  const fromHeader = contentType.match(/charset\s*=\s*["']?([\w-]+)/i)?.[1];
  const head = body.subarray(0, 4096).toString('latin1');
  const fromMeta = head.match(/<meta[^>]+charset\s*=\s*["']?([\w-]+)/i)?.[1];
  for (const cs of [fromHeader, fromMeta, 'utf-8']) {
    if (!cs) continue;
    try { return new TextDecoder(cs.toLowerCase(), { fatal: false }).decode(body); } catch { /* unsupported label: try the next */ }
  }
  return body.toString('utf8');
}
