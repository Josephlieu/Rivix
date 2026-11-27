// The translator (2026-11-27, in-house, no package). Pure: the tests load this file directly.
//   t('login.title')                         → the text in the page's locale
//   t('common.items', { count: 3 })          → "{count, plural, one {# item} other {# items}}" with Intl.PluralRules
//   t('login.sentTo', { email })             → "{email}" filled in (values are inserted as plain text, never markup)
// A missing key falls back along the chain (en-US → en-CA, fr-CA → en-CA, zh-CN → en-CA; merged in dictionaries.ts); a key
// missing everywhere comes back as the key itself (the i18n test makes sure that never ships).
// This file holds no messages (so the browser never downloads every language): dictionaries.ts gives the flat messages of
// one locale, already merged with its fallback, and the client provider passes only those.
import type en from './messages/en-CA.json';
import { DEFAULT_LOCALE, type Locale } from './config';

type Paths<T, P extends string = ''> = { [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Paths<T[K], `${P}${K}.`> }[keyof T & string];
/** Every key of the English (source) file, checked by TypeScript. */
export type MessageKey = Paths<typeof en>;
export type Vars = Record<string, string | number>;
export type T = (key: MessageKey, vars?: Vars) => string;
export type Messages = Record<string, string>;

export const chainOf = (locale: Locale): Locale[] => (locale === DEFAULT_LOCALE ? [DEFAULT_LOCALE] : [locale, DEFAULT_LOCALE]);

// "{count, plural, =0 {none} one {# item} other {# items}}" → the matching branch. Branch texts may hold {name} values.
function plural(locale: Locale, n: number, body: string): string {
  const options = new Map<string, string>();
  let i = 0;
  while (i < body.length) {
    while (body[i] === ' ') i++;
    let sel = '';
    while (i < body.length && body[i] !== '{' && body[i] !== ' ') sel += body[i++];
    while (body[i] === ' ') i++;
    if (body[i] !== '{' || !sel) break;
    const start = ++i;
    let depth = 0;
    for (; i < body.length; i++) { if (body[i] === '{') depth++; else if (body[i] === '}') { if (depth === 0) break; depth--; } }
    options.set(sel, body.slice(start, i)); i++;
  }
  const text = options.get(`=${n}`) ?? options.get(new Intl.PluralRules(locale).select(n)) ?? options.get('other') ?? '';
  return text.replace(/#/g, new Intl.NumberFormat(locale).format(n));
}

/** Fills one message: plural blocks first, then {name} values. */
export function format(locale: Locale, message: string, vars: Vars = {}): string {
  let out = '';
  for (let i = 0; i < message.length; i++) {
    if (message[i] !== '{') { out += message[i]; continue; }
    let depth = 0, j = i + 1;
    for (; j < message.length; j++) { if (message[j] === '{') depth++; else if (message[j] === '}') { if (depth === 0) break; depth--; } }
    const inner = message.slice(i + 1, j);
    const m = /^(\w+),\s*plural,\s*([\s\S]*)$/.exec(inner);
    if (m) out += format(locale, plural(locale, Number(vars[m[1]] ?? 0), m[2]), vars);
    else out += /^\w+$/.test(inner) && inner in vars ? String(vars[inner]) : `{${inner}}`;
    i = j;
  }
  return out;
}

/** A t() for one locale, over its flat messages (see dictionaries.ts flatMessages). A key missing everywhere comes back as itself. */
export function translator(locale: Locale, messages: Messages): T {
  return (key, vars) => {
    const m = messages[key];
    return m === undefined ? key : format(locale, m, vars);
  };
}
