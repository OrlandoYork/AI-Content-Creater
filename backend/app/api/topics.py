"""选题策划 API 路由"""
import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlmodel import Session

from app.database import get_sync_session, sync_engine
from app.schemas.topic import (
    HotTopicResponse,
    HotTopicListResponse,
    TopicCreate,
    TopicUpdate,
    TopicResponse,
    TopicListResponse,
    TopicGenerateRequest,
    TopicGenerateResponse,
    TopicScheduleRequest,
)
from app.services.topic_service import TopicService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/topics", tags=["选题策划"])

# 全局服务实例
topic_service = TopicService()


# ==================== SSE 格式化工具 ====================

def _sse_event(event: str, data: dict) -> str:
    """格式化 SSE (Server-Sent Events) 消息"""
    return f"event: {event}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"


# ==================== 热点话题接口 ====================

@router.get("/hot", response_model=HotTopicListResponse, summary="获取热点话题列表")
def list_hot_topics(
    platform: Optional[str] = Query(default=None, description="来源平台筛选"),
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=75, ge=1, le=100, description="每页数量"),
    session: Session = Depends(get_sync_session),
):
    """获取模拟热点话题列表，支持按平台筛选和分页"""
    items, total = topic_service.get_hot_topics(
        session, platform=platform, page=page, page_size=page_size
    )
    dedup_count = sum(1 for t in items if t.duplicate_of_id is not None)
    return HotTopicListResponse(
        items=[HotTopicResponse.model_validate(t) for t in items],
        total=total,
        dedup_count=dedup_count,
    )


@router.get("/hot/stats", summary="获取热点统计信息")
def hot_topic_stats(
    session: Session = Depends(get_sync_session),
):
    """获取热点话题的平台分布、去重统计等"""
    return topic_service.get_hot_topic_stats(session)


@router.post("/hot/refresh", summary="流式刷新热点数据（SSE）")
def refresh_hot_topics():
    """流式刷新热点话题，通过 SSE 实时推送进度和结果

    事件类型：
    - progress: 阶段进度（phase/platform/percent/message）
    - topic: 单个话题生成完成（预览数据）
    - platform_done: 一个平台完成
    - dedup_result: 去重标记
    - complete: 全部完成（含完整 topic 列表含ID）
    """
    from app.services.simulation_service import SimulationService

    sim = SimulationService()

    def generate():
        all_topics = []

        try:
            for event_data in sim.generate_hot_topics_stream(count=25):
                evt = event_data["event"]
                data = event_data["data"]

                if evt == "__topics__":
                    # 内部事件：获取生成的话题列表，存入数据库
                    all_topics = data
                    from sqlmodel import Session as DBSession
                    with DBSession(sync_engine) as session:
                        for t in all_topics:
                            session.add(t)
                        session.commit()
                        # 刷新以获取数据库分配的 ID
                        for t in all_topics:
                            session.refresh(t)

                    # 发送最终 complete 事件，包含完整数据
                    dedup_count = sum(1 for t in all_topics if t.duplicate_of_id is not None)
                    complete_data = {
                        "event": "complete",
                        "data": {
                            "total": len(all_topics),
                            "dedup_count": dedup_count,
                            "unique_count": len(all_topics) - dedup_count,
                            "message": f"✓ 刷新完成：{len(all_topics)} 条热点，去重 {dedup_count} 条",
                            "items": [
                                HotTopicResponse.model_validate(t).model_dump(
                                    mode="json"
                                ) for t in all_topics
                            ],
                        },
                    }
                    yield _sse_event(complete_data["event"], complete_data["data"])
                else:
                    yield _sse_event(evt, data)

        except Exception as e:
            logger.error("流式刷新异常: %s", str(e), exc_info=True)
            yield _sse_event("error", {"message": str(e)})

    return StreamingResponse(
        generate(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # 禁用 nginx 缓冲
        },
    )


@router.get("/hot/{topic_id}", response_model=HotTopicResponse, summary="获取热点详情")
def get_hot_topic(
    topic_id: int,
    session: Session = Depends(get_sync_session),
):
    """获取单个热点话题详细信息"""
    topic = topic_service.get_hot_topic(session, topic_id)
    return HotTopicResponse.model_validate(topic)


@router.get("/hot/{topic_id}/analyze", summary="AI分析热点话题")
def analyze_hot_topic(
    topic_id: int,
    session: Session = Depends(get_sync_session),
):
    """AI分析热点话题的热度、趋势和选题潜力"""
    return topic_service.analyze_hot_topic(session, topic_id)


# ==================== 选题接口 ====================

@router.get("", response_model=TopicListResponse, summary="获取选题列表")
def list_topics(
    status: Optional[str] = Query(default=None, description="状态筛选"),
    content_type: Optional[str] = Query(default=None, description="内容类型筛选"),
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    session: Session = Depends(get_sync_session),
):
    """获取选题列表，支持按状态和类型筛选、分页"""
    items, total = topic_service.list_topics(
        session,
        status=status,
        content_type=content_type,
        page=page,
        page_size=page_size,
    )
    return TopicListResponse(
        items=[TopicResponse.model_validate(t) for t in items],
        total=total,
    )


@router.post("", response_model=TopicResponse, status_code=201, summary="创建选题")
def create_topic(
    data: TopicCreate,
    session: Session = Depends(get_sync_session),
):
    """手动创建新选题"""
    return TopicResponse.model_validate(
        topic_service.create_topic(session, data)
    )


@router.post("/generate", response_model=TopicGenerateResponse, summary="AI生成选题")
def generate_topics(
    request: TopicGenerateRequest,
    session: Session = Depends(get_sync_session),
):
    """基于热点话题，AI自动生成选题建议"""
    return topic_service.generate_topics(session, request)


@router.get("/{topic_id}", response_model=TopicResponse, summary="获取选题详情")
def get_topic(
    topic_id: int,
    session: Session = Depends(get_sync_session),
):
    """获取单个选题的详情"""
    return TopicResponse.model_validate(
        topic_service.get_topic(session, topic_id)
    )


@router.put("/{topic_id}", response_model=TopicResponse, summary="更新选题")
def update_topic(
    topic_id: int,
    data: TopicUpdate,
    session: Session = Depends(get_sync_session),
):
    """更新选题内容、状态等"""
    return TopicResponse.model_validate(
        topic_service.update_topic(session, topic_id, data)
    )


@router.delete("/{topic_id}", status_code=204, summary="删除选题")
def delete_topic(
    topic_id: int,
    session: Session = Depends(get_sync_session),
):
    """删除指定选题"""
    topic_service.delete_topic(session, topic_id)


@router.post("/{topic_id}/schedule", response_model=TopicResponse, summary="选题排期")
def schedule_topic(
    topic_id: int,
    data: TopicScheduleRequest,
    session: Session = Depends(get_sync_session),
):
    """为选题设置计划发布日期"""
    return TopicResponse.model_validate(
        topic_service.schedule_topic(session, topic_id, data.scheduled_date)
    )
