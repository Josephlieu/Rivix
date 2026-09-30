import { randomInt } from 'crypto';

// Readable temporary password: no look-alike characters (0/O, 1/l/I).
// Guaranteed to contain upper, lower and a digit. Server-only.
export function generateTempPassword(length = 12): string {
  const upper = 'ABCDEFGHJKMNPQRSTUVWXYZ';
  const lower = 'abcdefghijkmnpqrstuvwxyz';
  const digits = '23456789';
  const all = upper + lower + digits;
  const pick = (set: string) => set[randomInt(set.length)];

  const chars = [pick(upper), pick(lower), pick(digits)];
  while (chars.length < length) chars.push(pick(all));

  // Fisher-Yates shuffle so the guaranteed characters aren't always first
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}
