"""选题策划相关数据模型"""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class HotTopic(SQLModel, table=True):
    """热点话题表"""
    __tablename__ = "hot_topics"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=200, description="热点标题")
    source_platform: str = Field(
        max_length=50,
        description="来源平台：weibo/zhihu/douyin/baidu/sohu"
    )
    hot_index: int = Field(default=0, ge=0, le=1000, description="热度指数 0-1000")
    trend: str = Field(
        max_length=20,
        default="stable",
        description="趋势：rising/stable/falling"
    )
    audience: str = Field(
        max_length=200,
        default="",
        description="受众群体描述"
    )
    sentiment: str = Field(
        max_length=20,
        default="neutral",
        description="情感倾向：positive/negative/neutral/mixed"
    )
    summary: str = Field(
        default="",
        description="热点详细内容摘要（200-500字）"
    )
    url: str = Field(
        max_length=500,
        default="",
        description="来源URL"
    )
    duplicate_of_id: Optional[int] = Field(
        default=None,
        foreign_key="hot_topics.id",
        description="去重：被标记为重复的原始话题ID"
    )
    collected_at: datetime = Field(
        default_factory=datetime.now,
        description="采集时间"
    )
    agent_task_id: Optional[str] = Field(default=None, max_length=64, description="关联的 Agent 任务ID")


class Topic(SQLModel, table=True):
    """选题表"""
    __tablename__ = "topics"

    id: Optional[int] = Field(default=None, primary_key=True)
    title: str = Field(max_length=200, description="选题标题")
    description: str = Field(default="", description="选题描述")
    target_audience: str = Field(default="", description="目标受众")
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
    status: str = Field(
        max_length=50,
        default="draft",
        description="状态：draft/selected/scheduled/in_progress/completed/cancelled"
    )
    priority: int = Field(default=0, ge=0, le=5, description="优先级 0-5")
    scheduled_date: Optional[datetime] = Field(default=None, description="计划发布日期")
    source_hot_topic_id: Optional[int] = Field(
        default=None,
        foreign_key="hot_topics.id",
        description="关联热点ID"
    )
    created_at: datetime = Field(default_factory=datetime.now)
    updated_at: datetime = Field(default_factory=datetime.now)
