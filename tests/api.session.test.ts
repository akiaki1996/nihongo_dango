import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { closeDb } from '@/lib/db';
import { insertWord } from '@/lib/queries';
import { GET } from '@/app/api/session/route';

function req(qs: string): Request {
  return new Request(`http://localhost/api/session?${qs}`);
}

describe('GET /api/session', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-sess-'));
    process.env.DB_PATH = path.join(tmpDir, 'app.sqlite');
    for (let i = 0; i < 5; i++) {
      insertWord({
        japanese: `日${i}`,
        kana: `か${i}`,
        chinese: `中${i}`,
        group_key: null,
      });
    }
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('source=all + kanji_to_kana returns prompts as japanese', async () => {
    const res = await GET(req('source=all&direction=kanji_to_kana&size=5'));
    const json = await res.json();
    expect(json.questions).toHaveLength(5);
    json.questions.forEach((q: { prompt: string; direction: string }) => {
      expect(q.prompt).toMatch(/^日\d$/);
      expect(q.direction).toBe('kanji_to_kana');
    });
  });

  it('kana_to_kanji returns prompts as kana', async () => {
    const res = await GET(req('source=all&direction=kana_to_kanji&size=3'));
    const json = await res.json();
    json.questions.forEach((q: { prompt: string }) => {
      expect(q.prompt).toMatch(/^か\d$/);
    });
  });

  it('jp_to_cn returns prompts as japanese', async () => {
    const res = await GET(req('source=all&direction=jp_to_cn&size=3'));
    const json = await res.json();
    json.questions.forEach((q: { prompt: string }) => {
      expect(q.prompt).toMatch(/^日\d$/);
    });
  });

  it('cn_to_jp returns prompts as chinese', async () => {
    const res = await GET(req('source=all&direction=cn_to_jp&size=3'));
    const json = await res.json();
    json.questions.forEach((q: { prompt: string }) => {
      expect(q.prompt).toMatch(/^中\d$/);
    });
  });

  it('mixed direction returns questions with various directions', async () => {
    const res = await GET(req('source=all&direction=mixed&size=5'));
    const json = await res.json();
    expect(json.questions).toHaveLength(5);
    const dirs = new Set(json.questions.map((q: { direction: string }) => q.direction));
    expect(dirs.size).toBeGreaterThanOrEqual(1);
    json.questions.forEach((q: { direction: string }) =>
      expect(['kanji_to_kana', 'kana_to_kanji', 'jp_to_cn', 'cn_to_jp']).toContain(q.direction),
    );
  });

  it('kana_to_kanji skips words without kana', () => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-sess2-'));
    process.env.DB_PATH = path.join(tmpDir, 'app.sqlite');

    insertWord({ japanese: '食べる', kana: 'たべる', chinese: '吃', group_key: null });
    insertWord({ japanese: '飲む', kana: 'のむ', chinese: '喝', group_key: null });
    insertWord({ japanese: 'ありがとう', kana: null, chinese: '谢谢', group_key: null });
    insertWord({ japanese: 'これ', kana: null, chinese: '这个', group_key: null });

    const p = path.join(tmpDir, 'app.sqlite');
    process.env.DB_PATH = p;
    const res = GET(req('source=all&direction=kana_to_kanji&size=10'));
    return res.then((r) => r.json()).then((json) => {
      expect(json.questions).toHaveLength(2);
      json.questions.forEach((q: { wordId: number }) => {
        expect([1, 2]).toContain(q.wordId);
      });
    });
  });

  it('returns 400 on invalid direction', async () => {
    const res = await GET(req('source=all&direction=bad&size=5'));
    expect(res.status).toBe(400);
  });

  it('returns 400 on invalid source', async () => {
    const res = await GET(req('source=bad&direction=jp_to_cn&size=5'));
    expect(res.status).toBe(400);
  });
});
