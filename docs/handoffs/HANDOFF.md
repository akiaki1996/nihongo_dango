# Handoff 文档 — 日语单词练习 Web 应用

> **日期**: 2026-04-26
> **当前分支**: `main` (领先 `origin/main` 1 个 commit)
> **状态**: 测试全部通过, UI 可用

---

## 项目概述

Next.js 14 (App Router) + SQLite (better-sqlite3) 的日语单词练习工具。从零实现，含 4 个练习方向、错题本状态机、HMAC 认证。

- **项目路径**: `/Users/wangqiuyang/nihon_class`
- **技术栈**: Next.js 14, React 18, TypeScript, better-sqlite3, Vitest, Docker
- **Node 版本**: v18.20.8
- **设计风格**: 极简 / Swiss Style，indigo 色系，Noto Sans JP + Noto Serif JP 字体

## 已完成的 17 Tasks

所有 17 个 task 按 TDD 流程完成（test → fail → implement → pass → commit），每个 task 一个独立 commit：

| Task | 内容 | 关键文件 |
|------|------|----------|
| 1 | 项目脚手架 | `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` 等 |
| 2 | SQLite 建表 | `src/lib/db.ts` — words + wrong_book 表 (4 方向 CHECK) |
| 3 | 匹配函数 | `src/lib/match.ts` — `isMatch()` trim + 完全相等 |
| 4 | 错题本状态机 | `src/lib/wrongbook.ts` — streak 0→1→2→remove, 4 方向独立追踪 |
| 5 | HMAC 认证 | `src/lib/auth.ts` — Web Crypto API (Edge Runtime 兼容) |
| 6 | 查询封装 | `src/lib/queries.ts` — `getKanaWordIds()`, `getWrongBookWordIds()` |
| 7 | CSV Seed | `seed/words.csv` (6 个单词), `src/scripts/seed.ts` |
| 8 | 登录 API | `src/app/api/login/route.ts` — POST `/api/login` |
| 9 | 认证中间件 | `src/middleware.ts` — async middleware, Edge Runtime |
| 10 | 统计 API | `src/app/api/stats/route.ts` — GET `/api/stats` |
| 11 | 抽题 API | `src/app/api/session/route.ts` — 4 方向 + mixed, kana 过滤 |
| 12 | 答题 API | `src/app/api/answer/route.ts` — 4 方向 expected, 错题本联动 |
| 13 | 布局与登录页 | `src/app/layout.tsx`, `src/app/login/page.tsx` |
| 14 | 首页 | `src/app/page.tsx` — 5 选项方向选择 |
| 15 | 答题页 | `src/app/practice/page.tsx` — 3 阶段 (answering/reviewing/done) |
| 16 | Docker 部署 | `Dockerfile`, `docker-compose.yml` |
| 17 | README | `README.md` |

## 最后 Commit 的额外工作

最后一个 commit `04da77d` 包含：

1. **UI 重新设计** — 使用 `ui-ux-pro-max` skill，极简风格，indigo 色系
   - `src/app/globals.css` — 完整 CSS 设计令牌（16 个 CSS 变量 + 工具类）
   - `src/app/login/page.tsx` — 居中卡片布局，label + error 状态
   - `src/app/page.tsx` — 双列 stats 卡片，`.field-group` / `.field-label` 表单结构
   - `src/app/practice/page.tsx` — 进度条、方向标签、prompt 大字、review 反馈、done 统计

2. **Edge Runtime 兼容修复**
   - `src/lib/auth.ts` — `node:crypto` → Web Crypto API（HMAC via `crypto.subtle.sign`，常量时间比较手写）
   - `src/middleware.ts` — `async function middleware`
   - `src/app/api/login/route.ts` — `await verifyPassword()` / `await signToken()`
   - `tests/setup.ts` — Node 18 crypto polyfill (`webcrypto` from `node:crypto`)

3. **TypeScript 修复**
   - `src/app/api/session/route.ts` — `searchParams.get()` 返回 `string | null` 的类型收窄

## 运行方式

```bash
# 开发环境
cp .env.example .env   # 然后编辑 APP_PASSWORD 和 AUTH_SECRET
npm install
echo "APP_PASSWORD=yourpw" >> .env
echo "AUTH_SECRET=$(openssl rand -hex 32)" >> .env
npx tsx src/scripts/seed.ts   # 导入 seed/words.csv
npm run dev                    # http://localhost:3000

# 运行测试
npm test   # 50 tests, 10 files, 全部通过
```

`.env` 文件（已存在但 gitignore，当前内容）：
```
APP_PASSWORD=change-me
AUTH_SECRET=replace-with-64-random-chars
DB_PATH=./data/app.sqlite
SEED_CSV=./seed/words.csv
PORT=3000
```

## 关键架构决策

- **4 个练习方向**: `kanji_to_kana` / `kana_to_kanji` / `jp_to_cn` / `cn_to_jp` + `mixed`（随机选有效方向）
- **Kana 过滤**: `kana_to_kanji` 和 `kanji_to_kana` 方向自动跳过 `kana IS NULL` 的词
- **错题本状态机**: 答错入册(streak=0) → 答对一次 streak=1 → 连续答对两次 streak=2 → 移出；答错重置为 0
- **匹配规则**: `isMatch(userAnswer, expected)` — trim + 完全相等
- **认证**: HMAC-SHA256 via Web Crypto API, httpOnly cookie, 30 天有效期
- **Middleware**: Edge Runtime, async, 不保护 `/login` 和 `/api/login`

## 测试覆盖

50 个测试，10 个文件：
- `tests/db.test.ts` (2), `tests/match.test.ts` (6), `tests/wrongbook.test.ts` (7)
- `tests/auth.test.ts` (4), `tests/queries.test.ts` (7)
- `tests/api.login.test.ts` (3), `tests/api.stats.test.ts` (1)
- `tests/api.session.test.ts` (8), `tests/api.answer.test.ts` (8)
- `tests/seed.test.ts` (4)

---

## 遗留 / 待完成工作

### 1. CSV 单词数据 ⚠️ 高优先级
当前 `seed/words.csv` 只有 6 行测试数据。需要真实日语单词数据：
- 格式: `japanese,kana,chinese,group_key`
- 示例行: `食べる,たべる,吃,动词`
- 支持空 kana: `ありがとう,,谢谢,あいさつ`
- 导入命令: `npx tsx src/scripts/seed.ts`

### 2. AUTH_SECRET 安全配置 ⚠️
当前 `.env` 中 `AUTH_SECRET=replace-with-64-random-chars`（太短/不安全）。需要生成真实密钥：
```bash
sed -i '' "s/AUTH_SECRET=.*/AUTH_SECRET=$(openssl rand -hex 32)/" .env
```

### 3. Edge Runtime 限制
`better-sqlite3` 是 C 扩展，无法在 Edge Runtime 运行。当前设计：middleware 走 Edge（auth 用 Web Crypto），API routes 走 Node.js（sqlite3）。如果未来要部署到 Vercel/Edge 平台，需要迁移到 Turso/libsql 或使用 serverless 数据库。

### 4. CI/CD
目前没有 CI 配置。建议添加 GitHub Actions 跑 `npm test` + `npm run typecheck`。

### 5. E2E 测试
设计文档中有 14 项手动测试清单（`docs/superpowers/plans/2026-04-25-japanese-vocab-quiz.md`），尚未自动化。可考虑用 Playwright 写 E2E 测试。

### 6. 环境变量
`DB_PATH=/data/app.sqlite` 是 Docker 容器路径。本地开发需 `DB_PATH=./data/app.sqlite`。当前 `.env` 已设为本地路径。

### 7. 未追踪文件
- `docs/superpowers/plans/2026-04-25-japanese-vocab-quiz.md` — 设计文档，可忽略或添加到 git

---

## Git 状态

```
On branch main
Your branch is ahead of 'origin/main' by 1 commit.
```

最新 commit: `04da77d feat(ui): 重新设计UI + 修复Edge Runtime兼容性`

上一个 commit: `f37fe0e Merge pull request #1`（初始 17 task 的 merge）

`origin/main` 目前指向 `f37fe0e`，本地的 UI 重新设计尚未 push。

---

## 下一步建议

1. 准备真实 CSV 数据 → 重新 seed → 完整功能测试
2. 修 `.env` 中的 AUTH_SECRET
3. 可选: push 当前 commit 到 origin
4. 可选: 加 CI + E2E 测试
