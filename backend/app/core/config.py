"""应用配置管理"""
import os
from pathlib import Path

# 项目根目录 (backend/)
BASE_DIR = Path(__file__).resolve().parent.parent

# 数据库配置
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    f"sqlite:///{BASE_DIR / 'data' / 'app.db'}"
)

# Coze API 配置（预留）
COZE_API_KEY = os.getenv("COZE_API_KEY", "")
COZE_BOT_ID = os.getenv("COZE_BOT_ID", "")

# DeepSeek API 配置
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-v4-flash")
DEEPSEEK_TIMEOUT = int(os.getenv("DEEPSEEK_TIMEOUT", "180"))
DEEPSEEK_ENABLED = os.getenv("DEEPSEEK_ENABLED", "true").lower() == "true" and bool(DEEPSEEK_API_KEY)

# 服务配置
API_PREFIX = "/api"
PROJECT_NAME = "AI全媒体内容生产与分发系统"
VERSION = "0.1.0"
DEBUG = os.getenv("DEBUG", "true").lower() == "true"
