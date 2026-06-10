"""数据分析 API 路由"""
from typing import Optional, List
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from fastapi.responses import JSONResponse
from app.database import get_session
from app.schemas.analytics import AnalyticsResponse, AnalyticsListResponse, AnalyticsOverviewResponse
from app.services.analytics_service import AnalyticsService

router = APIRouter(prefix="/analytics", tags=["数据分析"])
analytics_service = AnalyticsService()


@router.post("/collect", summary="触发模拟数据采集")
def collect_data(content_ids: Optional[List[int]] = Query(default=None), session: Session = Depends(get_session)):
    records = analytics_service.collect_data(session, content_ids=content_ids)
    return {"status": "ok", "collected": len(records)}


@router.get("/overview", response_model=AnalyticsOverviewResponse, summary="数据概览")
def get_overview(session: Session = Depends(get_session)):
    return analytics_service.get_overview(session)


@router.get("", response_model=AnalyticsListResponse, summary="数据列表")
def list_analytics(
    content_id: Optional[int] = Query(default=None),
    platform: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    items, total = analytics_service.list_analytics(session, content_id=content_id, platform=platform, page=page, page_size=page_size)
    return AnalyticsListResponse(items=[AnalyticsResponse.model_validate(a) for a in items], total=total)


@router.get("/suggestions", summary="AI 优化建议")
def get_suggestions(session: Session = Depends(get_session)):
    suggestions = analytics_service.get_suggestions(session)
    return {"suggestions": suggestions}
