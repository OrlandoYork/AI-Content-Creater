"""LangGraph Checkpointer — PostgreSQL 持久化"""
import logging
import psycopg
from langgraph.checkpoint.postgres import PostgresSaver

logger = logging.getLogger(__name__)

_checkpointer: PostgresSaver | None = None

_CHECKPOINTER_CONN_STRING = "host=localhost dbname=contentai user=contentai password=contentai123"


def get_checkpointer() -> PostgresSaver:
    global _checkpointer
    if _checkpointer is None:
        conn = psycopg.connect(_CHECKPOINTER_CONN_STRING)
        conn.autocommit = True  # Required: CREATE INDEX CONCURRENTLY needs autocommit
        _checkpointer = PostgresSaver(conn)
        _checkpointer.setup()
        logger.info("✓ LangGraph Checkpointer 已初始化 (PostgreSQL)")
    return _checkpointer
