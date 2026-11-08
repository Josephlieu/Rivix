// Catalogs: PDFs for signed-in users only, kept in the private 'catalogs' storage bucket and opened through short
// signed links (never a public address). Shared by the admin screens, the API routes and the viewer pages.
import type { DocumentRow } from './documents';

export const CATALOG_BUCKET = 'catalogs';
export const CATALOG_MIME = 'application/pdf';
export const CATALOG_ACCEPT = '.pdf,application/pdf';
export const MAX_CATALOG_BYTES = 50 * 1024 * 1024; // 50 MB, also enforced by the bucket

export interface CatalogRow {
  id: string;
  title: string;
  description: string | null;
  file_name: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  updated_at: string;
}

// Where the server hands out a short-lived link for one catalog (add ?download=1 to download).
export const catalogFileEndpoint = (id: string) => `/api/catalogs/${id}/file`;

// The shared document list shows catalogs too: the description takes the place of the document type.
export const catalogAsDocument = (c: CatalogRow): DocumentRow => ({
  id: c.id,
  customer_id: '',
  order_id: null,
  title: c.title,
  doc_type: c.description || 'Catalog',
  file_name: c.file_name,
  file_size: c.file_size,
  mime_type: c.mime_type,
  created_at: c.updated_at || c.created_at,
});
