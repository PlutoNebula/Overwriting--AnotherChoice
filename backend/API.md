# 后端接口文档

基于 **FastAPI** 的 REST 接口，对 `literary_agent`（LangGraph + DeepSeek）流水线做封装，提供 **txt 文件导入** 与 **生成内容回传** 两类能力。

## 概述

- **Base URL**：`http://localhost:8000`（默认，可用 `--port` 调整）
- **数据格式**：请求/响应均为 JSON（文件上传用 `multipart/form-data`）
- **编码**：UTF-8

### 启动

```bash
uv run uvicorn backend.main:app --reload --port 8000
# 或
python -m backend.main
```

### 交互式文档

FastAPI 自动生成，可直接在浏览器里调试：

| 文档 | 地址 |
|------|------|
| Swagger UI | `http://localhost:8000/docs` |
| ReDoc | `http://localhost:8000/redoc` |

---

## 通用约定

- 成功响应：HTTP 200，body 为 JSON 对象。
- 失败响应：HTTP 4xx/5xx，body 形如 `{"detail": "错误说明"}`。
- CORS 已对 `*` 放开，方便 `web/` 前端或第三方客户端跨域调用（生产环境请收紧 `allow_origins`）。

---

## 接口列表

### 1. 健康检查

`GET /health`

无参数。用于探活。

**响应示例**

```json
{ "status": "ok" }
```

---

### 2. 导入 txt 文件

`POST /api/import`

把 `.txt` / `.md` 文件存入 `inputs/` 目录，返回后续生成所需的 `filename`。

**请求**：`multipart/form-data`

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | file | 是 | 待导入的文本文件（`.txt` / `.md`） |

**限制**：仅 `.txt` / `.md`；大小 ≤ 10 MB；内容非空。

**响应**

```json
{
  "work_id": "demo",
  "filename": "demo.txt",
  "saved_path": "/abs/path/to/inputs/demo.txt"
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `work_id` | string | 作品标识（文件主名，经清洗） |
| `filename` | string | 存入后的文件名，供 `generate` 使用 |
| `saved_path` | string | 落盘绝对路径 |

**错误**

| 状态码 | 场景 |
|--------|------|
| 400 | 扩展名非 `.txt`/`.md`，或内容为空 |
| 413 | 文件超过 10 MB |

**curl 示例**

```bash
curl -X POST http://localhost:8000/api/import \
  -F "file=@/path/to/作品.txt"
```

---

### 3. 生成内容

`POST /api/generate`

对已导入的文件跑完整 Agent 流水线（load → chunk → analyze → assemble → review → write），同步返回生成的 **剧本摘要 / 人物信息 / 世界书**。

**请求**：`application/json`

```json
{
  "filename": "demo.txt",
  "review": true,
  "model": "deepseek-chat",
  "max_revisions": 2,
  "dry_run": false
}
```

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `filename` | string | — | 必填，`import` 返回的 `filename` |
| `review` | bool | `true` | 是否开启评测回路 |
| `model` | string \| null | `null` | 覆盖模型（默认 `deepseek-chat`） |
| `max_revisions` | int \| null | `null` | 覆盖修订上限（默认 2） |
| `dry_run` | bool | `false` | `true` 走离线 mock，无需 API Key |

> 该接口为**同步**调用，真实 LLM 生成可能耗时数十秒至数分钟，客户端需相应放宽超时。

**响应**

```json
{
  "work_id": "demo",
  "work_name": "demo",
  "status": "done",
  "outputs": {
    "剧本摘要/内容梗概.md": "# 内容梗概\n\n…",
    "剧本摘要/章节摘要.md": "…",
    "剧本摘要/主题分析.md": "…",
    "人物信息/人物总览.md": "…",
    "人物信息/人物关系.md": "…",
    "人物信息/张三.json": "{…chara_card_v2…}",
    "世界书/世界设定.md": "…",
    "世界书/world_info.json": "{…World Info…}"
  },
  "review_passed": true,
  "revision_count": 1,
  "review_history": [
    {
      "通过": true,
      "评分": { "一致性": 5, "完整性": 5, "准确性": 5, "去重": 5, "可读性": 5 },
      "问题清单": [],
      "修订意见": ""
    }
  ],
  "work_dir": "/abs/path/to/works/demo",
  "errors": []
}
```

| 字段 | 类型 | 说明 |
|------|------|------|
| `work_id` | string | 作品标识 |
| `work_name` | string | 作品名 |
| `status` | string | 流水线终态（`done` 等） |
| `outputs` | object | **生成内容**：`{相对路径 → 文件内容}`，见下方「产物结构」 |
| `review_passed` | bool | 评测是否通过 |
| `revision_count` | int | 实际修订次数 |
| `review_history` | array | 每轮评测记录 |
| `work_dir` | string | 落盘目录 |
| `errors` | array | 过程中的警告/错误 |

**错误**

| 状态码 | 场景 |
|--------|------|
| 404 | `filename` 对应文件不存在 |
| 500 | 缺少 `DEEPSEEK_API_KEY`（非 dry_run）等运行错误 |

**curl 示例**

```bash
curl -X POST http://localhost:8000/api/generate \
  -H "Content-Type: application/json" \
  -d '{"filename": "demo.txt", "review": true}'
```

---

### 4. 作品列表

`GET /api/works`

列出已生成的作品目录。

**响应示例**

```json
{
  "works": [
    { "work_id": "demo", "work_dir": "/abs/path/to/works/demo" }
  ]
}
```

---

### 5. 获取作品生成内容

`GET /api/works/{work_id}`

按 `work_id` 回传**已落盘**的生成内容。

**路径参数**

| 参数 | 类型 | 说明 |
|------|------|------|
| `work_id` | string | 作品标识 |

**响应示例**

```json
{
  "work_id": "demo",
  "work_dir": "/abs/path/to/works/demo",
  "files": {
    "剧本摘要/内容梗概.md": "…",
    "人物信息/张三.json": "…",
    "世界书/world_info.json": "…",
    "评测报告.md": "…",
    "_meta.json": "…"
  }
}
```

**错误**：`404` 作品不存在。

---

## 生成产物结构（`outputs` / `files`）

每个作品对应 `works/<作品名>/` 下的目录结构：

```
剧本摘要/
├── 内容梗概.md
├── 章节摘要.md
└── 主题分析.md
人物信息/
├── 人物总览.md
├── 人物关系.md
└── <角色名>.json      # SillyTavern chara_card_v2 角色卡
世界书/
├── 世界设定.md
└── world_info.json     # SillyTavern World Info（世界书）
评测报告.md
_meta.json
```

> `*.json` 均为酒馆（SillyTavern）兼容格式，可直接导入。

---

## 错误码汇总

| 状态码 | 含义 | 出现接口 |
|--------|------|----------|
| 400 | 参数/文件非法 | import |
| 404 | 文件或作品不存在 | generate、get_work |
| 413 | 文件过大 | import |
| 500 | 服务端运行错误（如缺 API Key） | generate |
