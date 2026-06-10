"""分发记录模型"""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class Distribution(SQLModel, table=True):
    __tablename__ = "distributions"
    id: Optional[int] = Field(default=None, primary_key=True)
    content_id: int = Field(foreign_key="contents.id")
    platform: str = Field(max_length=50)
    publish_url: Optional[str] = Field(default="", max_length=500)
    status: str = Field(default="pending", max_length=50)
    scheduled_time: Optional[datetime] = Field(default=None)
    published_at: Optional[datetime] = Field(default=None)
    platform_data: Optional[str] = Field(default="{}")
    created_at: datetime = Field(default_factory=datetime.now)
