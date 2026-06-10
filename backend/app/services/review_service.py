"""审核服务"""
from datetime import datetime
from typing import List, Tuple, Optional
from sqlmodel import Session, select, func
from app.models.review import Review
from app.schemas.review import ReviewCreate, ReviewUpdate
from app.core.exceptions import NotFoundException


class ReviewService:
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
