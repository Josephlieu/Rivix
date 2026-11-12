// Task 21: the guarded fetcher. The server fetches a link an admin typed, so every request is checked before it is made:
// - the link: https only, port 443 only, no user name or password, at most 2,000 characters;
// - the address: the host is resolved ONCE, every address it resolves to must be on the public internet (no private, local,
//   link-local, carrier NAT, cloud metadata, multicast or reserved addresses, IPv4 or IPv6, including IPv4-mapped IPv6), and
//   the connection is made to that same checked address (pinned), so a second DNS answer cannot swap in a private one;
// - redirects are followed by hand (at most 3), each new link checked again from the start;
// - time and size limits, counted while reading and after decompression (a compressed bomb is cut off).
// Nothing is sent but a GET with a generic User-Agent: no cookies, no credentials. Refusals carry a reason for the server's
// record only; the caller shows the person a generic message (so the answer cannot be used to probe internal systems).
// Pure Node, relative imports only (the tests load this file directly and pass in a fake DNS and a fake connection).
import { BlockList, isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import { lookup as dnsLookup } from 'node:dns/promises';
import { Readable } from 'node:stream';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';

export const LINK_LIMITS = { maxUrl: 2000, maxRedirects: 3, requestMs: 10_000, pageBytes: 3 * 1024 * 1024, imageBytes: 8 * 1024 * 1024 };
export const USER_AGENT = 'RIVIX portal link reader';

/** A refusal or failure. `reason` is for the server's record (link_reads.result), never for the person's screen. */
export class LinkError extends Error {
  reason: string;
  constructor(reason: string) { super(reason); this.reason = reason; }
}
export const GENERIC_LINK_MESSAGE = 'The page could not be read. Check that it is a public https product page, or save the photos from the page and add them by hand.';

// ---- The link -----------------------------------------------------------------------------------------------------------

/** Checks the link's shape only (no network). The messages here describe the link as typed, so they can be specific. */
export function checkLink(raw: unknown): { ok: true; url: URL } | { ok: false; reason: string; message: string } {
  const text = typeof raw === 'string' ? raw.trim() : '';
  if (!text) return { ok: false, reason: 'empty', message: 'Paste a link to a product page.' };
  if (text.length > LINK_LIMITS.maxUrl) return { ok: false, reason: 'too-long', message: 'That link is too long.' };
  let url: URL;
  try { url = new URL(text); } catch { return { ok: false, reason: 'not-a-url', message: 'That is not a web link. It should start with https://' }; }
  if (url.protocol !== 'https:') return { ok: false, reason: `scheme ${url.protocol}`, message: 'Only https links can be read.' };
  if (url.username || url.password) return { ok: false, reason: 'credentials', message: 'Links with a user name or password cannot be read.' };
  if (url.port && url.port !== '443') return { ok: false, reason: `port ${url.port}`, message: 'Only links on the standard https port can be read.' };
  if (!url.hostname) return { ok: false, reason: 'no-host', message: 'That is not a web link. It should start with https://' };
  url.hash = '';
  return { ok: true, url };
}

// ---- The address --------------------------------------------------------------------------------------------------------

const v4Blocked = new BlockList();
for (const [net, bits] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.31.196.0', 24], ['192.52.193.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['192.175.48.0', 24], ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) v4Blocked.addSubnet(net, bits, 'ipv4');

const v6GlobalUnicast = new BlockList();
v6GlobalUnicast.addSubnet('2000::', 3, 'ipv6');
const v6Blocked = new BlockList();
for (const [net, bits] of [
  ['2001::', 32], ['2001:2::', 48], ['2001:10::', 28], ['2001:20::', 28], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20],
] as const) v6Blocked.addSubnet(net, bits, 'ipv6');

/** The 8 groups of an IPv6 address (with an IPv4 tail expanded), or null. */
export function ipv6Groups(ip: string): number[] | null {
  let s = ip.toLowerCase();
  const zone = s.indexOf('%'); if (zone >= 0) s = s.slice(0, zone);
  const tail = s.match(/(\d+\.\d+\.\d+\.\d+)$/);
  if (tail) {
    const p = tail[1].split('.').map(Number);
    if (p.some((n) => n > 255)) return null;
    s = s.slice(0, -tail[1].length) + `${((p[0] << 8) | p[1]).toString(16)}:${((p[2] << 8) | p[3]).toString(16)}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const part = (h: string) => (h ? h.split(':') : []);
  const head = part(halves[0]), back = halves.length === 2 ? part(halves[1]) : [];
  const fill = halves.length === 2 ? 8 - head.length - back.length : 0;
  if (fill < 0 || (halves.length === 1 && head.length !== 8)) return null;
  const all = [...head, ...Array(fill).fill('0'), ...back];
  if (all.length !== 8 || all.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  return all.map((g) => parseInt(g, 16));
}

/** True only for an address on the public internet. Anything else (or anything unreadable) is refused. */
export function isPublicAddress(ip: string): boolean {
  const fam = isIP(ip.split('%')[0]);
  if (fam === 4) return !v4Blocked.check(ip, 'ipv4');
  if (fam !== 6) return false;
  const g = ipv6Groups(ip);
  if (!g) return false;
  // An IPv4 address inside IPv6 (mapped ::ffff:a.b.c.d, translated ::ffff:0:a.b.c.d, compatible ::a.b.c.d, NAT64
  // 64:ff9b::/96 and 64:ff9b:1::/48) is never fetched, whatever the IPv4 inside: a public site has a plain address.
  const zeros = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (zeros(5) && (g[5] === 0xffff || g[5] === 0)) return false; // mapped / compatible / unspecified / loopback
  if (zeros(4) && g[4] === 0xffff && g[5] === 0) return false;    // IPv4-translated
  if (g[0] === 0x64 && g[1] === 0xff9b) return false;             // NAT64
  const canonical = g.map((x) => x.toString(16)).join(':');
  if (!v6GlobalUnicast.check(canonical, 'ipv6')) return false;   // ::1, fc00::/7, fe80::/10, fec0::/10, ff00::/8, 100::/64…
  return !v6Blocked.check(canonical, 'ipv6');                     // Teredo, documentation, 6to4, ORCHID, benchmarking
}

// ---- The fetch ----------------------------------------------------------------------------------------------------------

export interface RawResponse { status: number; headers: Record<string, string | string[] | undefined>; body: Readable }
/** Resolves a host name to every address it has (the default uses the system resolver once). */
export type Resolve = (host: string) => Promise<string[]>;
/** Opens one GET to `url`, connecting to `ip` (already checked) and nowhere else. */
export type Transport = (url: URL, ip: string, signal: AbortSignal) => Promise<RawResponse>;
export interface FetchDeps { resolve?: Resolve; transport?: Transport }

export const systemResolve: Resolve = async (host) => (await dnsLookup(host, { all: true, verbatim: true })).map((a) => a.address);

/** The options of the real connection: to the pinned address (no DNS lookup in the request itself), TLS checked against
 *  the host name, port 443, a GET with a generic User-Agent, no cookies, no credentials, no proxy, no shared connection. */
export function pinnedRequestOptions(url: URL, ip: string) {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  return {
    host: ip,
    servername: isIP(host) ? undefined : host, // TLS name check and SNI use the host name
    port: 443,
    path: `${url.pathname}${url.search}`,
    method: 'GET' as const,
    agent: false as const,
    headers: { Host: url.host, 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,image/jpeg,image/png,image/webp;q=0.9,*/*;q=0.1', 'Accept-Encoding': 'gzip, deflate, br', 'Accept-Language': 'en' },
  };
}

/** The real connection (see pinnedRequestOptions). */
export const pinnedTransport: Transport = (url, ip, signal) =>
  new Promise((resolve, reject) => {
    const req = httpsRequest({ ...pinnedRequestOptions(url, ip), signal }, (res) => resolve({ status: res.statusCode ?? 0, headers: res.headers, body: res }));
    req.on('error', reject);
    req.end();
  });

/** Reads a body, decompressing it, and stops as soon as it passes `max` bytes (after decompression). */
export async function readCapped(body: Readable, encoding: string | undefined, max: number): Promise<Buffer> {
  const enc = String(encoding ?? '').toLowerCase().trim();
  let stream: Readable = body;
  if (enc === 'gzip' || enc === 'x-gzip') stream = body.pipe(createGunzip());
  else if (enc === 'deflate') stream = body.pipe(createInflate());
  else if (enc === 'br') stream = body.pipe(createBrotliDecompress());
  else if (enc && enc !== 'identity') { body.destroy(); throw new LinkError(`encoding ${enc}`); }
  const chunks: Buffer[] = [];
  let size = 0;
  try {
    for await (const chunk of stream) {
      size += (chunk as Buffer).length;
      if (size > max) throw new LinkError(`too large (over ${max} bytes)`);
      chunks.push(chunk as Buffer);
    }
  } catch (e) {
    body.destroy(); stream.destroy();
    if (e instanceof LinkError) throw e;
    throw new LinkError(`read failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200));
  }
  return Buffer.concat(chunks);
}

/** Resolve once and check every address; returns the one address the connection will use. */
export async function pinAddress(url: URL, resolve: Resolve): Promise<string> {
  const host = url.hostname.replace(/^\[|\]$/g, '');
  let addresses: string[];
  if (isIP(host)) addresses = [host];
  else {
    if (/^(localhost|.*\.localhost|.*\.local|.*\.internal|.*\.home\.arpa)$/i.test(host)) throw new LinkError(`local host name ${host}`);
    try { addresses = await resolve(host); } catch { throw new LinkError(`dns failed for ${host}`); }
  }
  if (!addresses.length) throw new LinkError(`no address for ${host}`);
  const bad = addresses.find((a) => !isPublicAddress(a));
  if (bad) throw new LinkError(`not public: ${host} -> ${bad}`);
  return addresses[0];
}

export interface Fetched { url: URL; status: number; contentType: string; body: Buffer }

/**
 * One guarded GET: the link is checked, the host resolved once and every address checked, the connection made to that
 * checked address, redirects followed by hand (each checked again from the start), the body read within `maxBytes`.
 */
export async function guardedGet(raw: string | URL, opts: { maxBytes: number; deadline?: number; signal?: AbortSignal }, deps: FetchDeps = {}): Promise<Fetched> {
  const resolve = deps.resolve ?? systemResolve;
  const transport = deps.transport ?? pinnedTransport;
  let current = String(raw);
  for (let hop = 0; hop <= LINK_LIMITS.maxRedirects; hop++) {
    const checked = checkLink(current);
    if (!checked.ok) throw new LinkError(`${hop ? 'redirect ' : ''}${checked.reason}`);
    const url = checked.url;
    const left = (opts.deadline ?? Date.now() + LINK_LIMITS.requestMs) - Date.now();
    if (left <= 0) throw new LinkError('time budget used up');
    const timeout = AbortSignal.timeout(Math.min(LINK_LIMITS.requestMs, left));
    const signal = opts.signal ? AbortSignal.any([opts.signal, timeout]) : timeout;
    const ip = await pinAddress(url, resolve);
    let res: RawResponse;
    try { res = await transport(url, ip, signal); }
    catch (e) { throw new LinkError(signal.aborted ? 'timed out' : `connection failed: ${e instanceof Error ? e.message : String(e)}`.slice(0, 200)); }
    const header = (k: string) => { const v = res.headers[k]; return Array.isArray(v) ? v[0] : v; };
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      res.body.destroy();
      const loc = header('location');
      if (!loc) throw new LinkError(`redirect ${res.status} without a location`);
      try { current = new URL(loc, url).toString(); } catch { throw new LinkError('bad redirect location'); }
      continue;
    }
    if (res.status !== 200) { res.body.destroy(); throw new LinkError(`status ${res.status}`); }
    let body: Buffer;
    try {
      body = await Promise.race([
        readCapped(res.body, header('content-encoding'), opts.maxBytes),
        new Promise<never>((_, rej) => { if (signal.aborted) rej(new LinkError('timed out')); signal.addEventListener('abort', () => { res.body.destroy(); rej(new LinkError('timed out')); }, { once: true }); }),
      ]);
    } catch (e) { res.body.destroy(); throw e instanceof LinkError ? e : new LinkError('read failed'); }
    return { url, status: res.status, contentType: String(header('content-type') ?? '').toLowerCase(), body };
  }
  throw new LinkError(`more than ${LINK_LIMITS.maxRedirects} redirects`);
}
