"""审核记录模型"""
from datetime import datetime
from typing import Optional
from sqlmodel import Field, SQLModel


class Review(SQLModel, table=True):
    __tablename__ = "reviews"
    id: Optional[int] = Field(default=None, primary_key=True)
    content_id: int = Field(foreign_key="contents.id")
    is_approved: bool = Field(default=False)
    issues: Optional[str] = Field(default="[]")
    reviewer_notes: Optional[str] = Field(default="")
    reviewed_at: datetime = Field(default_factory=datetime.now)
    created_at: datetime = Field(default_factory=datetime.now)
