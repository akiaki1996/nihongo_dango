import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getDb, closeDb } from '@/lib/db';

describe('db', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nihon-db-'));
    process.env.DB_PATH = path.join(tmpDir, 'app.sqlite');
  });

  afterEach(() => {
    closeDb();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates words and wrong_book tables on first open', () => {
    const db = getDb();
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
      .all() as { name: string }[];
    const names = tables.map((t) => t.name).filter((n) => n !== 'sqlite_sequence');
    expect(names).toEqual(['words', 'wrong_book']);
  });

  it('returns the same instance on subsequent calls', () => {
    expect(getDb()).toBe(getDb());
  });
});
