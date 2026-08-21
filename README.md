# 中短篇文学作品解读 Agent

基于 **LangGraph + DeepSeek（OpenAI 兼容端口）** 的批处理系统：输入一篇中短篇文字作品，自动提取**剧本摘要、人物信息（含主要人物经历）、世界书**三类解读产物，并为每个作品单独建立文件夹。

## 架构

```
START → load → chunk → analyze → assemble → review ──┬─ 通过/达上限 → write → END
                                                     └─ 未通过 → 回 assemble（修订，revision_count+1）
```

- **load**：读文件（编码探测 utf-8→gbk→utf-16）、清洗、取作品名。
- **chunk**：分块（超长文本带重叠切分；短文本单块直过）。
- **analyze**：唯一的「分析 Agent」，对每块做一次统一结构化提取（梗概 + 人物 + 世界），多块用 **Send API** 并行 fan-out。
- **assemble**：唯一的「成稿 Agent」，合并去重、统一命名、交叉引用，产出三类产物。
- **review**：评测 Agent，用**原始分析结果反向核对成稿**（一致性/完整性/准确性/去重/可读性），不达标则回成稿修订（有界循环）。
- **write**：原子落盘三个子文件夹 + `评测报告.md` + `_meta.json`。

### 输出结构（每个作品一个文件夹）

```
works/<作品名>/
├── 剧本摘要/     # 内容梗概.md / 章节摘要.md / 主题分析.md
├── 人物信息/     # 人物总览.md / 人物关系.md / <角色名>.md（含经历时间线）
├── 世界书/       # 世界设定/地点/势力组织/规则体系/时间线/术语表 + worldbook.json
├── 评测报告.md    # 每轮评分 + 问题清单 + 修订记录
└── _meta.json     # 元数据（源文件/模型/块数/修订次数/错误）
```

## 快速开始

### 1. 建虚拟环境并安装依赖（虚拟环境开发）

```bash
uv venv .venv --python 3.12
uv sync
```

> 若 uv 缓存目录无写权限，可指定项目内缓存：`$env:UV_CACHE_DIR=".uv-cache"`（已加入 .gitignore）。

### 2. 配置 DeepSeek

```bash
cp .env.example .env   # Windows: copy .env.example .env
# 编辑 .env 填入 DEEPSEEK_API_KEY
```

### 3. 运行

```bash
uv run run.py analyze inputs/demo.txt                 # 单篇（默认开 review，最多 2 轮修订）
uv run run.py analyze 路径 --model deepseek-reasoner    # 指定模型
uv run run.py analyze 路径 --max-revisions 3           # 调整修订上限
uv run run.py analyze 路径 --no-review                 # 跳过评测
uv run run.py batch inputs/                            # 批量处理目录
uv run run.py analyze inputs/demo.txt --dry-run         # 离线 mock（无需 Key）
```

### 4. 测试

```bash
uv run pytest
```

## 配置项

| 配置 | 默认 | 说明 |
|------|------|------|
| `DEEPSEEK_API_KEY` | - | 必填（.env） |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | OpenAI 兼容端口 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 可选 `deepseek-reasoner` |
| `chunk_size` / `chunk_overlap` | 8000 / 500 | 分块与重叠 |
| `max_revisions` | 2 | review 最大修订次数 |

## 目录

```
literary_agent/
├── config.py       # 配置 + .env 加载
├── state.py        # WorkState（TypedDict + add reducer）
├── llm.py          # DeepSeek 工厂 + 重试 + JSON 解析回退
├── chunking.py     # 分块
├── schemas.py      # Pydantic 输出模型
├── prompts.py      # 分析/成稿/评测提示词
├── nodes.py        # load/chunk/analyze/assemble/review/write
├── graph.py        # StateGraph + Send fan-out + review 回路
├── storage.py      # 目录/文件名清洗/原子写入
└── mock_llm.py     # 离线假 LLM
```
