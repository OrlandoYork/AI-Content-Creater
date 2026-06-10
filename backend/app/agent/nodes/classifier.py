"""Classifier 节点 — 使用 cheap model 判断用户意图"""
import logging
from app.agent.state import WorkflowState
from app.services.deepseek_service import DeepSeekService

logger = logging.getLogger(__name__)


async def classifier_node(state: WorkflowState) -> WorkflowState:
    """分析用户输入，判断意图并路由"""
    last_message = state["messages"][-1].content if state["messages"] else ""

    ai = DeepSeekService()
    if not ai.available:
        state["intent"] = "full_pipeline"
        state["current_node"] = "classifier"
        return state

    prompt = f"""分析以下用户请求，判断意图类型。只返回一个单词：

用户请求: "{last_message}"

意图类型:
- full_pipeline (全流程: 热点→选题→创作→审核→分发→分析)
- analyze_hotspot (仅分析热点)
- generate_topic (仅生成选题)
- create_content (仅创作内容)
- review_content (仅审核内容)
- distribute (仅分发)
- analyze (仅数据分析)

只返回意图类型（一个单词），不要任何解释："""

    try:
        raw = ai._call("你是意图分类器", prompt, temperature=0.1)
        intent = raw.strip().lower()
        valid = ["full_pipeline", "analyze_hotspot", "generate_topic",
                 "create_content", "review_content", "distribute", "analyze"]
        state["intent"] = intent if intent in valid else "full_pipeline"
    except Exception as e:
        logger.warning("Classifier failed, defaulting to full_pipeline: %s", e)
        state["intent"] = "full_pipeline"

    state["current_node"] = "classifier"
    return state


def route_by_intent(state: WorkflowState) -> str:
    """根据意图路由到对应节点"""
    intent = state.get("intent", "full_pipeline")
    single_node_map = {
        "analyze_hotspot": "hot_spot_analyzer",
        "generate_topic": "topic_planner",
        "create_content": "content_creator",
        "review_content": "content_reviewer",
        "distribute": "distribution_node",
        "analyze": "analytics_reporter",
    }
    if intent in single_node_map:
        return single_node_map[intent]
    return "hot_spot_analyzer"
