import { describe, it, expect, beforeAll } from 'vitest';
import { signToken, verifyToken } from '@/lib/auth';

describe('auth', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = 'test-secret-do-not-use-in-prod-0123456789';
  });

  it('sign then verify returns true within ttl', () => {
    const token = signToken(Date.now() + 60_000);
    expect(verifyToken(token)).toBe(true);
  });

  it('expired token fails verification', () => {
    const token = signToken(Date.now() - 1000);
    expect(verifyToken(token)).toBe(false);
  });

  it('tampered token fails verification', () => {
    const token = signToken(Date.now() + 60_000);
    const tampered = token.split('.')[0] + '.AAAA';
    expect(verifyToken(tampered)).toBe(false);
  });

  it('malformed token fails verification', () => {
    expect(verifyToken('not-a-token')).toBe(false);
    expect(verifyToken('')).toBe(false);
  });
});
