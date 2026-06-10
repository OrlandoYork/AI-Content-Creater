"""分发 Schemas"""
from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel


class DistributionCreate(BaseModel):
    content_id: int
    platform: str
    scheduled_time: Optional[datetime] = None


class DistributionUpdate(BaseModel):
    platform: Optional[str] = None
    status: Optional[str] = None
    publish_url: Optional[str] = None
    scheduled_time: Optional[datetime] = None
    published_at: Optional[datetime] = None
    platform_data: Optional[str] = None


class DistributionResponse(BaseModel):
    id: int
    content_id: int
    platform: str
    publish_url: str
    status: str
    scheduled_time: Optional[datetime]
    published_at: Optional[datetime]
    platform_data: str
    created_at: datetime
    model_config = {"from_attributes": True}


class DistributionListResponse(BaseModel):
    items: List[DistributionResponse]
    total: int
