import { NextResponse } from 'next/server';
import { getWordById } from '@/lib/queries';
import { applyAnswer, type Direction } from '@/lib/wrongbook';
import { isMatch } from '@/lib/match';

const VALID_DIRECTIONS = [
  'kanji_to_kana', 'kana_to_kanji', 'jp_to_cn', 'cn_to_jp',
] as const;

interface Body {
  wordId: number;
  direction: Direction;
  userAnswer: string;
}

function parseBody(raw: unknown): Body | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.wordId !== 'number') return null;
  if (!(VALID_DIRECTIONS as readonly string[]).includes(r.direction as string))
    return null;
  if (typeof r.userAnswer !== 'string') return null;
  return {
    wordId: r.wordId,
    direction: r.direction as Direction,
    userAnswer: r.userAnswer,
  };
}

function getExpected(
  word: { japanese: string; kana: string | null; chinese: string },
  d: Direction,
): string {
  switch (d) {
    case 'kanji_to_kana':
      return word.kana ?? '';
    case 'kana_to_kanji':
      return word.japanese;
    case 'jp_to_cn':
      return word.chinese;
    case 'cn_to_jp':
      return word.japanese;
  }
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const word = getWordById(body.wordId);
  if (!word) {
    return NextResponse.json({ error: 'word not found' }, { status: 404 });
  }
  const expected = getExpected(word, body.direction);
  const correct = isMatch(body.userAnswer, expected);
  const delta = applyAnswer(body.wordId, body.direction, correct);
  return NextResponse.json({ correct, correctAnswer: expected, ...delta });
}
