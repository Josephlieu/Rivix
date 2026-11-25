import CatalogBrowse from '@/components/catalog/CatalogBrowse';

// Browse products (2026-11-26): the published RIVIX product families. Customers only (the portal proxy).
export default function PortalBrowsePage() {
  return <CatalogBrowse basePath="/portal/browse" />;
}
