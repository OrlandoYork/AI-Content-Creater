"""热点分析工具集"""
from app.agent.tools.base import tool_wrapper


@tool_wrapper(
    name="fetch_hot_topics",
    description="从5个平台（微博/知乎/抖音/百度/搜狐）采集当日最热门话题，每平台5条，共25条。"
)
def fetch_hot_topics(platforms: list[str] | None = None) -> dict:
    from app.services.simulation_service import SimulationService
    sim = SimulationService()
    topics = sim.generate_hot_topics(count=25)
    return {
        "total": len(topics),
        "items": [
            {
                "title": t.title,
                "platform": t.source_platform,
                "hot_index": t.hot_index,
                "trend": t.trend,
                "audience": t.audience,
                "sentiment": t.sentiment,
                "summary": t.summary,
            }
            for t in topics
        ]
    }


@tool_wrapper(
    name="analyze_hot_topic",
    description="使用AI深度分析单条热点话题，返回热度等级、预估读者量、情感分布、目标受众、推荐内容类型。"
)
def analyze_hot_topic(title: str, platform: str) -> dict:
    from app.services.coze_service import CozeService
    coze = CozeService()
    return coze.analyze_hot_topic(title, platform)
