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
# PostgreSQL 同步 URL (Alembic迁移+LangGraph Checkpointer使用)
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
