from logging.config import fileConfig

from sqlalchemy import pool
from alembic import context
from sqlmodel import SQLModel

from app.database import sync_engine
from app.core.config import DATABASE_URL_SYNC

# 导入所有模型确保 SQLModel.metadata 包含所有表
from app.models.topic import HotTopic, Topic  # noqa
from app.models.content import Content  # noqa
from app.models.agent_task import AgentTask  # noqa

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 使用所有模型的 metadata
target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    context.configure(
        url=DATABASE_URL_SYNC,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
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
