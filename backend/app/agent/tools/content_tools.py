"""内容创作工具集"""
from app.agent.tools.base import tool_wrapper


@tool_wrapper(
    name="generate_article",
    description="生成结构化文章（800-2000字Markdown格式）。需提供选题标题、描述、目标受众。"
)
def generate_article(
    topic_title: str, topic_description: str,
    target_audience: str = "26-35岁职场人群", style: str = "professional",
) -> dict:
    from app.services.coze_service import CozeService
    coze = CozeService()
    result = coze.generate_content(
        topic_title=topic_title, topic_description=topic_description,
        content_type="article", style=style, target_audience=target_audience,
    )
    return {"title": result.get("title", ""), "body": result.get("body", "")}


@tool_wrapper(
    name="generate_video_script",
    description="生成短视频拍摄脚本（分镜表JSON数组）。8-15个分镜，每个含shot_number/duration/visual/dialogue/subtitle/bgm。"
)
def generate_video_script(
    topic_title: str, topic_description: str,
    target_audience: str = "26-35岁职场人群", style: str = "professional",
) -> dict:
    from app.services.coze_service import CozeService
    coze = CozeService()
    result = coze.generate_content(
        topic_title=topic_title, topic_description=topic_description,
        content_type="video_script", style=style, target_audience=target_audience,
    )
    return {
        "title": result.get("title", ""),
        "body": result.get("body", ""),
        "visual_style": result.get("visual_style", ""),
    }


@tool_wrapper(
    name="generate_poster_copy",
    description="生成海报文案（50-200字）+ AI生图提示词。"
)
def generate_poster_copy(
    topic_title: str, topic_description: str, style: str = "professional",
) -> dict:
    from app.services.coze_service import CozeService
    coze = CozeService()
    result = coze.generate_content(
        topic_title=topic_title, topic_description=topic_description,
        content_type="poster_copy", style=style, target_audience="general",
    )
    return {
        "title": result.get("title", ""), "body": result.get("body", ""),
        "image_prompt": result.get("image_prompt", ""),
    }


@tool_wrapper(
    name="generate_social_post",
    description="生成社交媒体帖子（100-500字，口语化+emoji）。"
)
def generate_social_post(
    topic_title: str, topic_description: str, style: str = "professional",
) -> dict:
    from app.services.coze_service import CozeService
    coze = CozeService()
    result = coze.generate_content(
        topic_title=topic_title, topic_description=topic_description,
        content_type="social_post", style=style, target_audience="general",
    )
    return {"title": result.get("title", ""), "body": result.get("body", "")}
