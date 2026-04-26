import { getDb } from './db';
import type { Direction } from './wrongbook';

export interface Word {
  id: number;
  japanese: string;
  kana: string | null;
  chinese: string;
  group_key: string | null;
  created_at: number;
}

export interface NewWord {
  japanese: string;
  kana: string | null;
  chinese: string;
  group_key: string | null;
}

export function countWords(): number {
  const db = getDb();
  const row = db.prepare('SELECT COUNT(*) as c FROM words').get() as { c: number };
  return row.c;
}

export function insertWord(w: NewWord): number {
  const db = getDb();
  const info = db
    .prepare(
      'INSERT INTO words (japanese, kana, chinese, group_key, created_at) VALUES (?,?,?,?,?)',
    )
    .run(w.japanese, w.kana, w.chinese, w.group_key, Date.now());
  return Number(info.lastInsertRowid);
}

export function getAllWordIds(): number[] {
  const db = getDb();
  const rows = db.prepare('SELECT id FROM words ORDER BY id').all() as { id: number }[];
  return rows.map((r) => r.id);
}

export function getKanaWordIds(): number[] {
  const db = getDb();
  const rows = db
    .prepare('SELECT id FROM words WHERE kana IS NOT NULL AND kana != ? ORDER BY id')
    .all('') as { id: number }[];
  return rows.map((r) => r.id);
}

export function getWrongBookWordIds(direction: Direction | 'all'): number[] {
  const db = getDb();
  const rows =
    direction === 'all'
      ? (db.prepare('SELECT DISTINCT word_id FROM wrong_book').all() as { word_id: number }[])
      : (db
          .prepare('SELECT word_id FROM wrong_book WHERE direction=?')
          .all(direction) as { word_id: number }[]);
  return rows.map((r) => r.word_id);
}

export function getWordById(id: number): Word | undefined {
  const db = getDb();
  return db.prepare('SELECT * FROM words WHERE id=?').get(id) as Word | undefined;
}
