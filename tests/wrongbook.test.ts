import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getDb, closeDb } from '@/lib/db';
import { applyAnswer, getWrongBookCount, type Direction } from '@/lib/wrongbook';

function insertWord(japanese: string, chinese: string, kana?: string) {
  const db = getDb();
  const now = Date.now();
  const info = db
    .prepare('INSERT INTO words (japanese, kana, chinese, created_at) VALUES (?,?,?,?)')
    .run(japanese, kana ?? null, chinese, now);
  return Number(info.lastInsertRowid);
}

describe('wrongbook', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-wb-'));
    process.env.DB_PATH = path.join(tmpDir, 'app.sqlite');
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('wrong answer on fresh word creates wrong_book row with streak 0', () => {
    const id = insertWord('食べる', '吃', 'たべる');
    const r = applyAnswer(id, 'kanji_to_kana', false);
    expect(r.addedToWrongBook).toBe(true);
    expect(r.removedFromWrongBook).toBe(false);
    expect(getWrongBookCount()).toBe(1);
  });

  it('correct answer on non-wrongbook word does nothing', () => {
    const id = insertWord('食べる', '吃', 'たべる');
    const r = applyAnswer(id, 'kanji_to_kana', true);
    expect(r.addedToWrongBook).toBe(false);
    expect(r.removedFromWrongBook).toBe(false);
    expect(getWrongBookCount()).toBe(0);
  });

  it('correct answer on wrongbook word increments streak', () => {
    const id = insertWord('食べる', '吃', 'たべる');
    applyAnswer(id, 'jp_to_cn', false);
    const r = applyAnswer(id, 'jp_to_cn', true);
    expect(r.removedFromWrongBook).toBe(false);
    expect(getWrongBookCount()).toBe(1);
  });

  it('second consecutive correct removes from wrongbook', () => {
    const id = insertWord('食べる', '吃', 'たべる');
    applyAnswer(id, 'cn_to_jp', false);
    applyAnswer(id, 'cn_to_jp', true);
    const r = applyAnswer(id, 'cn_to_jp', true);
    expect(r.removedFromWrongBook).toBe(true);
    expect(getWrongBookCount()).toBe(0);
  });

  it('wrong answer on streak=1 word resets streak to 0', () => {
    const id = insertWord('食べる', '吃', 'たべる');
    applyAnswer(id, 'kana_to_kanji', false);
    applyAnswer(id, 'kana_to_kanji', true);
    applyAnswer(id, 'kana_to_kanji', false);
    const db = getDb();
    const row = db
      .prepare('SELECT correct_streak FROM wrong_book WHERE word_id=? AND direction=?')
      .get(id, 'kana_to_kanji') as { correct_streak: number };
    expect(row.correct_streak).toBe(0);
  });

  it('different directions of same word are tracked independently', () => {
    const id = insertWord('食べる', '吃', 'たべる');
    applyAnswer(id, 'kanji_to_kana', false);
    applyAnswer(id, 'jp_to_cn', false);
    applyAnswer(id, 'kana_to_kanji', false);
    applyAnswer(id, 'cn_to_jp', false);
    expect(getWrongBookCount()).toBe(4);
  });

  it('all 4 direction values are accepted', () => {
    const id = insertWord('本', '书', 'ほん');
    const dirs: Direction[] = ['kanji_to_kana', 'kana_to_kanji', 'jp_to_cn', 'cn_to_jp'];
    for (const d of dirs) {
      const r = applyAnswer(id, d, false);
      expect(r.addedToWrongBook).toBe(true);
    }
    expect(getWrongBookCount()).toBe(4);
  });
});
