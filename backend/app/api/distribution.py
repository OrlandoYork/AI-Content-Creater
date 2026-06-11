"""分发 API 路由"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Body
from sqlmodel import Session
from app.database import get_sync_session
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
    session: Session = Depends(get_sync_session),
):
    items, total = distribution_service.list_distributions(session, content_id=content_id, platform=platform, status=status, page=page, page_size=page_size)
    return DistributionListResponse(items=[DistributionResponse(**d) for d in items], total=total)


@router.post("", response_model=DistributionResponse, status_code=201, summary="创建分发记录（含AI平台适配）")
def create_distribution(data: DistributionCreate, session: Session = Depends(get_sync_session)):
    """为内容创建分发记录，自动进行 AI 多平台内容适配"""
    return DistributionResponse(**distribution_service.create_distribution(session, data))


@router.post("/batch/{content_id}", response_model=List[DistributionResponse], status_code=201, summary="一键分发到多平台")
def batch_distribute(
    content_id: int,
    platforms: List[str] = Body(..., description="目标平台列表，如 ['weibo','douyin','xiaohongshu']"),
    session: Session = Depends(get_sync_session),
):
    """一键分发到多个平台，每个平台独立进行 AI 内容适配"""
    items = distribution_service.batch_create_distributions(session, content_id, platforms)
    return [DistributionResponse(**d) for d in items]


@router.post("/{distribution_id}/publish", response_model=DistributionResponse, summary="立即发布")
def publish_distribution(distribution_id: int, session: Session = Depends(get_sync_session)):
    """模拟发布待发布的分布记录"""
    return DistributionResponse(**distribution_service.publish_distribution(session, distribution_id))


@router.post("/{distribution_id}/cancel", response_model=DistributionResponse, summary="取消分发")
def cancel_distribution(distribution_id: int, session: Session = Depends(get_sync_session)):
    """取消待发布或已排期的分发"""
    return DistributionResponse(**distribution_service.cancel_distribution(session, distribution_id))


@router.get("/calendar", summary="获取发布日历")
def get_calendar(year: int = Query(...), month: int = Query(...), session: Session = Depends(get_sync_session)):
    return distribution_service.get_calendar(session, year, month)


@router.get("/{distribution_id}", response_model=DistributionResponse, summary="获取分发详情")
def get_distribution(distribution_id: int, session: Session = Depends(get_sync_session)):
    return DistributionResponse(**distribution_service.get_distribution(session, distribution_id))


@router.put("/{distribution_id}", response_model=DistributionResponse, summary="更新分发记录")
def update_distribution(distribution_id: int, data: DistributionUpdate, session: Session = Depends(get_sync_session)):
    return DistributionResponse(**distribution_service.update_distribution(session, distribution_id, data))
