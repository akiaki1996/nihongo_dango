import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getDb, closeDb } from '@/lib/db';
import {
  countWords,
  insertWord,
  getAllWordIds,
  getKanaWordIds,
  getWrongBookWordIds,
  getWordById,
} from '@/lib/queries';

describe('queries', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-q-'));
    process.env.DB_PATH = path.join(tmpDir, 'app.sqlite');
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('countWords returns 0 when empty', () => {
    expect(countWords()).toBe(0);
  });

  it('insertWord + countWords', () => {
    insertWord({ japanese: '食べる', kana: 'たべる', chinese: '吃', group_key: 'た行' });
    expect(countWords()).toBe(1);
  });

  it('getAllWordIds returns inserted ids', () => {
    insertWord({ japanese: 'a', kana: null, chinese: 'b', group_key: null });
    insertWord({ japanese: 'c', kana: null, chinese: 'd', group_key: null });
    expect(getAllWordIds()).toHaveLength(2);
  });

  it('getWordById returns expected fields', () => {
    insertWord({ japanese: '食べる', kana: 'たべる', chinese: '吃', group_key: null });
    const [id] = getAllWordIds();
    const w = getWordById(id);
    expect(w?.japanese).toBe('食べる');
    expect(w?.kana).toBe('たべる');
    expect(w?.chinese).toBe('吃');
  });

  it('getKanaWordIds returns only words with kana', () => {
    insertWord({ japanese: '食べる', kana: 'たべる', chinese: '吃', group_key: null });
    insertWord({ japanese: 'ありがとう', kana: null, chinese: '谢谢', group_key: null });
    insertWord({ japanese: '学校', kana: 'がっこう', chinese: '学校', group_key: null });
    const ids = getKanaWordIds();
    expect(ids).toHaveLength(2);
  });

  it('getWrongBookWordIds returns ids for a specific direction', () => {
    insertWord({ japanese: 'a', kana: null, chinese: 'b', group_key: null });
    const [id] = getAllWordIds();
    const db = getDb();
    db.prepare(
      'INSERT INTO wrong_book (word_id, direction, correct_streak, added_at) VALUES (?,?,?,?)',
    ).run(id, 'jp_to_cn', 0, Date.now());
    expect(getWrongBookWordIds('jp_to_cn')).toEqual([id]);
    expect(getWrongBookWordIds('kanji_to_kana')).toEqual([]);
  });

  it('getWrongBookWordIds with "all" returns ids from any direction', () => {
    insertWord({ japanese: 'a', kana: null, chinese: 'b', group_key: null });
    insertWord({ japanese: 'c', kana: null, chinese: 'd', group_key: null });
    const [id1, id2] = getAllWordIds();
    const db = getDb();
    db.prepare(
      'INSERT INTO wrong_book (word_id, direction, correct_streak, added_at) VALUES (?,?,?,?)',
    ).run(id1, 'jp_to_cn', 0, Date.now());
    db.prepare(
      'INSERT INTO wrong_book (word_id, direction, correct_streak, added_at) VALUES (?,?,?,?)',
    ).run(id2, 'kanji_to_kana', 0, Date.now());
    const ids = getWrongBookWordIds('all');
    expect(ids).toEqual([id1, id2]);
  });
});
