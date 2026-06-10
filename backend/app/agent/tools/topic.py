"""选题策划工具集"""
from app.agent.tools.base import tool_wrapper


@tool_wrapper(
    name="generate_topic_suggestions",
    description="基于热点话题生成选题建议。输入热点标题和来源平台，AI生成1-5个独特的选题角度。"
)
def generate_topic_suggestions(
    hot_topic_title: str,
    hot_topic_platform: str,
    count: int = 3,
    style_preference: str = "professional",
) -> dict:
    from app.services.coze_service import CozeService
    coze = CozeService()
    return coze.generate_topic_suggestions(
        hot_topic_title, hot_topic_platform, count, style_preference
    )
