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
    <div>
      <h1>日语单词练习</h1>
      <p>
        总词数: <strong>{stats?.totalWords ?? '…'}</strong>
        {' · '}
        错题本: <strong>{stats?.wrongBookCount ?? '…'}</strong>
      </p>

      <h2>练习设置</h2>

      <label style={{ display: 'block', marginBottom: 12 }}>
        题源:{' '}
        <select
          value={source}
          onChange={(e) => setSource(e.target.value as Source)}
        >
          <option value="all">全部词库</option>
          <option value="wrong">仅错题本</option>
        </select>
      </label>

      <label style={{ display: 'block', marginBottom: 12 }}>
        方向:{' '}
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as Direction)}
        >
          <option value="kanji_to_kana">汉字 → 假名</option>
          <option value="kana_to_kanji">假名 → 汉字</option>
          <option value="jp_to_cn">日 → 中</option>
          <option value="cn_to_jp">中 → 日</option>
          <option value="mixed">混合</option>
        </select>
      </label>

      <label style={{ display: 'block', marginBottom: 24 }}>
        题量:{' '}
        <select value={size} onChange={(e) => setSize(e.target.value)}>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="all">全部</option>
        </select>
      </label>

      <button className="btn" onClick={start} disabled={startDisabled}>
        开始练习
      </button>
      {source === 'all' && stats?.totalWords === 0 && (
        <p className="feedback-wrong">词库为空</p>
      )}
      {source === 'wrong' && stats?.wrongBookCount === 0 && (
        <p className="feedback-wrong">错题本为空</p>
      )}
    </div>
  );
}
