# 日语单词练习 Web 应用 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个单用户、部署到 VPS 的 Next.js + SQLite 日语单词练习应用,支持 4 向答题(汉字↔假名、日↔中)和方向独立的错题本。

**Architecture:** Next.js 14 App Router 同时承载 UI 和 API routes; `better-sqlite3` 直接读写挂载到 volume 的单文件数据库; 首次启动脚本从 CSV seed 词库; 密码验证通过 HMAC 签名的 httpOnly cookie 实现; 全部打包为单个 Docker 容器部署。

**Tech Stack:** Next.js 14 (App Router, TypeScript), React 18, better-sqlite3, Vitest, tsx, Node 20, Docker。

**参考 Spec:** `docs/superpowers/specs/2026-04-19-japanese-vocab-quiz-design.md`

---

## 设计修订(相对原 Spec)

原 Spec 只定义了两个方向(`jp_to_cn`/`cn_to_jp`)。本计划扩展为 **4 个练习方向**:

| 方向标识 | 显示(题目) | 用户输入(答案) | 匹配字段 |
|---|---|---|---|
| `kanji_to_kana` | `japanese`(食べる) | `kana`(たべる) | `words.kana` |
| `kana_to_kanji` | `kana`(たべる) | `japanese`(食べる) | `words.japanese` |
| `jp_to_cn` | `japanese`(食べる) | `chinese`(吃) | `words.chinese` |
| `cn_to_jp` | `chinese`(吃) | `japanese`(食べる) | `words.japanese` |
| `mixed` | 随机四选一 | — | 按上面映射 |

**边界处理:**
- `kana_to_kanji` / `kanji_to_kana`: 抽题时自动跳过 `kana IS NULL` 的词
- `mixed`: 每题从该词有效的方向中随机选一个

---

## 文件总览

| 路径 | 责任 |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.js`, `vitest.config.ts` | 项目配置 |
| `.gitignore`, `.dockerignore`, `.env.example` | 忽略规则与示例 |
| `seed/words.csv` | 词库源(示例) |
| `src/lib/db.ts` | SQLite 连接单例 + schema DDL + 首次建表 |
| `src/lib/match.ts` | 严格匹配判定(trim + 完全相等) |
| `src/lib/wrongbook.ts` | 错题本状态机纯函数 |
| `src/lib/auth.ts` | HMAC cookie 签名 / 验证 |
| `src/lib/queries.ts` | 所有 SQL 查询封装(含 kana 过滤查询) |
| `src/scripts/seed.ts` | 启动时从 CSV 导入词库 |
| `src/middleware.ts` | 未登录拦截 |
| `src/app/layout.tsx` | 全局布局 |
| `src/app/globals.css` | 全局样式 |
| `src/app/page.tsx` | 首页(统计 + 4 向练习入口) |
| `src/app/login/page.tsx` | 登录页 |
| `src/app/practice/page.tsx` | 答题页(4 方向) |
| `src/app/api/login/route.ts` | 登录 API |
| `src/app/api/stats/route.ts` | 首页统计 API |
| `src/app/api/session/route.ts` | 抽题 API(4 方向 + kana 过滤) |
| `src/app/api/answer/route.ts` | 提交答案 API(4 方向匹配) |
| `Dockerfile`、`docker-compose.yml` | 部署 |
| `tests/*.test.ts` | 单元 + 集成测试 |

---

### Task 1: 项目脚手架与配置

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.js`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `.dockerignore`
- Create: `.env.example`

- [ ] **Step 1: 创建 `package.json`**

```json
{
  "name": "nihon-class",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "node src/scripts/seed.js && npx next start -p ${PORT:-3000}",
    "seed": "tsx src/scripts/seed.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "better-sqlite3": "11.1.2"
  },
  "devDependencies": {
    "@types/better-sqlite3": "7.6.10",
    "@types/node": "20.14.10",
    "@types/react": "18.3.3",
    "@types/react-dom": "18.3.0",
    "typescript": "5.5.3",
    "tsx": "4.16.2",
    "vitest": "2.0.3"
  }
}
```

- [ ] **Step 2: 创建 `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "src/**/*.ts", "src/**/*.tsx", "tests/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 3: 创建 `next.config.js`**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ['better-sqlite3'] },
};
module.exports = nextConfig;
```

- [ ] **Step 4: 创建 `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
```

- [ ] **Step 5: 创建 `.gitignore`**

```
node_modules/
.next/
out/
*.tsbuildinfo
next-env.d.ts
data/
.env
.env.local
```

- [ ] **Step 6: 创建 `.dockerignore`**

```
node_modules
.next
data
.git
tests
docs
*.md
.env
.env.local
```

- [ ] **Step 7: 创建 `.env.example`**

```
APP_PASSWORD=change-me
AUTH_SECRET=replace-with-64-random-chars
DB_PATH=/data/app.sqlite
SEED_CSV=./seed/words.csv
PORT=3000
```

- [ ] **Step 8: 安装依赖**

Run: `npm install`
Expected: 生成 `node_modules/` 与 `package-lock.json`,无 peer warning 中断。

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.js vitest.config.ts .gitignore .dockerignore .env.example
git commit -m "chore: 初始化 Next.js + Vitest 项目脚手架"
```

---

### Task 2: SQLite 连接单例与建表

**Files:**
- Create: `src/lib/db.ts`
- Test: `tests/db.test.ts`

- [ ] **Step 1: 写测试 `tests/db.test.ts`**

```ts
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
    expect(tables.map((t) => t.name)).toEqual(['words', 'wrong_book']);
  });

  it('returns the same instance on subsequent calls', () => {
    expect(getDb()).toBe(getDb());
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npm test -- tests/db.test.ts`
Expected: FAIL — `Cannot find module '@/lib/db'`

- [ ] **Step 3: 实现 `src/lib/db.ts`**

```ts
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
```

注意: `direction` 的 CHECK 约束已包含 4 个方向值。

- [ ] **Step 4: 运行测试,确认通过**

Run: `npm test -- tests/db.test.ts`
Expected: 两个测试全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/db.ts tests/db.test.ts
git commit -m "feat(db): 新增 SQLite 连接单例并自动建表(4方向)"
```

---

### Task 3: 严格匹配函数

**Files:**
- Create: `src/lib/match.ts`
- Test: `tests/match.test.ts`

- [ ] **Step 1: 写测试 `tests/match.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { isMatch } from '@/lib/match';

describe('isMatch', () => {
  it('returns true for identical strings', () => {
    expect(isMatch('吃', '吃')).toBe(true);
  });

  it('trims leading and trailing whitespace', () => {
    expect(isMatch('  吃 ', '吃')).toBe(true);
  });

  it('returns false for partial match', () => {
    expect(isMatch('吃', '吃饭')).toBe(false);
  });

  it('is case sensitive (English ascii)', () => {
    expect(isMatch('Apple', 'apple')).toBe(false);
  });

  it('handles Japanese characters correctly', () => {
    expect(isMatch('食べる', '食べる')).toBe(true);
    expect(isMatch('たべる', '食べる')).toBe(false);
  });

  it('empty user input is never a match', () => {
    expect(isMatch('', '吃')).toBe(false);
    expect(isMatch('   ', '吃')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npm test -- tests/match.test.ts`
Expected: FAIL — `Cannot find module '@/lib/match'`

- [ ] **Step 3: 实现 `src/lib/match.ts`**

```ts
export function isMatch(userAnswer: string, expected: string): boolean {
  const trimmed = userAnswer.trim();
  if (trimmed.length === 0) return false;
  return trimmed === expected;
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npm test -- tests/match.test.ts`
Expected: 全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/match.ts tests/match.test.ts
git commit -m "feat(match): 新增严格匹配判定"
```

---

### Task 4: 错题本状态机

**Files:**
- Create: `src/lib/wrongbook.ts`
- Test: `tests/wrongbook.test.ts`

- [ ] **Step 1: 写测试 `tests/wrongbook.test.ts`**

```ts
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
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npm test -- tests/wrongbook.test.ts`
Expected: FAIL — `Cannot find module '@/lib/wrongbook'`

- [ ] **Step 3: 实现 `src/lib/wrongbook.ts`**

```ts
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
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npm test -- tests/wrongbook.test.ts`
Expected: 7 个测试全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/wrongbook.ts tests/wrongbook.test.ts
git commit -m "feat(wrongbook): 新增错题本状态机(4方向独立追踪)"
```

---

### Task 5: HMAC 认证工具

**Files:**
- Create: `src/lib/auth.ts`
- Test: `tests/auth.test.ts`

- [ ] **Step 1: 写测试 `tests/auth.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { signToken, verifyToken } from '@/lib/auth';

describe('auth', () => {
  beforeAll(() => {
    process.env.AUTH_SECRET = 'test-secret-do-not-use-in-prod-0123456789';
  });

  it('sign then verify returns true within ttl', () => {
    const token = signToken(Date.now() + 60_000);
    expect(verifyToken(token)).toBe(true);
  });

  it('expired token fails verification', () => {
    const token = signToken(Date.now() - 1000);
    expect(verifyToken(token)).toBe(false);
  });

  it('tampered token fails verification', () => {
    const token = signToken(Date.now() + 60_000);
    const tampered = token.split('.')[0] + '.AAAA';
    expect(verifyToken(tampered)).toBe(false);
  });

  it('malformed token fails verification', () => {
    expect(verifyToken('not-a-token')).toBe(false);
    expect(verifyToken('')).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npm test -- tests/auth.test.ts`
Expected: FAIL — `Cannot find module '@/lib/auth'`

- [ ] **Step 3: 实现 `src/lib/auth.ts`**

```ts
import crypto from 'node:crypto';

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('AUTH_SECRET must be set to at least 16 chars');
  }
  return secret;
}

function hmac(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('base64url');
}

export function signToken(expiresAtMs: number): string {
  const payload = String(expiresAtMs);
  const sig = hmac(payload);
  return `${payload}.${sig}`;
}

export function verifyToken(token: string): boolean {
  if (!token || !token.includes('.')) return false;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  const expected = hmac(payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  if (!crypto.timingSafeEqual(a, b)) return false;
  const exp = Number(payload);
  if (!Number.isFinite(exp)) return false;
  return Date.now() < exp;
}

export function verifyPassword(given: string): boolean {
  const expected = process.env.APP_PASSWORD ?? '';
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export const COOKIE_NAME = 'auth_token';
export const COOKIE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npm test -- tests/auth.test.ts`
Expected: 4 个测试全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/auth.ts tests/auth.test.ts
git commit -m "feat(auth): 新增 HMAC token 签名/验证"
```

---

### Task 6: 查询封装

**Files:**
- Create: `src/lib/queries.ts`
- Test: `tests/queries.test.ts`

- [ ] **Step 1: 写测试 `tests/queries.test.ts`**

```ts
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
import type { Direction } from '@/lib/wrongbook';

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
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npm test -- tests/queries.test.ts`
Expected: FAIL — `Cannot find module '@/lib/queries'`

- [ ] **Step 3: 实现 `src/lib/queries.ts`**

```ts
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
  const rows = db.prepare('SELECT id FROM words WHERE kana IS NOT NULL AND kana != ? ORDER BY id')
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
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npm test -- tests/queries.test.ts`
Expected: 7 个测试全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/queries.ts tests/queries.test.ts
git commit -m "feat(queries): 封装 words/wrong_book 查询(含 kana 过滤)"
```

---

### Task 7: CSV Seed 脚本

**Files:**
- Create: `seed/words.csv`
- Create: `src/scripts/seed.ts`
- Test: `tests/seed.test.ts`

- [ ] **Step 1: 创建示例 `seed/words.csv`**

```csv
japanese,kana,chinese,group_key
食べる,たべる,吃,た行
飲む,のむ,喝,な行
学校,がっこう,学校,か行
本,ほん,书,は行
水,みず,水,ま行
ありがとう,,谢谢,あ行
```

注意: 最后一行 `ありがとう` 没有 kana,用于测试 kana 为空的情况。

- [ ] **Step 2: 写测试 `tests/seed.test.ts`**

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { getDb, closeDb } from '@/lib/db';
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
```

- [ ] **Step 3: 运行测试,确认失败**

Run: `npm test -- tests/seed.test.ts`
Expected: FAIL — `Cannot find module '@/scripts/seed'`

- [ ] **Step 4: 实现 `src/scripts/seed.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import { getDb } from '@/lib/db';
import { countWords, insertWord } from '@/lib/queries';

function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ',') {
      out.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

export function runSeed(csvPath: string): void {
  if (!fs.existsSync(csvPath)) {
    throw new Error(`seed CSV not found: ${csvPath}`);
  }
  if (countWords() > 0) {
    console.log('[seed] words table already populated, skipping.');
    return;
  }
  const text = fs.readFileSync(csvPath, 'utf-8');
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV has no data rows');
  }
  const header = parseCsvLine(lines[0]).map((h) => h.trim());
  const iJp = header.indexOf('japanese');
  const iKana = header.indexOf('kana');
  const iCn = header.indexOf('chinese');
  const iGroup = header.indexOf('group_key');
  if (iJp < 0 || iCn < 0) {
    throw new Error('CSV header must contain japanese and chinese columns');
  }

  const db = getDb();
  const tx = db.transaction((rows: string[][]) => {
    rows.forEach((cols, idx) => {
      const japanese = (cols[iJp] ?? '').trim();
      const chinese = (cols[iCn] ?? '').trim();
      if (!japanese) throw new Error(`row ${idx + 2}: japanese is empty`);
      if (!chinese) throw new Error(`row ${idx + 2}: chinese is empty`);
      const kanaRaw = iKana >= 0 ? (cols[iKana] ?? '').trim() : '';
      insertWord({
        japanese,
        kana: kanaRaw || null,
        chinese,
        group_key: iGroup >= 0 ? (cols[iGroup] ?? '').trim() || null : null,
      });
    });
  });
  const dataRows = lines.slice(1).map(parseCsvLine);
  tx(dataRows);
  console.log(`[seed] imported ${dataRows.length} words`);
}

if (require.main === module) {
  const csvPath = process.env.SEED_CSV ?? path.resolve('./seed/words.csv');
  runSeed(csvPath);
}
```

- [ ] **Step 5: 运行测试,确认通过**

Run: `npm test -- tests/seed.test.ts`
Expected: 4 个测试全部 PASS

- [ ] **Step 6: Commit**

```bash
git add seed/words.csv src/scripts/seed.ts tests/seed.test.ts
git commit -m "feat(seed): 新增首次启动 CSV 导入脚本"
```

---

### Task 8: 登录 API 路由

**Files:**
- Create: `src/app/api/login/route.ts`
- Test: `tests/api.login.test.ts`

- [ ] **Step 1: 写测试 `tests/api.login.test.ts`**

```ts
import { describe, it, expect, beforeAll } from 'vitest';
import { POST } from '@/app/api/login/route';

describe('POST /api/login', () => {
  beforeAll(() => {
    process.env.APP_PASSWORD = 'secret123';
    process.env.AUTH_SECRET = 'test-secret-12345678901234567890';
  });

  function buildReq(body: unknown): Request {
    return new Request('http://localhost/api/login', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('returns 200 and sets cookie on correct password', async () => {
    const res = await POST(buildReq({ password: 'secret123' }));
    expect(res.status).toBe(200);
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/auth_token=/);
    expect(setCookie).toMatch(/HttpOnly/i);
  });

  it('returns 401 on wrong password', async () => {
    const res = await POST(buildReq({ password: 'nope' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 on malformed body', async () => {
    const res = await POST(buildReq({}));
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npm test -- tests/api.login.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/login/route'`

- [ ] **Step 3: 实现 `src/app/api/login/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { signToken, verifyPassword, COOKIE_NAME, COOKIE_TTL_MS } from '@/lib/auth';

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  if (
    !body ||
    typeof body !== 'object' ||
    typeof (body as { password?: unknown }).password !== 'string'
  ) {
    return NextResponse.json({ error: 'password required' }, { status: 400 });
  }
  const { password } = body as { password: string };
  if (!verifyPassword(password)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const expiresAt = Date.now() + COOKIE_TTL_MS;
  const token = signToken(expiresAt);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(expiresAt),
  });
  return res;
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npm test -- tests/api.login.test.ts`
Expected: 3 个测试全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/login/route.ts tests/api.login.test.ts
git commit -m "feat(api): 新增 /api/login 路由"
```

---

### Task 9: 认证中间件

**Files:**
- Create: `src/middleware.ts`

- [ ] **Step 1: 实现 `src/middleware.ts`**

```ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, COOKIE_NAME } from '@/lib/auth';

export const config = {
  matcher: ['/((?!_next|favicon.ico|login|api/login).*)'],
};

export function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (token && verifyToken(token)) {
    return NextResponse.next();
  }
  if (req.nextUrl.pathname.startsWith('/api')) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const loginUrl = new URL('/login', req.url);
  return NextResponse.redirect(loginUrl);
}
```

- [ ] **Step 2: Commit**

中间件需在 Next.js 运行时环境中执行,留到 Task 16 Docker 启动时手测。

```bash
git add src/middleware.ts
git commit -m "feat(auth): 新增认证中间件保护所有页面/API"
```

---

### Task 10: 统计 API 路由

**Files:**
- Create: `src/app/api/stats/route.ts`
- Test: `tests/api.stats.test.ts`

- [ ] **Step 1: 写测试 `tests/api.stats.test.ts`**

```ts
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
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npm test -- tests/api.stats.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/stats/route'`

- [ ] **Step 3: 实现 `src/app/api/stats/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { countWords } from '@/lib/queries';
import { getWrongBookCount } from '@/lib/wrongbook';

export async function GET() {
  return NextResponse.json({
    totalWords: countWords(),
    wrongBookCount: getWrongBookCount(),
  });
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npm test -- tests/api.stats.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/stats/route.ts tests/api.stats.test.ts
git commit -m "feat(api): 新增 /api/stats 路由"
```

---

### Task 11: 抽题 API 路由(4方向)

**Files:**
- Create: `src/app/api/session/route.ts`
- Test: `tests/api.session.test.ts`

这是本次修订的核心改动之一。抽题逻辑需要支持 4 个方向，并在 kana 相关方向跳过无 kana 的词。

- [ ] **Step 1: 写测试 `tests/api.session.test.ts`**

```ts
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
    // mixed should produce at least one direction type (random)
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

    // 2 words with kana, 2 without
    insertWord({ japanese: '食べる', kana: 'たべる', chinese: '吃', group_key: null });
    insertWord({ japanese: '飲む', kana: 'のむ', chinese: '喝', group_key: null });
    insertWord({ japanese: 'ありがとう', kana: null, chinese: '谢谢', group_key: null });
    insertWord({ japanese: 'これ', kana: null, chinese: '这个', group_key: null });

    const res = await GET(req('source=all&direction=kana_to_kanji&size=10'));
    const json = await res.json();
    expect(json.questions).toHaveLength(2); // only 2 eligible
    json.questions.forEach((q: { wordId: number }) => {
      expect([1, 2]).toContain(q.wordId);
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
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npm test -- tests/api.session.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/session/route'`

- [ ] **Step 3: 实现 `src/app/api/session/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getAllWordIds, getKanaWordIds, getWrongBookWordIds, getWordById } from '@/lib/queries';
import type { Direction } from '@/lib/wrongbook';

type Source = 'all' | 'wrong';
type DirectionParam = Direction | 'mixed';

interface Question {
  wordId: number;
  prompt: string;
  direction: Direction;
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const ALL_DIRECTIONS: Direction[] = ['kanji_to_kana', 'kana_to_kanji', 'jp_to_cn', 'cn_to_jp'];

function pickDirection(dp: DirectionParam): Direction {
  if (dp === 'mixed') {
    return ALL_DIRECTIONS[Math.floor(Math.random() * ALL_DIRECTIONS.length)];
  }
  return dp;
}

function promptFor(
  word: { japanese: string; kana: string | null; chinese: string },
  d: Direction,
): string {
  switch (d) {
    case 'kanji_to_kana':
      return word.japanese;
    case 'kana_to_kanji':
      return word.kana!;
    case 'jp_to_cn':
      return word.japanese;
    case 'cn_to_jp':
      return word.chinese;
  }
}

const VALID_DIRECTIONS = ['kanji_to_kana', 'kana_to_kanji', 'jp_to_cn', 'cn_to_jp', 'mixed'] as const;
const KANA_REQUIRED: Set<Direction> = new Set(['kanji_to_kana', 'kana_to_kanji']);

export async function GET(req: Request) {
  const url = new URL(req.url);
  const source = url.searchParams.get('source') as Source | null;
  const direction = url.searchParams.get('direction') as DirectionParam | null;
  const sizeRaw = url.searchParams.get('size');

  if (source !== 'all' && source !== 'wrong') {
    return NextResponse.json({ error: 'invalid source' }, { status: 400 });
  }
  if (!(VALID_DIRECTIONS as readonly string[]).includes(direction ?? '')) {
    return NextResponse.json({ error: 'invalid direction' }, { status: 400 });
  }
  if (sizeRaw !== 'all' && (!sizeRaw || !/^\d+$/.test(sizeRaw))) {
    return NextResponse.json({ error: 'invalid size' }, { status: 400 });
  }

  let ids: number[];
  if (source === 'all') {
    if (direction !== 'mixed' && KANA_REQUIRED.has(direction)) {
      ids = getKanaWordIds();
    } else {
      ids = getAllWordIds();
    }
  } else {
    const filter: Direction | 'all' = direction === 'mixed' ? 'all' : direction;
    ids = getWrongBookWordIds(filter);
  }

  const shuffled = shuffle(ids);
  const size = sizeRaw === 'all' ? shuffled.length : Math.min(Number(sizeRaw), shuffled.length);
  const picked = shuffled.slice(0, size);

  const questions: Question[] = [];
  for (const id of picked) {
    const word = getWordById(id);
    if (!word) continue;

    let d: Direction;
    if (direction === 'mixed') {
      // Pick from directions valid for this word
      const validDirs = ALL_DIRECTIONS.filter(
        (dir) => !KANA_REQUIRED.has(dir) || (word.kana && word.kana.length > 0),
      );
      if (validDirs.length === 0) continue;
      d = validDirs[Math.floor(Math.random() * validDirs.length)];
    } else {
      d = direction;
    }

    questions.push({
      wordId: word.id,
      prompt: promptFor(word, d),
      direction: d,
    });
  }

  return NextResponse.json({ questions });
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npm test -- tests/api.session.test.ts`
Expected: 8 个测试全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/session/route.ts tests/api.session.test.ts
git commit -m "feat(api): 新增 /api/session 抽题路由(4方向+kana过滤)"
```

---

### Task 12: 答题 API 路由(4方向)

**Files:**
- Create: `src/app/api/answer/route.ts`
- Test: `tests/api.answer.test.ts`

- [ ] **Step 1: 写测试 `tests/api.answer.test.ts`**

```ts
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
    wordId = insertWord({ japanese: '食べる', kana: 'たべる', chinese: '吃', group_key: null });
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
```

- [ ] **Step 2: 运行测试,确认失败**

Run: `npm test -- tests/api.answer.test.ts`
Expected: FAIL — `Cannot find module '@/app/api/answer/route'`

- [ ] **Step 3: 实现 `src/app/api/answer/route.ts`**

```ts
import { NextResponse } from 'next/server';
import { getWordById } from '@/lib/queries';
import { applyAnswer, type Direction } from '@/lib/wrongbook';
import { isMatch } from '@/lib/match';

const VALID_DIRECTIONS = ['kanji_to_kana', 'kana_to_kanji', 'jp_to_cn', 'cn_to_jp'] as const;

interface Body {
  wordId: number;
  direction: Direction;
  userAnswer: string;
}

function parseBody(raw: unknown): Body | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.wordId !== 'number') return null;
  if (!(VALID_DIRECTIONS as readonly string[]).includes(r.direction as string)) return null;
  if (typeof r.userAnswer !== 'string') return null;
  return { wordId: r.wordId, direction: r.direction as Direction, userAnswer: r.userAnswer };
}

function getExpected(word: { japanese: string; kana: string | null; chinese: string }, d: Direction): string {
  switch (d) {
    case 'kanji_to_kana':
      return word.kana ?? '';
    case 'kana_to_kanji':
      return word.japanese;
    case 'jp_to_cn':
      return word.chinese;
    case 'cn_to_jp':
      return word.japanese;
  }
}

export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid json' }, { status: 400 });
  }
  const body = parseBody(raw);
  if (!body) {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 });
  }
  const word = getWordById(body.wordId);
  if (!word) {
    return NextResponse.json({ error: 'word not found' }, { status: 404 });
  }
  const expected = getExpected(word, body.direction);
  const correct = isMatch(body.userAnswer, expected);
  const delta = applyAnswer(body.wordId, body.direction, correct);
  return NextResponse.json({ correct, correctAnswer: expected, ...delta });
}
```

- [ ] **Step 4: 运行测试,确认通过**

Run: `npm test -- tests/api.answer.test.ts`
Expected: 8 个测试全部 PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/api/answer/route.ts tests/api.answer.test.ts
git commit -m "feat(api): 新增 /api/answer 路由(4方向匹配)"
```

---

### Task 13: 全局布局与登录页

**Files:**
- Create: `src/app/globals.css`
- Create: `src/app/layout.tsx`
- Create: `src/app/login/page.tsx`

- [ ] **Step 1: 创建 `src/app/globals.css`**

```css
* { box-sizing: border-box; }
html, body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, system-ui, "PingFang SC", "Microsoft YaHei", sans-serif;
  background: #fafafa;
  color: #222;
}
button, input, select {
  font: inherit;
}
.container {
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 16px;
}
.btn {
  display: inline-block;
  padding: 10px 20px;
  border-radius: 8px;
  border: 1px solid #222;
  background: #222;
  color: #fff;
  cursor: pointer;
}
.btn:disabled {
  opacity: .4;
  cursor: not-allowed;
}
.btn.secondary {
  background: #fff;
  color: #222;
}
.input {
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  border: 1px solid #ccc;
  font-size: 18px;
}
.prompt {
  font-size: 42px;
  font-weight: 600;
  text-align: center;
  margin: 40px 0;
}
.feedback-correct { color: #1a7f37; font-size: 20px; }
.feedback-wrong { color: #cf222e; font-size: 20px; }
```

- [ ] **Step 2: 创建 `src/app/layout.tsx`**

```tsx
import './globals.css';

export const metadata = {
  title: '日语单词练习',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <div className="container">{children}</div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: 创建 `src/app/login/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setErr('密码错误');
        return;
      }
      router.push('/');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} style={{ marginTop: 80 }}>
      <h1>登录</h1>
      <input
        type="password"
        className="input"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoFocus
        placeholder="输入密码"
      />
      {err && <p className="feedback-wrong">{err}</p>}
      <button className="btn" type="submit" disabled={loading || !password} style={{ marginTop: 12 }}>
        {loading ? '登录中…' : '登录'}
      </button>
    </form>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css src/app/login/page.tsx
git commit -m "feat(ui): 新增全局布局与登录页"
```

---

### Task 14: 首页(4方向选择)

**Files:**
- Create: `src/app/page.tsx`

- [ ] **Step 1: 实现 `src/app/page.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Source = 'all' | 'wrong';
type Direction = 'kanji_to_kana' | 'kana_to_kanji' | 'jp_to_cn' | 'cn_to_jp' | 'mixed';

interface Stats {
  totalWords: number;
  wrongBookCount: number;
}

export default function HomePage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [source, setSource] = useState<Source>('all');
  const [direction, setDirection] = useState<Direction>('kanji_to_kana');
  const [size, setSize] = useState<string>('20');
  const router = useRouter();

  useEffect(() => {
    fetch('/api/stats')
      .then((r) => (r.ok ? r.json() : null))
      .then(setStats);
  }, []);

  function start() {
    const qs = new URLSearchParams({ source, direction, size });
    router.push(`/practice?${qs.toString()}`);
  }

  const startDisabled =
    !stats ||
    (source === 'all' && stats.totalWords === 0) ||
    (source === 'wrong' && stats.wrongBookCount === 0);

  return (
    <div>
      <h1>日语单词练习</h1>
      <p>
        总词数: <strong>{stats?.totalWords ?? '…'}</strong>
        {' · '}
        错题本: <strong>{stats?.wrongBookCount ?? '…'}</strong>
      </p>

      <h2>练习设置</h2>

      <label style={{ display: 'block', marginBottom: 12 }}>
        题源:{' '}
        <select value={source} onChange={(e) => setSource(e.target.value as Source)}>
          <option value="all">全部词库</option>
          <option value="wrong">仅错题本</option>
        </select>
      </label>

      <label style={{ display: 'block', marginBottom: 12 }}>
        方向:{' '}
        <select
          value={direction}
          onChange={(e) => setDirection(e.target.value as Direction)}
        >
          <option value="kanji_to_kana">汉字 → 假名</option>
          <option value="kana_to_kanji">假名 → 汉字</option>
          <option value="jp_to_cn">日 → 中</option>
          <option value="cn_to_jp">中 → 日</option>
          <option value="mixed">混合</option>
        </select>
      </label>

      <label style={{ display: 'block', marginBottom: 24 }}>
        题量:{' '}
        <select value={size} onChange={(e) => setSize(e.target.value)}>
          <option value="10">10</option>
          <option value="20">20</option>
          <option value="50">50</option>
          <option value="all">全部</option>
        </select>
      </label>

      <button className="btn" onClick={start} disabled={startDisabled}>
        开始练习
      </button>
      {source === 'all' && stats?.totalWords === 0 && (
        <p className="feedback-wrong">词库为空</p>
      )}
      {source === 'wrong' && stats?.wrongBookCount === 0 && (
        <p className="feedback-wrong">错题本为空</p>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(ui): 新增首页与4方向练习配置"
```

---

### Task 15: 答题页(4方向)

**Files:**
- Create: `src/app/practice/page.tsx`

- [ ] **Step 1: 实现 `src/app/practice/page.tsx`**

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

type Direction = 'kanji_to_kana' | 'kana_to_kanji' | 'jp_to_cn' | 'cn_to_jp';

interface Question {
  wordId: number;
  prompt: string;
  direction: Direction;
}

interface AnswerResponse {
  correct: boolean;
  correctAnswer: string;
  addedToWrongBook: boolean;
  removedFromWrongBook: boolean;
}

type Phase = 'loading' | 'answering' | 'reviewing' | 'done';

interface SessionStats {
  correctCount: number;
  added: number;
  removed: number;
}

const PLACEHOLDERS: Record<Direction, string> = {
  kanji_to_kana: '输入假名',
  kana_to_kanji: '输入汉字',
  jp_to_cn: '输入中文',
  cn_to_jp: '输入日文',
};

const LABELS: Record<Direction, string> = {
  kanji_to_kana: '汉字→假名',
  kana_to_kanji: '假名→汉字',
  jp_to_cn: '日→中',
  cn_to_jp: '中→日',
};

export default function PracticePage() {
  const sp = useSearchParams();
  const router = useRouter();
  const query = useMemo(
    () => ({
      source: sp.get('source') ?? 'all',
      direction: sp.get('direction') ?? 'kanji_to_kana',
      size: sp.get('size') ?? '20',
    }),
    [sp],
  );

  const [phase, setPhase] = useState<Phase>('loading');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState('');
  const [lastResult, setLastResult] = useState<AnswerResponse | null>(null);
  const [stats, setStats] = useState<SessionStats>({ correctCount: 0, added: 0, removed: 0 });

  useEffect(() => {
    const qs = new URLSearchParams(query).toString();
    fetch(`/api/session?${qs}`)
      .then((r) => r.json())
      .then((d: { questions: Question[] }) => {
        setQuestions(d.questions);
        setPhase(d.questions.length === 0 ? 'done' : 'answering');
      });
  }, [query]);

  async function submitAnswer(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    const q = questions[index];
    const res = await fetch('/api/answer', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        wordId: q.wordId,
        direction: q.direction,
        userAnswer: input,
      }),
    });
    const data: AnswerResponse = await res.json();
    setLastResult(data);
    setStats((s) => ({
      correctCount: s.correctCount + (data.correct ? 1 : 0),
      added: s.added + (data.addedToWrongBook ? 1 : 0),
      removed: s.removed + (data.removedFromWrongBook ? 1 : 0),
    }));
    setPhase('reviewing');
  }

  function nextQuestion() {
    setInput('');
    setLastResult(null);
    if (index + 1 >= questions.length) {
      setPhase('done');
    } else {
      setIndex(index + 1);
      setPhase('answering');
    }
  }

  useEffect(() => {
    if (phase !== 'reviewing') return;
    function handler(e: KeyboardEvent) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        nextQuestion();
      }
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  if (phase === 'loading') return <p>加载中…</p>;

  if (phase === 'done') {
    return (
      <div>
        <h1>练习结束</h1>
        <p>
          正确: {stats.correctCount} / {questions.length}
        </p>
        <p>本次新增错题: {stats.added}</p>
        <p>本次移出错题: {stats.removed}</p>
        <button className="btn" onClick={() => router.push('/')}>
          返回首页
        </button>
      </div>
    );
  }

  const q = questions[index];

  return (
    <div>
      <p>
        第 {index + 1} / {questions.length} 题{' · '}
        {LABELS[q.direction] ?? q.direction}
      </p>
      <div className="prompt">{q.prompt}</div>

      {phase === 'answering' && (
        <form onSubmit={submitAnswer}>
          <input
            className="input"
            autoFocus
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDERS[q.direction] ?? '输入答案'}
          />
          <button
            className="btn"
            style={{ marginTop: 12 }}
            type="submit"
            disabled={!input.trim()}
          >
            提交
          </button>
        </form>
      )}

      {phase === 'reviewing' && lastResult && (
        <div>
          <p className={lastResult.correct ? 'feedback-correct' : 'feedback-wrong'}>
            {lastResult.correct ? '✓ 正确!' : '✗ 错误'}
          </p>
          {!lastResult.correct && <p>你的答案: {input}</p>}
          <p>正确答案: {lastResult.correctAnswer}</p>
          <button className="btn" onClick={nextQuestion}>
            下一题 (Enter/Space)
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/practice/page.tsx
git commit -m "feat(ui): 新增答题页(4方向+方向标签+智能placeholder)"
```

---

### Task 16: Docker 部署配置

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `tsconfig.seed.json`
- Modify: `package.json` (调整 build/start 脚本)
- Create: `public/.gitkeep`

- [ ] **Step 1: 修改 `package.json` 的 `build` 和 `start` 脚本**

将 `package.json` 中 `scripts.build` 替换为:
```json
"build": "next build && tsc --project tsconfig.seed.json"
```

将 `scripts.start` 替换为:
```json
"start": "node dist-seed/src/scripts/seed.js && npx next start -p ${PORT:-3000}"
```

- [ ] **Step 2: 创建 `tsconfig.seed.json`**

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "moduleResolution": "node",
    "noEmit": false,
    "outDir": "dist-seed",
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["src/scripts/**/*.ts", "src/lib/db.ts", "src/lib/queries.ts", "src/lib/wrongbook.ts"]
}
```

- [ ] **Step 3: 创建 `public/.gitkeep`**

```bash
mkdir -p public
touch public/.gitkeep
```

- [ ] **Step 4: 创建 `Dockerfile`**

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV DB_PATH=/data/app.sqlite
ENV SEED_CSV=/app/seed/words.csv
ENV PORT=3000

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/dist-seed ./dist-seed
COPY --from=builder /app/public ./public
COPY --from=builder /app/seed ./seed

RUN mkdir -p /data
VOLUME ["/data"]
EXPOSE 3000

CMD ["sh", "-c", "node dist-seed/src/scripts/seed.js && npx next start -p ${PORT:-3000}"]
```

- [ ] **Step 5: 创建 `docker-compose.yml`**

```yaml
services:
  app:
    build: .
    ports:
      - "${PORT:-3000}:3000"
    environment:
      APP_PASSWORD: ${APP_PASSWORD}
      AUTH_SECRET: ${AUTH_SECRET}
    volumes:
      - ./data:/data
    restart: unless-stopped
```

- [ ] **Step 6: 构建并本地验证**

```bash
cp .env.example .env
# 编辑 .env,填入 APP_PASSWORD 和 AUTH_SECRET
docker compose build
docker compose up -d
```

Expected:
- `docker compose ps` 显示容器 running
- `curl -i http://localhost:3000/` 返回 307 跳转到 `/login`
- 浏览器访问出现登录页,输入密码后首页显示 `总词数: 6`

- [ ] **Step 7: 手动 E2E 测试清单**

- [ ] 登录页密码错误 → 显示 "密码错误"
- [ ] 登录页密码正确 → 跳转首页,看到 `总词数: 6`
- [ ] 汉字→假名: 选 `全部 / 汉字→假名 / 全部` → 显示日语汉字,输入假名
- [ ] 假名→汉字: 显示假名,输入汉字(应有5题,跳过ありがとう)
- [ ] 日→中: 显示日语,输入中文
- [ ] 中→日: 显示中文,输入日语
- [ ] 混合: 每题方向不同,方向标签正确显示
- [ ] 答对 → ✓ 正确 + Enter 下一题
- [ ] 答错 → ✗ 错误 + 显示正确答案
- [ ] 答完全部 → 结算页
- [ ] 回首页 → 错题本有数据
- [ ] 选 "仅错题本" → 可继续练习错题
- [ ] 同一错题连续答对 2 次 → 从错题本移除
- [ ] 手机浏览器访问 → 正常显示

- [ ] **Step 8: Commit**

```bash
git add Dockerfile docker-compose.yml tsconfig.seed.json package.json public/.gitkeep
git commit -m "feat(deploy): 新增 Docker 部署配置"
```

---

### Task 17: README 与部署指南

**Files:**
- Create: `README.md`

- [ ] **Step 1: 创建 `README.md`**

```markdown
# nihon_class

个人日语单词练习 Web 应用。支持 4 种练习方向:

- **汉字 → 假名**: 看日语汉字,写假名读音
- **假名 → 汉字**: 看假名读音,写汉字
- **日 → 中**: 看日语,写中文意思
- **中 → 日**: 看中文,写日语
- **混合**: 以上四种随机

错题本按方向独立追踪,答错即入,连续答对 2 次自动移出。

## 开发

```bash
npm install
cp .env.example .env            # 填入 APP_PASSWORD 和 AUTH_SECRET
npm run dev
```

访问 `http://localhost:3000`。首次启动会自动从 `seed/words.csv` 导入词库。

## 测试

```bash
npm test
```

## 更换词库

用自己的 CSV 替换 `seed/words.csv`,格式:

```csv
japanese,kana,chinese,group_key
食べる,たべる,吃,た行
```

- `japanese`、`chinese` 必填
- `kana` 可空(纯假名词填写时留空即可,相关方向会自动跳过)
- `group_key` 可选

然后删除数据库重启:

```bash
rm -f data/app.sqlite
npm run dev
```

## 部署到 VPS

```bash
scp -r . user@vps:~/nihon_class
ssh user@vps
cd ~/nihon_class
cp .env.example .env  # 填入真实密码
docker compose up -d --build
```

访问 `http://<vps-ip>:3000`。建议前置 HTTPS 反代。

### 备份

```bash
scp user@vps:~/nihon_class/data/app.sqlite ./backup/app-$(date +%F).sqlite
```
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: 新增 README 与部署指南"
```

---

## Self-Review

**1. Spec coverage**
- 目标与范围(单用户备考工具)→ 全 Task 覆盖 ✓
- 4 个练习方向 + mixed → Task 11, 12, 14, 15 ✓
- kana 为空的词在相关方向自动跳过 → Task 11(mixed 方向过滤), Task 6(getKanaWordIds) ✓
- 错题本按方向独立追踪(答错入,连续 2 次对移出)→ Task 4 ✓
- 系统架构(单容器 + SQLite + volume)→ Task 16 ✓
- 数据模型(words + wrong_book)→ Task 2(含 4 方向 CHECK) ✓
- 答题流程(登录/首页/答题/结算)→ Task 13-15 ✓
- 数据预装(CSV seed)→ Task 7, 16 ✓
- 认证(HMAC + cookie)→ Task 5, 8, 9 ✓
- API 四个端点(含 4 方向匹配逻辑)→ Task 8, 10, 11, 12 ✓
- 错误处理 → Task 14-15 ✓
- 测试(单元 + 集成)→ 每个 Task 含测试步骤 ✓
- 部署(Docker + compose)→ Task 16, 17 ✓

**2. Placeholder scan**
- 所有步骤含具体代码或具体命令,无 TBD/TODO/填入细节 ✓

**3. Type consistency**
- `Direction` 类型在 `wrongbook.ts` 定义为 4 值 ✓
- `queries.ts`、`/api/answer`、`/api/session` 等处统一引用 `Direction` ✓
- `applyAnswer` 返回 `{addedToWrongBook, removedFromWrongBook}` 在 `/api/answer` 展开 ✓
- CSV 字段顺序一致(`japanese,kana,chinese,group_key`) ✓
- 4 个方向值: `kanji_to_kana, kana_to_kanji, jp_to_cn, cn_to_jp` 拼写全局一致 ✓
- `promptFor()` 4 分支全覆盖 ✓
- `getExpected()` 4 分支全覆盖 ✓
- `PLACEHOLDERS` 和 `LABELS` 4 方向全覆盖 ✓
