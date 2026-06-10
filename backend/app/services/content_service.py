"""内容创作业务逻辑层"""
from datetime import datetime
from typing import List, Optional, Tuple

from sqlmodel import Session, select, func

from app.models.content import Content
from app.models.topic import Topic
from app.schemas.content import (
    ContentCreate,
    ContentUpdate,
    ContentGenerateRequest,
    ContentRewriteRequest,
)
from app.services.coze_service import CozeService
from app.core.exceptions import NotFoundException, BusinessException


class ContentService:
    """内容创作服务"""

    def __init__(self):
        self._coze = CozeService()

    # ==================== 内容 CRUD ====================

    def list_contents(
        self,
        session: Session,
        content_type: Optional[str] = None,
        style: Optional[str] = None,
        status: Optional[str] = None,
        topic_id: Optional[int] = None,
        page: int = 1,
        page_size: int = 20,
    ) -> Tuple[List[Content], int]:
        """内容列表（分页+筛选）"""
        query = select(Content)
        count_query = select(func.count(Content.id))

        if content_type and content_type != "all":
            query = query.where(Content.content_type == content_type)
            count_query = count_query.where(Content.content_type == content_type)
        if style and style != "all":
            query = query.where(Content.style == style)
            count_query = count_query.where(Content.style == style)
        if status and status != "all":
            query = query.where(Content.status == status)
            count_query = count_query.where(Content.status == status)
        if topic_id:
            query = query.where(Content.topic_id == topic_id)
            count_query = count_query.where(Content.topic_id == topic_id)

        total = session.exec(count_query).one()

        offset = (page - 1) * page_size
        query = query.order_by(Content.created_at.desc()).offset(offset).limit(page_size)
        items = list(session.exec(query).all())

        return items, total

    def create_content(self, session: Session, data: ContentCreate) -> Content:
        """手动创建内容"""
        content = Content(**data.model_dump())
        session.add(content)
        session.commit()
        session.refresh(content)
        return content

    def get_content(self, session: Session, content_id: int) -> Content:
        """获取内容详情"""
        content = session.get(Content, content_id)
        if not content:
            raise NotFoundException(f"内容不存在: id={content_id}")
        return content

    def update_content(
        self, session: Session, content_id: int, data: ContentUpdate
    ) -> Content:
        """更新内容"""
        content = self.get_content(session, content_id)

        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(content, key, value)
        content.updated_at = datetime.now()

        session.add(content)
        session.commit()
        session.refresh(content)
        return content

    def delete_content(self, session: Session, content_id: int) -> None:
        """删除内容"""
        content = self.get_content(session, content_id)
        session.delete(content)
        session.commit()

    # ==================== AI 内容生成 ====================

    def generate_content(
        self, session: Session, request: ContentGenerateRequest
    ) -> dict:
        """AI 生成内容（基于选题）"""
        # 获取选题
        topic = session.get(Topic, request.topic_id)
        if not topic:
            raise NotFoundException(f"选题不存在: id={request.topic_id}")

        # 调用 AI 生成
        result = self._coze.generate_content(
            topic_title=topic.title,
            topic_description=topic.description or topic.title,
            content_type=request.content_type,
            style=request.style,
            target_audience=topic.target_audience or "26-35岁职场人群",
        )

        # 计算字数/分镜数
        body = result.get("body", "")
        if request.content_type == "video_script":
            try:
                import json
                shots = json.loads(body)
                word_count = len(shots)
            except (json.JSONDecodeError, TypeError):
                word_count = 0
        else:
            word_count = len(body)

        # 创建 Content 记录并保存
        content = Content(
            topic_id=request.topic_id,
            title=result.get("title", ""),
            body=body,
            content_type=request.content_type,
            style=request.style,
            word_count=word_count,
            status="draft",
        )
        session.add(content)
        session.commit()
        session.refresh(content)

        return {
            "id": content.id,
            "topic_id": content.topic_id,
            "title": content.title,
            "body": content.body,
            "content_type": content.content_type,
            "style": content.style,
            "word_count": content.word_count,
            "status": content.status,
            "created_at": content.created_at.isoformat(),
            "updated_at": content.updated_at.isoformat(),
            # 海报额外字段
            "image_prompt": result.get("image_prompt", ""),
            "visual_style": result.get("visual_style", ""),
        }

    def rewrite_content(
        self, session: Session, content_id: int, request: ContentRewriteRequest
    ) -> Content:
        """AI 改写/润色/扩写内容"""
        content = self.get_content(session, content_id)

        # 目标风格：优先用请求指定的，否则用原内容的风格
        target_style = request.style or content.style

        result = self._coze.rewrite_content(
            original_body=content.body,
            content_type=content.content_type,
            style=target_style,
            instruction=request.instruction,
        )

        # 更新内容
        new_body = result.get("body", content.body)

        # 后处理：对于视频脚本，确保 body 是合法 JSON 数组
        if content.content_type == "video_script":
            new_body = self._clean_video_script_body(new_body)

        content.body = new_body
        # 字数计算：视频脚本按分镜数，其他按字符数
        if content.content_type == "video_script":
            try:
                import json
                shots = json.loads(new_body)
                content.word_count = len(shots) if isinstance(shots, list) else len(new_body)
            except (json.JSONDecodeError, TypeError):
                content.word_count = len(new_body)
        else:
            content.word_count = len(new_body)
        content.style = target_style
        content.updated_at = datetime.now()

        session.add(content)
        session.commit()
        session.refresh(content)
        return content

    def generate_titles(
        self, body: str, content_type: str = "article", count: int = 5
    ) -> list:
        """AI 生成标题建议"""
        if not body.strip():
            raise BusinessException("内容正文不能为空")
        return self._coze.generate_titles(body, content_type, count)

    @staticmethod
    def _clean_video_script_body(body: str) -> str:
        """清理视频脚本 body，确保是合法 JSON 数组

        处理以下情况：
        1. body 以中文前缀开头（如"（以下为重新撰写的版本）"）
        2. body 被 markdown 代码块包裹
        3. AI 在 JSON 前添加了额外文字
        """
        import re
        import json

        # 尝试直接解析 — 如果已经合法，直接返回
        try:
            json.loads(body)
            return body
        except (json.JSONDecodeError, TypeError):
            pass

        # 策略1: 移除常见的 mock 前缀模式
        cleaned = re.sub(
            r'^[（(]以下[为是].*?[版本内容][)）]?\s*\n*',
            '', body
        )
        cleaned = re.sub(
            r'^[（(]以下.*?(?:版本|内容)[)）]?\s*\n*',
            '', cleaned
        )
        cleaned = cleaned.strip()

        # 策略2: 移除 markdown 代码块标记
        cleaned = re.sub(r'^```(?:json)?\s*\n?', '', cleaned)
        cleaned = re.sub(r'\n?\s*```$', '', cleaned)
        cleaned = cleaned.strip()

        # 策略3: 查找 JSON 数组区域
        arr_match = re.search(r'\[[\s\S]*\]', cleaned)
        if arr_match:
            candidate = arr_match.group(0)
            try:
                json.loads(candidate)
                return candidate
            except (json.JSONDecodeError, TypeError):
                pass

        # 如果所有策略都失败，返回清理后的文本（即使不是合法 JSON）
        # 调用方会进一步处理
        return cleaned
