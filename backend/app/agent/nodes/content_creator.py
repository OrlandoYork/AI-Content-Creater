"""内容创作节点"""
import logging
from app.agent.state import WorkflowState

logger = logging.getLogger(__name__)


async def content_creator_node(state: WorkflowState) -> WorkflowState:
    state["current_node"] = "content_creator"
    topics = state.get("topics", [])

    feedback = state.get("human_feedback", "")
    if feedback:
        logger.info("🟢 [内容创作] 根据修改意见重新创作: %s", feedback[:50])

    if not topics:
        logger.warning("无选题数据，跳过内容创作")
        state["contents"] = []
        return state

    logger.info("🟢 [内容创作] 基于 %d 条选题生成内容……", len(topics))
    contents = []

    tool_map = {
        "article": "generate_article",
        "video_script": "generate_video_script",
        "poster_copy": "generate_poster_copy",
        "social_post": "generate_social_post",
    }

    for topic in topics[:3]:
        content_type = topic.get("content_type", "article")
        style = topic.get("style", "professional")
        audience = topic.get("target_audience", "26-35岁职场人群")
        tool_name = tool_map.get(content_type, "generate_article")

        try:
            from app.agent.tools import content_tools
            tool_func = getattr(content_tools, tool_name)
            result = tool_func(
                topic_title=topic.get("title", ""),
                topic_description=topic.get("description", ""),
                target_audience=audience,
                style=style,
            )
            if result.get("success"):
                data = result["data"]
                data["content_type"] = content_type
                data["style"] = style
                data["topic_title"] = topic.get("title", "")
                contents.append(data)
        except Exception as e:
            logger.error("内容创作失败 [%s]: %s", topic.get("title", "")[:30], e)

    state["contents"] = contents
    state["human_feedback"] = None
    logger.info("✓ 内容创作完成: %d 篇", len(contents))
    return state
