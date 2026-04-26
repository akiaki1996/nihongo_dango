import { describe, it, expect, beforeAll } from 'vitest';
import { POST } from '@/app/api/login/route';

describe('POST /api/login', () => {
  beforeAll(() => {
    process.env.APP_PASSWORD = 'secret123';
    process.env.AUTH_SECRET = 'test-secret-12345678901234567890';
  });

  function buildReq(body: unknown): Request {
    return new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 200 and sets cookie on correct password', async () => {
    const res = await POST(buildReq({ password: 'secret123' }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/auth_token=/);
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it('returns 401 on wrong password', async () => {
    const res = await POST(buildReq({ password: 'nope' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on malformed body', async () => {
    const res = await POST(buildReq({}));
    expect(res.status).toBe(400);
  });
});
