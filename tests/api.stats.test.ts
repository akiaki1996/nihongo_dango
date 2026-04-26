import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getDb, closeDb } from '@/lib/db';
import { insertWord } from '@/lib/queries';
import { GET } from '@/app/api/stats/route';

describe('GET /api/stats', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-stats-'));
    process.env.DB_PATH = path.join(tmpDir, 'app.sqlite');
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('returns counts', async () => {
    insertWord({ japanese: 'a', kana: null, chinese: 'b', group_key: null });
    insertWord({ japanese: 'c', kana: null, chinese: 'd', group_key: null });
    const db = getDb();
    db.prepare(
      'INSERT INTO wrong_book (word_id, direction, correct_streak, added_at) VALUES (1,?,0,?)',
    ).run('jp_to_cn', Date.now());

    const res = await GET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ totalWords: 2, wrongBookCount: 1 });
  });
});
