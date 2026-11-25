import FamilyPage from '@/components/catalog/FamilyPage';

// One product family: the customer's spec, sizes and quantities, Add to quote, Save, Request a sample (2026-11-26).
export default function PortalFamilyPage() {
  return <FamilyPage mode="customer" backHref="/portal/browse" />;
}
