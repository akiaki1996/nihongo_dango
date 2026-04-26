import crypto from 'node:crypto';

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET must be set to at least 16 chars');
  }
  return secret;
}

function hmac(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

export function signToken(expiresAtMs: number): string {
  const payload = String(expiresAtMs);
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): boolean {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp)) return false;
  return Date.now() < exp;
}

export function verifyPassword(given: string): boolean {
  const expected = process.env.APP_PASSWORD ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const COOKIE_NAME = 'auth_token';
export const COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
