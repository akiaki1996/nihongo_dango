import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { closeDb } from '@/lib/db';
import { runSeed } from '@/scripts/seed';
import { countWords } from '@/lib/queries';

describe('seed', () => {
  let tmpDir: string;
  let csvPath: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-seed-'));
    process.env.DB_PATH = path.join(tmpDir, 'app.sqlite');
    csvPath = path.join(tmpDir, 'words.csv');
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('imports all rows from a valid csv', () => {
    fs.writeFileSync(
      csvPath,
      'japanese,kana,chinese,group_key\n食べる,たべる,吃,た行\n水,みず,水,ま行\n',
      'utf-8',
    );
    runSeed(csvPath);
    expect(countWords()).toBe(2);
  });

  it('skips seed when table already has words', () => {
    fs.writeFileSync(
      csvPath,
      'japanese,kana,chinese,group_key\n食べる,たべる,吃,た行\n',
      'utf-8',
    );
    runSeed(csvPath);
    runSeed(csvPath);
    expect(countWords()).toBe(1);
  });

  it('throws if csv missing required field', () => {
    fs.writeFileSync(csvPath, 'japanese,kana,chinese,group_key\n,たべる,吃,た行\n', 'utf-8');
    expect(() => runSeed(csvPath)).toThrow(/japanese/);
  });

  it('handles empty optional fields', () => {
    fs.writeFileSync(
      csvPath,
      'japanese,kana,chinese,group_key\nありがとう,,谢谢,\n',
      'utf-8',
    );
    runSeed(csvPath);
    expect(countWords()).toBe(1);
  });
});
