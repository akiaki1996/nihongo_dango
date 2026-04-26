import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { closeDb } from '@/lib/db';
import { insertWord } from '@/lib/queries';
import { POST } from '@/app/api/answer/route';

function req(body: unknown): Request {
  return new Request('http://localhost/api/answer', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/answer', () => {
  let tmpDir: string;
  let wordId: number;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-ans-'));
    process.env.DB_PATH = path.join(tmpDir, 'app.sqlite');
    wordId = insertWord({
      japanese: '食べる', kana: 'たべる', chinese: '吃', group_key: null,
    });
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('kanji_to_kana: correct answer matched against kana', async () => {
    const res = await POST(req({ wordId, direction: 'kanji_to_kana', userAnswer: 'たべる' }));
    const json = await res.json();
    expect(json.correct).toBe(true);
    expect(json.correctAnswer).toBe('たべる');
  });

  it('kanji_to_kana: wrong answer', async () => {
    const res = await POST(req({ wordId, direction: 'kanji_to_kana', userAnswer: 'のむ' }));
    const json = await res.json();
    expect(json.correct).toBe(false);
    expect(json.correctAnswer).toBe('たべる');
    expect(json.addedToWrongBook).toBe(true);
  });

  it('kana_to_kanji: correct answer matched against japanese', async () => {
    const res = await POST(req({ wordId, direction: 'kana_to_kanji', userAnswer: '食べる' }));
    const json = await res.json();
    expect(json.correct).toBe(true);
    expect(json.correctAnswer).toBe('食べる');
  });

  it('jp_to_cn: correct answer matched against chinese', async () => {
    const res = await POST(req({ wordId, direction: 'jp_to_cn', userAnswer: '吃' }));
    const json = await res.json();
    expect(json.correct).toBe(true);
    expect(json.correctAnswer).toBe('吃');
  });

  it('cn_to_jp: correct answer matched against japanese', async () => {
    const res = await POST(req({ wordId, direction: 'cn_to_jp', userAnswer: '食べる' }));
    const json = await res.json();
    expect(json.correct).toBe(true);
    expect(json.correctAnswer).toBe('食べる');
  });

  it('cn_to_jp: wrong answer adds to wrong book', async () => {
    const res = await POST(req({ wordId, direction: 'cn_to_jp', userAnswer: '飲む' }));
    const json = await res.json();
    expect(json.correct).toBe(false);
    expect(json.correctAnswer).toBe('食べる');
    expect(json.addedToWrongBook).toBe(true);
  });

  it('returns 404 when wordId does not exist', async () => {
    const res = await POST(req({ wordId: 9999, direction: 'jp_to_cn', userAnswer: 'x' }));
    expect(res.status).toBe(404);
  });

  it('returns 400 on malformed body', async () => {
    const res = await POST(req({ direction: 'jp_to_cn', userAnswer: 'x' }));
    expect(res.status).toBe(400);
  });
});
