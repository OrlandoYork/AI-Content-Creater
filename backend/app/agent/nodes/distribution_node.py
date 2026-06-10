"""多平台分发节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)

PLATFORMS = ["wechat", "weibo", "douyin", "xiaohongshu"]


async def distribution_node(state: WorkflowState) -> WorkflowState:
    state["current_node"] = "distribution_node"
    contents = state.get("contents", [])
    if not contents:
        logger.warning("无内容可分发")
        state["publish_records"] = []
        return state

    logger.info("🟣 [多平台分发] 分发 %d 篇内容到 %d 个平台……", len(contents), len(PLATFORMS))
    records = []

    for c in contents:
        try:
            from app.agent.tools.distribution import publish_to_platforms
            result = publish_to_platforms(
                content_title=c.get("title", ""),
                content_body=c.get("body", ""),
                content_type=c.get("content_type", "article"),
                platforms=PLATFORMS,
            )
            if result.get("success"):
                records.extend(result["data"]["records"])
        except Exception as e:
            logger.error("分发失败 [%s]: %s", c.get("title", "")[:30], e)

    state["publish_records"] = records
    logger.info("✓ 分发完成: %d 条记录", len(records))
    return state
