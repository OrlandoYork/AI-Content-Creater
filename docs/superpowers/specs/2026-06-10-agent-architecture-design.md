# AI全媒体内容生产与分发系统 — Agent 架构重设计

> 日期: 2026-06-10  
> 状态: 设计阶段  
> 参考项目: AiToEarn (MIT License, github.com/yikart/AiToEarn)

---

## 一、背景与目标

### 当前状态

Phase 1 (热点分析与选题策划) 和 Phase 2 (AI 内容创作) 已完整实现：
- 后端: FastAPI + SQLModel + SQLite + DeepSeek API
- 前端: React 18 + Vite + Ant Design 5 (深色主题)
- AI 调用: 一次性 prompt→response 模式，Mock 回退

### 问题

当前架构是传统的「表单→按钮→API→结果」模式，每次 AI 调用是孤立的。无法实现：
- 多步骤 AI 工作流编排（热点→选题→创作→审核→分发→分析）
- Agent 自主推理 + 工具调用循环
- 任务断点续跑和历史回溯
- 流式进度反馈

### 目标

参考 AiToEarn 的 Agent 驱动架构，用 **LangGraph + FastAPI + PostgreSQL + Redis** 重构核心引擎，同时保留现有表单操作界面，新增 Agent 对话面板。

---

## 二、技术决策

| 维度 | 选择 | 理由 |
|------|------|------|
| Agent 引擎 | **LangGraph** (Python) | 有向图编排，State 管理强，Checkpointer 支持 PG 持久化 |
| LLM Provider | DeepSeek API (保留) | 现有集成稳定，OpenAI 兼容接口 |
| 后端框架 | **FastAPI** (保留) | 现有代码复用，与 LangGraph 同为 Python 生态 |
| 数据库 | SQLite → **PostgreSQL 16** | 支持 LangGraph Checkpointer、JSONB、全文搜索、并发 |
| 缓存/队列 | **Redis 7** | SSE Pub/Sub、Celery broker、会话缓存 |
| 前端 | React 18 + Vite (保留) | 新增 Agent 对话面板，保留现有表单页 |
| 前端状态 | Zustand (保留) | 借鉴 AiToEarn TaskInstance 模式增强 |

---

## 三、LangGraph 工作流设计

### 3.1 全局 State

```python
from typing import TypedDict, List, Optional, Literal, Annotated
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage

class WorkflowState(TypedDict):
    messages: Annotated[List[BaseMessage], add_messages]
    intent: Literal["full_pipeline", "analyze_hotspot", "generate_topic",
                    "create_content", "review_content", "distribute", "analyze"]
    hot_topics: List[dict]
    topics: List[dict]
    contents: List[dict]
    review_results: List[dict]
    publish_records: List[dict]
    analytics_data: List[dict]
    report: Optional[dict]
    current_node: str
    errors: List[str]
    human_feedback: Optional[str]
    task_id: str
    user_id: str
    status: Literal["running","completed","error","aborted","requires_action"]
```

### 3.2 工作流图

```
START
  │
  ▼
[classifier] ─── 单节点请求 ──→ [对应节点] ──→ END
  │
  │ (full_pipeline)
  ▼
[hot_spot_analyzer] ──→ [topic_planner] ──→ [content_creator]
                                                    │
                                                    ▼
                                          [content_reviewer]
                                            │         │
                                       不通过    通过  │
                                            │         │
                                            ▼         ▼
                                    [content_creator]  [distribution_node]
                                    (带修改意见)            │
                                                           ▼
                                                   [data_collector]
                                                           │
                                                           ▼
                                                   [analytics_reporter]
                                                           │
                                                           ▼
                                                          END
```

### 3.3 8 个节点职责

| 节点 | 功能 | 调用的 Tools |
|------|------|-------------|
| **classifier** | 用 cheap model 判断用户意图，路由到子图或单节点 | 分类 LLM |
| **hot_spot_analyzer** | 采集5平台热点，AI分析情感/受众/趋势 | `fetch_hot_topics`, `analyze_sentiment`, `summarize_topic` |
| **topic_planner** | 基于热点 AI 生成选题建议，排期排序 | `generate_topic_suggestions`, `rank_by_priority`, `schedule_topic` |
| **content_creator** | 生成4种类型内容（文章/脚本/海报/帖子） | `generate_article`, `generate_video_script`, `generate_poster`, `generate_social_post`, `generate_titles` |
| **content_reviewer** | 敏感词检测、合规检查、质量评分 | `check_sensitive_words`, `check_compliance`, `score_quality` |
| **distribution_node** | 格式适配 + 模拟多平台发布 | `adapt_format`, `publish_to_platform`, `schedule_publish` |
| **data_collector** | 模拟各平台数据（阅读/点赞/评论/转发） | `simulate_views`, `simulate_engagement`, `collect_comments` |
| **analytics_reporter** | 综合报表 + AI 优化建议 | `generate_report`, `compare_performance`, `suggest_optimization` |

### 3.4 关键设计点

- **Classifier 用 cheap model**（DeepSeek-V4-Flash）：用户输入先过分类器，只在需要时启动完整 pipeline
- **断点续跑**：LangGraph `checkpointer` 持久化到 PG，任意节点失败后从断点恢复
- **人工干预**：`content_reviewer` 不通过时路由回 `content_creator` 带 `human_feedback`
- **并行分发**：`distribution_node` 内多个平台并行执行
- **强制 AI 生成**：选题和内容生成不使用 Mock 模板回退，AI 不可用时报错

---

## 四、前端 Agent 对话面板

### 4.1 布局

- 保留现有页面（Dashboard / TopicList / TopicGenerate / ContentList / ContentEditor 等）
- 右下角浮动按钮「🤖 AI 助手」
- 点击展开右侧面板（400px 宽，可拖拽调整）
- 主内容区自适应缩小

### 4.2 面板结构

```
┌─ Agent 面板 ─────────────────┐
│  [执行进度指示]               │
│  ○ 热点分析 ✓                │
│  ● 选题策划 ⟳ (进行中)       │
│  ○ 内容创作                   │
│  ○ 审核分发                   │
│                               │
│  [对话区]                     │
│  🤖: 检测到你选中了3个选题    │
│  👤: 用专业风格生成文章       │
│  🤖: [步骤卡片] 正在生成...   │
│                               │
│  [输入框________________]     │
│  [📤 发送] [⏹ 停止]          │
└───────────────────────────────┘
```

### 4.3 消息类型（借鉴 AiToEarn agent.vo.ts）

```
IDisplayMessage {
  id, role, content, status
  steps?: IMessageStep[]       // 工具调用步骤
  actions?: IActionCard[]      // 可操作 UI 卡片
}

IMessageStep {
  type: 'tool_call' | 'tool_result' | 'thinking' | 'text_delta'
  toolName, toolInput, toolResult
  status: 'running' | 'done' | 'error'
}

IActionCard {
  type: 'navigate' | 'save' | 'publish' | 'edit'
  title, description
  action: { route, params }
}
```

### 4.4 SSE 事件协议

| 事件 | 方向 | 用途 |
|------|------|------|
| `init` | S→C | 任务初始化 {task_id, workflow_type} |
| `keep_alive` | S→C | 5s 心跳 |
| `node_start` | S→C | 节点开始 {node, timestamp} |
| `node_complete` | S→C | 节点完成 {node, result} |
| `tool_call` | S→C | 工具调用 {toolName, input} |
| `tool_result` | S→C | 工具返回 {toolName, output} |
| `text_delta` | S→C | 流式文本 |
| `error` | S→C | 错误 {code, message, node} |
| `requires_action` | S→C | 需要人工干预 {node, prompt} |
| `done` | S→C | 完成 {state_summary, actions} |
| `abort` | C→S | 用户取消 |
| `human_response` | C→S | 人工干预回复 |

### 4.5 面板与表单页联动

- Agent 感知当前页面上下文（所在页面、选中的选题/内容、表单数据）
- 用户在 TopicList 选中选题 → Agent 自动提示"要生成内容吗？"
- 用户在 ContentEditor 编辑 → Agent 感知修改，主动提供润色/改写
- Agent 生成的产出自动出现在对应表单页面中

---

## 五、从 AiToEarn 复用的组件

### 5.1 直接复用的模式

| AiToEarn 模式 | → 本项目实现 |
|---------------|-------------|
| 任务状态机 (5 states) | Pydantic Literal 枚举 |
| AgentMessageVo 联合类型 | Pydantic discriminated union |
| wrapTool 错误包装器 | Python @tool_wrapper 装饰器 |
| TaskInstance 任务隔离 | dataclass + asyncio.Queue |
| skill-analyzer 意图分类 | LangGraph classifier 节点 |
| SSE chunk type 系统 | StreamingResponse + async generator |
| OutputTaskResult 结构化输出 | Pydantic schema |
| Skill markdown 格式 | SKILL.md 文件格式 |
| keepAlive heartbeat | asyncio.sleep(5) yield |
| SYSTEM_PROMPT 架构 | 节点 system prompt 模板 |

### 5.2 不复用的部分

| AiToEarn | 原因 | 本项目替代 |
|----------|------|-----------|
| NestJS + RxJS | Python 生态 | FastAPI + async generators |
| Anthropic Agent SDK | 厂商锁定 | LangGraph + LangChain tools |
| Mongoose/MongoDB | 与 PG 不兼容 | SQLAlchemy + PostgreSQL JSONB |
| BullMQ | 过重 | LangGraph checkpointing / Celery |
| Next.js App Router | 已有 Vite+React | 保留现有架构 |
| 14平台OAuth | Phase 3 模拟 | SimulationService 模拟 |

---

## 六、数据库重设计

### 6.1 升级原因

| 需求 | SQLite 限制 | PostgreSQL 方案 |
|------|------------|----------------|
| LangGraph Checkpointer | 不支持并发写 | `langgraph-checkpoint-postgres` |
| 并发 Agent 任务 | 单写锁 | MVCC 无锁并发 |
| 灵活字段 | TEXT 模拟 JSON | 原生 JSONB + GIN 索引 |
| 全文搜索 | 无 | `tsvector` 中文分词 |

### 6.2 新增核心表：agent_tasks

```sql
CREATE TABLE agent_tasks (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       VARCHAR(64) NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'running',
    title         VARCHAR(200),
    workflow_type VARCHAR(50) NOT NULL DEFAULT 'full_pipeline',
    state_snapshot JSONB DEFAULT '{}',     -- WorkflowState 完整快照
    messages      JSONB DEFAULT '[]',      -- AgentMessage[]
    outputs       JSONB DEFAULT '{}',      -- 各阶段产出
    errors        JSONB DEFAULT '[]',      -- [{node, error, timestamp}]
    current_node  VARCHAR(50),
    thread_id     VARCHAR(128),            -- LangGraph checkpoint thread
    session_data  JSONB DEFAULT '{}',
    share_token   VARCHAR(64) UNIQUE,
    share_expires_at TIMESTAMPTZ,
    deleted_at    TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 6.3 现有表改造

- `hot_topics`: 新增 `search_vector` (tsvector 全文索引) + agent_task_id
- `topics`: 新增 `agent_task_id` + `search_vector`，其余字段保持
- `contents`: `body` TEXT → JSONB，新增 `agent_task_id` + `metadata JSONB`

### 6.4 Redis 键设计

```
agent:task:{id}:status     → 任务状态缓存 (TTL 1h)
agent:task:{id}:progress   → 当前进度 0-100
agent:session:{uid}:ctx    → 用户会话上下文 (TTL 24h)
agent:sse:{id}:channel     → SSE Pub/Sub 频道
agent:abort:{id}           → 取消信号
```

### 6.5 部署架构

```
Docker Compose:
  ├── PostgreSQL 16 (:5432)
  ├── Redis 7 (:6379)
  ├── Backend (FastAPI + LangGraph, :8082)
  └── Frontend (Vite dev, :5173, 或 Nginx 静态文件)
```

---

## 七、项目结构（新）

```
AI全媒体内容生产与分发系统/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── database.py              # PG + Redis 连接
│   │   ├── core/
│   │   │   ├── config.py            # 新增 PG/REDIS 配置
│   │   │   └── exceptions.py
│   │   ├── models/                  # 新增 agent_task + 改造现有
│   │   ├── schemas/
│   │   ├── api/
│   │   │   ├── topics.py
│   │   │   ├── content.py
│   │   │   ├── review.py            # NEW Phase 3
│   │   │   ├── distribution.py      # NEW Phase 3
│   │   │   ├── analytics.py         # NEW Phase 4
│   │   │   └── agent.py             # NEW Agent SSE 端点
│   │   ├── services/
│   │   │   ├── deepseek_service.py
│   │   │   ├── simulation_service.py
│   │   │   └── ...
│   │   └── agent/                   # NEW Agent 引擎
│   │       ├── __init__.py
│   │       ├── graph.py             # StateGraph 定义
│   │       ├── state.py             # WorkflowState
│   │       ├── nodes/               # 8 个节点实现
│   │       │   ├── classifier.py
│   │       │   ├── hot_spot_analyzer.py
│   │       │   ├── topic_planner.py
│   │       │   ├── content_creator.py
│   │       │   ├── content_reviewer.py
│   │       │   ├── distribution_node.py
│   │       │   ├── data_collector.py
│   │       │   └── analytics_reporter.py
│   │       ├── tools/               # LangChain Tool 定义
│   │       └── skills/              # SKILL.md 技能文件
│   ├── requirements.txt
│   └── alembic/                     # 数据库迁移
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── agent/               # NEW Agent 面板组件
│   │   │   │   ├── AgentPanel.tsx
│   │   │   │   ├── AgentChat.tsx
│   │   │   │   ├── AgentProgress.tsx
│   │   │   │   └── ActionCard.tsx
│   │   ├── stores/
│   │   │   └── agentStore.ts        # NEW Agent Zustand Store
│   │   └── services/
│   │       └── agentApi.ts          # NEW Agent SSE Client
├── docker-compose.yml               # NEW
└── docs/
    └── superpowers/
        └── specs/
            └── 2026-06-10-agent-architecture-design.md
```

---

## 八、实施计划（概要）

### Phase A: 基础设施 (2-3天)

1. Docker Compose 配置 (PG + Redis)
2. 数据库迁移 SQLite → PostgreSQL
3. SQLAlchemy 异步引擎配置
4. Alembic 初始化 + 建表
5. LangGraph + checkpointer 集成

### Phase B: Agent 引擎核心 (3-4天)

1. WorkflowState + StateGraph 定义
2. classifier 节点 + 路由逻辑
3. hot_spot_analyzer + topic_planner 节点 (复用现有 DeepSeekService)
4. content_creator 节点 (4 种类型工具)
5. content_reviewer + distribution_node 节点
6. data_collector + analytics_reporter 节点
7. `/api/agent/*` SSE 端点
8. 断点续跑 + 错误恢复

### Phase C: 前端 Agent 面板 (2-3天)

1. AgentPanel 浮动按钮 + 侧边面板
2. AgentChat 对话组件
3. AgentProgress 执行进度组件
4. agentStore (借鉴 TaskInstance 模式)
5. agentApi (SSE client, 借鉴现有 topicApi SSE 实现)
6. 面板与表单页上下文联动

### Phase D: Phase 3-4 功能 (4-5天)

1. Review 模块 (model + schema + service + API + 页面)
2. Distribution 模块
3. Analytics 模块 (ECharts 可视化)
4. 各模块 Agent 工具注册

### Phase E: 测试与文档 (2-3天)

1. 端到端 Agent 工作流测试
2. SSE 流式传输测试
3. 前端 TypeScript 编译 + 交互测试
4. API 文档更新

---

## 九、验证标准

1. **Agent 全流程**: 用户输入"分析热点并生成内容" → Agent 自动完成热点采集→选题→创作→审核→分发→分析全流程
2. **断点续跑**: 模拟中途断网 → 重连后从断点继续
3. **人工干预**: 审核不通过 → 用户输入修改意见 → Agent 重新创作
4. **前端联动**: 表单选中选题 → Agent 感知 → 对话面板自动提示
5. **SSE 流式**: 每个节点的执行进度实时推送到前端
6. **向后兼容**: 现有 Phase 1-2 所有页面和 API 正常工作

---

*设计文档版本: v1.0*
