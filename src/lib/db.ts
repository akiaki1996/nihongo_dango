import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

let instance: Database.Database | null = null;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  japanese TEXT NOT NULL,
  kana TEXT,
  chinese TEXT NOT NULL,
  group_key TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_words_japanese ON words(japanese);

CREATE TABLE IF NOT EXISTS wrong_book (
  word_id INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK(direction IN ('kanji_to_kana','kana_to_kanji','jp_to_cn','cn_to_jp')),
  correct_streak INTEGER NOT NULL DEFAULT 0,
  added_at INTEGER NOT NULL,
  PRIMARY KEY (word_id, direction),
  FOREIGN KEY (word_id) REFERENCES words(id) ON DELETE CASCADE
);
`;

export function getDb(): Database.Database {
  if (instance) return instance;
  const dbPath = process.env.DB_PATH ?? './data/app.sqlite';
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  instance = db;
  return db;
}

export function closeDb(): void {
  if (instance) {
    instance.close();
    instance = null;
  }
}
