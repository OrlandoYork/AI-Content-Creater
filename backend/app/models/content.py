"""内容创作相关数据模型"""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel
from sqlalchemy import Column
from sqlalchemy.dialects.postgresql import JSONB


class Content(SQLModel, table=True):
    """内容表"""
    __tablename__ = "contents"

    id: Optional[int] = Field(default=None, primary_key=True)
    topic_id: Optional[int] = Field(
        default=None,
        foreign_key="topics.id",
        description="关联选题ID"
    )
    title: str = Field(max_length=200, description="内容标题")
    body: str = Field(default="", description="内容正文(TEXT)")
    content_type: str = Field(
        max_length=50,
        default="article",
        description="内容类型：article/video_script/poster_copy/social_post"
    )
    style: str = Field(
        max_length=50,
        default="professional",
        description="内容风格：formal/humorous/literary/professional"
    )
    word_count: int = Field(default=0, description="字数/分镜数")
    status: str = Field(
        max_length=50,
        default="draft",
        description="状态：draft/completed/archived"
    )
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
    agent_task_id: Optional[str] = Field(default=None, max_length=64, description="关联的 Agent 任务ID")
    metadata_: Optional[str] = Field(default="{}", sa_column=Column(JSONB), description="扩展元数据")
