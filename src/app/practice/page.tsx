'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Direction =
  'kanji_to_kana' | 'kana_to_kanji' | 'jp_to_cn' | 'cn_to_jp';

interface Question {
  wordId: number;
  prompt: string;
  direction: Direction;
}

interface AnswerResponse {
  correct: boolean;
  correctAnswer: string;
  addedToWrongBook: boolean;
  removedFromWrongBook: boolean;
}

type Phase = 'loading' | 'answering' | 'reviewing' | 'done';

interface SessionStats {
  correctCount: number;
  added: number;
  removed: number;
}

const PLACEHOLDERS: Record<Direction, string> = {
  kanji_to_kana: '输入假名',
  kana_to_kanji: '输入汉字',
  jp_to_cn: '输入中文',
  cn_to_jp: '输入日文',
};

const LABELS: Record<Direction, string> = {
  kanji_to_kana: '汉字→假名',
  kana_to_kanji: '假名→汉字',
  jp_to_cn: '日→中',
  cn_to_jp: '中→日',
};

export default function PracticePage() {
  const sp = useSearchParams();
  const router = useRouter();
  const query = useMemo(
    () => ({
      source: sp.get('source') ?? 'all',
      direction: sp.get('direction') ?? 'kanji_to_kana',
      size: sp.get('size') ?? '20',
    }),
    [sp],
  );

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [lastResult, setLastResult] = useState<AnswerResponse | null>(null);
  const [stats, setStats] = useState<SessionStats>({
    correctCount: 0, added: 0, removed: 0,
  });

  useEffect(() => {
    const qs = new URLSearchParams(query).toString();
    fetch(`/api/session?${qs}`)
      .then((r) => r.json())
      .then((d: { questions: Question[] }) => {
        setQuestions(d.questions);
        setPhase(d.questions.length === 0 ? 'done' : 'answering');
      });
  }, [query]);

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const q = questions[index];
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        wordId: q.wordId,
        direction: q.direction,
        userAnswer: input,
      }),
    });
    const data: AnswerResponse = await res.json();
    setLastResult(data);
    setStats((s) => ({
      correctCount: s.correctCount + (data.correct ? 1 : 0),
      added: s.added + (data.addedToWrongBook ? 1 : 0),
      removed: s.removed + (data.removedFromWrongBook ? 1 : 0),
    }));
    setPhase('reviewing');
  }

  function nextQuestion() {
    setInput('');
    setLastResult(null);
    if (index + 1 >= questions.length) {
      setPhase('done');
    } else {
      setIndex(index + 1);
      setPhase('answering');
    }
  }

  useEffect(() => {
    if (phase !== 'reviewing') return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        nextQuestion();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (phase === 'loading') return <p>加载中…</p>;

  if (phase === 'done') {
    return (
      <div>
        <h1>练习结束</h1>
        <p>
          正确: {stats.correctCount} / {questions.length}
        </p>
        <p>本次新增错题: {stats.added}</p>
        <p>本次移出错题: {stats.removed}</p>
        <button className="btn" onClick={() => router.push('/')}>
          返回首页
        </button>
      </div>
    );
  }

  const q = questions[index];

  return (
    <div>
      <p>
        第 {index + 1} / {questions.length} 题{' · '}
        {LABELS[q.direction] ?? q.direction}
      </p>
      <div className="prompt">{q.prompt}</div>

      {phase === 'answering' && (
        <form onSubmit={submitAnswer}>
          <input
            className="input"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDERS[q.direction] ?? '输入答案'}
          />
          <button
            className="btn"
            style={{ marginTop: 12 }}
            type="submit"
            disabled={!input.trim()}
          >
            提交
          </button>
        </form>
      )}

      {phase === 'reviewing' && lastResult && (
        <div>
          <p
            className={
              lastResult.correct ? 'feedback-correct' : 'feedback-wrong'
            }
          >
            {lastResult.correct ? '✓ 正确!' : '✗ 错误'}
          </p>
          {!lastResult.correct && <p>你的答案: {input}</p>}
          <p>正确答案: {lastResult.correctAnswer}</p>
          <button className="btn" onClick={nextQuestion}>
            下一题 (Enter/Space)
          </button>
        </div>
      )}
    </div>
  );
}
