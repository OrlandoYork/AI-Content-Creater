"""选题策划业务逻辑层"""
from datetime import datetime
from typing import List, Optional, Tuple

from sqlmodel import Session, select, func

from app.models.topic import HotTopic, Topic
from app.schemas.topic import (
    TopicCreate,
    TopicUpdate,
    TopicGenerateRequest,
    TopicGenerateResponse,
)
from app.services.simulation_service import SimulationService
from app.services.coze_service import CozeService
from app.core.exceptions import NotFoundException, BusinessException


class TopicService:
    """选题策划服务"""

    def __init__(self):
        self._simulation = SimulationService()
        self._coze = CozeService()

    # ==================== 热点话题管理 ====================

    def get_hot_topics(
        self,
        session: Session,
        platform: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[HotTopic], int]:
        """获取热点话题列表（分页+筛选）"""
        query = select(HotTopic)
        count_query = select(func.count(HotTopic.id))

        if platform and platform != "all":
            query = query.where(HotTopic.source_platform == platform)
            count_query = count_query.where(HotTopic.source_platform == platform)

        total = session.exec(count_query).one()

        offset = (page - 1) * page_size
        # 按热度降序 + 去重项排后
        query = query.order_by(
            HotTopic.duplicate_of_id.is_not(None),  # nulls first (unique first)
            HotTopic.hot_index.desc()
        ).offset(offset).limit(page_size)
        items = list(session.exec(query).all())

        return items, total

    def refresh_hot_topics(self, session: Session) -> List[HotTopic]:
        """刷新热点数据"""
        new_topics = self._simulation.refresh_hot_topics()
        for topic in new_topics:
            session.add(topic)
        session.commit()
        # 重新查询（获取ID）
        return new_topics

    def get_hot_topic(self, session: Session, topic_id: int) -> HotTopic:
        """获取单个热点话题"""
        topic = session.get(HotTopic, topic_id)
        if not topic:
            raise NotFoundException(f"热点话题不存在: id={topic_id}")
        return topic

    def get_hot_topic_stats(self, session: Session) -> dict:
        """获取热点话题统计信息"""
        all_topics = list(session.exec(select(HotTopic)).all())

        total = len(all_topics)
        dedup_count = sum(1 for t in all_topics if t.duplicate_of_id is not None)

        # 按平台统计
        platform_stats = {}
        for t in all_topics:
            p = t.source_platform
            if p not in platform_stats:
                platform_stats[p] = {"count": 0, "total_index": 0, "dedup": 0}
            platform_stats[p]["count"] += 1
            platform_stats[p]["total_index"] += t.hot_index
            if t.duplicate_of_id is not None:
                platform_stats[p]["dedup"] += 1

        # 按情感统计
        sentiment_stats = {}
        for t in all_topics:
            s = t.sentiment
            sentiment_stats[s] = sentiment_stats.get(s, 0) + 1

        # 按趋势统计
        trend_stats = {}
        for t in all_topics:
            tr = t.trend
            trend_stats[tr] = trend_stats.get(tr, 0) + 1

        return {
            "total": total,
            "dedup_count": dedup_count,
            "unique_count": total - dedup_count,
            "platform_stats": platform_stats,
            "sentiment_stats": sentiment_stats,
            "trend_stats": trend_stats,
        }

    # ==================== 选题CRUD ====================

    def list_topics(
        self,
        session: Session,
        status: Optional[str] = None,
        content_type: Optional[str] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Topic], int]:
        """选题列表（分页+筛选）"""
        query = select(Topic)
        count_query = select(func.count(Topic.id))

        if status and status != "all":
            query = query.where(Topic.status == status)
            count_query = count_query.where(Topic.status == status)
        if content_type and content_type != "all":
            query = query.where(Topic.content_type == content_type)
            count_query = count_query.where(Topic.content_type == content_type)

        total = session.exec(count_query).one()

        offset = (page - 1) * page_size
        query = query.order_by(Topic.created_at.desc()).offset(offset).limit(page_size)
        items = list(session.exec(query).all())

        return items, total

    def create_topic(self, session: Session, data: TopicCreate) -> Topic:
        """创建选题"""
        topic = Topic(**data.model_dump())
        session.add(topic)
        session.commit()
        session.refresh(topic)
        return topic

    def get_topic(self, session: Session, topic_id: int) -> Topic:
        """获取选题详情"""
        topic = session.get(Topic, topic_id)
        if not topic:
            raise NotFoundException(f"选题不存在: id={topic_id}")
        return topic

    def update_topic(
        self, session: Session, topic_id: int, data: TopicUpdate
    ) -> Topic:
        """更新选题"""
        topic = self.get_topic(session, topic_id)

        # 只更新非空字段
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(topic, key, value)
        topic.updated_at = datetime.now()

        session.add(topic)
        session.commit()
        session.refresh(topic)
        return topic

    def delete_topic(self, session: Session, topic_id: int) -> None:
        """删除选题"""
        topic = self.get_topic(session, topic_id)
        session.delete(topic)
        session.commit()

    def schedule_topic(
        self, session: Session, topic_id: int, scheduled_date: datetime
    ) -> Topic:
        """排期选题"""
        topic = self.get_topic(session, topic_id)

        if topic.status == "completed":
            raise BusinessException("已完成的选题不能重新排期")

        topic.scheduled_date = scheduled_date
        topic.status = "scheduled"
        topic.updated_at = datetime.now()

        session.add(topic)
        session.commit()
        session.refresh(topic)
        return topic

    # ==================== AI选题生成 ====================

    def generate_topics(
        self, session: Session, request: TopicGenerateRequest
    ) -> TopicGenerateResponse:
        """基于热点话题AI生成选题建议"""
        # 获取关联的热点话题
        hot_topic = self.get_hot_topic(session, request.hot_topic_id)

        # 调用Coze服务生成选题建议
        result = self._coze.generate_topic_suggestions(
            hot_topic_title=hot_topic.title,
            hot_topic_platform=hot_topic.source_platform,
            count=request.count,
            style_preference=request.style_preference,
        )

        # 转换为TopicCreate对象
        suggestions = []
        for s in result["suggestions"]:
            suggestions.append(
                TopicCreate(
                    title=s["title"],
                    description=s["description"],
                    target_audience=s["target_audience"],
                    content_type=s["content_type"],
                    style=s["style"],
                    priority=s["priority"],
                    source_hot_topic_id=hot_topic.id,
                )
            )

        return TopicGenerateResponse(
            suggestions=suggestions,
            analysis=result["analysis"],
        )

    def analyze_hot_topic(self, session: Session, topic_id: int) -> dict:
        """分析单个热点话题"""
        hot_topic = self.get_hot_topic(session, topic_id)
        return self._coze.analyze_hot_topic(
            topic_title=hot_topic.title,
            platform=hot_topic.source_platform,
        )
