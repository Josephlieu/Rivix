import { specLines, type Spec } from '@/lib/catalog-families';

// A customer's spec as PLAIN TEXT (2026-11-26): React text only, line breaks kept. Never parsed as HTML or markdown.
export default function SpecText({ spec, className = '' }: { spec: Partial<Spec> | null | undefined; className?: string }) {
  const lines = specLines(spec);
  if (!lines.length) return null;
  return <span className={`block whitespace-pre-line break-words ${className}`}>{lines.join('\n')}</span>;
}
