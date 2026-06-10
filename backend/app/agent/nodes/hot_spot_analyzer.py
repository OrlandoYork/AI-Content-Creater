"""热点分析节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)


async def hot_spot_analyzer_node(state: WorkflowState) -> WorkflowState:
    state["current_node"] = "hot_spot_analyzer"
    logger.info("🔴 [热点分析] 开始采集5平台热点……")
    try:
        from app.agent.tools.hot_spot import fetch_hot_topics
        result = fetch_hot_topics()
        if result.get("success"):
            state["hot_topics"] = result["data"]["items"]
            logger.info("✓ 热点采集完成: %d 条", len(state["hot_topics"]))
        else:
            state["errors"].append(f"热点采集失败: {result.get('error')}")
            state["hot_topics"] = []
    except Exception as e:
        state["errors"].append(f"热点分析异常: {str(e)}")
        state["hot_topics"] = []
    return state
