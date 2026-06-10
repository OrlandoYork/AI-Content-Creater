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
