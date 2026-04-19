# 日语单词练习 Web 应用 — 设计文档

**日期**: 2026-04-19
**项目代号**: nihon_class

---

## 1. 目标与范围

构建一个供个人备考使用的日语单词练习 Web 应用。用户可在手机和电脑上访问同一 URL,在指定词库范围内进行双向(日→中、中→日)的输入式练习,答错的词自动进入错题本,并在连续答对达阈值后自动移出。

**非目标**
- 多用户系统、账号注册、数据隔离
- 间隔重复(SRS)算法
- PDF 自动解析 / OCR
- 历史答题流水统计
- 选择题、翻卡片等其他题型

## 2. 核心需求

- 单用户,部署到公网 VPS 上,仅本人使用
- 简单密码/令牌做访问控制
- 两种答题方向:日→中、中→日,以及两者混合
- 输入框输入答案,严格完全匹配判定(trim 首尾空格)
- 错题本:答错即入,连续答对 2 次后自动移出
- 两个方向分别记录:同一个词在日→中和中→日是两条独立的错题记录
- 数据库随应用容器一起部署到 VPS,手机和电脑看到同一份数据
- 词库通过 CSV 在开发 / 部署时预装,无前端导入界面

## 3. 系统架构

```
[浏览器(手机/电脑)]  ──►  [VPS: Next.js 容器 :PORT]
                                     │
                                     └── /data/app.sqlite (volume)
```

- 单个 Docker 容器运行 Next.js(同时承载 UI 和 API)
- 对外暴露一个端口,HTTP 直连或由宿主机 / 云厂商层面解决 HTTPS
- SQLite 单文件数据库,文件挂载到宿主机 `./data/` 便于 `scp` 备份
- 环境变量 `APP_PASSWORD`、`AUTH_SECRET` 在容器启动时注入

**选型理由**:单用户场景下,SQLite 读写并发非瓶颈,文件级备份最省事;单容器部署运维最少。

## 4. 数据模型

### `words`
| 字段 | 类型 | 说明 |
|---|---|---|
| `id` | INTEGER PK | 自增 |
| `japanese` | TEXT NOT NULL | 日语词(漢字/假名写法),中→日严格匹配此字段 |
| `kana` | TEXT | 假名读音,仅显示辅助,不参与匹配 |
| `chinese` | TEXT NOT NULL | 中文意思,日→中严格匹配此字段 |
| `group_key` | TEXT | 分组(例 "あ行"),当前未用于过滤 |
| `created_at` | INTEGER | 导入时间(unix ms) |

### `wrong_book`
| 字段 | 类型 | 说明 |
|---|---|---|
| `word_id` | INTEGER | 外键 → `words.id` |
| `direction` | TEXT | `'jp_to_cn'` 或 `'cn_to_jp'` |
| `correct_streak` | INTEGER | 已连续答对次数 |
| `added_at` | INTEGER | 首次进入时间(unix ms) |
| PRIMARY KEY | (word_id, direction) | 两个方向各算一条 |

**关键规则**
1. 答错该 (word_id, direction):upsert 到 `wrong_book`,`correct_streak = 0`
2. 答对在错题本中的 (word_id, direction):`correct_streak += 1`;若 `correct_streak >= 2` 则删除该行
3. 答对不在错题本中的题:不写 `wrong_book`
4. 不建 `attempts` 表,不保留历史流水

## 5. 答题流程

### 页面
- `/login` — 密码输入页
- `/` — 首页:显示总词数、错题本数量,"开始练习"按钮
- `/practice` — 答题页

### 练习配置(在首页触发)
| 选项 | 可选值 |
|---|---|
| 题源 | 全部词库 / 仅错题本 |
| 方向 | 日→中 / 中→日 / 混合(随机) |
| 题量 | 10 / 20 / 50 / 全部 |

### 单题交互
1. 页面顶部显示 `第 N / 总 题`
2. 中央大字显示题目(根据方向:日语词 或 中文释义)
3. 下方输入框,自动聚焦,Enter 提交
4. 提交后立即显示判定结果(✓/✗)+ 正确答案;再按 Enter/Space 进入下一题
5. 全部答完跳转结算页:正确数、新增错题数、移出错题数、返回首页

### 会话状态
所有会话状态(抽得的题目列表、当前进度、每题答案)仅存在前端内存,刷新页面即作废重来。后端不保存 session。

## 6. 数据预装(替代导入功能)

- 开发者(即用户)将 CSV 文件放到项目内 `seed/words.csv`
- 容器启动脚本:
  1. 若 `/data/app.sqlite` 不存在 → 新建库 + 执行 `words` / `wrong_book` 建表 DDL + 从 `seed/words.csv` 批量 INSERT
  2. 若已存在 → 直接启动应用,跳过 seed
- 更换词库方式:手动删除 `/data/app.sqlite` 后重启容器

### CSV 格式(UTF-8,首行 header)
```csv
japanese,kana,chinese,group_key
食べる,たべる,吃,た行
飲む,のむ,喝,な行
```
- `japanese`、`chinese` 必填,缺失则 seed 脚本报错并终止
- `kana`、`group_key` 可空(CSV 中留空即可)

## 7. 认证

- 单一环境变量 `APP_PASSWORD` 存储明文密码
- `POST /api/login` 接收 `{password}`,服务端用常量时间比较
- 通过后下发 httpOnly cookie `auth_token`,值为 HMAC(`AUTH_SECRET`) 签名的 `expiresAt` 时间戳(默认有效期 30 天);属性 `HttpOnly; SameSite=Lax`(若站点走 HTTPS 则追加 `Secure`)
- `src/middleware.ts` 拦截所有非 `/login` 与 `/api/login` 的请求,cookie 无效即 302 到 `/login`
- 不建 session 表,cookie 自验证

## 8. API 接口

| 方法 & 路径 | 作用 | 请求体 / 查询 | 响应 |
|---|---|---|---|
| `POST /api/login` | 校验密码,下发 cookie | `{password}` | `200 {ok:true}` / `401` |
| `GET /api/stats` | 首页统计 | — | `{totalWords, wrongBookCount}` |
| `GET /api/session` | 开始练习,抽题 | query: `source=all\|wrong`、`direction=jp_to_cn\|cn_to_jp\|mixed`、`size=10\|20\|50\|all` | `{questions: [{wordId, prompt, direction}]}` |
| `POST /api/answer` | 提交一题答案 | `{wordId, direction, userAnswer}` | `{correct, correctAnswer, removedFromWrongBook, addedToWrongBook}` |

**约束**
- `GET /api/session` 的返回中不包含正确答案;正确答案在 `POST /api/answer` 的响应里由服务端给出
- 抽题由后端执行:按 `source` 选集合,按 `direction` 决定字段,随机打乱,截取 `size`;混合方向则每题独立随机一个方向
- 严格匹配逻辑位于 `src/lib/match.ts`,仅做 `trim` 后字符串完全相等比较(大小写敏感)

## 9. 项目结构

```
nihon_class/
├── Dockerfile
├── docker-compose.yml
├── package.json
├── next.config.js
├── tsconfig.json
├── seed/
│   └── words.csv
├── src/
│   ├── app/
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── login/page.tsx
│   │   ├── practice/page.tsx
│   │   └── api/
│   │       ├── login/route.ts
│   │       ├── stats/route.ts
│   │       ├── session/route.ts
│   │       └── answer/route.ts
│   ├── lib/
│   │   ├── db.ts              # better-sqlite3 连接单例
│   │   ├── auth.ts            # HMAC 签名 / 验证
│   │   ├── match.ts           # trim + 严格相等
│   │   └── wrongbook.ts       # 错题本状态机
│   ├── middleware.ts
│   └── scripts/
│       └── seed.ts            # 首次启动时导入 CSV
├── tests/
│   ├── match.test.ts
│   ├── wrongbook.test.ts
│   └── api.test.ts
└── data/                      # .gitignore,运行时挂载
    └── app.sqlite
```

## 10. 错误处理

| 场景 | 行为 |
|---|---|
| DB 读写失败 | API 返回 500,写 stderr,前端 toast "操作失败,请重试" |
| 词库为空时开始练习 | 首页按钮置灰,提示 "词库为空" |
| 选 "仅错题本" 但错题本为空 | 按钮置灰,提示 "错题本为空" |
| 前端提交空答案 | 提交按钮置灰,Enter 不触发 |
| cookie 失效 / 无效 | 下次 API 返回 401,前端重定向 `/login` |
| CSV seed 字段缺失 | 启动脚本报错并终止容器(由运维注意到) |

## 11. 测试策略

**单元测试(Vitest)**
- `match.ts`:trim、完全相等、中文 / 日文用例、空字符串边界
- `wrongbook.ts`:答对 streak +1、连续 2 次移出、答错 streak 归零、不在错题本时答对不建行

**集成测试(Next.js API)**
- 登录:正确密码获得 cookie;错误密码 401;无 cookie 访问保护 API 401
- `POST /api/answer`:
  - 答对词库中非错题本词:不写 `wrong_book`
  - 答错:新建 `wrong_book` 行,`correct_streak = 0`
  - 答对错题本中 streak=0 的词:streak → 1,仍在表中
  - 答对错题本中 streak=1 的词:该行被删除
  - 再次答错 streak=1 的词:streak 归零,仍保留

**手动测试**(不写自动化)
- 所有页面 UI 交互、手机端输入法切换、iOS Safari / Android Chrome 兼容性
- 容器启动时的 seed 脚本行为(删库重启)

## 12. 部署

1. 构建镜像:`docker build -t nihon_class .`
2. 首次跑:
   ```bash
   docker run -d \
     -p 3000:3000 \
     -v $(pwd)/data:/data \
     -e APP_PASSWORD=<your-password> \
     -e AUTH_SECRET=<random-64-chars> \
     --name nihon_class \
     nihon_class
   ```
3. 访问 `http://<VPS-IP>:3000`(HTTPS 自行安排)
4. 备份:`scp -r user@vps:~/nihon_class/data ./backup/`

## 13. 后续可选扩展(非本次范围)

- 错题本列表页 `/review`(手动删除某条、调整 streak 阈值)
- 按 `group_key` 过滤练习范围
- 多答案支持(`chinese` 字段以 `|` 分隔多义)
- 间隔重复算法
- iOS / Android PWA 图标

---

**本设计的核心取舍**:严格限定在"单用户备考工具"这一场景,牺牲通用性换取实现简单。SQLite 单文件、无导入 UI、无 session 表、无历史流水,都是这一原则的体现。
