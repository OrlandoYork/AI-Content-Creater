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
