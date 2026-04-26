async function getKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET must be set to at least 16 chars');
  }
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

async function hmac(data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await getKey();
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  const bytes = new Uint8Array(sig);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

export async function signToken(expiresAtMs: number): Promise<string> {
  const payload = String(expiresAtMs);
  const sig = await hmac(payload);
  return `${payload}.${sig}`;
}

export async function verifyToken(token: string): Promise<boolean> {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = await hmac(payload);
  const a = new TextEncoder().encode(sig);
  const b = new TextEncoder().encode(expected);
  if (!timingSafeEqual(a, b)) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp)) return false;
  return Date.now() < exp;
}

export async function verifyPassword(given: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD ?? '';
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  return timingSafeEqual(a, b);
}

export const COOKIE_NAME = 'auth_token';
export const COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
