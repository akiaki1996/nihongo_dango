'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Source = 'all' | 'wrong';
type Direction =
  'kanji_to_kana' | 'kana_to_kanji' | 'jp_to_cn' | 'cn_to_jp' | 'mixed';

interface Stats {
  totalWords: number;
  wrongBookCount: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [source, setSource] = useState<Source>('all');
  const [direction, setDirection] = useState<Direction>('kanji_to_kana');
  const [size, setSize] = useState<string>('20');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats);
  }, []);

  function start() {
    const qs = new URLSearchParams({ source, direction, size });
    router.push(`/practice?${qs.toString()}`);
  }

  const startDisabled =
    !stats ||
    (source === 'all' && stats.totalWords === 0) ||
    (source === 'wrong' && stats.wrongBookCount === 0);

  return (
    <div style={{ paddingTop: 16 }}>
      <h1 style={{ textAlign: 'center', marginBottom: 4 }}>にほんご</h1>
      <p style={{
        textAlign: 'center',
        color: 'var(--color-text-secondary)',
        fontSize: 14,
        margin: '0 0 28px',
      }}>
        日语单词练习
      </p>

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 12,
        marginBottom: 28,
      }}>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div className="stat-value">{stats?.totalWords ?? '…'}</div>
          <div className="stat-label">词库</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px 16px' }}>
          <div className="stat-value">{stats?.wrongBookCount ?? '…'}</div>
          <div className="stat-label">错题</div>
        </div>
      </div>

      {/* Settings */}
      <div className="card">
        <h2>练习设置</h2>

        <div className="field-group">
          <label className="field-label">题源</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as Source)}
            style={{ width: '100%' }}
          >
            <option value="all">全部词库</option>
            <option value="wrong">仅错题本</option>
          </select>
        </div>

        <div className="field-group">
          <label className="field-label">方向</label>
          <select
            value={direction}
            onChange={(e) => setDirection(e.target.value as Direction)}
            style={{ width: '100%' }}
          >
            <option value="kanji_to_kana">汉字 → 假名</option>
            <option value="kana_to_kanji">假名 → 汉字</option>
            <option value="jp_to_cn">日 → 中</option>
            <option value="cn_to_jp">中 → 日</option>
            <option value="mixed">混合模式</option>
          </select>
        </div>

        <div className="field-group">
          <label className="field-label">题量</label>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            style={{ width: '100%' }}
          >
            <option value="10">10 题</option>
            <option value="20">20 题</option>
            <option value="50">50 题</option>
            <option value="all">全部</option>
          </select>
        </div>

        <button
          className="btn animate-in"
          onClick={start}
          disabled={startDisabled}
          style={{ marginTop: 8 }}
        >
          开始练习
        </button>

        {source === 'all' && stats?.totalWords === 0 && (
          <p className="feedback-wrong" style={{ textAlign: 'center', marginTop: 12 }}>
            词库为空，请先导入 seed/words.csv
          </p>
        )}
        {source === 'wrong' && stats?.wrongBookCount === 0 && (
          <p className="feedback-wrong" style={{ textAlign: 'center', marginTop: 12 }}>
            错题本为空
          </p>
        )}
      </div>
    </div>
  );
}
