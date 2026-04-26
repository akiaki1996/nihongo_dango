import { NextResponse } from 'next/server';
import { signToken, verifyPassword, COOKIE_NAME, COOKIE_TTL_MS } from '@/lib/auth';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== 'object' ||
    typeof (body as { password?: unknown }).password !== 'string'
  ) {
    return NextResponse.json({ error: 'password required' }, { status: 400 });
  }
  const { password } = body as { password: string };
  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const expiresAt = Date.now() + COOKIE_TTL_MS;
  const token = await signToken(expiresAt);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  });
  return res;
}
