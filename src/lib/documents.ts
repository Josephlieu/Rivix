import { plainDateDay } from './format';

export const DOC_TYPES = [
  'Certificate of Origin',
  'Quality Inspection Report',
  'Certificate of Compliance',
  'CSA Certificate',
  'Fabric Detail Sheet',
  'Test Report',
  'Other',
] as const;

export const MAX_DOC_BYTES = 20 * 1024 * 1024; // 20 MB, also enforced by the bucket

export const ALLOWED_DOC_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
] as const;

export const DOC_ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx';

export interface DocumentRow {
  id: string;
  customer_id: string;
  order_id: string | null;
  title: string;
  doc_type: string;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  uploaded_by?: string | null;
  expires_on?: string | null; // "YYYY-MM-DD", or null when the document has no expiry date
  created_at: string;
}

// A document expiring within this many days gets the amber "Expires in N days" badge.
export const EXPIRY_WARNING_DAYS = 30;

// What the admin typed for an expiry date: a real "YYYY-MM-DD" date, null (empty: no expiry), or invalid.
export function parseExpiryDate(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v !== 'string') return { ok: false };
  const s = v.trim();
  if (!s) return { ok: true, value: null };
  return plainDateDay(s) === null ? { ok: false } : { ok: true, value: s };
}

export type ExpiryStatus = { kind: 'expired'; label: string } | { kind: 'soon'; days: number; label: string } | null;

// The badge for a document, given today's date ("YYYY-MM-DD", the viewer's own day). Null means no badge.
export function documentExpiry(expiresOn: string | null | undefined, todayKey: string): ExpiryStatus {
  if (!expiresOn) return null;
  const end = plainDateDay(expiresOn), today = plainDateDay(todayKey);
  if (end === null || today === null) return null;
  const days = end - today;
  if (days < 0) return { kind: 'expired', label: 'Expired' };
  if (days > EXPIRY_WARNING_DAYS) return null;
  return { kind: 'soon', days, label: days === 0 ? 'Expires today' : `Expires in ${days} day${days === 1 ? '' : 's'}` };
}

// Keep file names safe for a storage path: letters, numbers, dot, dash, underscore.
export const safeFileName = (name: string) =>
  name
    .normalize('NFKD')
    .replace(/[^\w.\-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._]+/, '')
    .slice(-100) || 'file';

export const formatBytes = (n: number | null | undefined) => {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};
