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
  kanji_to_kana: '汉字 → 假名',
  kana_to_kanji: '假名 → 汉字',
  jp_to_cn: '日 → 中',
  cn_to_jp: '中 → 日',
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

  const progress = questions.length > 0
    ? ((index + (phase === 'reviewing' ? 1 : 0)) / questions.length) * 100
    : 0;

  if (phase === 'loading') {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60dvh',
      }}>
        <p style={{ color: 'var(--color-text-secondary)' }}>加载中…</p>
      </div>
    );
  }

  if (phase === 'done') {
    const accuracy = questions.length > 0
      ? Math.round((stats.correctCount / questions.length) * 100)
      : 0;

    return (
      <div style={{ paddingTop: 32 }} className="animate-in">
        <h1 style={{ textAlign: 'center' }}>练习结束</h1>
        <p style={{ textAlign: 'center', color: 'var(--color-text-secondary)', marginBottom: 32 }}>
          辛苦了！
        </p>

        <div className="card" style={{ marginBottom: 24 }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <div className="stat-value" style={{ fontSize: 48 }}>{accuracy}%</div>
            <div className="stat-label">正确率</div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12,
            textAlign: 'center',
            padding: '16px 0',
            borderTop: '1px solid var(--color-border-light)',
          }}>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-text)' }}>
                {stats.correctCount}/{questions.length}
              </div>
              <div className="stat-label">正确</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-error)' }}>
                +{stats.added}
              </div>
              <div className="stat-label">新增错题</div>
            </div>
            <div>
              <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--color-success)' }}>
                -{stats.removed}
              </div>
              <div className="stat-label">移出错题</div>
            </div>
          </div>
        </div>

        <button className="btn" onClick={() => router.push('/')}>
          返回首页
        </button>
      </div>
    );
  }

  const q = questions[index];

  return (
    <div style={{ paddingTop: 16 }}>
      {/* Progress bar */}
      <div className="progress-bar" style={{ marginBottom: 20 }}>
        <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
      </div>

      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
      }}>
        <span style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
        }}>
          {LABELS[q.direction]}
        </span>
        <span style={{
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          fontWeight: 400,
        }}>
          {index + 1} / {questions.length}
        </span>
      </div>

      {/* Prompt */}
      <div className="prompt">{q.prompt}</div>

      {/* Answer form */}
      {phase === 'answering' && (
        <form onSubmit={submitAnswer} className="animate-in">
          <input
            className="input"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDERS[q.direction]}
            style={{
              textAlign: 'center',
              fontSize: 22,
              padding: '16px',
            }}
          />
          <button
            className="btn"
            type="submit"
            disabled={!input.trim()}
            style={{ marginTop: 16 }}
          >
            确认
          </button>
        </form>
      )}

      {/* Review */}
      {phase === 'reviewing' && lastResult && (
        <div className="animate-in">
          <div style={{
            textAlign: 'center',
            padding: 24,
            borderRadius: 'var(--radius-lg)',
            background: lastResult.correct
              ? 'rgba(22, 163, 74, 0.06)'
              : 'var(--color-error-bg)',
            border: '1px solid',
            borderColor: lastResult.correct
              ? 'rgba(22, 163, 74, 0.2)'
              : 'rgba(220, 38, 38, 0.15)',
            marginBottom: 20,
          }}>
            <p className={lastResult.correct ? 'feedback-correct' : 'feedback-wrong'}
              style={{ margin: '0 0 8px' }}>
              {lastResult.correct ? '正确' : '错误'}
            </p>
            {!lastResult.correct && (
              <p style={{
                margin: '0 0 4px',
                color: 'var(--color-text-secondary)',
                fontSize: 15,
              }}>
                你的回答：{input}
              </p>
            )}
            <p style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 500,
              color: 'var(--color-text)',
            }}>
              {lastResult.correctAnswer}
            </p>
          </div>

          <button className="btn" onClick={nextQuestion}>
            下一题 ⏎
          </button>
        </div>
      )}
    </div>
  );
}
