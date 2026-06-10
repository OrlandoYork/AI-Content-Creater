"""数据采集节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)


async def data_collector_node(state: WorkflowState) -> WorkflowState:
    state["current_node"] = "data_collector"
    records = state.get("publish_records", [])
    if not records:
        logger.warning("无分发记录，跳过数据采集")
        state["analytics_data"] = []
        return state

    logger.info("🟠 [数据采集] 采集 %d 条分发记录的数据……", len(records))
    try:
        from app.agent.tools.analytics import collect_analytics
        result = collect_analytics(records)
        if result.get("success"):
            state["analytics_data"] = result["data"]["items"]
            logger.info("✓ 数据采集完成: 总阅读 %d", result["data"]["total_views"])
    except Exception as e:
        logger.error("数据采集失败: %s", e)
        state["analytics_data"] = []
    return state
