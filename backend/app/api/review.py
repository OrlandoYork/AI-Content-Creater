"""审核 API 路由"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from app.database import get_sync_session
from app.schemas.review import ReviewCreate, ReviewUpdate, ReviewResponse, ReviewListResponse
from app.services.review_service import ReviewService

router = APIRouter(prefix="/reviews", tags=["内容审核"])
review_service = ReviewService()


@router.get("", response_model=ReviewListResponse, summary="获取审核列表")
def list_reviews(
    content_id: Optional[int] = Query(default=None),
    is_approved: Optional[bool] = Query(default=None),
    review_status: Optional[str] = Query(default="pending"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_sync_session),
):
    items, total = review_service.list_reviews(
        session,
        content_id=content_id,
        is_approved=is_approved,
        review_status=review_status if review_status != "all" else None,
        page=page,
        page_size=page_size,
    )
    return ReviewListResponse(items=[ReviewResponse(**r) for r in items], total=total)


@router.post("", response_model=ReviewResponse, status_code=201, summary="创建审核记录")
def create_review(data: ReviewCreate, session: Session = Depends(get_sync_session)):
    review = review_service.create_review(session, data)
    enriched = review_service._enrich_with_title(session, review)
    return ReviewResponse(**enriched)


@router.get("/{review_id}", response_model=ReviewResponse, summary="获取审核详情")
def get_review(review_id: int, session: Session = Depends(get_sync_session)):
    return ReviewResponse(**review_service.get_review(session, review_id))


@router.put("/{review_id}", response_model=ReviewResponse, summary="更新审核记录")
def update_review(review_id: int, data: ReviewUpdate, session: Session = Depends(get_sync_session)):
    return ReviewResponse(**review_service.update_review(session, review_id, data))


@router.post("/auto/{content_id}", response_model=ReviewResponse, status_code=201, summary="AI自动审核内容")
def auto_review_content(content_id: int, session: Session = Depends(get_sync_session)):
    """AI 自动审核指定内容，检测敏感信息和违规内容，并创建审核记录"""
    result = review_service.auto_review_content(session, content_id)
    return ReviewResponse(**result)


@router.post("/{review_id}/approve", summary="审核通过并自动分发")
def approve_review(review_id: int, session: Session = Depends(get_sync_session)):
    """审核通过 → 内容状态改为approved → 自动创建全平台分发记录"""
    result = review_service.approve_review(session, review_id)
    return {"message": "审核通过，已分发到发布中心", **result}


@router.post("/{review_id}/reject", summary="驳回审核，打回内容编辑")
def reject_review(review_id: int, session: Session = Depends(get_sync_session)):
    """驳回审核 → 内容打回draft状态"""
    result = review_service.reject_review(session, review_id)
    return {"message": "审核不通过，已打回内容编辑页面", **result}
