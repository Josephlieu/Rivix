// Certificate files (2026-11-21): PDF, JPEG or PNG only, checked by their CONTENT (first bytes), at most 10 MB. Stored in the
// private bucket "product-certificates", never overwritten, downloaded only through short-lived links. Pure.
export const CERT_BUCKET = 'product-certificates';
export const CERT_MAX_BYTES = 10 * 1024 * 1024;
export type CertMime = 'application/pdf' | 'image/jpeg' | 'image/png';
const EXT: Record<CertMime, string> = { 'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png' };
const starts = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

/** The file's real type, or why it is refused. */
export function checkCertificateFile(bytes: Uint8Array): { type: CertMime; ext: string } | { error: string } {
  if (!bytes.length) return { error: 'the file is empty' };
  if (bytes.length > CERT_MAX_BYTES) return { error: 'the file is over 10 MB' };
  let type: CertMime | null = null;
  if (starts(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) type = 'application/pdf';
  else if (starts(bytes, [0xff, 0xd8, 0xff])) type = 'image/jpeg';
  else if (starts(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) type = 'image/png';
  return type ? { type, ext: EXT[type] } : { error: 'only PDF, JPEG or PNG files are accepted (checked by the file content)' };
}
/** A file name safe to store and show: letters, digits, dot, dash, underscore and spaces; at most 150 characters. */
export const safeName = (n: string) => (n.replace(/[^\w .-]+/g, '_').replace(/^[ .]+/, '').slice(0, 150) || 'certificate');
/** Where a staged import file lives, and where a certificate file lives. */
export const stagingPrefix = (batch: string) => `import/${batch}`;
export const isBatchId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v);
