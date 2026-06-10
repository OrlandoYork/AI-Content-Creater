"""审核 API 路由"""
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlmodel import Session
from app.database import get_session
from app.schemas.review import ReviewCreate, ReviewUpdate, ReviewResponse, ReviewListResponse
from app.services.review_service import ReviewService

router = APIRouter(prefix="/reviews", tags=["内容审核"])
review_service = ReviewService()


@router.get("", response_model=ReviewListResponse, summary="获取审核列表")
def list_reviews(
    content_id: Optional[int] = Query(default=None),
    is_approved: Optional[bool] = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    session: Session = Depends(get_session),
):
    items, total = review_service.list_reviews(session, content_id=content_id, is_approved=is_approved, page=page, page_size=page_size)
    return ReviewListResponse(items=[ReviewResponse.model_validate(r) for r in items], total=total)


@router.post("", response_model=ReviewResponse, status_code=201, summary="创建审核记录")
def create_review(data: ReviewCreate, session: Session = Depends(get_session)):
    return ReviewResponse.model_validate(review_service.create_review(session, data))


@router.get("/{review_id}", response_model=ReviewResponse, summary="获取审核详情")
def get_review(review_id: int, session: Session = Depends(get_session)):
    return ReviewResponse.model_validate(review_service.get_review(session, review_id))


@router.put("/{review_id}", response_model=ReviewResponse, summary="更新审核记录")
def update_review(review_id: int, data: ReviewUpdate, session: Session = Depends(get_session)):
    return ReviewResponse.model_validate(review_service.update_review(session, review_id, data))
