"""数据分析模型"""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class Analytics(SQLModel, table=True):
    __tablename__ = "analytics"
    id: Optional[int] = Field(default=None, primary_key=True)
    content_id: int = Field(foreign_key="contents.id")
    distribution_id: Optional[int] = Field(default=None, foreign_key="distributions.id")
    platform: str = Field(max_length=50)
    views: int = Field(default=0)
    likes: int = Field(default=0)
    comments: int = Field(default=0)
    shares: int = Field(default=0)
    bookmarks: int = Field(default=0)
    follower_gain: int = Field(default=0)
    collected_at: datetime = Field(default_factory=datetime.now)
