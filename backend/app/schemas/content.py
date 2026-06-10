"""内容创作相关 Pydantic Schema"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


# ==================== 内容 Schema ====================

class ContentCreate(BaseModel):
    """创建内容请求"""
    topic_id: Optional[int] = Field(default=None, description="关联选题ID")
    title: str = Field(..., max_length=200, description="内容标题")
    body: str = Field(default="", description="内容正文")
    content_type: str = Field(
        default="article",
        description="内容类型：article/video_script/poster_copy/social_post"
    )
    style: str = Field(
        default="professional",
        description="内容风格：formal/humorous/literary/professional"
    )
    word_count: int = Field(default=0, description="字数/分镜数")


class ContentUpdate(BaseModel):
    """更新内容请求"""
    title: Optional[str] = Field(default=None, max_length=200)
    body: Optional[str] = None
    content_type: Optional[str] = None
    style: Optional[str] = None
    word_count: Optional[int] = None
    status: Optional[str] = None


class ContentResponse(BaseModel):
    """内容响应"""
    id: int
    topic_id: Optional[int] = None
    title: str
    body: str
    content_type: str
    style: str
    word_count: int
    status: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContentListResponse(BaseModel):
    """内容列表响应"""
    items: List[ContentResponse]
    total: int


# ==================== AI 生成 Schema ====================

class ContentGenerateRequest(BaseModel):
    """AI生成内容请求"""
    topic_id: int = Field(..., description="基于的选题ID")
    content_type: str = Field(
        default="article",
        description="内容类型：article/video_script/poster_copy/social_post"
    )
    style: str = Field(
        default="professional",
        description="内容风格：formal/humorous/literary/professional"
    )


class ContentRewriteRequest(BaseModel):
    """内容改写请求"""
    instruction: str = Field(
        default="rewrite",
        description="改写模式：rewrite(重写)/polish(润色)/expand(扩写)"
    )
    style: Optional[str] = Field(
        default=None,
        description="可选：改为不同风格"
    )


# ==================== 标题生成 Schema ====================

class TitleGenerateRequest(BaseModel):
    """标题生成请求"""
    body: str = Field(..., description="内容正文")
    content_type: str = Field(default="article", description="内容类型")
    count: int = Field(default=5, ge=1, le=10, description="生成标题数量")


class TitleGenerateResponse(BaseModel):
    """标题生成响应"""
    titles: List[str]
