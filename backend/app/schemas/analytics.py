"""数据分析 Schemas"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class AnalyticsCreate(BaseModel):
    content_id: int
    distribution_id: Optional[int] = None
    platform: str
    views: int = 0
    likes: int = 0
    comments: int = 0
    shares: int = 0
    bookmarks: int = 0
    follower_gain: int = 0


class AnalyticsResponse(BaseModel):
    id: int
    content_id: int
    distribution_id: Optional[int]
    platform: str
    views: int
    likes: int
    comments: int
    shares: int
    bookmarks: int
    follower_gain: int
    collected_at: datetime
    model_config = {"from_attributes": True}


class AnalyticsListResponse(BaseModel):
    items: List[AnalyticsResponse]
    total: int


class AnalyticsOverviewResponse(BaseModel):
    total_views: int
    total_likes: int
    total_comments: int
    total_shares: int
    total_bookmarks: int
    total_follower_gain: int
    total_contents: int
    platform_breakdown: List[dict]
