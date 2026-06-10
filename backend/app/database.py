"""数据库连接管理"""
from pathlib import Path
from sqlmodel import create_engine, Session, SQLModel
from app.core.config import DATABASE_URL, DEBUG

# 确保数据目录存在
db_path = DATABASE_URL.replace("sqlite:///", "")
Path(db_path).parent.mkdir(parents=True, exist_ok=True)

# 创建引擎
# SQLite需要check_same_thread=False以支持FastAPI异步
connect_args = {"check_same_thread": False}
engine = create_engine(
    DATABASE_URL,
    echo=DEBUG,
    connect_args=connect_args,
)


def create_db_and_tables():
    """创建所有表"""
    SQLModel.metadata.create_all(engine)


def get_session():
    """获取数据库会话（依赖注入）"""
    with Session(engine) as session:
        yield session
