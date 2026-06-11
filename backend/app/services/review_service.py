"""审核服务"""
from datetime import datetime
from typing import List, Tuple, Optional
from sqlmodel import Session, select, func
from app.models.review import Review
from app.models.content import Content
from app.schemas.review import ReviewCreate, ReviewUpdate
from app.core.exceptions import NotFoundException
from app.services.coze_service import CozeService


class ReviewService:
    def __init__(self):
        self._coze = CozeService()

    def list_reviews(self, session: Session, content_id: Optional[int] = None,
                     is_approved: Optional[bool] = None, page: int = 1, page_size: int = 20) -> Tuple[List[Review], int]:
        query = select(Review)
        count_query = select(func.count(Review.id))
        if content_id:
            query = query.where(Review.content_id == content_id)
            count_query = count_query.where(Review.content_id == content_id)
        if is_approved is not None:
            query = query.where(Review.is_approved == is_approved)
            count_query = count_query.where(Review.is_approved == is_approved)
        total = session.exec(count_query).one()
        offset = (page - 1) * page_size
        query = query.order_by(Review.created_at.desc()).offset(offset).limit(page_size)
        return list(session.exec(query).all()), total

    def create_review(self, session: Session, data: ReviewCreate) -> Review:
        review = Review(**data.model_dump())
        session.add(review)
        session.commit()
        session.refresh(review)
        return review

    def get_review(self, session: Session, review_id: int) -> Review:
        review = session.get(Review, review_id)
        if not review:
            raise NotFoundException(f"审核记录不存在: id={review_id}")
        return review

    def update_review(self, session: Session, review_id: int, data: ReviewUpdate) -> Review:
        review = self.get_review(session, review_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(review, key, value)
        review.reviewed_at = datetime.now()
        session.add(review)
        session.commit()
        session.refresh(review)
        return review

    def auto_review_content(self, session: Session, content_id: int) -> Review:
        """AI 自动审核内容并创建审核记录"""
        # 获取内容
        content = session.get(Content, content_id)
        if not content:
            raise NotFoundException(f"内容不存在: id={content_id}")

        # 调用 AI 审核
        result = self._coze.review_content(
            content_body=content.body,
            content_type=content.content_type,
            title=content.title,
        )

        # 创建审核记录
        import json
        review = Review(
            content_id=content_id,
            is_approved=result["is_approved"],
            issues=json.dumps(result["issues"], ensure_ascii=False),
            reviewer_notes=result["reviewer_notes"],
            reviewed_at=datetime.now(),
        )
        session.add(review)
        session.commit()
        session.refresh(review)
        return review
