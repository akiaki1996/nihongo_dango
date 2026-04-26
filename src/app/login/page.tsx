'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setErr('密码错误');
        return;
      }
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 80 }}>
      <h1>登录</h1>
      <input
        type="password"
        className="input"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        placeholder="输入密码"
      />
      {err && <p className="feedback-wrong">{err}</p>}
      <button
        className="btn"
        type="submit"
        disabled={loading || !password}
        style={{ marginTop: 12 }}
      >
        {loading ? '登录中…' : '登录'}
      </button>
    </form>
  );
}
