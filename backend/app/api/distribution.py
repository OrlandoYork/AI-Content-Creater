"""分发 API 路由"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from app.database import get_session
from app.schemas.distribution import DistributionCreate, DistributionUpdate, DistributionResponse, DistributionListResponse
from app.services.distribution_service import DistributionService

router = APIRouter(prefix="/distributions", tags=["多平台分发"])
distribution_service = DistributionService()


@router.get("", response_model=DistributionListResponse, summary="获取分发列表")
def list_distributions(
    content_id: Optional[int] = Query(default=None),
    platform: Optional[str] = Query(default=None),
    status: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    items, total = distribution_service.list_distributions(session, content_id=content_id, platform=platform, status=status, page=page, page_size=page_size)
    return DistributionListResponse(items=[DistributionResponse.model_validate(d) for d in items], total=total)


@router.post("", response_model=DistributionResponse, status_code=201, summary="创建分发记录")
def create_distribution(data: DistributionCreate, session: Session = Depends(get_session)):
    return DistributionResponse.model_validate(distribution_service.create_distribution(session, data))


@router.get("/calendar", summary="获取发布日历")
def get_calendar(year: int = Query(...), month: int = Query(...), session: Session = Depends(get_session)):
    return distribution_service.get_calendar(session, year, month)


@router.get("/{distribution_id}", response_model=DistributionResponse, summary="获取分发详情")
def get_distribution(distribution_id: int, session: Session = Depends(get_session)):
    return DistributionResponse.model_validate(distribution_service.get_distribution(session, distribution_id))


@router.put("/{distribution_id}", response_model=DistributionResponse, summary="更新分发记录")
def update_distribution(distribution_id: int, data: DistributionUpdate, session: Session = Depends(get_session)):
    return DistributionResponse.model_validate(distribution_service.update_distribution(session, distribution_id, data))
