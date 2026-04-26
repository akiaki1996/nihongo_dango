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
        setErr('密码错误，请重试');
        return;
      }
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      minHeight: '100dvh',
      paddingBottom: '15%',
    }}>
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <h1 style={{ fontSize: 36, marginBottom: 4 }}>にほんご</h1>
        <p style={{ color: 'var(--color-text-secondary)', margin: 0, fontSize: 14 }}>
          日语单词练习
        </p>
      </div>

      <div className="card animate-in">
        <form onSubmit={submit}>
          <div className="field-group">
            <label className="field-label" htmlFor="password">
              密码
            </label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              placeholder="输入登录密码"
            />
          </div>

          {err && (
            <p style={{
              color: 'var(--color-error)',
              fontSize: 14,
              margin: '0 0 16px',
              padding: '10px 14px',
              background: 'var(--color-error-bg)',
              borderRadius: 'var(--radius-sm)',
            }}>
              {err}
            </p>
          )}

          <button
            className="btn"
            type="submit"
            disabled={loading || !password}
          >
            {loading ? '验证中…' : '开始练习'}
          </button>
        </form>
      </div>
    </div>
  );
}
