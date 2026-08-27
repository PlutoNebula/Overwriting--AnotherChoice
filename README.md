# 覆写：故事新编（OVERWRITING）

西幻风格的沉浸式读书批注与 AI 剧情覆写应用。读者在原文上留下四类「铭文」和「读者终章」，可以从任意选中位置让 AI 改写后续剧情、生长出分支，最终契名生成署有原作者与读者名字的个人版本。

前端以浏览器 localStorage 为主态，后端（FastAPI + MySQL）作为按用户隔离的持久化副本。

---

## 功能

- **开场动画**：羽毛笔绘制 / 书页放大入场（React，`?autoplay=1` 自动播放）。
- **首次署名 → 秘典书库**：内置三本示例藏书。
- **阅读器**：章节/段落、翻页、朗读（TTS）、选字批注、分支切换。
- **四类铭文**：回响（共鸣）/ 诘问（质疑）/ 星链（联结）/ 续章（续写），锚定原文选区。
- **读者终章**：≥50 字的读后回应，与四类铭文共同构成契名条件。
- **契名仪式 → 个人秘典**：署上读者名字的版本。
- **AI 剧情覆写**：从章节结尾 / 选中原文 / 续章铭文 / 已有分支继续改写，生成平行分支。
- **分支管理**：分支树切换、删除；删除父分支时子分支提升（reparent，非级联）。
- **分用户存储**：多用户可各自独立持有同名书（如内置示例书），内容按 `user_id` 隔离。
- **原文拆章**：导入 TXT 时按「第X章」正则自动拆分为章节入库。

---

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | FastAPI · SQLModel · MySQL 8.0（pymysql）· LangGraph + DeepSeek（AI 覆写） |
| 前端 | Vite · 原生 JavaScript（无框架）· React（仅开场动画层） |
| 运行时 | Python 3.12 · uv · Node.js |

---

## 目录结构

```
backend/
  main.py          # FastAPI 路由与接口
  db.py            # SQLModel 模型 + engine/session + 建库建表
  library.py       # 业务持久化函数（upsert / delete / list / reparent）
literary_agent/
  chapters.py      # 按「第X章」正则拆章 split_chapters
  overwrite.py     # 剧情覆写流水线（classify → 改世界书 → 改写 → review）
  config.py        # 配置（DeepSeek / MySQL / 路径）
  …                # LangGraph 解读流水线（load/chunk/analyze/assemble/review/write）
frontend/
  public/legacy/js/   # 原生 JS：app/library/reader/overwrite/finale/ceremony/store/data/…
  public/legacy/css/  # 样式
  src/                # React 开场动画（IntroScene）
inputs/            # 导入的原文 txt
works/             # 解读产物（旧流水线落盘目录）
```

---

## 快速开始

### 1. 环境准备

- Python 3.12（用 `uv` 管理依赖）
- MySQL 8.0（本地实例）
- Node.js（前端）

### 2. 后端

```bash
# 复制并编辑 .env（填 DeepSeek Key 与 MySQL 密码）
cp .env.example .env

# 安装依赖
uv sync

# 启动（自动建库 overwriting 并建表）
uv run uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

后端启动后会自动执行 `CREATE DATABASE IF NOT EXISTS overwriting` 并 `create_all` 建表。MySQL 未就绪或密码未配置时只告警、不阻断既有接口。

### 3. 前端

```bash
cd frontend
npm install
npm run dev
```

打开终端提示的本地地址（默认 `http://localhost:5173`）。前端通过 `OW.Api`（`overwrite.js` 中的 `API` 常量，默认 `http://127.0.0.1:8000`）调用后端，可用 `window.OW_API_BASE` 或 `<html data-api>` 覆盖。

---

## 配置项（`.env`）

| 配置 | 默认 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | — | DeepSeek API Key |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | OpenAI 兼容端口 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 模型名 |
| `MYSQL_HOST` | `127.0.0.1` | MySQL 地址 |
| `MYSQL_PORT` | `3306` | 端口 |
| `MYSQL_USER` | `root` | 用户 |
| `MYSQL_PASSWORD` | — | 密码 |
| `MYSQL_DATABASE` | `overwriting` | 库名 |

---

## 数据库设计

库名 `overwriting`，UTF-8（utf8mb4）。六张表：

### 核心约定

- **分用户**：`book` 用代理主键 `pk`（自增）+ `(user_id, id)` 唯一约束，因此**多用户可以各自持有同一 `book_id`**（例如内置示例书 `b-lamp`）。
- **分支/铭文归属**：`branch` / `inscription` 通过 `book_pk` 外键指向某本书，不再单独存 `user_id`（用户由所属书籍决定）。

### 表结构

| 表 | 关键字段 | 说明 |
|----|---------|------|
| `book` | `pk`(自增 PK) · `user_id` · `id`(book_id) · `title` · `author` · `sub` · `finale` | `(user_id, id)` 唯一；书 + 终章 |
| `chapter` | `id`(自增 PK) · `book_pk`(FK→book.pk) · `idx` · `title` | `(book_pk, idx)` 唯一 |
| `paragraph` | `id`(自增 PK) · `chapter_id`(FK→chapter.id) · `idx` · `text` | `(chapter_id, idx)` 唯一 |
| `branch` | `id`(分支id PK) · `book_pk`(FK→book.pk) · `parent_id`(自引用, RESTRICT) · `no` · `title` · `narrative` · `status` · `origin_json` · `form_json` · `result_json` · `changes_json` · `conflicts_json` · `next_directions_json` · `demo` · `edited_by_reader` · `pending` · `at` | 分支（改写文）；`parent_id=null` 表示承接原作 |
| `branch_chapter` | `id`(自增 PK) · `branch_id`(FK→branch.id) · `ch_idx` · `narrative` · `summary` · `title` · `demo` | `(branch_id, ch_idx)` 唯一；分支逐章正文 |
| `inscription` | `id`(铭文id PK) · `book_pk`(FK→book.pk) · `branch_id`(可空) · `kind` · `ch` · `para` · `s` · `e` · `quote` · `body` · `at` | 铭文；`branch_id=null` 为原文铭文，否则为分支铭文 |

### 关键语义

- **删除父分支**：`delete_branch` 先把子分支的 `parent_id` 改指向被删分支的父分支，再删自身（`parent_id` 外键为 `RESTRICT`，防止误级联）。
- **删除书**：先解除分支间 `parent_id` 引用，再删书，其余（章节/段落/分支/铭文）由外键 `CASCADE` 与 ORM `cascade_delete` 级联清理。

---

## API 接口

除 `/health` 外，书籍/分支/铭文接口都带 `?user_id=` 查询参数（默认 `guest`）做用户隔离。

| Method | Path | 说明 |
|--------|------|------|
| GET | `/health` | 健康检查 |
| POST | `/api/import?user_id=` | 上传 txt，按「第X章」拆章并入库，返回 `chapters` |
| PUT | `/api/books/{book_id}?user_id=` | 保存/更新一本书（含 `finale` 与结构化 `chapters`） |
| GET | `/api/books/{book_id}?user_id=` | 读取一本书 |
| DELETE | `/api/books/{book_id}?user_id=` | 删除一本书（级联清分支/铭文/章节） |
| PUT | `/api/books/{book_id}/branches/{branch_id}?user_id=` | 保存/更新一条分支 |
| DELETE | `/api/books/{book_id}/branches/{branch_id}?user_id=` | 删除分支（reparent） |
| GET | `/api/books/{book_id}/branches?user_id=` | 列出该书分支 |
| PUT | `/api/books/{book_id}/inscriptions/{ins_id}?user_id=` | 保存/更新一条铭文 |
| DELETE | `/api/books/{book_id}/inscriptions/{ins_id}?user_id=` | 删除一条铭文 |
| GET | `/api/books/{book_id}/inscriptions?user_id=` | 列出该书铭文 |
| POST | `/api/overwrite` | AI 覆写：起点章一次性推演（classify → 改世界书 → 改写 → review） |
| POST | `/api/overwrite/chapter` | AI 覆写：全书顺序改写，逐章调用 |
| POST | `/api/generate` | 旧版：文学解读流水线（load→chunk→analyze→assemble→review→write） |
| GET | `/api/works` | 旧版：列出已生成作品目录 |
| GET | `/api/works/{work_id}` | 旧版：读取已生成作品内容 |

交互式文档：`http://127.0.0.1:8000/docs`（Swagger UI）。

---

## 前端说明

- **数据主态**：浏览器 localStorage（`OW.Store`），后端是「尽力而为」的持久化副本——保存/删除 fire-and-forget，失败只 toast 提示、不回滚本地。
- **用户标识**：`OW.Api.userId()` 返回 `OW.Store.get().reader`（读者署名），未署名时 `guest`；所有请求拼 `?user_id=`。
- **后端地址**：`frontend/public/legacy/js/overwrite.js` 的 `API` 常量（默认 `http://127.0.0.1:8000`）。
- **拆章**：前端「导入 TXT」直接上传到后端 `/api/import`，由后端按「第X章」拆章，前端用返回的 `chapters` 建书。
- **分支铭文隔离**：内联标记与右侧铭文面板都按当前分支隔离——读原作只见原文铭文，读某分支只见该分支铭文。

---

## 旧版文学解读（LangGraph 流水线）

仓库保留了最初的「中短篇文学作品解读 Agent」：输入一篇 txt/md，经 LangGraph 流水线产出 **剧本摘要 / 人物信息（SillyTavern 角色卡）/ 世界书（World Info）**，落盘到 `works/<作品名>/`。入口为 `run.py`（CLI）与 `POST /api/generate`。当前主界面（书库/阅读器/覆写）不依赖它。
