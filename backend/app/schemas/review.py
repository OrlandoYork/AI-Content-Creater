"""审核 Schemas"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class ReviewCreate(BaseModel):
    content_id: int
    is_approved: bool = False
    issues: str = "[]"
    reviewer_notes: str = ""


class ReviewUpdate(BaseModel):
    is_approved: Optional[bool] = None
    issues: Optional[str] = None
    reviewer_notes: Optional[str] = None


class ReviewResponse(BaseModel):
    id: int
    content_id: int
    is_approved: bool
    issues: str
    reviewer_notes: str
    reviewed_at: datetime
    created_at: datetime
    model_config = {"from_attributes": True}


class ReviewListResponse(BaseModel):
    items: List[ReviewResponse]
    total: int
