"""LangGraph StateGraph 组装 — 完整工作流定义"""
import logging
from langgraph.graph import StateGraph, END
from app.agent.state import WorkflowState
from app.agent.nodes import (
    classifier_node, route_by_intent,
    hot_spot_analyzer_node, topic_planner_node,
    content_creator_node, content_reviewer_node, review_router,
    distribution_node, data_collector_node, analytics_reporter_node,
)
from app.agent.checkpointer import get_checkpointer

logger = logging.getLogger(__name__)


def build_workflow_graph() -> StateGraph:
    """构建 LangGraph 工作流图"""
    workflow = StateGraph(WorkflowState)

    # 注册所有节点
    workflow.add_node("classifier", classifier_node)
    workflow.add_node("hot_spot_analyzer", hot_spot_analyzer_node)
    workflow.add_node("topic_planner", topic_planner_node)
    workflow.add_node("content_creator", content_creator_node)
    workflow.add_node("content_reviewer", content_reviewer_node)
    workflow.add_node("distribution_node", distribution_node)
    workflow.add_node("data_collector", data_collector_node)
    workflow.add_node("analytics_reporter", analytics_reporter_node)

    # 入口 → classifier
    workflow.set_entry_point("classifier")

    # Classifier → conditional routing
    workflow.add_conditional_edges(
        "classifier", route_by_intent,
        {
            "hot_spot_analyzer": "hot_spot_analyzer",
            "topic_planner": "topic_planner",
            "content_creator": "content_creator",
            "content_reviewer": "content_reviewer",
            "distribution_node": "distribution_node",
            "analytics_reporter": "analytics_reporter",
        }
    )

    # Full Pipeline 链路
    workflow.add_edge("hot_spot_analyzer", "topic_planner")
    workflow.add_edge("topic_planner", "content_creator")
    workflow.add_edge("content_creator", "content_reviewer")

    # 审核条件路由: passed → distribution, failed → content_creator (retry)
    workflow.add_conditional_edges(
        "content_reviewer", review_router,
        {"content_creator": "content_creator", "distribution_node": "distribution_node"}
    )

    workflow.add_edge("distribution_node", "data_collector")
    workflow.add_edge("data_collector", "analytics_reporter")
    workflow.add_edge("analytics_reporter", END)

    # 单节点执行后 → END
    for single_node in ["hot_spot_analyzer", "topic_planner", "content_creator",
                        "content_reviewer", "distribution_node", "analytics_reporter"]:
        workflow.add_edge(single_node, END)

    # 编译
    checkpointer = get_checkpointer()
    compiled = workflow.compile(checkpointer=checkpointer)
    logger.info("✓ LangGraph 工作流已编译 (8 nodes, PostgreSQL checkpoint)")
    return compiled


_workflow = None


def get_workflow() -> StateGraph:
    global _workflow
    if _workflow is None:
        _workflow = build_workflow_graph()
    return _workflow
