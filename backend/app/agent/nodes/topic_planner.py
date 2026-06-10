"""选题策划节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)


async def topic_planner_node(state: WorkflowState) -> WorkflowState:
    state["current_node"] = "topic_planner"
    hot_topics = state.get("hot_topics", [])
    if not hot_topics:
        logger.warning("无热点数据，跳过选题策划")
        state["topics"] = []
        return state

    logger.info("🟡 [选题策划] 基于 %d 条热点生成选题……", len(hot_topics))
    topics = []
    for ht in hot_topics[:5]:
        try:
            from app.agent.tools.topic import generate_topic_suggestions
            result = generate_topic_suggestions(
                hot_topic_title=ht["title"],
                hot_topic_platform=ht["platform"],
                count=2,
            )
            if result.get("success"):
                for s in result["data"].get("suggestions", []):
                    s["source_hot_topic"] = ht["title"]
                    topics.append(s)
        except Exception as e:
            logger.error("选题生成失败 [%s]: %s", ht["title"][:30], e)

    state["topics"] = topics
    logger.info("✓ 选题策划完成: %d 条选题", len(topics))
    return state
