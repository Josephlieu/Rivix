// The message files (2026-11-27). Server code and tests only: the browser gets one locale's flat messages through the
// provider, never this file. Pure (relative imports; the tests load it directly).
import en from './messages/en-CA.json' with { type: 'json' };
import fr from './messages/fr-CA.json' with { type: 'json' };
import us from './messages/en-US.json' with { type: 'json' };
import zh from './messages/zh-CN.json' with { type: 'json' };
import { type Locale } from './config';
import { chainOf, translator, type Messages, type T } from './translate';

export type Dict = { [k: string]: string | Dict };
export const DICTS: Record<Locale, Dict> = { 'en-CA': en as Dict, 'fr-CA': fr as Dict, 'en-US': us as Dict, 'zh-CN': zh as Dict };

export function flatten(d: Dict, p = '', out: Messages = {}): Messages {
  for (const [k, v] of Object.entries(d)) { if (typeof v === 'string') out[p + k] = v; else flatten(v, `${p}${k}.`, out); }
  return out;
}
/** One locale's messages, merged with its fallback (its own text wins). */
export function flatMessages(locale: Locale): Messages {
  const out: Messages = {};
  for (const l of [...chainOf(locale)].reverse()) Object.assign(out, flatten(DICTS[l]));
  return out;
}
const cache = new Map<Locale, Messages>();
export const messagesFor = (locale: Locale): Messages => { let m = cache.get(locale); if (!m) { m = flatMessages(locale); cache.set(locale, m); } return m; };
export const tFor = (locale: Locale): T => translator(locale, messagesFor(locale));
