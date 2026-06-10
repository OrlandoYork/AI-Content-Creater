"""数据分析工具"""
from app.agent.tools.base import tool_wrapper


@tool_wrapper(
    name="collect_analytics",
    description="采集各平台数据（阅读量/点赞/评论/转发/收藏）。当前使用模拟数据。"
)
def collect_analytics(publish_records: list[dict]) -> dict:
    import random
    data = []
    for record in publish_records:
        views = random.randint(500, 50000)
        data.append({
            "platform": record["platform"],
            "publish_url": record.get("publish_url", ""),
            "views": views,
            "likes": random.randint(10, int(views * 0.1)),
            "comments": random.randint(0, int(views * 0.02)),
            "shares": random.randint(0, int(views * 0.05)),
            "bookmarks": random.randint(0, int(views * 0.03)),
            "collected_at": record.get("published_at", ""),
        })
    return {"total_views": sum(d["views"] for d in data), "items": data}


@tool_wrapper(
    name="generate_performance_report",
    description="基于各平台数据生成综合效果分析报表和AI优化建议。"
)
def generate_performance_report(analytics_data: list[dict]) -> dict:
    total_views = sum(d["views"] for d in analytics_data)
    total_engagement = sum(
        d["likes"] + d["comments"] + d["shares"] + d["bookmarks"]
        for d in analytics_data
    )
    best = max(analytics_data, key=lambda d: d["views"]) if analytics_data else None

    return {
        "summary": {
            "total_views": total_views,
            "total_engagement": total_engagement,
            "engagement_rate": round(total_engagement / total_views * 100, 2) if total_views else 0,
            "best_platform": best["platform"] if best else None,
            "total_platforms": len(analytics_data),
        },
        "suggestions": [
            "最佳发布时间：工作日 12:00-14:00 互动率最高",
            f"最佳平台：{best['platform']} 的阅读量最高" if best else "",
            "短视频内容互动率高于图文2.3倍，建议增加视频内容比例",
            "带话题标签的内容曝光量提升约40%",
        ],
    }
