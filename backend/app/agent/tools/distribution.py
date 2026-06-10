"""多平台分发工具"""
from app.agent.tools.base import tool_wrapper


@tool_wrapper(
    name="publish_to_platforms",
    description="将内容发布到指定平台（微信/微博/抖音/小红书）。当前为模拟分发。"
)
def publish_to_platforms(
    content_title: str, content_body: str, content_type: str, platforms: list[str],
) -> dict:
    import random
    from datetime import datetime

    records = []
    platform_ids = {
        "wechat": "wx", "weibo": "wb", "douyin": "dy", "xiaohongshu": "xhs",
    }
    for platform in platforms:
        pid = platform_ids.get(platform, "unk")
        records.append({
            "platform": platform,
            "status": "published",
            "publish_url": f"https://{platform}.com/mock/{pid}_{random.randint(1000, 9999)}",
            "published_at": datetime.now().isoformat(),
        })

    return {"total": len(records), "records": records}
