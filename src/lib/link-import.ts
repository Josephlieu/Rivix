// Task 21: read a product page from a link: the page through the guarded fetcher, what it says through the extractor, and
// its images, each fetched through the same guard and kept only when it really is an image. Server only (sharp), relative
// imports (the tests load this file directly and pass in a fake DNS and connection, like the fake AI).
import { guardedGet, LinkError, LINK_LIMITS, type FetchDeps } from './safe-fetch';
import { extractProduct, decodeHtml } from './link-extract';
import { sniffImage } from './image-sniff';
import type { WebFound } from './link-source';

export const IMPORT_LIMITS = { budgetMs: 40_000, imagesTried: 20, imagesKept: 8, minSide: 300, maxSide: 1600, maxPixels: 40_000_000, keptBytes: 6 * 1024 * 1024 };

export interface ReferenceImage { jpeg: Buffer; thumb: string; width: number; height: number; source: string }
export interface LinkRead { finalUrl: string; site: string; found: WebFound; images: ReferenceImage[]; notes: string[] }

/**
 * Checks one downloaded image: JPEG, PNG or WebP by its bytes (never SVG, GIF or anything else), decodable, at least
 * 300 × 300 px, under 40 MP; then a NEW JPEG is made from the pixels (max 1600 px, no metadata). Only that copy is kept.
 */
export async function checkImage(bytes: Buffer, source = ''): Promise<{ ok: true; image: ReferenceImage } | { ok: false; reason: string }> {
  const type = sniffImage(bytes);
  if (!type) return { ok: false, reason: 'not a JPEG, PNG or WebP image' };
  const sharp = (await import('sharp')).default;
  try {
    const img = sharp(bytes, { limitInputPixels: IMPORT_LIMITS.maxPixels, failOn: 'error' });
    const meta = await img.metadata();
    if (!meta.format || !['jpeg', 'png', 'webp'].includes(meta.format)) return { ok: false, reason: `decoded as ${meta.format ?? 'unknown'}` };
    const w = meta.width ?? 0, h = meta.height ?? 0;
    if (w < IMPORT_LIMITS.minSide || h < IMPORT_LIMITS.minSide) return { ok: false, reason: `too small (${w}×${h})` };
    const base = () => sharp(bytes, { limitInputPixels: IMPORT_LIMITS.maxPixels, failOn: 'error' }).rotate().flatten({ background: '#ffffff' });
    const { data: jpeg, info } = await base().resize({ width: IMPORT_LIMITS.maxSide, height: IMPORT_LIMITS.maxSide, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer({ resolveWithObject: true });
    const thumb = await base().resize({ width: 320, height: 320, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 70 }).toBuffer();
    return { ok: true, image: { jpeg, thumb: `data:image/jpeg;base64,${thumb.toString('base64')}`, width: info.width, height: info.height, source } };
  } catch (e) {
    return { ok: false, reason: `could not be read as an image${e instanceof Error ? `: ${e.message.slice(0, 80)}` : ''}` };
  }
}

/** True when the redirects ended on a page that is not the typed product page: the last part of the typed path (the
 *  product's own part, such as "t500-jacket") is not in the final path. Same page with another host, case or ending "/" is not "away". */
export function sentAway(typed: string, final: URL): boolean {
  let t: URL;
  try { t = new URL(typed); } catch { return false; }
  const norm = (p: string) => { try { return decodeURIComponent(p).toLowerCase().replace(/\/+$/, ''); } catch { return p.toLowerCase().replace(/\/+$/, ''); } };
  const tp = norm(t.pathname), fp = norm(final.pathname);
  if (tp === fp) return false;
  const slug = tp.split('/').filter(Boolean).pop();
  if (!slug) return false;
  return !fp.split('/').includes(slug);
}

/** Reads the page and its images. Throws LinkError (with a reason for the server's record) when the page cannot be read. */
export async function readProductLink(link: string, deps: FetchDeps = {}, opts: { budgetMs?: number } = {}): Promise<LinkRead> {
  const deadline = Date.now() + (opts.budgetMs ?? IMPORT_LIMITS.budgetMs);
  const page = await guardedGet(link, { maxBytes: LINK_LIMITS.pageBytes, deadline }, deps);
  if (!/^(text\/html|application\/xhtml\+xml)\b/.test(page.contentType)) throw new LinkError(`not a web page (${page.contentType.slice(0, 60) || 'no type'})`);
  const html = decodeHtml(page.body, page.contentType);
  const { found, imageLinks } = extractProduct(html, page.url);
  const notes: string[] = [];
  // A site that sends the reader to another page (its front page, a "choose your country" page, a category) must not be
  // read as the product: that page's menus, logos and QR codes are not the product's details or photos.
  const away = sentAway(link, page.url);
  if (away && !found.structured) throw new LinkError(`sent to another page (${page.url.pathname.slice(0, 100)})`);
  if (away) notes.push('The site sent the portal to another page than the link: check that what was found is the same product.');
  if (!found.structured) notes.push('The page has no structured product data: what was found comes from the page text and may be incomplete.');

  const images: ReferenceImage[] = [];
  let skipped = 0, kept = 0;
  for (const src of imageLinks.slice(0, IMPORT_LIMITS.imagesTried)) {
    if (images.length >= IMPORT_LIMITS.imagesKept || Date.now() > deadline - 1000) break;
    try {
      const got = await guardedGet(src, { maxBytes: LINK_LIMITS.imageBytes, deadline }, deps);
      if (/svg|html|xml|javascript/.test(got.contentType)) { skipped++; continue; }
      const c = await checkImage(got.body, got.url.toString());
      if (!c.ok) { skipped++; continue; }
      if (kept + c.image.jpeg.length > IMPORT_LIMITS.keptBytes) break;
      kept += c.image.jpeg.length;
      images.push(c.image);
    } catch { skipped++; }
  }
  if (!images.length) notes.push('No usable product image was found on the page. Save the photos from the page and add them by hand.');
  if (skipped) notes.push(`${skipped} image link${skipped > 1 ? 's were' : ' was'} skipped (not a JPEG, PNG or WebP image, too small, too large, or not reachable).`);
  if (!found.materials.length && !found.sizes.length && !found.description) notes.push('Little was found on the page: the site may build its pages with JavaScript, which the portal does not run.');
  return { finalUrl: page.url.toString(), site: page.url.hostname, found, images, notes };
}
