"""审核服务"""
import json
from datetime import datetime
from typing import List, Tuple, Optional
from sqlmodel import Session, select, func
from app.models.review import Review
from app.models.content import Content
from app.schemas.review import ReviewCreate, ReviewUpdate
from app.core.exceptions import NotFoundException, BusinessException
from app.services.coze_service import CozeService
from app.services.distribution_service import DistributionService


class ReviewService:
    def __init__(self):
        self._coze = CozeService()
        self._distribution_service = DistributionService()

    def _enrich_with_title(self, session: Session, review: Review) -> dict:
        """Enrich a review dict with the content's title"""
        content = session.get(Content, review.content_id)
        title = content.title if content else ""
        return {
            "id": review.id,
            "content_id": review.content_id,
            "content_title": title,
            "is_approved": review.is_approved,
            "issues": review.issues or "[]",
            "reviewer_notes": review.reviewer_notes or "",
            "review_status": review.review_status if hasattr(review, 'review_status') else "pending",
            "reviewed_at": review.reviewed_at,
            "created_at": review.created_at,
        }

    def list_reviews(self, session: Session, content_id: Optional[int] = None,
                     is_approved: Optional[bool] = None, review_status: Optional[str] = None,
                     page: int = 1, page_size: int = 20) -> Tuple[List[dict], int]:
        query = select(Review)
        count_query = select(func.count(Review.id))
        if content_id:
            query = query.where(Review.content_id == content_id)
            count_query = count_query.where(Review.content_id == content_id)
        if is_approved is not None:
            query = query.where(Review.is_approved == is_approved)
            count_query = count_query.where(Review.is_approved == is_approved)
        if review_status:
            query = query.where(Review.review_status == review_status)
            count_query = count_query.where(Review.review_status == review_status)
        total = session.exec(count_query).one()
        offset = (page - 1) * page_size
        query = query.order_by(Review.created_at.desc()).offset(offset).limit(page_size)
        reviews = list(session.exec(query).all())
        return [self._enrich_with_title(session, r) for r in reviews], total

    def create_review(self, session: Session, data: ReviewCreate) -> Review:
        review = Review(**data.model_dump())
        session.add(review)
        session.commit()
        session.refresh(review)
        return review

    def get_review(self, session: Session, review_id: int) -> dict:
        review = session.get(Review, review_id)
        if not review:
            raise NotFoundException(f"审核记录不存在: id={review_id}")
        return self._enrich_with_title(session, review)

    def update_review(self, session: Session, review_id: int, data: ReviewUpdate) -> dict:
        review = session.get(Review, review_id)
        if not review:
            raise NotFoundException(f"审核记录不存在: id={review_id}")
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(review, key, value)
        review.reviewed_at = datetime.now()
        session.add(review)
        session.commit()
        session.refresh(review)
        return self._enrich_with_title(session, review)

    def auto_review_content(self, session: Session, content_id: int) -> dict:
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
        review = Review(
            content_id=content_id,
            is_approved=result["is_approved"],
            issues=json.dumps(result["issues"], ensure_ascii=False),
            reviewer_notes=result["reviewer_notes"],
            review_status="pending",
            reviewed_at=datetime.now(),
        )
        session.add(review)
        session.commit()
        session.refresh(review)
        return self._enrich_with_title(session, review)

    def approve_review(self, session: Session, review_id: int) -> dict:
        """审核通过 → 自动创建全平台分发记录"""
        review = session.get(Review, review_id)
        if not review:
            raise NotFoundException(f"审核记录不存在: id={review_id}")
        if review.review_status == "approved":
            raise BusinessException("该审核已通过，无需重复操作")

        # 更新审核状态
        review.review_status = "approved"
        review.is_approved = True
        review.reviewed_at = datetime.now()

        # 更新内容状态
        content = session.get(Content, review.content_id)
        if content:
            content.status = "approved"

        # 自动创建全平台分发
        dists = self._distribution_service.batch_create_distributions(
            session, review.content_id, ["weibo", "douyin", "xiaohongshu", "wechat"]
        )

        session.add(review)
        session.commit()
        session.refresh(review)

        result = self._enrich_with_title(session, review)
        result["distribution_ids"] = [d.id for d in dists]
        return result

    def reject_review(self, session: Session, review_id: int) -> dict:
        """审核驳回 → 打回内容编辑"""
        review = session.get(Review, review_id)
        if not review:
            raise NotFoundException(f"审核记录不存在: id={review_id}")
        if review.review_status == "rejected":
            raise BusinessException("该审核已被驳回，无需重复操作")

        # 更新审核状态
        review.review_status = "rejected"
        review.reviewed_at = datetime.now()

        # 打回内容到草稿状态
        content = session.get(Content, review.content_id)
        if content:
            content.status = "draft"

        session.add(review)
        session.commit()
        session.refresh(review)

        return self._enrich_with_title(session, review)
