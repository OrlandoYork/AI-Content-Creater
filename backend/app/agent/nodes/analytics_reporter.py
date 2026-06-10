"""效果分析节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)


async def analytics_reporter_node(state: WorkflowState) -> WorkflowState:
    state["current_node"] = "analytics_reporter"
    data = state.get("analytics_data", [])
    if not data:
        logger.warning("无分析数据，跳过报表生成")
        state["report"] = {"summary": {}, "suggestions": []}
        return state

    logger.info("📊 [效果分析] 生成综合报表……")
    try:
        from app.agent.tools.analytics import generate_performance_report
        result = generate_performance_report(data)
        if result.get("success"):
            state["report"] = result["data"]
            logger.info("✓ 报表生成完成")
    except Exception as e:
        logger.error("报表生成失败: %s", e)
        state["report"] = {"summary": {}, "suggestions": []}

    state["status"] = "completed"
    return state
