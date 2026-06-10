"""内容创作 API 路由"""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Query
from fastapi.responses import JSONResponse
from sqlmodel import Session

from app.database import get_sync_session
from app.schemas.content import (
    ContentCreate,
    ContentUpdate,
    ContentResponse,
    ContentListResponse,
    ContentGenerateRequest,
    ContentRewriteRequest,
    TitleGenerateRequest,
    TitleGenerateResponse,
)
from app.services.content_service import ContentService

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/content", tags=["内容创作"])
titles_router = APIRouter(prefix="/titles", tags=["标题生成"])

content_service = ContentService()


# ==================== 预留接口 ====================

@router.post("/{content_id}/generate-image", summary="🔮 预留：根据海报提示词生成图片")
def generate_image(content_id: int):
    """预留接口：未来对接 Stable Diffusion / DALL·E / Midjourney API"""
    return JSONResponse(
        status_code=501,
        content={
            "status": 501,
            "message": "图片生成服务尚未接入，请等待后续版本。届时将根据已保存的 image_prompt 自动生成海报图片。",
            "content_id": content_id,
        },
    )


@router.post("/{content_id}/generate-video", summary="🔮 预留：根据脚本分镜生成视频")
def generate_video(content_id: int):
    """预留接口：未来对接 Runway / Pika / Sora API"""
    return JSONResponse(
        status_code=501,
        content={
            "status": 501,
            "message": "视频生成服务尚未接入，请等待后续版本。届时将根据已保存的视频分镜脚本自动生成视频。",
            "content_id": content_id,
        },
    )


# ==================== 内容 CRUD ====================

@router.get("", response_model=ContentListResponse, summary="获取内容列表")
def list_contents(
    content_type: Optional[str] = Query(default=None, description="内容类型筛选"),
    style: Optional[str] = Query(default=None, description="风格筛选"),
    status: Optional[str] = Query(default=None, description="状态筛选"),
    topic_id: Optional[int] = Query(default=None, description="关联选题ID"),
    page: int = Query(default=1, ge=1, description="页码"),
    page_size: int = Query(default=20, ge=1, le=100, description="每页数量"),
    session: Session = Depends(get_sync_session),
):
    """获取内容列表，支持按类型、风格、状态和关联选题筛选"""
    items, total = content_service.list_contents(
        session,
        content_type=content_type,
        style=style,
        status=status,
        topic_id=topic_id,
        page=page,
        page_size=page_size,
    )
    return ContentListResponse(
        items=[ContentResponse.model_validate(t) for t in items],
        total=total,
    )


@router.post("", response_model=ContentResponse, status_code=201, summary="手动创建内容")
def create_content(
    data: ContentCreate,
    session: Session = Depends(get_sync_session),
):
    """手动创建内容（不经过AI生成）"""
    return ContentResponse.model_validate(
        content_service.create_content(session, data)
    )


@router.post("/generate", summary="AI生成内容")
def generate_content(
    request: ContentGenerateRequest,
    session: Session = Depends(get_sync_session),
):
    """基于选题 AI 生成内容（文章/视频脚本/海报文案/社交帖子），自动保存到数据库"""
    return content_service.generate_content(session, request)


@router.get("/{content_id}", response_model=ContentResponse, summary="获取内容详情")
def get_content(
    content_id: int,
    session: Session = Depends(get_sync_session),
):
    """获取单个内容详情"""
    return ContentResponse.model_validate(
        content_service.get_content(session, content_id)
    )


@router.put("/{content_id}", response_model=ContentResponse, summary="更新内容")
def update_content(
    content_id: int,
    data: ContentUpdate,
    session: Session = Depends(get_sync_session),
):
    """手动编辑保存内容"""
    return ContentResponse.model_validate(
        content_service.update_content(session, content_id, data)
    )


@router.delete("/{content_id}", status_code=204, summary="删除内容")
def delete_content(
    content_id: int,
    session: Session = Depends(get_sync_session),
):
    """删除指定内容"""
    content_service.delete_content(session, content_id)


@router.post("/{content_id}/rewrite", response_model=ContentResponse, summary="改写/润色/扩写内容")
def rewrite_content(
    content_id: int,
    request: ContentRewriteRequest,
    session: Session = Depends(get_sync_session),
):
    """AI 改写/润色/扩写已有内容

    instruction 选项：
    - rewrite: 换个角度重新撰写
    - polish: 润色语言表达
    - expand: 扩写至约2倍长度
    """
    return ContentResponse.model_validate(
        content_service.rewrite_content(session, content_id, request)
    )


# ==================== 标题生成 ====================

@titles_router.post("/generate", response_model=TitleGenerateResponse, summary="AI生成标题建议")
def generate_titles(
    request: TitleGenerateRequest,
):
    """根据内容正文，AI 批量生成多个吸引人的标题"""
    titles = content_service.generate_titles(
        body=request.body,
        content_type=request.content_type,
        count=request.count,
    )
    return TitleGenerateResponse(titles=titles)
