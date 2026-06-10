"""FastAPI 应用入口"""
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import PROJECT_NAME, VERSION, API_PREFIX, DEEPSEEK_MODEL
from app.database import sync_engine, create_db_and_tables, AsyncSessionLocal
from app.core.exceptions import AppException
from app.api import topics
from app.api import content
from app.api import agent

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
    from sqlmodel import select, Session, SQLModel

    # Step 1: 确保表已创建
    await create_db_and_tables()
    logger.info("✓ 数据库表检查完成")

    # Step 2: 报告 DeepSeek AI 状态
    from app.services.deepseek_service import DeepSeekService
    ai = DeepSeekService()
    if ai.available:
        logger.info("✓ DeepSeek AI 服务已就绪 (model: %s)", DEEPSEEK_MODEL)
    else:
        logger.warning("✗ DeepSeek API Key 未设置 — 将使用 Mock 数据 (请设置 DEEPSEEK_API_KEY 环境变量)")

    # Step 3: 初始化模拟热点数据
    from app.models.topic import HotTopic
    from app.services.simulation_service import SimulationService

    sim = SimulationService()
    with Session(sync_engine) as session:
        existing = session.exec(select(HotTopic)).all()
        if len(existing) == 0:
            logger.info("初始化热点数据（5平台 × 5条 = 25条）……")
            topics_data = sim.generate_hot_topics(count=25)
            for t in topics_data:
                session.add(t)
            session.commit()
            logger.info("✓ 热点数据初始化完成: %d 条", len(topics_data))

    # Step 4: 初始化 LangGraph Agent 引擎
    try:
        from app.agent.graph import get_workflow
        get_workflow()
        logger.info("✓ LangGraph Agent 引擎已初始化")
    except Exception as e:
        logger.warning("✗ LangGraph Agent 引擎初始化失败: %s", e)

    yield

    # 关闭时清理
    from app.database import close_connections
    await close_connections()


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
app.include_router(agent.router, prefix=API_PREFIX)
