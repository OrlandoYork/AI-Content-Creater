"""FastAPI 应用入口"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import PROJECT_NAME, VERSION, API_PREFIX, DEEPSEEK_MODEL
from app.database import engine, create_db_and_tables, Session
from app.core.exceptions import AppException
from app.api import topics
from app.api import content

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """应用生命周期管理"""
    from sqlmodel import select, SQLModel
    from sqlalchemy import inspect as sa_inspect, text as sa_text

    # Step 1: 确保数据目录存在并创建表
    create_db_and_tables()

    # Step 2: Schema 迁移（检查 hot_topics 表是否有新字段）
    inspector = sa_inspect(engine)
    if "hot_topics" in inspector.get_table_names():
        existing_cols = {c["name"] for c in inspector.get_columns("hot_topics")}
        required_cols = {"summary", "url", "duplicate_of_id"}
        if not required_cols.issubset(existing_cols):
            logger.info("检测到旧 schema，迁移 hot_topics 表……")
            with engine.begin() as conn:
                conn.execute(sa_text("DROP TABLE IF EXISTS hot_topics"))
            # 重新创建所有表
            SQLModel.metadata.create_all(engine)
            logger.info("✓ hot_topics 表已重建（含新字段）")

    # Step 3: 报告 DeepSeek AI 状态
    from app.services.deepseek_service import DeepSeekService
    ai = DeepSeekService()
    if ai.available:
        logger.info("✓ DeepSeek AI 服务已就绪 (model: %s)", DEEPSEEK_MODEL)
    else:
        logger.warning("✗ DeepSeek API Key 未设置 — 将使用 Mock 数据 (请设置 DEEPSEEK_API_KEY 环境变量)")

    # Step 4: 初始化模拟热点数据
    from app.models.topic import HotTopic
    from app.services.simulation_service import SimulationService

    sim = SimulationService()
    with Session(engine) as session:
        existing = session.exec(select(HotTopic)).all()
        if len(existing) == 0:
            logger.info("初始化热点数据（5平台 × 15条 = 75条）……")
            topics_data = sim.generate_hot_topics(count=75)
            for t in topics_data:
                session.add(t)
            session.commit()
            logger.info("✓ 热点数据初始化完成: %d 条", len(topics_data))

    yield
    # 关闭时：清理资源（暂不需要）


app = FastAPI(
    title=PROJECT_NAME,
    version=VERSION,
    lifespan=lifespan,
)

# CORS 配置（允许前端开发服务器）
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 全局异常处理
@app.exception_handler(AppException)
async def app_exception_handler(request, exc: AppException):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=exc.code,
        content={"detail": exc.message},
    )


# 注册路由
app.include_router(topics.router, prefix=API_PREFIX)
app.include_router(content.router, prefix=API_PREFIX)
app.include_router(content.titles_router, prefix=API_PREFIX)
