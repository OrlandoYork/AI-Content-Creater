"""数据库连接管理 — PostgreSQL + asyncpg"""
import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlmodel import SQLModel, Session
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

# === Sync Session factory (现有 API 兼容) ===
SyncSessionLocal = sessionmaker(
    sync_engine,
    class_=Session,
    expire_on_commit=False,
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
    """获取异步数据库会话（FastAPI 依赖注入 — 新路由使用）"""
    async with AsyncSessionLocal() as session:
        yield session


def get_sync_session():
    """获取同步数据库会话（FastAPI 依赖注入 — 现有 API 兼容）"""
    with SyncSessionLocal() as session:
        yield session


async def close_connections():
    """关闭所有连接"""
    await async_engine.dispose()
    sync_engine.dispose()
    logger.info("✓ 数据库连接已关闭")
