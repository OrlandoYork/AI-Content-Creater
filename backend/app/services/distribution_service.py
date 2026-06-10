"""分发服务"""
import random
from datetime import datetime
from typing import List, Tuple, Optional
from sqlmodel import Session, select, func
from app.models.distribution import Distribution
from app.schemas.distribution import DistributionCreate, DistributionUpdate
from app.core.exceptions import NotFoundException

PLATFORMS = ["wechat", "weibo", "douyin", "xiaohongshu"]


class DistributionService:
    def list_distributions(self, session: Session, content_id: Optional[int] = None,
                           platform: Optional[str] = None, status: Optional[str] = None,
                           page: int = 1, page_size: int = 20) -> Tuple[List[Distribution], int]:
        query = select(Distribution)
        count_query = select(func.count(Distribution.id))
        if content_id:
            query = query.where(Distribution.content_id == content_id)
            count_query = count_query.where(Distribution.content_id == content_id)
        if platform and platform != "all":
            query = query.where(Distribution.platform == platform)
            count_query = count_query.where(Distribution.platform == platform)
        if status and status != "all":
            query = query.where(Distribution.status == status)
            count_query = count_query.where(Distribution.status == status)
        total = session.exec(count_query).one()
        offset = (page - 1) * page_size
        query = query.order_by(Distribution.created_at.desc()).offset(offset).limit(page_size)
        return list(session.exec(query).all()), total

    def create_distribution(self, session: Session, data: DistributionCreate) -> Distribution:
        platform_ids = {"wechat": "wx", "weibo": "wb", "douyin": "dy", "xiaohongshu": "xhs"}
        pid = platform_ids.get(data.platform, "unk")
        dist = Distribution(
            **data.model_dump(),
            publish_url=f"https://{data.platform}.com/mock/{pid}_{random.randint(1000, 9999)}",
            status="published",
            published_at=datetime.now(),
        )
        session.add(dist)
        session.commit()
        session.refresh(dist)
        return dist

    def get_distribution(self, session: Session, distribution_id: int) -> Distribution:
        dist = session.get(Distribution, distribution_id)
        if not dist:
            raise NotFoundException(f"分发记录不存在: id={distribution_id}")
        return dist

    def update_distribution(self, session: Session, distribution_id: int, data: DistributionUpdate) -> Distribution:
        dist = self.get_distribution(session, distribution_id)
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(dist, key, value)
        session.add(dist)
        session.commit()
        session.refresh(dist)
        return dist

    def get_calendar(self, session: Session, year: int, month: int) -> List[dict]:
        query = select(Distribution).where(
            Distribution.scheduled_time is not None,
            func.extract('year', Distribution.scheduled_time) == year,
            func.extract('month', Distribution.scheduled_time) == month,
        )
        records = session.exec(query).all()
        return [{"id": r.id, "content_id": r.content_id, "platform": r.platform,
                 "status": r.status, "scheduled_time": r.scheduled_time.isoformat() if r.scheduled_time else None}
                for r in records]
