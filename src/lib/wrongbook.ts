import { getDb } from './db';

export type Direction = 'kanji_to_kana' | 'kana_to_kanji' | 'jp_to_cn' | 'cn_to_jp';

export interface AnswerResult {
  addedToWrongBook: boolean;
  removedFromWrongBook: boolean;
}

const REMOVE_STREAK = 2;

export function applyAnswer(
  wordId: number,
  direction: Direction,
  correct: boolean,
): AnswerResult {
  const db = getDb();
  const existing = db
    .prepare('SELECT correct_streak FROM wrong_book WHERE word_id=? AND direction=?')
    .get(wordId, direction) as { correct_streak: number } | undefined;

  if (!correct) {
    if (existing) {
      db.prepare('UPDATE wrong_book SET correct_streak=0 WHERE word_id=? AND direction=?')
        .run(wordId, direction);
      return { addedToWrongBook: false, removedFromWrongBook: false };
    }
    db.prepare(
      'INSERT INTO wrong_book (word_id, direction, correct_streak, added_at) VALUES (?,?,?,?)',
    ).run(wordId, direction, 0, Date.now());
    return { addedToWrongBook: true, removedFromWrongBook: false };
  }

  // correct
  if (!existing) {
    return { addedToWrongBook: false, removedFromWrongBook: false };
  }
  const nextStreak = existing.correct_streak + 1;
  if (nextStreak >= REMOVE_STREAK) {
    db.prepare('DELETE FROM wrong_book WHERE word_id=? AND direction=?')
      .run(wordId, direction);
    return { addedToWrongBook: false, removedFromWrongBook: true };
  }
  db.prepare('UPDATE wrong_book SET correct_streak=? WHERE word_id=? AND direction=?')
    .run(nextStreak, wordId, direction);
  return { addedToWrongBook: false, removedFromWrongBook: false };
}

export function getWrongBookCount(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as c FROM wrong_book').get() as { c: number };
  return row.c;
}
