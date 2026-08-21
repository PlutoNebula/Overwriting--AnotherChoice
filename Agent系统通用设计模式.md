# 通用 Agent 系统设计模式


---

## 一、核心循环模式（Agent Loop）

### 1.1 六阶段主循环

```
用户指令
  │
  ▼
┌─────────────────────────────────────────┐
│  Phase 0: 初始化                         │
│  ├─ 加载 session memory                 │
│  ├─ 自动创建 root task（如需要）          │
│  └─ 构建首条 user message               │
├─────────────────────────────────────────┤
│  for each turn:                         │
│    ├─ OBSERVE   收集环境状态              │
│    ├─ DRAIN     排空外部消息队列          │
│    ├─ COMPACT   检查 token 阈值并压缩     │
│    ├─ THINK     LLM 推理                │
│    ├─ PARSE     解析响应中的结构化信息     │
│    └─ ACT       执行工具调用              │
└─────────────────────────────────────────┘
```

### 1.2 设计要点

| 要点 | 说明 |
|------|------|
| **阶段顺序不可变** | COMPACT 必须在 THINK 之前，否则超限请求直接失败 |
| **DRAIN 优先级** | 用户中断、子 Agent 结果、background 通知都需要在每轮开始时处理 |
| **PARSE 分离** | 从 LLM 响应中提取 Memory Update、tool_use、纯文本，各自走不同路径 |
| **纯文本即终止** | 无 tool_use 且有 text → 视为 Agent 主动结束 |

### 1.3 Cancel 信号注入点

取消信号需要在一个 turn 的**开始边界**检查，不要在 tool 执行中途强制打断：

```
turn_start → check_cancel → observe → drain → compact → think → check_cancel → act
```

---

## 二、上下文管理模式

### 2.1 三层压缩体系

```
上下文窗口使用率
100% ┤
     │
 85% ┤──────────── Layer 2: LLM 摘要压缩（auto_compact）
     │
 70% ┤──────────── Layer 1: 占位符替换（microcompact）
     │
 50% ┤──────────── 正常运行区间
     │
  0% ┤
```

### 2.2 各层职责

| 层级 | 触发条件 | 操作 | 成本 | 可逆性 |
|------|---------|------|------|:---:|
| **microcompact** | 每轮自动 | 旧 tool_result → 占位符，保留最近 N 条 | 零 | ❌ 不可逆 |
| **auto_compact** | token > 阈值 | LLM 摘要 + 替换全部历史 | 一次 Haiku 调用 | ❌ 不可逆（但有 transcript 存档） |
| **manual_compact** | tool 返回信号 | 同上，可指定 focus | 一次 Haiku 调用 | ❌ 不可逆 |

### 2.3 占位符策略

microcompact 不删除消息（会破坏 prompt cache），而是**原地替换内容**：

- 保留消息结构（role + content 框架不变）
- 仅替换 tool_result 的 content 字段
- 格式统一为：`[Previous: used {tool_name}]`
- 保留最近 `KEEP_RECENT` 条完整结果（典型值 3）

### 2.4 摘要提示词结构

auto_compact 的摘要 prompt 必须包含以下 5 个部分，顺序和措辞影响摘要质量：

1. **原始用户请求**（要求逐字引用 — 防止目标漂移）
2. **已完成工作清单**（标记 [DONE] — 防止重复执行）
3. **剩余工作清单**（标记 [TODO] — 指导继续方向）
4. **当前位置**（URL/文件/步骤号 — 精确定位断点）
5. **关键上下文**（创建的文件、提取的数据 — 保留环境信息）

**关键约束**：摘要后的消息必须包含 "DO NOT restart from the beginning" 指令，否则模型倾向于重新开始。

### 2.5 Token 估算

- 生产级：调用 API 的 token counting endpoint
- 快速估算：`len(str(messages)) // 4`（英文约 4 字符/token，中文约 1.5-2 字符/token）
- 压缩阈值设为模型上下文窗口的 70-85%

---

## 三、记忆系统模式

### 3.1 双层架构

```
┌─────────────────────────────────────────────┐
│              记忆系统分层                     │
│                                              │
│  Layer 1: Session Memory（会话级/短记忆）      │
│  ├─ 存储：Redis / 内存                       │
│  ├─ 生命周期：单次会话                        │
│  ├─ 内容：current_state, task_spec,           │
│  │        important_files, pending_tasks      │
│  └─ 更新方式：每轮解析 [Memory Update]        │
│                                              │
│  Layer 2: Persistent Memory（跨会话/长记忆）   │
│  ├─ 存储：文件系统 + 索引文件                  │
│  ├─ 生命周期：永久                            │
│  ├─ 类型：user / feedback / project / reference│
│  └─ 检索方式：索引文件全量注入 → 按需读取       │
│                                              │
│  可选 Layer 3: Knowledge Base（RAG 升级）     │
│  ├─ 存储：FAISS / Milvus 向量索引             │
│  ├─ 检索方式：语义相似度搜索                   │
│  └─ 适用场景：大量文档的知识库问答              │
└─────────────────────────────────────────────┘
```

### 3.2 Memory Update 结构化格式

让 LLM 在每轮结束时输出结构化记忆块，格式固定：

```
[Memory Update]
current_state: <一句话描述当前进度>
task_spec: <用户核心请求原文>
important_files: <本回合创建/修改的关键文件>
errors_corrections: <遇到的错误及解决方式>
pending_tasks: <尚未完成的任务>
[/Memory Update]
```

**设计要点**：
- 用正则从响应末尾提取，不影响 tool_use 的解析
- 字段固定但可选 — 没有更新的字段可以省略
- 解析后立即写入 Session Memory，下一轮 THINK 时注入 system prompt

### 3.3 文件索引式长记忆（Claude Code 模式）

```
memory/
├── MEMORY.md           ← 索引文件，每会话全量加载（控制 < 200 行）
├── user_role.md
├── feedback_testing.md
├── project_auth.md
└── reference_slack.md
```

每条记忆 = YAML frontmatter（元数据） + Markdown body（内容）

索引文件格式：每行一条 `- [Title](file.md) — one-line description`，控制在 ~150 字符以内

**写入策略**：
- 始终**先检查已有记忆**，更新而非重复创建
- 记忆内容应记录 **Why**（原因）而非 What（操作步骤）
- 定期清理过时记忆

### 3.4 向量 RAG

适用场景：用户上传了大量文档，需要语义检索

核心差异：
- 文件索引 → 精确匹配，结构化元数据，成本低
- 向量 RAG → 语义匹配，非结构化文本，成本高

推荐策略：两者并存 — 文件索引处理"关于用户的记忆"，向量 RAG 处理"关于文档的记忆"

---

## 四、任务系统模式

### 4.1 状态机

```
                    ┌─────────┐
                    │ pending │ ←──────────────────┐
                    └────┬────┘                                         │
                         │                                                            │
                    ┌────▼────┐                                        │ 
                    │in_progress│                                           │
                    └────┬────┘                    │
                         │                         │
              ┌──────────┼──────────┐              │
              ▼          ▼          ▼              │
        ┌─────────┐ ┌─────────┐ ┌─────────┐       │
        │completed     │ │      cancelled│ │ failed            │       │
        └─────────┘ └─────────┘ └─────────┘       │
                                                   │
              超步数 / 取消 → 降级为 pending ────────┘
```

### 4.2 文件系统存储方案

放弃数据库，将所有任务以文件形式存储在工作目录下。每个 session 拥有独立的 task 目录：

```
workspace/
└── .agent/
    └── tasks/
        ├── _index.jsonl          ← 任务索引（每行一个任务的摘要）
        ├── T001.md               ← 单个任务详情
        ├── T002.md
        └── T003.md
```

#### 索引文件格式（`_index.jsonl`）

每行一条 JSON，记录任务摘要信息，启动时全量加载到内存：

```jsonl
{"id":"T001","subject":"部署到生产环境","status":"completed","parent":null,"blocked_by":[],"blocks":["T002"],"created_at":"..."}
{"id":"T002","subject":"运行集成测试","status":"in_progress","parent":"T001","blocked_by":["T003"],"blocks":[],"created_at":"..."}
{"id":"T003","subject":"配置 CI/CD","status":"completed","parent":"T001","blocked_by":[],"blocks":["T002"],"created_at":"..."}
```

#### 单任务文件格式（`T00x.md`）

使用 YAML frontmatter 存储结构化元数据，Markdown body 存储人类可读描述：

```markdown
---
id: T001
subject: 部署到生产环境
status: completed
parent: null
blocked_by: []
blocks: [T002]
created_at: 2026-05-06T10:30:00Z
updated_at: 2026-05-06T11:45:00Z
completed_at: 2026-05-06T11:45:00Z
---

## 描述
用户要求将 v2.1 部署到生产 k8s 集群。

## 步骤
1. 构建 Docker 镜像 [DONE]
2. 推送到 ECR [DONE]
3. 更新 k8s deployment [DONE]
4. 验证健康检查 [DONE]

## 关联文件
- k8s/deployment.yaml
- Dockerfile
```

#### 设计要点

| 要点 | 说明 |
|------|------|
| **索引优先** | 启动时只读 `_index.jsonl`（几十 KB），不需要遍历所有文件 |
| **按需读取** | 只在 `task_get` 时读取具体 `T00x.md` 文件 |
| **原子写入** | 先写临时文件 → rename，避免并发写入损坏 |
| **Git 友好** | 文本文件，天然支持 diff、回滚、协同 |
| **无外部依赖** | 不需要 PostgreSQL，部署复杂度降为零 |
| **人类可读** | 可以直接用编辑器查看和修改任务状态 |

#### 索引重建

如果 `_index.jsonl` 损坏或缺失，可通过扫描 `T*.md` 文件的 frontmatter 重建：

```
重建流程：
  1. Glob 所有 T*.md 文件
  2. 解析每个文件的 YAML frontmatter
  3. 提取摘要字段写入 _index.jsonl
  4. 校验依赖关系完整性
```

### 4.3 Root Task 自动创建

**触发条件**（非平凡请求）：

- 包含 URL
- 包含操作动词（打开/搜索/分析/生成/下载...）
- 附带图片或文件
- 文本长度 ≥ 阈值（如 18 字符）
- 包含多个句子（多步骤意图）

**注入提示词**：
- 告知模型 root task 已自动创建，id 和 subject 是什么
- 禁止创建重复 root task
- 要求在 finish_task 前标记为 completed
- **禁止在用户可见输出中提及 task ID**（内部实现细节不泄露）

**生命周期**：
- 正常完成 → completed
- 用户取消 → pending（可恢复）
- 超步数 → pending（可恢复）

### 4.4 依赖图

```
T001 (部署) ──blocks──→ T002 (测试)
                          │
                        blocked_by
                          │
                        T003 (CI/CD)
```

规则：
- 只有所有 `blocked_by` 任务状态为 `completed` 时，任务才能开始
- `blocks` 是 `blocked_by` 的反向索引，方便快速查询"谁在等我"
- 创建依赖前检查是否存在循环引用
- 完成父任务时，自动检查所有子任务是否已完成

---

## 五、工具系统模式

### 5.1 注册表模式（Registry Pattern）

```
ToolRegistry
  ├─ register(name, handler)    注册工具
  ├─ execute(name, args)        执行工具 → ToolResult
  └─ get_schemas()              生成 Anthropic API 兼容的 tool schema 列表
```

### 5.2 工具分类

| 分类 | 特征 | 并发安全 | 权限要求 |
|------|------|:---:|------|
| 只读 | 不改变任何状态 | ✅ 安全 | 自动允许 |
| 写入 | 创建/修改文件 | ❌ 不安全 | 需要审批 |
| 破坏性 | 删除/覆盖/发送 | ❌ 不安全 | 必须审批 |
| 网络 | 访问外部资源 | ✅ 安全 | 需要审批 |

### 5.3 ToolResult 信号

工具执行结果需要携带**控制信号**：

| 信号 | 含义 | 处理 |
|------|------|------|
| `finished: true` | Agent 任务完成 | 终止主循环 |
| `manual_compact: true` | 需要立即压缩上下文 | 触发 Layer 3 压缩 |
| `error` | 执行失败 | 注入错误信息，继续下一轮 |
| `persisted_path` | 大结果已写磁盘 | 返回预览 + 路径引用 |

---

## 六、LLM 集成模式

### 6.1 多级回退

```
Stage 0: 正常请求（images + tools 齐全）
  │
  ├─ 失败 ──→ Stage 1: 移除 images（网关不支持视觉）
  │             │
  │             ├─ 失败 ──→ Stage 2: 移除 tools（SDK 兼容性问题）
  │             │             │
  │             │             └─ 失败 ──→ 终止，报错
  │             │
  │             └─ 成功 ──→ 继续（无视觉能力）
  │
  └─ 成功 ──→ 继续（完整能力）
```

**判断逻辑**：根据错误信息中的关键词决定回退策略（如 `image_url` → 去掉图片，`validation` → 去掉 tools）

### 6.2 系统提示词组装

拆分为**静态部分**（可缓存）和**动态部分**（会话特定）：

```
静态前缀（可复用 prompt cache）:
  ├─ 角色定义与核心指令
  ├─ 工具使用规范
  ├─ 工作目录约束
  └─ [Memory Update] 格式说明

动态后缀（每会话变化）:
  ├─ 用户画像
  ├─ Session Memory 内容
  ├─ 活跃任务列表
  └─ CLAUDE.md / 项目级配置
```

### 6.3 上下文注入要素

每轮 THINK 时，system prompt 必须包含：

1. 用户画像（角色、偏好、背景）
2. 当前 Session Memory（进度、状态）
3. 活跃任务列表（包括 root task）
4. 工作目录信息
5. [Memory Update] 输出格式要求

---

## 七、A2A 编排模式（LangGraph Node & Edge）

Agent-to-Agent 通信不通过消息队列，而是用 LangGraph 的图结构来编排：每个 Agent 是一个 **Node**，Agent 之间的交接是 **Edge**，共享上下文通过 **State** 在图中流转。

### 7.1 核心概念映射

```
LangGraph 概念        Agent 系统映射
─────────────────     ─────────────────
Node                  一个 Agent / 一个 Tool / 一个处理函数
Edge                  控制流：Agent A 完成后 → Agent B
Conditional Edge      路由：根据结果决定下一个 Node 是谁
State                 共享上下文（session、messages、tasks、memory）
Graph                 完整的 Agent 工作流定义
```

### 7.2 基础图结构

```
              ┌─────────────────┐
              │   supervisor    │  ← 调度节点：分析请求，决定路由
              │   (Agent Node)  │
              └───────┬─────────┘
                      │
              ┌───────┼───────┐
              ▼       ▼       ▼
        ┌────────┐┌────────┐┌────────┐
        │explorer││ coder  ││reviewer│  ← 专用 Agent 节点
        │ Node   ││ Node   ││ Node   │
        └───┬────┘└───┬────┘└───┬────┘
            │         │         │
            └─────────┼─────────┘
                      ▼
              ┌─────────────┐
              │  __end__    │  ← 终止
              └─────────────┘
```

### 7.3 State 设计

State 是贯穿整张图的数据载体。Node 读取 State，处理后返回更新：

```
State 字段：
  ├─ messages         消息历史（累加，operator='+')
  ├─ session          AgentSession 上下文
  ├─ tasks            任务列表
  ├─ memory           会话记忆
  ├─ tool_results     本轮工具执行结果
  └─ next_agent       条件路由：下一个 Node 是谁
```

设计原则：
- State 中的列表字段使用 `add` reducer（累加语义），而非替换
- 每个 Node 只读取自己需要的字段，不需要感知整个 State
- `next_agent` 由 supervisor 或条件边判断后写入，控制路由方向


### 7.4 条件路由

条件边根据 State 内容决定下一个 Node：

```
路由决策维度：
  ├─ task 复杂程度      → 单 Agent 还是多 Agent
  ├─ 上一 Node 的结果   → 成功继续 / 失败重试 / 转人工
  ├─ 会话状态           → 正常 / 需要压缩 / 用户取消
  └─ 工具调用类型       → 只读自动 / 写入审批
```

条件边的本质是：`fn(state) → next_node_name`

### 7.5 关键实现要点

- **Checkpointer**：将每次图执行的 State 快照持久化到 SQLite/PG，支持暂停后恢复和重放调试
- **Interrupt**：在关键 Node 前设置 `interrupt_before`，暂停等待外部输入（人工审批等）
- **Command**：子 Agent 完成后通过 `Command(goto=...)` 显式指定下一个 Node
- **Subgraph**：将 Agent 主循环封装为子图，作为父图中的一个 Node 复用
- **Send API**：fan-out 场景下，从 dispatcher 动态派发 N 个并行任务到同一个 worker Node

---

## 八、可观测性模式

### 8.1 关键指标

| 指标 | 类型 | 用途 |
|------|------|------|
| `turns_total` | Counter | 计费预测 |
| `tokens_total` | Counter | 成本追踪 |
| `cost_usd` | Counter | 预算告警 |
| `tool_calls_total` | Counter（按 tool 名分片） | 工具使用分析 |
| `errors_total` | Counter（按类型分片） | 告警触发 |
| `turn_latency_ms` | Histogram | 性能回归检测 |
| `llm_ttfb_ms` | Histogram | 首 Token 延迟监控 |
| `active_sessions` | Gauge | 容量规划 |

### 8.2 结构化日志

每个关键事件一行 JSON 日志，携带 `session_id`、`turn_number`、`tool_name`、`tokens_used` 等上下文字段。避免在日志中输出完整 prompt 或 tool 结果内容（敏感信息 + 体积过大）。

---

## 九、方案决策树

当你需要构建一个新的 Agent 系统时，按以下顺序决策：

```
1. 单体还是多 Agent 图？
   ├─ 单一 Agent 够用 → 单体 Agent Loop
   ├─ 需要多 Agent 协作 → LangGraph 编排
   └─ 需要人机协同 → LangGraph + interrupt

2. 任务存储方案？
   ├─ 原型 / 简单场景 → 文件系统（_index.jsonl + T*.md）
   ├─ 需要复杂查询 / 多用户 → PostgreSQL
   └─ 需要审计追踪 → 不可变事件流

3. 记忆系统选型？
   ├─ 只有用户偏好 → 文件索引（参考 Claude Code）
   ├─ 有大量文档问答 → 向量 RAG（参考 NeoFish）
   └─ 两者都有 → 双层架构

4. A2A 通信方式？
   ├─ 简单顺序 → LangGraph Pipeline 模式
   ├─ 动态调度 → LangGraph Supervisor-Worker 模式
   ├─ 并行独立任务 → LangGraph Fan-out 模式
   └─ 跨进程/跨节点 → 微服务 + 消息总线（仅在必要时）

5. 工具执行安全级别？
   ├─ 完全信任用户 → 进程内执行
   ├─ 基本安全 → Docker 沙盒
   └─ 高安全要求 → VM 级隔离

6. 上下文压缩策略？
   ├─ 短会话（< 50 轮）→ 不需要
   ├─ 中等会话 → 只做 microcompact
   └─ 长会话 / 复杂任务 → 三层完整压缩
```

---

## 十、常见反模式

| 反模式 | 问题 | 正确做法 |
|--------|------|---------|
| 在 tool 执行中强制 kill | 文件系统半改状态 | 仅在 turn 边界检查 cancel |
| 压缩后不保留 transcript | 问题无法回溯 | 每次 auto_compact 前存档 JSONL |
| 静态 prompt 每次重建 | 浪费 prompt cache | 静态部分单独管理 |
| 所有工具串行执行 | 并发安全的工具浪费时间 | 声明 is_concurrency_safe |
| Memory 只写不读 | 记忆膨胀，context 浪费 | 用 MEMORY.md 索引 + 按需读取 |
| tool_result 无限增长 | 单轮就撑爆窗口 | 大结果写磁盘，返回预览 |
| 摘要 prompt 太简单 | 模型丢失关键上下文 | 5 部分结构化 prompt |
| 任务文件全量加载 | 任务多时启动慢 | _index.jsonl 索引 + 按需读取 T*.md |
| 图结构过度嵌套 | 单次 run 调试困难 | 单图 ≤ 3 层，深逻辑用 subgraph 封装 |
| State 字段无 reducer | 列表被意外覆盖 | 拆分 State，用 TypedDict + add reducer |
| 每个 turn 都写磁盘 | 高频 I/O 拖慢循环 | 内存缓存 + 定时/结束批量刷盘 |

---

*整理日期：2026-05-06*
