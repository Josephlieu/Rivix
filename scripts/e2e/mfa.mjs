// Test helper: completes the admin two-step sign-in (task 8) the way an authenticator app would.
// A test admin gets an authenticator set up on first use; the 6-digit codes are computed here (RFC 6238 TOTP).
// Use after signInWithPassword on the same client: `await stepUp(sb)`. Customers and reps are left as they are.
import crypto from 'crypto';

const secrets = new Map(); // user id -> TOTP secret (base32), for this test process only

function base32Decode(s) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '', out = [];
  for (const c of s.replace(/=+$/, '').toUpperCase()) {
    const v = alphabet.indexOf(c);
    if (v < 0) continue;
    bits += v.toString(2).padStart(5, '0');
  }
  for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2));
  return Buffer.from(out);
}

/** The current 6-digit code for a base32 secret (offset in 30-second steps, for testing a stale code). */
export function totp(secret, offset = 0) {
  const counter = Math.floor(Date.now() / 1000 / 30) + offset;
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = crypto.createHmac('sha1', base32Decode(secret)).update(buf).digest();
  const o = h[h.length - 1] & 0xf;
  const n = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(n % 1_000_000).padStart(6, '0');
}

/** Sets up an authenticator for the signed-in user and returns { factorId, secret } (verified, session now aal2). */
export async function enrollTotp(sb) {
  const { data: en, error } = await sb.auth.mfa.enroll({ factorType: 'totp', friendlyName: `test-${Date.now()}` });
  if (error) throw new Error(`mfa enroll failed: ${error.message}`);
  const { error: vErr } = await sb.auth.mfa.challengeAndVerify({ factorId: en.id, code: totp(en.totp.secret) });
  if (vErr) throw new Error(`mfa verify failed: ${vErr.message}`);
  const { data: { user } } = await sb.auth.getUser();
  secrets.set(user.id, en.totp.secret);
  return { factorId: en.id, secret: en.totp.secret };
}

/** After a password sign-in: an admin is taken to aal2 (setting up an authenticator the first time). */
export async function stepUp(sb) {
  const { data: { user } } = await sb.auth.getUser();
  if (user?.app_metadata?.role !== 'admin') return;
  const verified = (user.factors || []).find((f) => f.factor_type === 'totp' && f.status === 'verified');
  if (!verified) { await enrollTotp(sb); return; }
  const secret = secrets.get(user.id);
  if (!secret) throw new Error('this admin has an authenticator this test did not set up');
  const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: verified.id, code: totp(secret) });
  if (error) throw new Error(`mfa verify failed: ${error.message}`);
}
