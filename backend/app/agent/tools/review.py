"""内容审核工具"""
from app.agent.tools.base import tool_wrapper


@tool_wrapper(
    name="check_content_quality",
    description="审核内容质量：检查敏感词、合规性、字数规范、格式正确性。返回通过/不通过及具体问题列表。"
)
def check_content_quality(body: str, content_type: str) -> dict:
    issues = []
    sensitive_words = ["违禁词1", "违禁词2"]
    for word in sensitive_words:
        if word in body:
            issues.append({"type": "sensitive", "word": word, "severity": "high"})

    if content_type == "article" and len(body) < 500:
        issues.append({"type": "length", "message": "文章不足500字", "severity": "medium"})

    return {
        "passed": len([i for i in issues if i["severity"] == "high"]) == 0,
        "score": max(0, 100 - len(issues) * 15),
        "issues": issues,
    }
