// Family images (2026-11-26): JPEG, PNG or WebP only, checked by their CONTENT (first bytes), at most 5 MB, at most 10 per
// family. Stored in the private bucket "product-images" only after the server has re-encoded them (image-reencode.ts), so
// EXIF, GPS and every other piece of metadata is gone. Served only through short-lived signed links. Pure.
export const IMAGE_BUCKET = 'product-images';
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export type ImageMime = 'image/jpeg' | 'image/png' | 'image/webp';
export const IMAGE_EXT: Record<ImageMime, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
const starts = (b: Uint8Array, sig: number[], at = 0) => sig.every((v, i) => b[at + i] === v);

/** The file's real type, or why it is refused (PDF and anything else included). */
export function checkImageFile(bytes: Uint8Array): { type: ImageMime } | { error: string } {
  if (!bytes.length) return { error: 'the file is empty' };
  if (bytes.length > IMAGE_MAX_BYTES) return { error: 'the image is over 5 MB' };
  if (starts(bytes, [0xff, 0xd8, 0xff])) return { type: 'image/jpeg' };
  if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { type: 'image/png' };
  if (starts(bytes, [0x52, 0x49, 0x46, 0x46]) && starts(bytes, [0x57, 0x45, 0x42, 0x50], 8)) return { type: 'image/webp' };
  return { error: 'only JPEG, PNG or WebP images are accepted (checked by the file content)' };
}
