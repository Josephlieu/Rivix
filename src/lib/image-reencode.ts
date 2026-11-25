// Re-encodes an uploaded family image on the server (2026-11-26) so nothing but the pixels is kept: sharp writes no EXIF,
// GPS, XMP, IPTC or ICC data unless asked to, and we never ask. Order matters:
//   1. the size is read from the file header first: more than 40 million pixels is refused before anything is decoded
//      (a tiny file can claim a huge picture), and sharp's own limitInputPixels guards the decode as well;
//   2. .rotate() turns the picture upright from its EXIF orientation (phone photos), BEFORE the metadata is dropped;
//   3. the longest side is scaled down to at most 2400 px (never enlarged);
//   4. it is written again in its own format with no metadata.
// Server only.
import sharp from 'sharp';
import { IMAGE_MAX_BYTES, type ImageMime } from '@/lib/image-files';

export const MAX_INPUT_PIXELS = 40_000_000;
export const MAX_SIDE = 2400;
const TOO_LARGE = `the image is too large (more than ${MAX_INPUT_PIXELS / 1_000_000} million pixels); make it smaller and try again`;

export async function reencodeImage(bytes: Uint8Array, type: ImageMime): Promise<{ bytes: Buffer; type: ImageMime; width: number; height: number } | { error: string }> {
  const input = Buffer.from(bytes);
  try {
    const meta = await sharp(input, { limitInputPixels: false }).metadata(); // header only, nothing decoded
    if (!meta.width || !meta.height) return { error: 'the image could not be read' };
    if (meta.width * meta.height > MAX_INPUT_PIXELS) return { error: TOO_LARGE };
  } catch {
    return { error: 'the image could not be read' };
  }
  try {
    const img = sharp(input, { limitInputPixels: MAX_INPUT_PIXELS, failOn: 'error', animated: false })
      .rotate()
      .resize({ width: MAX_SIDE, height: MAX_SIDE, fit: 'inside', withoutEnlargement: true });
    const out = type === 'image/png' ? img.png({ compressionLevel: 9 }) : type === 'image/webp' ? img.webp({ quality: 85 }) : img.jpeg({ quality: 85, mozjpeg: true });
    const { data, info } = await out.toBuffer({ resolveWithObject: true });
    if (data.length > IMAGE_MAX_BYTES) return { error: 'the image is over 5 MB after processing' };
    return { bytes: data, type, width: info.width, height: info.height };
  } catch (e) {
    return { error: /pixel limit/i.test(e instanceof Error ? e.message : '') ? TOO_LARGE : 'the image could not be read' };
  }
}
