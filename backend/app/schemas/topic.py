"""选题策划相关 Pydantic Schema"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ==================== 热点话题 Schema ====================

class HotTopicResponse(BaseModel):
    """热点话题响应"""
    id: int
    title: str
    source_platform: str
    hot_index: int
    trend: str
    audience: str
    sentiment: str
    summary: str = ""
    url: str = ""
    duplicate_of_id: Optional[int] = None
    collected_at: datetime

    model_config = {"from_attributes": True}


class HotTopicListResponse(BaseModel):
    """热点话题列表响应"""
    items: List[HotTopicResponse]
    total: int
    dedup_count: int = 0  # 被去重的数量


# ==================== 选题 Schema ====================

class TopicCreate(BaseModel):
    """创建选题请求"""
    title: str = Field(..., max_length=200, description="选题标题")
    description: str = Field(default="", description="选题描述")
    target_audience: str = Field(default="", description="目标受众")
    content_type: str = Field(
        default="article",
        description="内容类型：article/video_script/poster_copy/social_post"
    )
    style: str = Field(
        default="professional",
        description="内容风格：formal/humorous/literary/professional"
    )
    priority: int = Field(default=0, ge=0, le=5, description="优先级")
    scheduled_date: Optional[datetime] = Field(default=None, description="计划发布日期")
    source_hot_topic_id: Optional[int] = Field(default=None, description="关联热点ID")


class TopicUpdate(BaseModel):
    """更新选题请求"""
    title: Optional[str] = Field(default=None, max_length=200)
    description: Optional[str] = None
    target_audience: Optional[str] = None
    content_type: Optional[str] = None
    style: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[int] = Field(default=None, ge=0, le=5)
    scheduled_date: Optional[datetime] = None


class TopicResponse(BaseModel):
    """选题响应"""
    id: int
    title: str
    description: str
    target_audience: str
    content_type: str
    style: str
    status: str
    priority: int
    scheduled_date: Optional[datetime] = None
    source_hot_topic_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TopicListResponse(BaseModel):
    """选题列表响应"""
    items: List[TopicResponse]
    total: int


class TopicGenerateRequest(BaseModel):
    """AI生成选题请求"""
    hot_topic_id: int = Field(..., description="基于的热点话题ID")
    count: int = Field(default=3, ge=1, le=5, description="生成选题数量")
    style_preference: str = Field(default="professional", description="偏好的内容风格")


class TopicGenerateResponse(BaseModel):
    """AI生成选题响应"""
    suggestions: List[TopicCreate]
    analysis: str = Field(default="", description="AI分析说明")


class TopicScheduleRequest(BaseModel):
    """选题排期请求"""
    scheduled_date: datetime = Field(..., description="计划发布日期")
