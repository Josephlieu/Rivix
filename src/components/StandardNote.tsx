import { replacedEditionNote } from '@/lib/safety-standards';

// A small note under a safety standard field when the typed edition has been replaced (e.g. CSA Z96-15). Information
// only: nothing is blocked and the text is saved as typed.
export default function StandardNote({ value }: { value: string | null | undefined }) {
  const note = replacedEditionNote(value);
  if (!note) return null;
  return <p className="mt-1 text-[11px] font-semibold text-amber-700" role="note">{note}</p>;
}
