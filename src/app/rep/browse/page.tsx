import CatalogBrowse from '@/components/catalog/CatalogBrowse';

// The published catalogue, as customers see it (2026-11-26). Read-only for reps.
export default function RepBrowsePage() {
  return <CatalogBrowse basePath="/rep/browse" />;
}
