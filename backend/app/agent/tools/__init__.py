"""Agent 工具集 — LangChain Tool 注册中心"""
from app.agent.tools.hot_spot import fetch_hot_topics, analyze_hot_topic
from app.agent.tools.topic import generate_topic_suggestions
from app.agent.tools.content_tools import (
    generate_article,
    generate_video_script,
    generate_poster_copy,
    generate_social_post,
)
from app.agent.tools.review import check_content_quality
from app.agent.tools.distribution import publish_to_platforms
from app.agent.tools.analytics import collect_analytics, generate_performance_report

ALL_TOOLS = [
    fetch_hot_topics,
    analyze_hot_topic,
    generate_topic_suggestions,
    generate_article,
    generate_video_script,
    generate_poster_copy,
    generate_social_post,
    check_content_quality,
    publish_to_platforms,
    collect_analytics,
    generate_performance_report,
]
