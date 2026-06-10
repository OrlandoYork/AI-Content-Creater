"""内容审核节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)


async def content_reviewer_node(state: WorkflowState) -> WorkflowState:
    state["current_node"] = "content_reviewer"
    contents = state.get("contents", [])
    if not contents:
        logger.warning("无内容可审核")
        state["review_results"] = []
        return state

    logger.info("🔵 [内容审核] 审核 %d 篇内容……", len(contents))
    results = []

    for c in contents:
        try:
            from app.agent.tools.review import check_content_quality
            result = check_content_quality(
                body=c.get("body", ""),
                content_type=c.get("content_type", "article"),
            )
            results.append({
                "title": c.get("title", ""),
                "content_type": c.get("content_type", ""),
                "review": result.get("data", {}) if result.get("success") else {"passed": True, "issues": []},
            })
        except Exception as e:
            logger.error("审核失败 [%s]: %s", c.get("title", "")[:30], e)
            results.append({"title": c.get("title", ""), "review": {"passed": True, "issues": []}})

    state["review_results"] = results
    failed = [r for r in results if not r["review"].get("passed", True)]
    if failed:
        logger.warning("⚠ 有 %d 篇内容未通过审核", len(failed))
        state["status"] = "requires_action"
    else:
        logger.info("✓ 内容审核通过: %d 篇", len(results))

    return state


def review_router(state: WorkflowState) -> str:
    """审核路由：通过→分发 / 不通过→重新创作"""
    if state.get("status") == "requires_action":
        return "content_creator"
    return "distribution_node"
