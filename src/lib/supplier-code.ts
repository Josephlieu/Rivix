// Supplier codes (2026-11-21): "Supplier 07", chosen at random from the unused numbers, for the future bidder role. A code
// never hints at the name: it is never in creation order, and its number never appears in the supplier's name ("Factory 07"
// can never be "Supplier 07"). 2 digits until 70% of them are used, then 3, then 4. Pure: the random source is passed in.
export const CODE_PATTERN = /^Supplier \d{2,4}$/;

/** Numbers (as written, with and without leading zeros) that appear in the name. */
function numbersIn(name: string): Set<string> {
  const out = new Set<string>();
  for (const m of name.matchAll(/\d+/g)) { out.add(m[0]); out.add(String(parseInt(m[0], 10))); }
  return out;
}
/** True when the code's number (or the code itself) appears in the name. */
export function codeHintsAtName(code: string, name: string): boolean {
  const n = code.replace(/^Supplier /, '');
  const inName = numbersIn(name);
  return inName.has(n) || inName.has(String(parseInt(n, 10))) || name.toLowerCase().replace(/\s+/g, '').includes(code.toLowerCase().replace(/\s+/g, ''));
}

/** A new code. `randomInt(n)` returns 0..n-1 (crypto.randomInt on the server). Throws when every code is taken. */
export function pickSupplierCode(name: string, taken: Iterable<string>, randomInt: (n: number) => number): string {
  const used = new Set(taken);
  for (const digits of [2, 3, 4]) {
    const max = 10 ** digits - 1, first = digits === 2 ? 1 : 10 ** (digits - 1);
    const usedHere = [...used].filter((c) => c.length === 'Supplier '.length + digits).length;
    if (digits < 4 && usedHere >= 0.7 * (max - first + 1)) continue;
    const free: string[] = [];
    for (let i = first; i <= max; i++) {
      const code = `Supplier ${String(i).padStart(digits, '0')}`;
      if (!used.has(code) && !codeHintsAtName(code, name)) free.push(code);
    }
    if (free.length) return free[randomInt(free.length)];
  }
  throw new Error('No supplier code is free.');
}
