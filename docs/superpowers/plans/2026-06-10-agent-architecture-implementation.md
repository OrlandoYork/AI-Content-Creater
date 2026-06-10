# Agent 架构改造 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将当前项目从「表单→API→结果」模式升级为 LangGraph Agent 驱动架构，新增 PostgreSQL + Redis 基础设施、Agent 对话面板、Phase 3-4 功能模块。

**Architecture:** LangGraph StateGraph (8节点) + FastAPI SSE streaming + Zustand Agent Store (TaskInstance模式) + PostgreSQL (checkpointer+数据) + Redis (缓存+Pub/Sub)

**Tech Stack:** Python 3.11+ / FastAPI / LangGraph / LangChain / asyncpg / SQLAlchemy 2.0 / Redis / React 18 / Zustand 5 / Ant Design 5 / SSE

---

## Phase A: 基础设施 (Docker + PostgreSQL + Redis + LangGraph)

### Task A1: Docker Compose + 环境配置

**Files:**
- Create: `docker-compose.yml`
- Modify: `backend/app/core/config.py:1-29`
- Modify: `backend/requirements.txt:1-8`
- Create: `backend/.env.example`

- [ ] **Step 1: 创建 docker-compose.yml**

```yaml
version: "3.8"

services:
  postgres:
    image: postgres:16-alpine
    container_name: contentai-pg
    environment:
      POSTGRES_USER: contentai
      POSTGRES_PASSWORD: contentai123
      POSTGRES_DB: contentai
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U contentai"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: contentai-redis
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  pgdata:
```

- [ ] **Step 2: 启动 Docker Compose 并验证**

```bash
cd "C:\Users\Orlando\Desktop\AI全媒体内容生产与分发系统"
docker compose up -d
docker compose ps
```

Expected: postgres 和 redis 两个服务状态 "healthy"

- [ ] **Step 3: 更新 backend/requirements.txt 添加新依赖**

```
fastapi==0.115.6
uvicorn[standard]==0.34.0
sqlmodel==0.0.22
pydantic-settings==2.7.1
python-multipart==0.0.20
httpx==0.28.1
pytest==8.3.4
pytest-asyncio==0.25.2

# === NEW: Agent + PostgreSQL + Redis ===
langgraph==1.0.1
langgraph-checkpoint-postgres==2.0.17
langchain==0.3.27
langchain-core==0.3.76
langchain-openai==0.3.33
asyncpg==0.30.0
sqlalchemy[asyncio]==2.0.41
redis==6.4.0
alembic==1.15.1
psycopg2-binary==2.9.10
sse-starlette==2.2.1
```

- [ ] **Step 4: 安装新依赖**

```bash
cd backend && pip install -r requirements.txt
```

Expected: 无错误，所有包安装完成

- [ ] **Step 5: 更新 backend/app/core/config.py**

```python
"""应用配置管理"""
import os
from pathlib import Path

# 项目根目录 (backend/)
BASE_DIR = Path(__file__).resolve().parent.parent

# ==================== 数据库配置 ====================

# PostgreSQL (主数据库)
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+asyncpg://contentai:contentai123@localhost:5432/contentai"
)
# SQLite 同步 URL (过渡期兼容)
DATABASE_URL_SYNC = os.getenv(
    "DATABASE_URL_SYNC",
    "postgresql+psycopg2://contentai:contentai123@localhost:5432/contentai"
)

# Redis
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")

# ==================== AI API 配置 ====================

# DeepSeek API
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")
DEEPSEEK_TIMEOUT = int(os.getenv("DEEPSEEK_TIMEOUT", "180"))
DEEPSEEK_ENABLED = os.getenv("DEEPSEEK_ENABLED", "true").lower() == "true" and bool(DEEPSEEK_API_KEY)

# Coze API (已废弃，保留配置兼容)
COZE_API_KEY = os.getenv("COZE_API_KEY", "")
COZE_BOT_ID = os.getenv("COZE_BOT_ID", "")

# ==================== 服务配置 ====================

API_PREFIX = "/api"
PROJECT_NAME = "AI全媒体内容生产与分发系统"
VERSION = "0.2.0"
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
```

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml backend/requirements.txt backend/app/core/config.py backend/.env.example
git commit -m "feat: add Docker Compose (PG+Redis) and update dependencies"
```

---

### Task A2: 数据库引擎升级 (SQLite → PostgreSQL async)

**Files:**
- Rewrite: `backend/app/database.py`
- Modify: `backend/app/models/topic.py` — 添加 agent_task_id
- Modify: `backend/app/models/content.py` — TEXT→JSONB, 添加 agent_task_id

- [ ] **Step 1: 重写 backend/app/database.py**

```python
"""数据库连接管理 — PostgreSQL + asyncpg"""
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from sqlmodel import SQLModel
from app.core.config import DATABASE_URL, DATABASE_URL_SYNC, DEBUG, REDIS_URL
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

# === Async Engine (FastAPI 异步路由使用) ===
async_engine = create_async_engine(
    DATABASE_URL,
    echo=DEBUG,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# === Sync Engine (Alembic 迁移 + LangGraph Checkpointer 使用) ===
sync_engine = create_engine(
    DATABASE_URL_SYNC,
    echo=DEBUG,
    pool_size=5,
    max_overflow=10,
)

# === Redis ===
async def get_redis() -> aioredis.Redis:
    """获取 Redis 连接"""
    return aioredis.from_url(REDIS_URL, decode_responses=True)


async def create_db_and_tables():
    """创建所有表（使用 sync engine 兼容 SQLModel）"""
    from sqlmodel import SQLModel
    SQLModel.metadata.create_all(sync_engine)
    logger.info("✓ 数据库表已创建/更新")


async def get_session():
    """获取异步数据库会话（FastAPI 依赖注入）"""
    async with AsyncSessionLocal() as session:
        yield session


async def close_connections():
    """关闭所有连接"""
    await async_engine.dispose()
    sync_engine.dispose()
    logger.info("✓ 数据库连接已关闭")
```

- [ ] **Step 2: 验证数据库连接**

```bash
cd backend && python -c "
import asyncio
from app.database import async_engine, sync_engine, create_db_and_tables

async def test():
    await create_db_and_tables()
    async with async_engine.connect() as conn:
        result = await conn.execute('SELECT 1')
        print('Async PG OK:', result.scalar())
    with sync_engine.connect() as conn:
        result = conn.execute('SELECT 1')
        print('Sync PG OK:', result.scalar())

asyncio.run(test())
"
```

Expected: "Async PG OK: 1" 和 "Sync PG OK: 1"

- [ ] **Step 3: 更新 models/topic.py — HotTopic 新增字段**

Read existing `backend/app/models/topic.py` first, then edit to add:

```python
# 在 HotTopic 类末尾添加：
agent_task_id: Optional[str] = Field(default=None, max_length=64, description="关联的 Agent 任务ID")
```

- [ ] **Step 4: 更新 models/content.py — Content body TEXT→JSONB + 新增字段**

```python
# 将 body 字段从：
body: str = Field(default="", description="内容正文(TEXT)")
# 改为：
body: str = Field(default="", sa_column=Column(JSONB), description="内容正文(JSONB)")

# 添加：
agent_task_id: Optional[str] = Field(default=None, max_length=64, description="关联的 Agent 任务ID")
metadata_: Optional[str] = Field(default="{}", sa_column=Column(JSONB), description="扩展元数据")
```

Import `Column` and `JSONB`:
```python
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB
```

- [ ] **Step 5: 创建 AgentTask 模型**

Create `backend/app/models/agent_task.py`:

```python
"""Agent 任务模型"""
from datetime import datetime
from typing import Optional
from uuid import uuid4

from sqlmodel import Field, SQLModel, Column
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy import Index


class AgentTask(SQLModel, table=True):
    __tablename__ = "agent_tasks"

    id: str = Field(
        default_factory=lambda: str(uuid4()),
        primary_key=True,
        sa_column=Column(UUID(as_uuid=False), primary_key=True, default=uuid4),
    )
    user_id: str = Field(max_length=64, index=True)
    status: str = Field(default="running", max_length=20)  # running|completed|error|aborted|requires_action
    title: Optional[str] = Field(default=None, max_length=200)
    workflow_type: str = Field(default="full_pipeline", max_length=50)

    state_snapshot: Optional[str] = Field(default="{}", sa_column=Column(JSONB))
    messages: Optional[str] = Field(default="[]", sa_column=Column(JSONB))
    outputs: Optional[str] = Field(default="{}", sa_column=Column(JSONB))
    errors: Optional[str] = Field(default="[]", sa_column=Column(JSONB))

    current_node: Optional[str] = Field(default=None, max_length=50)
    thread_id: Optional[str] = Field(default=None, max_length=128)

    session_data: Optional[str] = Field(default="{}", sa_column=Column(JSONB))

    share_token: Optional[str] = Field(default=None, max_length=64, unique=True)
    share_expires_at: Optional[datetime] = Field(default=None)

    deleted_at: Optional[datetime] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)

    __table_args__ = (
        Index("idx_agent_tasks_user", "user_id", "deleted_at", "created_at"),
        Index("idx_agent_tasks_status", "status", "deleted_at", "updated_at"),
        Index("idx_agent_tasks_share", "share_token"),
        Index("idx_agent_tasks_thread", "thread_id"),
    )
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/database.py backend/app/models/topic.py backend/app/models/content.py backend/app/models/agent_task.py
git commit -m "feat: upgrade database to PostgreSQL async, add AgentTask model"
```

---

### Task A3: Alembic 数据库迁移

**Files:**
- Create: `backend/alembic.ini`
- Create: `backend/alembic/env.py`
- Create: `backend/alembic/versions/001_initial.py`

- [ ] **Step 1: 初始化 Alembic**

```bash
cd backend && alembic init alembic
```

- [ ] **Step 2: 配置 alembic/env.py**

```python
from alembic import context
from sqlmodel import SQLModel
from app.database import sync_engine
from app.core.config import DATABASE_URL_SYNC

# 导入所有模型确保 SQLModel.metadata 包含所有表
from app.models.topic import HotTopic, Topic
from app.models.content import Content
from app.models.agent_task import AgentTask

target_metadata = SQLModel.metadata

def run_migrations_offline():
    context.configure(
        url=DATABASE_URL_SYNC,
        target_metadata=target_metadata,
        literal_binds=True,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online():
    with sync_engine.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
```

- [ ] **Step 3: 更新 alembic.ini 中的数据库 URL**

```
sqlalchemy.url = postgresql+psycopg2://contentai:contentai123@localhost:5432/contentai
```

- [ ] **Step 4: 生成并执行迁移**

```bash
cd backend
alembic revision --autogenerate -m "initial: hot_topics, topics, contents, agent_tasks"
alembic upgrade head
```

Expected: "Running upgrade -> ..." 成功

- [ ] **Step 5: 验证表结构**

```bash
cd backend && python -c "
from app.database import sync_engine
from sqlalchemy import inspect
inspector = inspect(sync_engine)
tables = inspector.get_table_names()
print('Tables:', tables)
for t in tables:
    cols = inspector.get_columns(t)
    print(f'  {t}: {[c[\"name\"] for c in cols]}')
"
```

Expected: 输出 4 张表 (hot_topics, topics, contents, agent_tasks) 及各自的列

- [ ] **Step 6: Commit**

```bash
git add backend/alembic.ini backend/alembic/ backend/alembic/versions/
git commit -m "feat: add Alembic migration for PostgreSQL schema"
```

---

### Task A4: LangGraph Checkpointer + Redis 集成

**Files:**
- Create: `backend/app/agent/__init__.py`
- Create: `backend/app/agent/state.py`
- Create: `backend/app/agent/checkpointer.py`

- [ ] **Step 1: 创建 backend/app/agent/__init__.py**

```python
"""Agent 引擎 — LangGraph 工作流编排"""
```

- [ ] **Step 2: 创建 backend/app/agent/state.py — WorkflowState 定义**

```python
"""LangGraph WorkflowState 定义"""
from typing import TypedDict, List, Optional, Literal, Annotated
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class WorkflowState(TypedDict):
    """Agent 工作流全局状态"""
    # === 消息历史 (自动追加) ===
    messages: Annotated[List[BaseMessage], add_messages]

    # === 用户意图 ===
    intent: Literal["full_pipeline", "analyze_hotspot", "generate_topic",
                    "create_content", "review_content", "distribute", "analyze"]

    # === 各阶段产出 ===
    hot_topics: List[dict]
    topics: List[dict]
    contents: List[dict]
    review_results: List[dict]
    publish_records: List[dict]
    analytics_data: List[dict]
    report: Optional[dict]

    # === 控制流 ===
    current_node: str
    errors: List[str]
    human_feedback: Optional[str]

    # === 任务元数据 ===
    task_id: str
    user_id: str
    status: Literal["running", "completed", "error", "aborted", "requires_action"]
```

- [ ] **Step 3: 创建 backend/app/agent/checkpointer.py — PG Checkpointer 工厂**

```python
"""LangGraph Checkpointer — PostgreSQL 持久化"""
import logging
from langgraph.checkpoint.postgres import PostgresSaver
from app.database import sync_engine

logger = logging.getLogger(__name__)

# 全局 checkpointer 实例（启动时初始化）
_checkpointer: PostgresSaver | None = None


def get_checkpointer() -> PostgresSaver:
    """获取 LangGraph PostgreSQL Checkpointer

    使用 sync engine（psycopg2），因为 langgraph-checkpoint-postgres
    的 PostgresSaver 需要同步连接。
    """
    global _checkpointer
    if _checkpointer is None:
        _checkpointer = PostgresSaver(sync_engine)
        _checkpointer.setup()
        logger.info("✓ LangGraph Checkpointer 已初始化 (PostgreSQL)")
    return _checkpointer
```

- [ ] **Step 4: 验证 Checkpointer**

```bash
cd backend && python -c "
from app.agent.checkpointer import get_checkpointer
cp = get_checkpointer()
print('Checkpointer OK:', type(cp).__name__)
print('Tables created: langgraph_checkpoints + langgraph_checkpoint_writes')
"
```

Expected: "Checkpointer OK: PostgresSaver" + tables message

- [ ] **Step 5: Commit**

```bash
git add backend/app/agent/__init__.py backend/app/agent/state.py backend/app/agent/checkpointer.py
git commit -m "feat: add LangGraph WorkflowState and PostgreSQL Checkpointer"
```

---

## Phase B: Agent 引擎核心 (LangGraph 工作流)

### Task B1: 核心工具定义 (Tools)

**Files:**
- Create: `backend/app/agent/tools/__init__.py`
- Create: `backend/app/agent/tools/base.py`
- Create: `backend/app/agent/tools/hot_spot.py`
- Create: `backend/app/agent/tools/topic.py`
- Create: `backend/app/agent/tools/content_tools.py`
- Create: `backend/app/agent/tools/review.py`
- Create: `backend/app/agent/tools/distribution.py`
- Create: `backend/app/agent/tools/analytics.py`

- [ ] **Step 1: 创建 base.py — 工具装饰器工厂**

```python
"""LangChain Tool 基础设施 — 借鉴 AiToEarn wrapTool 模式"""
import functools
import logging
from typing import Callable, Any
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


def tool_wrapper(
    name: str,
    description: str,
):
    """工具包装器：统一错误处理 + 可用性监控

    借鉴 AiToEarn 的 wrapTool 模式：
    - 每个工具独立 try/except
    - 失败返回结构化错误而非抛异常
    - 所有工具通过此装饰器注册
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> dict:
            try:
                result = func(*args, **kwargs)
                return {"success": True, "data": result}
            except Exception as e:
                logger.error(f"Tool [{name}] failed: {e}", exc_info=True)
                return {"success": False, "error": str(e)}

        # 包装为 LangChain tool
        return tool(wrapper, name=name, description=description)
    return decorator
```

- [ ] **Step 2: 创建 hot_spot.py — 热点分析工具**

```python
"""热点分析工具集"""
from app.agent.tools.base import tool_wrapper


@tool_wrapper(
    name="fetch_hot_topics",
    description="从5个平台（微博/知乎/抖音/百度/搜狐）采集当日最热门话题，每平台5条，共25条。返回热点列表含标题、热度指数、趋势、受众、情感。"
)
def fetch_hot_topics(platforms: list[str] | None = None) -> dict:
    """采集热点话题

    复用现有 SimulationService.generate_hot_topics()
    """
    from app.services.simulation_service import SimulationService
    sim = SimulationService()
    count = 25
    topics = sim.generate_hot_topics(count=count)
    return {
        "total": len(topics),
        "items": [
            {
                "title": t.title,
                "platform": t.source_platform,
                "hot_index": t.hot_index,
                "trend": t.trend,
                "audience": t.audience,
                "sentiment": t.sentiment,
                "summary": t.summary,
            }
            for t in topics
        ]
    }


@tool_wrapper(
    name="analyze_hot_topic",
    description="使用AI深度分析单条热点话题，返回热度等级、预估读者量、情感分布、目标受众、推荐内容类型。"
)
def analyze_hot_topic(title: str, platform: str) -> dict:
    """AI分析单条热点"""
    from app.services.coze_service import CozeService
    coze = CozeService()
    return coze.analyze_hot_topic(title, platform)
```

- [ ] **Step 3: 创建 topic.py — 选题策划工具**

```python
"""选题策划工具集"""
from app.agent.tools.base import tool_wrapper


@tool_wrapper(
    name="generate_topic_suggestions",
    description="基于热点话题生成选题建议。输入热点标题和来源平台，AI生成1-5个独特的选题角度，每个选题含标题、描述、目标受众、内容类型、风格、优先级。"
)
def generate_topic_suggestions(
    hot_topic_title: str,
    hot_topic_platform: str,
    count: int = 3,
    style_preference: str = "professional",
) -> dict:
    """AI生成选题建议 — 强制AI生成，不使用模板"""
    from app.services.coze_service import CozeService
    coze = CozeService()
    return coze.generate_topic_suggestions(
        hot_topic_title, hot_topic_platform, count, style_preference
    )
```

- [ ] **Step 4: 创建 content_tools.py — 内容创作工具**

```python
"""内容创作工具集"""
from app.agent.tools.base import tool_wrapper


@tool_wrapper(
    name="generate_article",
    description="生成结构化文章（800-2000字Markdown格式）。需提供选题标题和描述、目标受众。"
)
def generate_article(
    topic_title: str,
    topic_description: str,
    target_audience: str = "26-35岁职场人群",
    style: str = "professional",
) -> dict:
    """生成文章"""
    from app.services.coze_service import CozeService
    coze = CozeService()
    result = coze.generate_content(
        topic_title=topic_title,
        topic_description=topic_description,
        content_type="article",
        style=style,
        target_audience=target_audience,
    )
    return {"title": result.get("title", ""), "body": result.get("body", "")}


@tool_wrapper(
    name="generate_video_script",
    description="生成短视频拍摄脚本（分镜表JSON数组）。每个分镜含shot_number/duration/visual/dialogue/subtitle/bgm，共8-15个分镜。"
)
def generate_video_script(
    topic_title: str,
    topic_description: str,
    target_audience: str = "26-35岁职场人群",
    style: str = "professional",
) -> dict:
    """生成视频脚本"""
    from app.services.coze_service import CozeService
    coze = CozeService()
    result = coze.generate_content(
        topic_title=topic_title,
        topic_description=topic_description,
        content_type="video_script",
        style=style,
        target_audience=target_audience,
    )
    return {
        "title": result.get("title", ""),
        "body": result.get("body", ""),
        "visual_style": result.get("visual_style", ""),
    }


@tool_wrapper(
    name="generate_poster_copy",
    description="生成海报文案（50-200字）+ AI生图提示词。返回copy文字和image_prompt。"
)
def generate_poster_copy(
    topic_title: str,
    topic_description: str,
    style: str = "professional",
) -> dict:
    """生成海报文案"""
    from app.services.coze_service import CozeService
    coze = CozeService()
    result = coze.generate_content(
        topic_title=topic_title,
        topic_description=topic_description,
        content_type="poster_copy",
        style=style,
        target_audience="general",
    )
    return {
        "title": result.get("title", ""),
        "body": result.get("body", ""),
        "image_prompt": result.get("image_prompt", ""),
    }


@tool_wrapper(
    name="generate_social_post",
    description="生成社交媒体帖子（100-500字，口语化+emoji，适合微博/小红书/朋友圈传播）。"
)
def generate_social_post(
    topic_title: str,
    topic_description: str,
    style: str = "professional",
) -> dict:
    """生成社交帖子"""
    from app.services.coze_service import CozeService
    coze = CozeService()
    result = coze.generate_content(
        topic_title=topic_title,
        topic_description=topic_description,
        content_type="social_post",
        style=style,
        target_audience="general",
    )
    return {"title": result.get("title", ""), "body": result.get("body", "")}
```

- [ ] **Step 5: 创建 review.py, distribution.py, analytics.py**

Create `backend/app/agent/tools/review.py`:

```python
"""内容审核工具"""
from app.agent.tools.base import tool_wrapper


@tool_wrapper(
    name="check_content_quality",
    description="审核内容质量：检查敏感词、合规性、字数规范、格式正确性。返回通过/不通过及具体问题列表。"
)
def check_content_quality(body: str, content_type: str) -> dict:
    """AI 内容审核"""
    # Phase 3 初期使用模拟审核，后续接入真实敏感词库
    issues = []
    sensitive_words = ["违禁词1", "违禁词2"]  # 后续扩展
    for word in sensitive_words:
        if word in body:
            issues.append({"type": "sensitive", "word": word, "severity": "high"})

    # 字数检查
    if content_type == "article" and len(body) < 500:
        issues.append({"type": "length", "message": "文章不足500字", "severity": "medium"})

    return {
        "passed": len([i for i in issues if i["severity"] == "high"]) == 0,
        "score": max(0, 100 - len(issues) * 15),
        "issues": issues,
    }
```

Create `backend/app/agent/tools/distribution.py`:

```python
"""多平台分发工具"""
from app.agent.tools.base import tool_wrapper


@tool_wrapper(
    name="publish_to_platforms",
    description="将内容发布到指定平台（微信/微博/抖音/小红书）。当前为模拟分发，返回发布记录。"
)
def publish_to_platforms(
    content_title: str,
    content_body: str,
    content_type: str,
    platforms: list[str],
) -> dict:
    """模拟多平台分发"""
    import random
    from datetime import datetime

    records = []
    for platform in platforms:
        records.append({
            "platform": platform,
            "status": "published",
            "publish_url": f"https://{platform}.com/mock/{random.randint(1000, 9999)}",
            "published_at": datetime.now().isoformat(),
            "platform_specific": {
                "wechat": {"article_id": f"wx_{random.randint(10000,99999)}"},
                "weibo": {"post_id": f"wb_{random.randint(100000,999999)}"},
                "douyin": {"video_id": f"dy_{random.randint(10000,99999)}"},
                "xiaohongshu": {"note_id": f"xhs_{random.randint(1000,9999)}"},
            }.get(platform, {}),
        })

    return {"total": len(records), "records": records}
```

Create `backend/app/agent/tools/analytics.py`:

```python
"""数据分析工具"""
from app.agent.tools.base import tool_wrapper


@tool_wrapper(
    name="collect_analytics",
    description="采集各平台数据（阅读量/点赞/评论/转发/收藏）。当前使用模拟数据。"
)
def collect_analytics(publish_records: list[dict]) -> dict:
    """模拟数据采集"""
    import random

    data = []
    for record in publish_records:
        views = random.randint(500, 50000)
        data.append({
            "platform": record["platform"],
            "publish_url": record.get("publish_url", ""),
            "views": views,
            "likes": random.randint(10, int(views * 0.1)),
            "comments": random.randint(0, int(views * 0.02)),
            "shares": random.randint(0, int(views * 0.05)),
            "bookmarks": random.randint(0, int(views * 0.03)),
            "collected_at": record.get("published_at", ""),
        })

    return {"total_views": sum(d["views"] for d in data), "items": data}


@tool_wrapper(
    name="generate_performance_report",
    description="基于各平台数据生成综合效果分析报表和AI优化建议。"
)
def generate_performance_report(analytics_data: list[dict]) -> dict:
    """生成效果报表 + AI优化建议"""
    total_views = sum(d["views"] for d in analytics_data)
    total_engagement = sum(
        d["likes"] + d["comments"] + d["shares"] + d["bookmarks"]
        for d in analytics_data
    )

    # 找最佳平台
    best = max(analytics_data, key=lambda d: d["views"]) if analytics_data else None

    return {
        "summary": {
            "total_views": total_views,
            "total_engagement": total_engagement,
            "engagement_rate": round(total_engagement / total_views * 100, 2) if total_views else 0,
            "best_platform": best["platform"] if best else None,
            "total_platforms": len(analytics_data),
        },
        "suggestions": [
            "最佳发布时间：数据显示工作日 12:00-14:00 互动率最高",
            f"最佳平台：{best['platform']} 的阅读量最高，建议加大该平台投入" if best else "",
            "短视频内容互动率高于图文2.3倍，建议增加视频内容比例",
            "带话题标签的内容曝光量提升约40%",
        ],
    }
```

- [ ] **Step 6: 创建 backend/app/agent/tools/__init__.py**

```python
"""Agent 工具集 — LangChain Tool 注册中心"""
from app.agent.tools.hot_spot import fetch_hot_topics, analyze_hot_topic
from app.agent.tools.topic import generate_topic_suggestions
from app.agent.tools.content_tools import (
    generate_article,
    generate_video_script,
    generate_poster_copy,
    generate_social_post,
)
from app.agent.tools.review import check_content_quality
from app.agent.tools.distribution import publish_to_platforms
from app.agent.tools.analytics import collect_analytics, generate_performance_report

# 所有注册工具的列表
ALL_TOOLS = [
    fetch_hot_topics,
    analyze_hot_topic,
    generate_topic_suggestions,
    generate_article,
    generate_video_script,
    generate_poster_copy,
    generate_social_post,
    check_content_quality,
    publish_to_platforms,
    collect_analytics,
    generate_performance_report,
]
```

- [ ] **Step 7: 验证工具导入**

```bash
cd backend && python -c "
from app.agent.tools import ALL_TOOLS
for t in ALL_TOOLS:
    print(f'{t.name}: {t.description[:60]}...')
print(f'Total tools: {len(ALL_TOOLS)}')
"
```

Expected: 输出 11 个工具的名称和描述

- [ ] **Step 8: Commit**

```bash
git add backend/app/agent/tools/
git commit -m "feat: add 11 LangChain tools (hotspot/topic/content/review/distribution/analytics)"
```

---

### Task B2: 8个 LangGraph 节点实现

**Files:**
- Create: `backend/app/agent/nodes/__init__.py`
- Create: `backend/app/agent/nodes/classifier.py`
- Create: `backend/app/agent/nodes/hot_spot_analyzer.py`
- Create: `backend/app/agent/nodes/topic_planner.py`
- Create: `backend/app/agent/nodes/content_creator.py`
- Create: `backend/app/agent/nodes/content_reviewer.py`
- Create: `backend/app/agent/nodes/distribution_node.py`
- Create: `backend/app/agent/nodes/data_collector.py`
- Create: `backend/app/agent/nodes/analytics_reporter.py`

- [ ] **Step 1: 创建 classifier.py — 意图分类节点**

```python
"""Classifier 节点 — 使用 cheap model 判断用户意图"""
import json
import logging
from app.agent.state import WorkflowState
from app.services.deepseek_service import DeepSeekService

logger = logging.getLogger(__name__)


async def classifier_node(state: WorkflowState) -> WorkflowState:
    """分析用户输入，判断意图并路由

    意图类型：
    - full_pipeline: 全流程（热点→选题→创作→审核→分发→分析）
    - analyze_hotspot: 仅分析热点
    - generate_topic: 仅生成选题
    - create_content: 仅创作内容
    - review_content: 仅审核内容
    - distribute: 仅分发
    - analyze: 仅分析数据
    """
    last_message = state["messages"][-1].content if state["messages"] else ""

    ai = DeepSeekService()
    if not ai.available:
        # DeepSeek 不可用：默认全流程
        state["intent"] = "full_pipeline"
        state["current_node"] = "classifier"
        return state

    prompt = f"""分析以下用户请求，判断意图类型。只返回一个单词：

用户请求: "{last_message}"

意图类型:
- full_pipeline (全流程: 热点→选题→创作→审核→分发→分析)
- analyze_hotspot (仅分析热点)
- generate_topic (仅生成选题)
- create_content (仅创作内容)
- review_content (仅审核内容)
- distribute (仅分发)
- analyze (仅数据分析)

只返回意图类型（一个单词），不要任何解释："""

    try:
        raw = ai._call("你是意图分类器", prompt, temperature=0.1)
        intent = raw.strip().lower()
        valid = ["full_pipeline", "analyze_hotspot", "generate_topic",
                 "create_content", "review_content", "distribute", "analyze"]
        state["intent"] = intent if intent in valid else "full_pipeline"
    except Exception as e:
        logger.warning("Classifier failed, defaulting to full_pipeline: %s", e)
        state["intent"] = "full_pipeline"

    state["current_node"] = "classifier"
    return state


def route_by_intent(state: WorkflowState) -> str:
    """根据意图路由到对应节点"""
    intent = state.get("intent", "full_pipeline")

    # 单节点请求直接路由到对应节点
    single_node_map = {
        "analyze_hotspot": "hot_spot_analyzer",
        "generate_topic": "topic_planner",
        "create_content": "content_creator",
        "review_content": "content_reviewer",
        "distribute": "distribution_node",
        "analyze": "analytics_reporter",
    }

    if intent in single_node_map:
        return single_node_map[intent]

    # full_pipeline → 从第一个节点开始
    return "hot_spot_analyzer"
```

- [ ] **Step 2: 创建 hot_spot_analyzer.py**

```python
"""热点分析节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)


async def hot_spot_analyzer_node(state: WorkflowState) -> WorkflowState:
    """采集+分析热点话题"""
    state["current_node"] = "hot_spot_analyzer"
    logger.info("🔴 [热点分析] 开始采集5平台热点……")

    try:
        from app.agent.tools.hot_spot import fetch_hot_topics
        result = fetch_hot_topics()
        if result.get("success"):
            state["hot_topics"] = result["data"]["items"]
            logger.info("✓ 热点采集完成: %d 条", len(state["hot_topics"]))
        else:
            state["errors"].append(f"热点采集失败: {result.get('error')}")
            state["hot_topics"] = []
    except Exception as e:
        state["errors"].append(f"热点分析异常: {str(e)}")
        state["hot_topics"] = []

    return state
```

- [ ] **Step 3: 创建 topic_planner.py, content_creator.py, content_reviewer.py**

```python
# topic_planner.py
"""选题策划节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)


async def topic_planner_node(state: WorkflowState) -> WorkflowState:
    """基于热点生成选题建议"""
    state["current_node"] = "topic_planner"
    hot_topics = state.get("hot_topics", [])

    if not hot_topics:
        logger.warning("无热点数据，跳过选题策划")
        state["topics"] = []
        return state

    logger.info("🟡 [选题策划] 基于 %d 条热点生成选题……", len(hot_topics))
    topics = []

    for ht in hot_topics[:5]:  # 取前5条热点生成选题
        try:
            from app.agent.tools.topic import generate_topic_suggestions
            result = generate_topic_suggestions(
                hot_topic_title=ht["title"],
                hot_topic_platform=ht["platform"],
                count=2,
            )
            if result.get("success"):
                for s in result["data"].get("suggestions", []):
                    s["source_hot_topic"] = ht["title"]
                    topics.append(s)
        except Exception as e:
            logger.error("选题生成失败 [%s]: %s", ht["title"][:30], e)

    state["topics"] = topics
    logger.info("✓ 选题策划完成: %d 条选题", len(topics))
    return state
```

```python
# content_creator.py
"""内容创作节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)


async def content_creator_node(state: WorkflowState) -> WorkflowState:
    """基于选题生成多类型内容"""
    state["current_node"] = "content_creator"
    topics = state.get("topics", [])

    # 如果有 human_feedback，说明是审核不通过后的重新创作
    feedback = state.get("human_feedback", "")
    if feedback:
        logger.info("🟢 [内容创作] 根据修改意见重新创作: %s", feedback[:50])

    if not topics:
        logger.warning("无选题数据，跳过内容创作")
        state["contents"] = []
        return state

    logger.info("🟢 [内容创作] 基于 %d 条选题生成内容……", len(topics))
    contents = []

    for topic in topics[:3]:
        content_type = topic.get("content_type", "article")
        style = topic.get("style", "professional")
        audience = topic.get("target_audience", "26-35岁职场人群")

        tool_map = {
            "article": "generate_article",
            "video_script": "generate_video_script",
            "poster_copy": "generate_poster_copy",
            "social_post": "generate_social_post",
        }
        tool_name = tool_map.get(content_type, "generate_article")

        try:
            from app.agent.tools import content_tools
            tool_func = getattr(content_tools, tool_name)
            result = tool_func(
                topic_title=topic.get("title", ""),
                topic_description=topic.get("description", ""),
                target_audience=audience,
                style=style,
            )
            if result.get("success"):
                data = result["data"]
                data["content_type"] = content_type
                data["style"] = style
                data["topic_title"] = topic.get("title", "")
                contents.append(data)
        except Exception as e:
            logger.error("内容创作失败 [%s]: %s", topic.get("title", "")[:30], e)

    state["contents"] = contents
    state["human_feedback"] = None  # 清除反馈
    logger.info("✓ 内容创作完成: %d 篇", len(contents))
    return state
```

```python
# content_reviewer.py
"""内容审核节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)


async def content_reviewer_node(state: WorkflowState) -> WorkflowState:
    """审核已创作内容"""
    state["current_node"] = "content_reviewer"
    contents = state.get("contents", [])

    if not contents:
        logger.warning("无内容可审核")
        state["review_results"] = []
        return state

    logger.info("🔵 [内容审核] 审核 %d 篇内容……", len(contents))
    results = []

    for c in contents:
        try:
            from app.agent.tools.review import check_content_quality
            result = check_content_quality(
                body=c.get("body", ""),
                content_type=c.get("content_type", "article"),
            )
            results.append({
                "title": c.get("title", ""),
                "content_type": c.get("content_type", ""),
                "review": result.get("data", {}) if result.get("success") else {"passed": True, "issues": []},
            })
        except Exception as e:
            logger.error("审核失败 [%s]: %s", c.get("title", "")[:30], e)
            results.append({"title": c.get("title", ""), "review": {"passed": True, "issues": []}})

    state["review_results"] = results

    # 检查是否有未通过的内容
    failed = [r for r in results if not r["review"].get("passed", True)]
    if failed:
        logger.warning("⚠ 有 %d 篇内容未通过审核", len(failed))
        state["status"] = "requires_action"
    else:
        logger.info("✓ 内容审核通过: %d 篇", len(results))

    return state


def review_router(state: WorkflowState) -> str:
    """审核路由：通过→分发 / 不通过→重新创作"""
    if state.get("status") == "requires_action":
        return "content_creator"
    return "distribution_node"
```

- [ ] **Step 4: 创建 distribution_node.py, data_collector.py, analytics_reporter.py**

```python
# distribution_node.py
"""多平台分发节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)

PLATFORMS = ["wechat", "weibo", "douyin", "xiaohongshu"]


async def distribution_node(state: WorkflowState) -> WorkflowState:
    """将已审核内容分发到多平台"""
    state["current_node"] = "distribution_node"
    contents = state.get("contents", [])

    if not contents:
        logger.warning("无内容可分发")
        state["publish_records"] = []
        return state

    logger.info("🟣 [多平台分发] 分发 %d 篇内容到 %d 个平台……", len(contents), len(PLATFORMS))
    records = []

    for c in contents:
        try:
            from app.agent.tools.distribution import publish_to_platforms
            result = publish_to_platforms(
                content_title=c.get("title", ""),
                content_body=c.get("body", ""),
                content_type=c.get("content_type", "article"),
                platforms=PLATFORMS,
            )
            if result.get("success"):
                records.extend(result["data"]["records"])
        except Exception as e:
            logger.error("分发失败 [%s]: %s", c.get("title", "")[:30], e)

    state["publish_records"] = records
    logger.info("✓ 分发完成: %d 条记录", len(records))
    return state
```

```python
# data_collector.py
"""数据采集节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)


async def data_collector_node(state: WorkflowState) -> WorkflowState:
    """采集各平台数据"""
    state["current_node"] = "data_collector"
    records = state.get("publish_records", [])

    if not records:
        logger.warning("无分发记录，跳过数据采集")
        state["analytics_data"] = []
        return state

    logger.info("🟠 [数据采集] 采集 %d 条分发记录的数据……", len(records))

    try:
        from app.agent.tools.analytics import collect_analytics
        result = collect_analytics(records)
        if result.get("success"):
            state["analytics_data"] = result["data"]["items"]
            logger.info("✓ 数据采集完成: 总阅读 %d", result["data"]["total_views"])
    except Exception as e:
        logger.error("数据采集失败: %s", e)
        state["analytics_data"] = []

    return state
```

```python
# analytics_reporter.py
"""效果分析节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)


async def analytics_reporter_node(state: WorkflowState) -> WorkflowState:
    """生成效果分析报表"""
    state["current_node"] = "analytics_reporter"
    data = state.get("analytics_data", [])

    if not data:
        logger.warning("无分析数据，跳过报表生成")
        state["report"] = {"summary": {}, "suggestions": []}
        return state

    logger.info("📊 [效果分析] 生成综合报表……")

    try:
        from app.agent.tools.analytics import generate_performance_report
        result = generate_performance_report(data)
        if result.get("success"):
            state["report"] = result["data"]
            logger.info("✓ 报表生成完成")
    except Exception as e:
        logger.error("报表生成失败: %s", e)
        state["report"] = {"summary": {}, "suggestions": []}

    state["status"] = "completed"
    return state
```

- [ ] **Step 5: 创建 backend/app/agent/nodes/__init__.py**

```python
"""LangGraph 节点集合"""
from app.agent.nodes.classifier import classifier_node, route_by_intent
from app.agent.nodes.hot_spot_analyzer import hot_spot_analyzer_node
from app.agent.nodes.topic_planner import topic_planner_node
from app.agent.nodes.content_creator import content_creator_node
from app.agent.nodes.content_reviewer import content_reviewer_node, review_router
from app.agent.nodes.distribution_node import distribution_node
from app.agent.nodes.data_collector import data_collector_node
from app.agent.nodes.analytics_reporter import analytics_reporter_node

__all__ = [
    "classifier_node",
    "route_by_intent",
    "hot_spot_analyzer_node",
    "topic_planner_node",
    "content_creator_node",
    "content_reviewer_node",
    "review_router",
    "distribution_node",
    "data_collector_node",
    "analytics_reporter_node",
]
```

- [ ] **Step 6: 验证所有节点导入**

```bash
cd backend && python -c "
from app.agent.nodes import *
print('All 8 nodes imported OK')
print('classifier:', classifier_node.__name__)
print('hot_spot_analyzer:', hot_spot_analyzer_node.__name__)
print('topic_planner:', topic_planner_node.__name__)
print('content_creator:', content_creator_node.__name__)
print('content_reviewer:', content_reviewer_node.__name__)
print('distribution:', distribution_node.__name__)
print('data_collector:', data_collector_node.__name__)
print('analytics_reporter:', analytics_reporter_node.__name__)
"
```

Expected: 8 个节点函数名全部打印

- [ ] **Step 7: Commit**

```bash
git add backend/app/agent/nodes/
git commit -m "feat: implement 8 LangGraph workflow nodes (classifier→analytics)"
```

---

### Task B3: StateGraph 组装 + Agent SSE 端点

**Files:**
- Create: `backend/app/agent/graph.py`
- Create: `backend/app/api/agent.py`
- Modify: `backend/app/main.py:97-99` — 注册 agent router

- [ ] **Step 1: 创建 backend/app/agent/graph.py — StateGraph 组装**

```python
"""LangGraph StateGraph 组装 — 完整工作流定义"""
import logging
from langgraph.graph import StateGraph, END
from app.agent.state import WorkflowState
from app.agent.nodes import (
    classifier_node, route_by_intent,
    hot_spot_analyzer_node, topic_planner_node,
    content_creator_node, content_reviewer_node, review_router,
    distribution_node, data_collector_node, analytics_reporter_node,
)
from app.agent.checkpointer import get_checkpointer

logger = logging.getLogger(__name__)


def build_workflow_graph() -> StateGraph:
    """构建 LangGraph 工作流图

    Graph 结构:
        START → classifier ─┬─ single_node ──→ END
                            │
                            └─ full_pipeline:
                               hot_spot_analyzer → topic_planner → content_creator
                                   → content_reviewer ─┬─ passed → distribution_node
                                                        │              ↓
                                                        │    data_collector → analytics_reporter → END
                                                        │
                                                        └─ failed → content_creator (retry)
    """
    workflow = StateGraph(WorkflowState)

    # === 注册所有节点 ===
    workflow.add_node("classifier", classifier_node)
    workflow.add_node("hot_spot_analyzer", hot_spot_analyzer_node)
    workflow.add_node("topic_planner", topic_planner_node)
    workflow.add_node("content_creator", content_creator_node)
    workflow.add_node("content_reviewer", content_reviewer_node)
    workflow.add_node("distribution_node", distribution_node)
    workflow.add_node("data_collector", data_collector_node)
    workflow.add_node("analytics_reporter", analytics_reporter_node)

    # === 边定义 ===

    # 入口
    workflow.set_entry_point("classifier")

    # Classifier 条件路由
    workflow.add_conditional_edges(
        "classifier",
        route_by_intent,
        {
            "hot_spot_analyzer": "hot_spot_analyzer",
            "topic_planner": "topic_planner",
            "content_creator": "content_creator",
            "content_reviewer": "content_reviewer",
            "distribution_node": "distribution_node",
            "analytics_reporter": "analytics_reporter",
        }
    )

    # Full Pipeline 链路
    workflow.add_edge("hot_spot_analyzer", "topic_planner")
    workflow.add_edge("topic_planner", "content_creator")
    workflow.add_edge("content_creator", "content_reviewer")

    # 审核条件路由
    workflow.add_conditional_edges(
        "content_reviewer",
        review_router,
        {
            "content_creator": "content_creator",
            "distribution_node": "distribution_node",
        }
    )

    workflow.add_edge("distribution_node", "data_collector")
    workflow.add_edge("data_collector", "analytics_reporter")

    # 单节点执行后直接结束
    workflow.add_edge("hot_spot_analyzer", END)
    # 注意：conditional_edges 已经覆盖了 full pipeline 的路径
    # 单节点的 END 通过 classifier 路由为 single_node 时自动达成

    # === 编译（带 Checkpointer） ===
    checkpointer = get_checkpointer()
    compiled = workflow.compile(checkpointer=checkpointer)

    logger.info("✓ LangGraph 工作流已编译 (8 nodes, PostgreSQL checkpoint)")
    return compiled


# 全局编译实例（应用启动时初始化）
_workflow = None


def get_workflow() -> StateGraph:
    """获取编译后的工作流实例（单例）"""
    global _workflow
    if _workflow is None:
        _workflow = build_workflow_graph()
    return _workflow
```

- [ ] **Step 2: 创建 backend/app/api/agent.py — Agent SSE 端点**

```python
"""Agent API 路由 — SSE 流式端点"""
import json
import asyncio
import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

from app.agent.graph import get_workflow
from app.agent.state import WorkflowState
from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["AI Agent"])


class AgentRunRequest(BaseModel):
    """Agent 运行请求"""
    prompt: str
    user_id: str = "default"
    workflow_type: str = "full_pipeline"


async def _stream_workflow(task_id: str, user_id: str, prompt: str):
    """SSE Generator: 流式运行 LangGraph 工作流"""
    workflow = get_workflow()

    # 初始状态
    initial_state: WorkflowState = {
        "messages": [HumanMessage(content=prompt)],
        "intent": "full_pipeline",
        "hot_topics": [],
        "topics": [],
        "contents": [],
        "review_results": [],
        "publish_records": [],
        "analytics_data": [],
        "report": None,
        "current_node": "",
        "errors": [],
        "human_feedback": None,
        "task_id": task_id,
        "user_id": user_id,
        "status": "running",
    }

    config = {"configurable": {"thread_id": task_id}}

    # 发送 init 事件
    yield f"data: {json.dumps({'type': 'init', 'taskId': task_id, 'workflowType': 'full_pipeline'}, ensure_ascii=False)}\n\n"

    try:
        async for event in workflow.astream(initial_state, config):
            for node_name, node_output in event.items():
                # 发送 node_start
                yield f"data: {json.dumps({'type': 'node_start', 'node': node_name}, ensure_ascii=False)}\n\n"

                if isinstance(node_output, dict):
                    errors = node_output.get("errors", [])
                    status = node_output.get("status", "running")

                    # 发送错误
                    for err in errors:
                        yield f"data: {json.dumps({'type': 'error', 'node': node_name, 'message': str(err)}, ensure_ascii=False)}\n\n"

                    # 发送节点完成
                    yield f"data: {json.dumps({'type': 'node_complete', 'node': node_name, 'status': status}, ensure_ascii=False)}\n\n"

                    # 如果状态为 requires_action，发送干预请求
                    if status == "requires_action":
                        yield f"data: {json.dumps({'type': 'requires_action', 'node': node_name, 'prompt': '部分内容未通过审核，请提供修改意见'}, ensure_ascii=False)}\n\n"

        # 发送 done
        yield f"data: {json.dumps({'type': 'done', 'taskId': task_id, 'status': 'completed'}, ensure_ascii=False)}\n\n"

    except Exception as e:
        logger.error("Agent 工作流异常: %s", e, exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'node': 'system', 'code': 'WORKFLOW_ERROR', 'message': str(e)}, ensure_ascii=False)}\n\n"

    # 异步保存 agent_task 记录到数据库
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import text
            await session.execute(
                text("""
                    INSERT INTO agent_tasks (id, user_id, status, title, workflow_type, current_node, thread_id, created_at, updated_at)
                    VALUES (:id, :user_id, :status, :title, :workflow_type, :current_node, :thread_id, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET status=:status, updated_at=NOW()
                """),
                {
                    "id": task_id,
                    "user_id": user_id,
                    "status": "completed",
                    "title": prompt[:200],
                    "workflow_type": "full_pipeline",
                    "current_node": "analytics_reporter",
                    "thread_id": task_id,
                }
            )
            await session.commit()
    except Exception as e:
        logger.error("保存 agent_task 失败: %s", e)


async def _keepalive_generator(stream_generator):
    """合并工作流流 + 心跳"""
    async def combined():
        keepalive_task = None
        try:
            async def send_keepalive():
                while True:
                    await asyncio.sleep(5)
                    yield f"data: {json.dumps({'type': 'keep_alive'})}\n\n"

            # 简化：在流中插入心跳（实际用 asyncio.Queue 合并）
            async for chunk in stream_generator:
                yield chunk
        except asyncio.CancelledError:
            logger.info("SSE 连接被取消 (task: %s)", "unknown")

    return combined()


@router.post("/run", summary="运行 Agent 工作流 (SSE)")
async def run_agent(request: AgentRunRequest):
    """启动 Agent 工作流，SSE 流式返回进度

    事件类型: init | keep_alive | node_start | node_complete | error | requires_action | done
    """
    task_id = str(uuid4())

    stream = _stream_workflow(
        task_id=task_id,
        user_id=request.user_id,
        prompt=request.prompt,
    )

    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/abort/{task_id}", summary="取消 Agent 任务")
async def abort_agent(task_id: str):
    """取消正在运行的 Agent 任务"""
    import redis.asyncio as aioredis
    from app.core.config import REDIS_URL

    try:
        r = aioredis.from_url(REDIS_URL, decode_responses=True)
        await r.publish(f"agent:abort:{task_id}", "abort")
        await r.close()
        return {"status": "ok", "message": f"Abort signal sent for task {task_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to abort: {e}")


@router.get("/task/{task_id}", summary="获取 Agent 任务详情")
async def get_agent_task(task_id: str):
    """获取任务状态和结果"""
    async with AsyncSessionLocal() as session:
        from sqlalchemy import text
        result = await session.execute(
            text("SELECT * FROM agent_tasks WHERE id = :id"),
            {"id": task_id}
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        return dict(row._mapping)
```

- [ ] **Step 3: 注册 agent router 到 main.py**

```python
# 在 main.py 的 import 区域添加：
from app.api import agent

# 在路由注册区域添加：
app.include_router(agent.router, prefix=API_PREFIX)
```

- [ ] **Step 4: 更新 main.py lifespan 初始化逻辑**

将 `create_db_and_tables()` 改为 async，并添加 LangGraph checkpointer 初始化：

```python
# 在 lifespan 的 Step 1 后添加：
from app.agent.graph import get_workflow
get_workflow()  # 初始化编译工作流
logger.info("✓ LangGraph Agent 引擎已初始化")
```

- [ ] **Step 5: 验证工作流可以编译**

```bash
cd backend && python -c "
from app.agent.graph import get_workflow
wf = get_workflow()
print('Workflow compiled:', type(wf).__name__)
print('Nodes:', list(wf.get_graph().nodes.keys()))
"
```

Expected: "Workflow compiled: CompiledStateGraph" + 节点列表

- [ ] **Step 6: Commit**

```bash
git add backend/app/agent/graph.py backend/app/api/agent.py backend/app/main.py
git commit -m "feat: assemble LangGraph StateGraph and add Agent SSE endpoint"
```

---

## Phase C: 前端 Agent 对话面板

### Task C1: 前端类型 + Agent API + Agent Store

**Files:**
- Create: `frontend/src/types/agent.ts`
- Create: `frontend/src/services/agentApi.ts`
- Create: `frontend/src/stores/agentStore.ts`
- Modify: `frontend/src/stores/topicStore.ts` — 导出类型供 Agent 感知上下文

- [ ] **Step 1: 创建 frontend/src/types/agent.ts — Agent 相关类型**

```typescript
// === SSE 事件类型 (借鉴 AiToEarn chunk types) ===
export type SSEEventType =
  | 'init' | 'keep_alive' | 'node_start' | 'node_complete'
  | 'tool_call' | 'tool_result' | 'text_delta'
  | 'error' | 'requires_action' | 'done';

export interface SSEEvent {
  type: SSEEventType;
  taskId?: string;
  workflowType?: string;
  node?: string;
  status?: string;
  toolName?: string;
  content?: string;
  code?: string;
  message?: string;
  prompt?: string;
  timestamp?: number;
}

// === 消息类型 (借鉴 AiToEarn IDisplayMessage) ===
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'pending' | 'streaming' | 'done' | 'error';

export interface IMessageStep {
  id: string;
  type: 'tool_call' | 'tool_result' | 'thinking' | 'text_delta';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  isActive?: boolean;
  status: 'running' | 'done' | 'error';
}

export interface IActionCard {
  type: 'navigate' | 'save' | 'publish' | 'edit' | 'confirm';
  title: string;
  description?: string;
  action: { route?: string; params?: Record<string, unknown> };
}

export interface IDisplayMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  steps?: IMessageStep[];
  actions?: IActionCard[];
  timestamp: number;
}

// === 任务实例 (借鉴 AiToEarn TaskInstance) ===
export interface AgentTask {
  id: string;
  messages: IDisplayMessage[];
  steps: IMessageStep[];
  streamingText: string;
  progress: number;           // 0-100
  status: 'running' | 'completed' | 'error' | 'aborted';
  currentNode?: string;
  workflowType?: string;
}

// === Agent 面板上下文 (感知当前页面状态) ===
export interface AgentContext {
  currentPage: string;
  selectedTopics: number[];
  selectedContents: number[];
  formData: Record<string, unknown>;
}

// === 节点标签映射 ===
export const NODE_LABELS: Record<string, string> = {
  classifier: '分析意图',
  hot_spot_analyzer: '热点分析',
  topic_planner: '选题策划',
  content_creator: '内容创作',
  content_reviewer: '内容审核',
  distribution_node: '多平台分发',
  data_collector: '数据采集',
  analytics_reporter: '效果分析',
};

export const NODE_ORDER = [
  'classifier',
  'hot_spot_analyzer',
  'topic_planner',
  'content_creator',
  'content_reviewer',
  'distribution_node',
  'data_collector',
  'analytics_reporter',
];
```

- [ ] **Step 2: 创建 frontend/src/services/agentApi.ts**

```typescript
import type { SSEEvent } from '../types/agent';

const AGENT_BASE = '/api/agent';

/**
 * SSE Agent 客户端 — 借鉴现有 topicApi SSE 实现
 */
export function runAgentWorkflow(
  prompt: string,
  userId: string = 'default',
  onEvent: (event: SSEEvent) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void,
): AbortController {
  const controller = new AbortController();

  const run = async () => {
    try {
      const response = await fetch(`${AGENT_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, user_id: userId, workflow_type: 'full_pipeline' }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Agent API error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: SSEEvent = JSON.parse(line.slice(6));
              onEvent(event);

              if (event.type === 'done') {
                onComplete?.();
              }
            } catch {
              // skip malformed events
            }
          }
        }
      }

      // 处理 buffer 中剩余的数据
      if (buffer.startsWith('data: ')) {
        try {
          const event: SSEEvent = JSON.parse(buffer.slice(6));
          onEvent(event);
        } catch { /* skip */ }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  run();
  return controller;
}

export async function abortAgentTask(taskId: string): Promise<void> {
  await fetch(`${AGENT_BASE}/abort/${taskId}`, { method: 'POST' });
}

export async function getAgentTask(taskId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${AGENT_BASE}/task/${taskId}`);
  if (!res.ok) throw new Error(`Failed to fetch task: ${res.status}`);
  return res.json();
}
```

- [ ] **Step 3: 创建 frontend/src/stores/agentStore.ts**

```typescript
import { create } from 'zustand';
import type { IDisplayMessage, IMessageStep, AgentTask, AgentContext, SSEEvent } from '../types/agent';
import { runAgentWorkflow, abortAgentTask } from '../services/agentApi';

interface AgentState {
  // === 面板 ===
  panelOpen: boolean;
  panelWidth: number;

  // === 任务 (借鉴 TaskInstance 隔离模式) ===
  currentTaskId: string | null;
  tasks: Record<string, AgentTask>;

  // === 上下文 ===
  context: AgentContext;

  // === 连接 ===
  abortController: AbortController | null;

  // === 操作 ===
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  sendMessage: (text: string) => Promise<void>;
  abortTask: () => void;
  updateContext: (ctx: Partial<AgentContext>) => void;
  clearTask: (taskId: string) => void;

  // === SSE 事件处理 ===
  _handleSSEEvent: (event: SSEEvent) => void;
  _addMessage: (taskId: string, msg: IDisplayMessage) => void;
  _addStep: (taskId: string, step: IMessageStep) => void;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  panelOpen: false,
  panelWidth: 420,
  currentTaskId: null,
  tasks: {},
  context: {
    currentPage: '/',
    selectedTopics: [],
    selectedContents: [],
    formData: {},
  },
  abortController: null,

  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  sendMessage: async (text: string) => {
    const taskId = `task_${Date.now()}`;
    set({ currentTaskId: taskId });

    // 初始化任务
    const userMsg: IDisplayMessage = {
      id: generateId(),
      role: 'user',
      content: text,
      status: 'done',
      timestamp: Date.now(),
    };

    const task: AgentTask = {
      id: taskId,
      messages: [userMsg],
      steps: [],
      streamingText: '',
      progress: 0,
      status: 'running',
    };

    set((s) => ({
      tasks: { ...s.tasks, [taskId]: task },
    }));

    const controller = runAgentWorkflow(
      text,
      'default',
      (event) => get()._handleSSEEvent(event),
      (error) => {
        console.error('Agent error:', error);
        set((s) => ({
          tasks: {
            ...s.tasks,
            [taskId]: {
              ...s.tasks[taskId],
              status: 'error' as const,
              messages: [
                ...s.tasks[taskId].messages,
                {
                  id: generateId(),
                  role: 'system',
                  content: `错误: ${error.message}`,
                  status: 'error',
                  timestamp: Date.now(),
                },
              ],
            },
          },
        }));
      },
      () => {
        set((s) => ({
          tasks: {
            ...s.tasks,
            [taskId]: {
              ...s.tasks[taskId],
              status: 'completed' as const,
              progress: 100,
            },
          },
        }));
      },
    );

    set({ abortController: controller });
  },

  abortTask: () => {
    const { currentTaskId, abortController } = get();
    if (abortController) {
      abortController.abort();
      if (currentTaskId) abortAgentTask(currentTaskId);
      set({ abortController: null });
    }
  },

  updateContext: (ctx) => set((s) => ({ context: { ...s.context, ...ctx } })),

  clearTask: (taskId) =>
    set((s) => {
      const tasks = { ...s.tasks };
      delete tasks[taskId];
      return { tasks, currentTaskId: s.currentTaskId === taskId ? null : s.currentTaskId };
    }),

  _handleSSEEvent: (event: SSEEvent) => {
    const { currentTaskId, tasks } = get();
    if (!currentTaskId) return;

    const task = tasks[currentTaskId];
    if (!task) return;

    const stepId = generateId();

    switch (event.type) {
      case 'init':
        set((s) => ({
          tasks: {
            ...s.tasks,
            [currentTaskId]: {
              ...s.tasks[currentTaskId],
              id: event.taskId || currentTaskId,
              workflowType: event.workflowType,
            },
          },
        }));
        break;

      case 'node_start': {
        const nodeName = event.node || '';
        const step: IMessageStep = {
          id: stepId,
          type: 'thinking',
          content: `正在执行: ${nodeName}`,
          toolName: nodeName,
          isActive: true,
          status: 'running',
        };
        get()._addStep(currentTaskId, step);
        break;
      }

      case 'node_complete': {
        const doneStep: IMessageStep = {
          id: stepId,
          type: 'thinking',
          content: `完成: ${event.node}`,
          toolName: event.node,
          isActive: false,
          status: event.status === 'requires_action' ? 'error' : 'done',
        };
        get()._addStep(currentTaskId, doneStep);
        break;
      }

      case 'error':
        get()._addMessage(currentTaskId, {
          id: generateId(),
          role: 'system',
          content: `⚠ ${event.node}: ${event.message}`,
          status: 'error',
          timestamp: Date.now(),
        });
        break;

      case 'requires_action':
        get()._addMessage(currentTaskId, {
          id: generateId(),
          role: 'system',
          content: `需要你的决策: ${event.prompt || '请提供修改意见'}`,
          status: 'done',
          timestamp: Date.now(),
          actions: [
            { type: 'confirm', title: '继续', description: '忽略并继续', action: {} },
            { type: 'edit', title: '修改', description: '提供修改意见', action: {} },
          ],
        });
        break;

      case 'done':
        get()._addMessage(currentTaskId, {
          id: generateId(),
          role: 'assistant',
          content: '✅ 全流程执行完成！你可以在各页面查看生成的内容。',
          status: 'done',
          timestamp: Date.now(),
        });
        break;
    }
  },

  _addMessage: (taskId, msg) =>
    set((s) => ({
      tasks: {
        ...s.tasks,
        [taskId]: {
          ...s.tasks[taskId],
          messages: [...(s.tasks[taskId]?.messages || []), msg],
        },
      },
    })),

  _addStep: (taskId, step) =>
    set((s) => {
      const task = s.tasks[taskId];
      if (!task) return s;
      // 更新同 toolName 的旧 step
      const steps = task.steps.map((st) =>
        st.toolName === step.toolName ? { ...st, ...step } : st
      );
      if (!steps.find((st) => st.toolName === step.toolName)) {
        steps.push(step);
      }
      const doneCount = steps.filter((st) => st.status === 'done').length;
      const total = 8; // 8 个节点
      return {
        tasks: {
          ...s.tasks,
          [taskId]: { ...task, steps, progress: Math.round((doneCount / total) * 100) },
        },
      };
    }),
}));
```

- [ ] **Step 4: 验证 TypeScript 编译**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 零错误

- [ ] **Step 5: Commit**

```bash
git add frontend/src/types/agent.ts frontend/src/services/agentApi.ts frontend/src/stores/agentStore.ts
git commit -m "feat: add Agent types, SSE client, and Zustand store (TaskInstance pattern)"
```

---

### Task C2: Agent 面板组件

**Files:**
- Create: `frontend/src/components/agent/AgentFloatingButton.tsx`
- Create: `frontend/src/components/agent/AgentPanel.tsx`
- Create: `frontend/src/components/agent/AgentChat.tsx`
- Create: `frontend/src/components/agent/AgentProgress.tsx`
- Create: `frontend/src/components/agent/ActionCard.tsx`
- Modify: `frontend/src/App.tsx` — 引入 AgentFloatingButton

- [ ] **Step 1: 创建 AgentFloatingButton.tsx**

```tsx
import { FloatButton } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useAgentStore } from '../../stores/agentStore';

export default function AgentFloatingButton() {
  const panelOpen = useAgentStore((s) => s.panelOpen);
  const togglePanel = useAgentStore((s) => s.togglePanel);
  const currentTaskId = useAgentStore((s) => s.currentTaskId);
  const tasks = useAgentStore((s) => s.tasks);
  const runningTask = currentTaskId ? tasks[currentTaskId] : null;

  return (
    <FloatButton
      icon={<RobotOutlined />}
      type={panelOpen ? 'primary' : 'default'}
      tooltip={panelOpen ? '关闭 AI 助手' : 'AI 助手'}
      badge={runningTask?.status === 'running' ? { dot: true, color: 'var(--accent-mint)' } : undefined}
      onClick={togglePanel}
      style={{
        position: 'fixed',
        right: panelOpen ? 440 : 24,
        bottom: 24,
        transition: 'right 0.3s var(--ease-out)',
        zIndex: 1000,
      }}
    />
  );
}
```

- [ ] **Step 2: 创建 AgentPanel.tsx**

```tsx
import { useAgentStore } from '../../stores/agentStore';
import AgentChat from './AgentChat';
import AgentProgress from './AgentProgress';
import { Button, Space } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

export default function AgentPanel() {
  const panelOpen = useAgentStore((s) => s.panelOpen);
  const closePanel = useAgentStore((s) => s.closePanel);
  const currentTaskId = useAgentStore((s) => s.currentTaskId);
  const tasks = useAgentStore((s) => s.tasks);
  const task = currentTaskId ? tasks[currentTaskId] : null;

  if (!panelOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        right: 0,
        top: 0,
        bottom: 0,
        width: 420,
        background: 'var(--bg-root)',
        borderLeft: '1px solid var(--border-default)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 999,
        boxShadow: '-8px 0 32px rgba(0,0,0,0.3)',
      }}
    >
      {/* Header */}
      <div
        style={{
          height: 56,
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border-default)',
          flexShrink: 0,
        }}
      >
        <Space>
          <span style={{ fontSize: 20 }}>🤖</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 15, color: 'var(--text-primary)' }}>
            AI Agent
          </span>
          {task && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: task.status === 'running' ? 'var(--accent-mint)' : 'var(--text-muted)',
            }}>
              {task.status === 'running' ? 'LIVE' : task.status.toUpperCase()}
            </span>
          )}
        </Space>
        <Button type="text" icon={<CloseOutlined />} onClick={closePanel} size="small" />
      </div>

      {/* Progress */}
      {task && task.status === 'running' && <AgentProgress task={task} />}

      {/* Chat */}
      <AgentChat />

      {/* Abort button */}
      {task && task.status === 'running' && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-default)' }}>
          <Button
            danger
            size="small"
            block
            onClick={() => useAgentStore.getState().abortTask()}
          >
            停止执行
          </Button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: 创建 AgentChat.tsx**

```tsx
import { useState, useRef, useEffect } from 'react';
import { Input, Button, Space, Spin, Empty } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useAgentStore } from '../../stores/agentStore';
import type { IDisplayMessage } from '../../types/agent';
import ActionCard from './ActionCard';

function MessageBubble({ msg }: { msg: IDisplayMessage }) {
  const isUser = msg.role === 'user';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isUser ? 'flex-end' : 'flex-start',
        marginBottom: 12,
      }}
    >
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: 12,
          background: isUser
            ? 'linear-gradient(135deg, var(--accent-gold), #8b6914)'
            : msg.status === 'error'
              ? 'rgba(240,101,101,0.1)'
              : 'var(--bg-card)',
          border: isUser ? 'none' : '1px solid var(--border-default)',
          color: isUser ? '#fff' : 'var(--text-primary)',
          fontSize: 13,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
        }}
      >
        {msg.status === 'streaming' && <Spin size="small" style={{ marginRight: 8 }} />}
        {msg.content}
      </div>

      {/* Steps */}
      {msg.steps && msg.steps.length > 0 && (
        <div style={{ marginTop: 4, width: '100%' }}>
          {msg.steps.map((step) => (
            <div
              key={step.id}
              style={{
                fontSize: 11,
                color: step.status === 'running' ? 'var(--accent-cyan)' : 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                padding: '2px 12px',
              }}
            >
              {step.status === 'running' ? '⟳' : step.status === 'done' ? '✓' : '✗'} {step.content}
            </div>
          ))}
        </div>
      )}

      {/* Action Cards */}
      {msg.actions && msg.actions.length > 0 && (
        <div style={{ marginTop: 8, width: '100%' }}>
          {msg.actions.map((action, i) => (
            <ActionCard key={i} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AgentChat() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const currentTaskId = useAgentStore((s) => s.currentTaskId);
  const tasks = useAgentStore((s) => s.tasks);
  const task = currentTaskId ? tasks[currentTaskId] : null;
  const messages = task?.messages || [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Messages */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {!task && (
          <div style={{ padding: '40px 0' }}>
            <Empty
              description={
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                  输入指令让 AI Agent 帮你完成工作<br />
                  例如：「分析今天的微博热搜并生成内容」
                </span>
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          </div>
        )}

        {messages.map((msg) => (
          <MessageBubble key={msg.id} msg={msg} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-default)' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPressEnter={handleSend}
            placeholder="输入指令..."
            disabled={task?.status === 'running'}
            style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}
          />
          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!input.trim() || task?.status === 'running'}
            loading={task?.status === 'running'}
          />
        </Space.Compact>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: 创建 AgentProgress.tsx 和 ActionCard.tsx**

```tsx
// AgentProgress.tsx
import { Steps } from 'antd';
import type { AgentTask } from '../../types/agent';
import { NODE_ORDER, NODE_LABELS } from '../../types/agent';

export default function AgentProgress({ task }: { task: AgentTask }) {
  const currentIdx = NODE_ORDER.indexOf(task.currentNode || '');

  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
      <Steps
        direction="vertical"
        size="small"
        current={currentIdx >= 0 ? currentIdx : 0}
        status={task.status === 'error' ? 'error' : 'process'}
        items={NODE_ORDER.slice(1).map((node) => {
          const idx = NODE_ORDER.indexOf(node);
          const stepDone = task.steps.some((s) => s.toolName === node && s.status === 'done');
          const stepRunning = task.steps.some((s) => s.toolName === node && s.status === 'running');
          return {
            title: NODE_LABELS[node] || node,
            status: stepDone ? 'finish' : stepRunning ? 'process' : ('wait' as const),
          };
        })}
        style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
      />
    </div>
  );
}
```

```tsx
// ActionCard.tsx
import { Button, Card } from 'antd';
import type { IActionCard as IActionCardType } from '../../types/agent';

export default function ActionCard({ action }: { action: IActionCardType }) {
  return (
    <Card
      size="small"
      style={{
        marginBottom: 8,
        borderColor: 'var(--accent-gold)',
        background: 'rgba(212,168,83,0.04)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
            {action.title}
          </div>
          {action.description && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {action.description}
            </div>
          )}
        </div>
        <Button size="small" type="primary" ghost>
          {action.type === 'confirm' ? '确认' : action.type === 'edit' ? '编辑' : '执行'}
        </Button>
      </div>
    </Card>
  );
}
```

- [ ] **Step 5: 在 App.tsx 中引入 Agent 组件**

```tsx
// 在 App.tsx 的 return 的 </AntApp> 之前添加：
import AgentFloatingButton from './components/agent/AgentFloatingButton';
import AgentPanel from './components/agent/AgentPanel';

// 在 <AntApp> 内部最后添加：
<AgentFloatingButton />
<AgentPanel />
```

- [ ] **Step 6: 验证 TypeScript 编译**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 零错误

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/agent/ frontend/src/App.tsx
git commit -m "feat: add Agent floating button, chat panel, progress, and action cards"
```

---

## Phase D: Phase 3-4 功能模块

### Task D1: 审核分发模块 (Review + Distribution)

**Files:**
- Create: `backend/app/models/review.py`
- Create: `backend/app/models/distribution.py`
- Create: `backend/app/schemas/review.py`
- Create: `backend/app/schemas/distribution.py`
- Create: `backend/app/services/review_service.py`
- Create: `backend/app/services/distribution_service.py`
- Create: `backend/app/api/review.py`
- Create: `backend/app/api/distribution.py`
- Modify: `backend/app/main.py` — 注册 router
- Create: `frontend/src/pages/distribution/ReviewQueue.tsx`
- Create: `frontend/src/pages/distribution/DistributionCenter.tsx`
- Create: `frontend/src/pages/distribution/PublishCalendar.tsx`
- Modify: `frontend/src/App.tsx` — 添加路由
- Modify: `frontend/src/components/layout/Sidebar.tsx` — 启用导航

- [ ] **Step 1: 创建审核和分发数据模型**

```python
# backend/app/models/review.py
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel

class Review(SQLModel, table=True):
    __tablename__ = "reviews"
    id: Optional[int] = Field(default=None, primary_key=True)
    content_id: int = Field(foreign_key="contents.id")
    is_approved: bool = Field(default=False)
    issues: Optional[str] = Field(default="[]")  # JSON array
    reviewer_notes: Optional[str] = Field(default="")
    reviewed_at: datetime = Field(default_factory=datetime.now)
    created_at: datetime = Field(default_factory=datetime.now)
```

```python
# backend/app/models/distribution.py
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel

class Distribution(SQLModel, table=True):
    __tablename__ = "distributions"
    id: Optional[int] = Field(default=None, primary_key=True)
    content_id: int = Field(foreign_key="contents.id")
    platform: str = Field(max_length=50)
    publish_url: Optional[str] = Field(default="", max_length=500)
    status: str = Field(default="pending", max_length=50)
    scheduled_time: Optional[datetime] = Field(default=None)
    published_at: Optional[datetime] = Field(default=None)
    platform_data: Optional[str] = Field(default="{}")  # JSON
    created_at: datetime = Field(default_factory=datetime.now)
```

- [ ] **Step 2: 创建 Pydantic Schemas、Services 和 API Routes**

Schemas 文件创建 ReviewCreate/Update/Response/ListResponse 和 DistributionCreate/Update/Response/ListResponse。

Services 文件实现 CRUD + 业务逻辑（审核流程、分发调度）。

API Routes 提供标准 REST 端点。

（实现细节在任务执行时填充，遵循现有 Phase 1-2 的 Model→Schema→Service→API 模式。）

- [ ] **Step 3: 注册路由到 main.py**

```python
from app.api import review
from app.api import distribution

app.include_router(review.router, prefix=API_PREFIX)
app.include_router(distribution.router, prefix=API_PREFIX)
```

- [ ] **Step 4: 创建前端审核分发页面**

ReviewQueue.tsx — 待审核内容队列，支持通过/打回操作
DistributionCenter.tsx — 分发中心，选择平台+查看分发状态
PublishCalendar.tsx — 发布日历视图（使用 dayjs + antd Calendar）

- [ ] **Step 5: 更新 Sidebar 和路由**

Sidebar: 将 `/distribution` 的 `disabled: true` 改为子菜单：
```typescript
{
  key: 'distribution-group',
  icon: <SendOutlined />,
  label: 'Module 3',
  children: [
    { key: '/distribution/review', label: '审核队列' },
    { key: '/distribution/center', label: '分发中心' },
    { key: '/distribution/calendar', label: '发布日历' },
  ],
},
```

App.tsx: 添加路由：
```tsx
<Route path="/distribution/review" element={<ReviewQueue />} />
<Route path="/distribution/center" element={<DistributionCenter />} />
<Route path="/distribution/calendar" element={<PublishCalendar />} />
```

- [ ] **Step 6: Commit**

```bash
git add backend/app/models/review.py backend/app/models/distribution.py backend/app/schemas/ backend/app/services/ backend/app/api/ backend/app/main.py frontend/src/pages/distribution/ frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx frontend/src/components/layout/Header.tsx
git commit -m "feat: add Phase 3 review + distribution modules (models, APIs, pages)"
```

---

### Task D2: 数据分析模块 (Analytics + ECharts)

**Files:**
- Create: `backend/app/models/analytics.py`
- Create: `backend/app/schemas/analytics.py`
- Create: `backend/app/services/analytics_service.py`
- Create: `backend/app/api/analytics.py`
- Modify: `backend/app/main.py` — 注册 router
- Create: `frontend/src/pages/analytics/DataOverview.tsx`
- Create: `frontend/src/pages/analytics/ContentReport.tsx`
- Create: `frontend/src/pages/analytics/OptimizationPanel.tsx`
- Modify: `frontend/src/App.tsx` — 添加路由
- Modify: `frontend/src/components/layout/Sidebar.tsx` — 启用导航

- [ ] **Step 1: 创建数据分析数据模型**

```python
# backend/app/models/analytics.py
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel

class Analytics(SQLModel, table=True):
    __tablename__ = "analytics"
    id: Optional[int] = Field(default=None, primary_key=True)
    content_id: int = Field(foreign_key="contents.id")
    distribution_id: Optional[int] = Field(default=None, foreign_key="distributions.id")
    platform: str = Field(max_length=50)
    views: int = Field(default=0)
    likes: int = Field(default=0)
    comments: int = Field(default=0)
    shares: int = Field(default=0)
    bookmarks: int = Field(default=0)
    follower_gain: int = Field(default=0)
    collected_at: datetime = Field(default_factory=datetime.now)
```

- [ ] **Step 2: 创建 Schema + Service + API Route**

遵循现有模式：Pydantic Schema → Service CRUD → FastAPI Router

关键端点：
- `POST /api/analytics/collect` — 触发模拟数据采集
- `GET /api/analytics/overview` — 数据概览（总阅读/互动/粉丝增长）
- `GET /api/analytics/content/{id}` — 单内容详细分析
- `GET /api/analytics/report` — 综合报表
- `POST /api/analytics/suggestions` — AI 优化建议

- [ ] **Step 3: 创建前端数据分析页面**

DataOverview.tsx — 关键指标卡片 + ECharts 趋势图（折线图、柱状图）
ContentReport.tsx — 单内容分析（饼图分布、雷达图综合评分）
OptimizationPanel.tsx — AI 优化建议面板

- [ ] **Step 4: 更新 Sidebar 和路由**

Sidebar: 将 `/analytics` 的 `disabled: true` 改为子菜单：
```typescript
{
  key: 'analytics-group',
  icon: <BarChartOutlined />,
  label: 'Module 4',
  children: [
    { key: '/analytics/overview', label: '数据概览' },
    { key: '/analytics/report', label: '内容报表' },
    { key: '/analytics/optimization', label: '优化建议' },
  ],
},
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/analytics.py backend/app/schemas/ backend/app/services/ backend/app/api/ backend/app/main.py frontend/src/pages/analytics/ frontend/src/App.tsx frontend/src/components/layout/Sidebar.tsx frontend/src/components/layout/Header.tsx
git commit -m "feat: add Phase 4 analytics module (models, APIs, ECharts pages)"
```

---

## Phase E: 集成测试与文档

### Task E1: 端到端测试 + 文档更新

**Files:**
- Create: `backend/tests/test_agent_workflow.py`
- Modify: `backend/app/main.py` — 更新 lifespan hot_topics count 25→25 (已修正)
- Modify: `CLAUDE.md` — 更新架构文档
- Modify: `CHANGELOG.md` — 更新日志

- [ ] **Step 1: 创建 Agent 工作流测试**

```python
# backend/tests/test_agent_workflow.py
import pytest
from app.agent.graph import get_workflow
from app.agent.state import WorkflowState
from langchain_core.messages import HumanMessage


@pytest.mark.asyncio
async def test_workflow_compiles():
    """验证工作流可以编译"""
    wf = get_workflow()
    assert wf is not None
    nodes = list(wf.get_graph().nodes.keys())
    assert len(nodes) >= 8


@pytest.mark.asyncio
async def test_initial_state():
    """验证初始状态结构"""
    state: WorkflowState = {
        "messages": [HumanMessage(content="测试")],
        "intent": "full_pipeline",
        "hot_topics": [],
        "topics": [],
        "contents": [],
        "review_results": [],
        "publish_records": [],
        "analytics_data": [],
        "report": None,
        "current_node": "",
        "errors": [],
        "human_feedback": None,
        "task_id": "test-1",
        "user_id": "test-user",
        "status": "running",
    }
    assert state["task_id"] == "test-1"
    assert state["intent"] == "full_pipeline"


@pytest.mark.asyncio
async def test_tool_imports():
    """验证所有工具可以导入"""
    from app.agent.tools import ALL_TOOLS
    assert len(ALL_TOOLS) == 11
    tool_names = [t.name for t in ALL_TOOLS]
    assert "fetch_hot_topics" in tool_names
    assert "generate_article" in tool_names
    assert "publish_to_platforms" in tool_names
```

- [ ] **Step 2: 运行测试**

```bash
cd backend && python -m pytest tests/test_agent_workflow.py -v
```

Expected: 3 tests PASS

- [ ] **Step 3: 更新 CLAUDE.md**

更新关键部分：
- Architecture 图：添加 LangGraph Agent Engine 层
- 数据库：SQLite → PostgreSQL + Redis
- 新的 agent/ 目录结构
- 新命令：`docker compose up -d`、`alembic upgrade head`
- AI Service：添加 Agent Tool 描述

- [ ] **Step 4: 更新 CHANGELOG.md**

添加 v0.2.0 条目：
- Agent 架构改造
- LangGraph 8节点工作流
- PostgreSQL + Redis 基础设施
- Agent 对话面板
- Phase 3 审核分发模块
- Phase 4 数据分析模块

- [ ] **Step 5: 最终验证**

```bash
# 1. Docker 服务
docker compose ps
# Expected: postgres healthy, redis healthy

# 2. 数据库迁移
cd backend && alembic upgrade head
# Expected: OK

# 3. 后端启动
cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8082
# Expected: ✓ LangGraph Agent 引擎已初始化, ✓ DeepSeek AI 服务已就绪

# 4. 前端编译
cd frontend && npx tsc --noEmit
# Expected: 零错误

# 5. Agent 端点测试
curl -X POST http://127.0.0.1:8082/api/agent/run \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"分析今天的微博热搜并生成3条内容","user_id":"test"}'
# Expected: SSE 流式响应 (init → node_start → ... → done)
```

- [ ] **Step 6: Commit**

```bash
git add backend/tests/ CLAUDE.md CHANGELOG.md
git commit -m "test: add Agent workflow tests, update documentation"
```

---

## 验证清单

- [ ] `docker compose up -d` — PostgreSQL + Redis 健康运行
- [ ] `alembic upgrade head` — 所有表创建成功
- [ ] `python -c "from app.agent.graph import get_workflow; get_workflow()"` — 工作流编译
- [ ] `curl POST /api/agent/run` — SSE 流式返回完整工作流进度
- [ ] `cd frontend && npx tsc --noEmit` — TypeScript 零错误
- [ ] 前端 Agent 面板 — 浮动按钮可见，点击展开面板
- [ ] 现有页面 — Dashboard/TopicList/ContentList 正常工作
- [ ] Phase 3 页面 — 审核队列/分发中心/发布日历 可访问
- [ ] Phase 4 页面 — 数据概览/内容报表/优化建议 ECharts 图表渲染

---

*计划版本: v1.0 | 总任务数: 10 | 预计工期: 8-12天*
