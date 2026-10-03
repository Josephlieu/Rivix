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
  created_at: string;
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
