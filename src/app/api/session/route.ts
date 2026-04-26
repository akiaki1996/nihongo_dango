import { NextResponse } from 'next/server';
import { getAllWordIds, getKanaWordIds, getWrongBookWordIds, getWordById } from '@/lib/queries';
import type { Direction } from '@/lib/wrongbook';

type Source = 'all' | 'wrong';
type DirectionParam = Direction | 'mixed';

interface Question {
  wordId: number;
  prompt: string;
  direction: Direction;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALL_DIRECTIONS: Direction[] = [
  'kanji_to_kana',
  'kana_to_kanji',
  'jp_to_cn',
  'cn_to_jp',
];

function promptFor(
  word: { japanese: string; kana: string | null; chinese: string },
  d: Direction,
): string {
  switch (d) {
    case 'kanji_to_kana':
      return word.japanese;
    case 'kana_to_kanji':
      return word.kana!;
    case 'jp_to_cn':
      return word.japanese;
    case 'cn_to_jp':
      return word.chinese;
  }
}

const VALID_DIRECTIONS = [
  'kanji_to_kana',
  'kana_to_kanji',
  'jp_to_cn',
  'cn_to_jp',
  'mixed',
] as const;

const KANA_REQUIRED: Set<Direction> = new Set(['kanji_to_kana', 'kana_to_kanji']);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = url.searchParams.get('source') as Source | null;
  const direction = url.searchParams.get('direction') as DirectionParam | null;
  const sizeRaw = url.searchParams.get('size');

  if (source !== 'all' && source !== 'wrong') {
    return NextResponse.json({ error: 'invalid source' }, { status: 400 });
  }
  const d = (direction ?? '') as string;
  if (!(VALID_DIRECTIONS as readonly string[]).includes(d)) {
    return NextResponse.json({ error: 'invalid direction' }, { status: 400 });
  }
  const dir = d as DirectionParam;
  if (sizeRaw !== 'all' && (!sizeRaw || !/^\d+$/.test(sizeRaw))) {
    return NextResponse.json({ error: 'invalid size' }, { status: 400 });
  }

  let ids: number[];
  if (source === 'all') {
    if (dir !== 'mixed' && KANA_REQUIRED.has(dir)) {
      ids = getKanaWordIds();
    } else {
      ids = getAllWordIds();
    }
  } else {
    const filter: Direction | 'all' = dir === 'mixed' ? 'all' : dir;
    ids = getWrongBookWordIds(filter);
  }

  const shuffled = shuffle(ids);
  const size = sizeRaw === 'all' ? shuffled.length : Math.min(Number(sizeRaw), shuffled.length);
  const picked = shuffled.slice(0, size);

  const questions: Question[] = [];
  for (const id of picked) {
    const word = getWordById(id);
    if (!word) continue;

    let d: Direction;
    if (dir === 'mixed') {
      const validDirs = ALL_DIRECTIONS.filter(
        (dir) => !KANA_REQUIRED.has(dir) || (word.kana && word.kana.length > 0),
      );
      if (validDirs.length === 0) continue;
      d = validDirs[Math.floor(Math.random() * validDirs.length)];
    } else {
      d = dir;
    }

    questions.push({
      wordId: word.id,
      prompt: promptFor(word, d),
      direction: d,
    });
  }

  return NextResponse.json({ questions });
}
