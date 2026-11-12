// Task 21: what a product page gave, as saved on a request (admin only), and what it did not give for a product type.
// Everything here came from a website: it is DATA, never instructions (it never goes into an AI prompt), it is shown as
// plain text only, and every value is "from the website, not confirmed". A standard, rating or certification named on the
// page is only a claim to verify: it never fills a rating, a standard or a certification level, and the original's
// certification does not carry over to a copy.
// Client-safe, relative imports (the tests load this file directly).
import type { ResolvedTemplate } from './template-catalog';
import { viewsText } from './template-catalog';

export interface WebFound {
  name: string;
  brand: string;
  sku: string;
  description: string;
  materials: string[];
  weights: string[];
  sizes: string[];
  colours: string[];
  care: string[];
  claims: string[]; // standards, ratings or certifications named on the page: to verify, never copied into the tech file
  details: string[]; // other "name: value" product details the page listed
  structured: boolean; // the page had structured product data (JSON-LD Product)
}

/** Saved on the request by the server (specs.webSource); the browser can neither set nor change it. */
export interface WebSource {
  url: string; // the page as read (after redirects)
  typedUrl: string;
  site: string; // host name, e.g. "www.example.com"
  readAt: string; // when the page was fetched
  readBy: string;
  found: WebFound;
  referenceImages: string[]; // storage paths of the images taken from the page
}

export const FROM_WEBSITE = 'From the website, not confirmed';
// A shop often puts its own company in the brand field: never shown as the maker.
export const BRAND_OR_SELLER = 'Brand or seller (from the website, not confirmed)';
export const CERT_DOES_NOT_CARRY = "The original's certification does not carry over to a copy: verify any claim against the copy itself.";

export const emptyFound = (): WebFound => ({ name: '', brand: '', sku: '', description: '', materials: [], weights: [], sizes: [], colours: [], care: [], claims: [], details: [], structured: false });

/** Plain text: control and invisible characters removed, spaces collapsed, length capped. Shown as text only (escaped). */
export const plain = (v: unknown, max = 300): string =>
  String(v ?? '')
    .replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028-\u202E\u2060-\u206F\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const list = (v: unknown, max: number, len = 200): string[] => {
  const out: string[] = [];
  for (const x of Array.isArray(v) ? v : []) {
    const t = plain(x, len);
    if (t && !out.some((o) => o.toLowerCase() === t.toLowerCase())) out.push(t);
    if (out.length >= max) break;
  }
  return out;
};

/** Cleans a found record (from the database or from the extractor) into the exact shape above. */
export function cleanFound(v: unknown): WebFound {
  const f = v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
  return {
    name: plain(f.name, 200), brand: plain(f.brand, 120), sku: plain(f.sku, 80), description: plain(f.description, 2000),
    materials: list(f.materials, 8), weights: list(f.weights, 4, 160), sizes: list(f.sizes, 30, 60), colours: list(f.colours, 20, 80),
    care: list(f.care, 8), claims: list(f.claims, 10), details: list(f.details, 20), structured: f.structured === true,
  };
}

/** A web source from a saved request, or null. The link is only kept if it is https. */
export function readWebSource(v: unknown): WebSource | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const s = v as Record<string, unknown>;
  const url = typeof s.url === 'string' && /^https:\/\//i.test(s.url) ? s.url.slice(0, 2000) : '';
  if (!url) return null;
  return {
    url, typedUrl: typeof s.typedUrl === 'string' ? s.typedUrl.slice(0, 2000) : url, site: plain(s.site, 255), readAt: plain(s.readAt, 40), readBy: plain(s.readBy, 200),
    found: cleanFound(s.found), referenceImages: Array.isArray(s.referenceImages) ? s.referenceImages.filter((p): p is string => typeof p === 'string') : [],
  };
}

/** The scan's starting values from the website: material, weight and care text only, all flagged for confirmation.
 *  Never a rating, a standard or a certification. */
export function websiteGiven(found: WebFound): Record<string, string> {
  return {
    'fabricAnalysis.material': found.materials.join('; ').slice(0, 300),
    'fabricAnalysis.weight': (found.weights[0] ?? '').slice(0, 300),
    'washCare.instructions': found.care.join('\n').slice(0, 300),
  };
}

/** What the page did not give for this product type's template (shown under "Not on the page"). */
export function linkMissing(found: WebFound, template: ResolvedTemplate): string[] {
  const out: string[] = [];
  const has = { fabric: found.materials.length + found.weights.length > 0, colour: found.colours.length > 0, care: found.care.length > 0 };
  for (const item of template.checklist) {
    if (!item.required) continue;
    if (item.key === 'measurements') continue; // listed below, with the points
    if (item.key === 'fabric' && has.fabric) {
      if (!found.weights.length) out.push(`${item.label}: weight not on the page`);
      continue;
    }
    if (item.key === 'colour' && has.colour) continue;
    if (item.key === 'labels') { out.push(`${item.label}: ${has.care ? 'the page gives care text only; label content and placement need the garment or label photos' : 'not on the page'}`); continue; }
    out.push(`${item.label}: not on the page`);
  }
  const points = template.parts.reduce((n, p) => n + p.points.length, 0);
  if (points) out.push(`Measurements: all ${points} point${points > 1 ? 's' : ''} (a website gives no garment measurements; a size chart there is body sizes)`);
  if (!found.sizes.length) out.push('Size range: not on the page');
  const views = template.parts.flatMap((p) => p.views ?? []).filter((v, i, a) => a.indexOf(v) === i);
  if (views.length) out.push(`Photos: check the reference images show the ${viewsText(views)} (shop photos are often front only)`);
  if (found.claims.length) out.push(`Certification: ${CERT_DOES_NOT_CARRY}`);
  return out;
}
