"""分发服务 — v2.0: AI 多平台适配 + 一键分发 + 发布管理"""
import json
import random
from datetime import datetime, timedelta
from typing import List, Tuple, Optional
from sqlmodel import Session, select, func
from app.models.distribution import Distribution
from app.models.content import Content
from app.schemas.distribution import DistributionCreate, DistributionUpdate
from app.core.exceptions import NotFoundException
from app.services.coze_service import CozeService

PLATFORMS = ["wechat", "weibo", "douyin", "xiaohongshu"]

PLATFORM_IDS = {"wechat": "wx", "weibo": "wb", "douyin": "dy", "xiaohongshu": "xhs"}

PLATFORM_RULES = {
    "weibo": {
        "max_chars": 140,
        "supports_images": True,
        "supports_video": True,
        "hashtag_style": "#话题#",
        "optimal_time": "12:00-13:00, 20:00-22:00",
        "optimal_hour": 20,
        "tone": "短平快、互动性强、蹭热点",
        "best_practices": "前15字抓住注意力；善用话题标签；配图/视频互动率高3倍",
    },
    "wechat": {
        "max_chars": 20000,
        "supports_images": True,
        "hashtag_style": "",
        "optimal_time": "07:00-08:00, 12:00, 18:00, 21:00-22:00",
        "optimal_hour": 21,
        "tone": "深度、有料、排版精美",
        "best_practices": "标题党友好但需有干货；富文本排版；末尾引导关注/在看",
    },
    "douyin": {
        "max_chars": 500,
        "supports_images": True,
        "supports_video": True,
        "hashtag_style": "#话题",
        "optimal_time": "12:00-13:00, 18:00-19:00, 21:00-23:00",
        "optimal_hour": 21,
        "tone": "娱乐化、节奏快、前三秒抓人",
        "best_practices": "前3秒决定完播率；热门BGM加持；评论区引导互动",
    },
    "xiaohongshu": {
        "max_chars": 1000,
        "supports_images": True,
        "hashtag_style": "#话题",
        "optimal_time": "07:30-09:00, 12:00-13:30, 20:00-22:00",
        "optimal_hour": 20,
        "tone": "种草、真实分享、精致图片",
        "best_practices": "封面图是核心；标题包含关键词利于搜索；末尾加相关话题标签",
    },
}


def _get_optimal_publish_time(platform: str) -> datetime:
    """基于平台最佳时段计算推荐发布时间"""
    rules = PLATFORM_RULES.get(platform, {})
    optimal_hour = rules.get("optimal_hour", 12)
    now = datetime.now()
    # 如果最佳时间已过今天，则排到明天
    scheduled = now.replace(hour=optimal_hour, minute=0, second=0, microsecond=0)
    if scheduled <= now:
        scheduled += timedelta(days=1)
    return scheduled


def _generate_mock_url(platform: str) -> str:
    """生成逼真的模拟发布链接"""
    pid = PLATFORM_IDS.get(platform, "unk")
    rand_id = random.randint(10000, 999999)
    url_templates = {
        "weibo": f"https://weibo.com/u/{rand_id}/detail/{random.randint(10000000, 99999999)}",
        "wechat": f"https://mp.weixin.qq.com/s/mock_{pid}_{rand_id}",
        "douyin": f"https://www.douyin.com/video/{random.randint(7000000000, 7999999999)}",
        "xiaohongshu": f"https://www.xiaohongshu.com/explore/{pid}{rand_id}",
    }
    return url_templates.get(platform, f"https://{platform}.com/mock/{pid}_{rand_id}")


class DistributionService:
    def __init__(self):
        self._coze = CozeService()

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
        """创建分发记录 — 自动进行 AI 平台适配，状态设为 pending"""
        # 获取原始内容
        content = session.get(Content, data.content_id)
        if not content:
            raise NotFoundException(f"内容不存在: id={data.content_id}")

        # AI 平台适配
        platform_rules = PLATFORM_RULES.get(data.platform, {})
        adapt_result = self._coze.adapt_for_platform(
            content_body=content.body,
            content_type=content.content_type,
            target_platform=data.platform,
            platform_rules=platform_rules,
        )

        # 推荐发布时间
        scheduled_time = data.scheduled_time or _get_optimal_publish_time(data.platform)

        dist = Distribution(
            content_id=data.content_id,
            platform=data.platform,
            status="pending",
            scheduled_time=scheduled_time,
            publish_url="",
            platform_data=json.dumps(adapt_result, ensure_ascii=False),
        )
        session.add(dist)
        session.commit()
        session.refresh(dist)
        return dist

    def batch_create_distributions(
        self, session: Session, content_id: int, platforms: List[str]
    ) -> List[Distribution]:
        """一键分发到多个平台"""
        results = []
        for plat in platforms:
            if plat in PLATFORMS:
                from app.schemas.distribution import DistributionCreate
                data = DistributionCreate(content_id=content_id, platform=plat)
                dist = self.create_distribution(session, data)
                results.append(dist)
        return results

    def publish_distribution(self, session: Session, distribution_id: int) -> Distribution:
        """发布指定分发记录"""
        dist = self.get_distribution(session, distribution_id)
        if dist.status == "published":
            return dist  # 已经发布
        dist.status = "published"
        dist.published_at = datetime.now()
        if not dist.publish_url:
            dist.publish_url = _generate_mock_url(dist.platform)
        session.add(dist)
        session.commit()
        session.refresh(dist)
        return dist

    def cancel_distribution(self, session: Session, distribution_id: int) -> Distribution:
        """取消分发"""
        dist = self.get_distribution(session, distribution_id)
        if dist.status in ("published", "cancelled"):
            from app.core.exceptions import BusinessException
            raise BusinessException(f"无法取消状态为 {dist.status} 的分发")
        dist.status = "cancelled"
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
                 "status": r.status, "scheduled_time": r.scheduled_time.isoformat() if r.scheduled_time else None,
                 "publish_url": r.publish_url}
                for r in records]
