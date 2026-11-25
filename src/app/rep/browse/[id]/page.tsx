import FamilyPage from '@/components/catalog/FamilyPage';

// One product family, as customers see it, read-only (2026-11-26).
export default function RepFamilyPage() {
  return <FamilyPage mode="rep" backHref="/rep/browse" />;
}
