"""Agent API 路由 — SSE 流式端点"""
import json
import asyncio
import logging
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from langchain_core.messages import HumanMessage

from app.agent.graph import get_workflow
from app.agent.state import WorkflowState
from app.database import AsyncSessionLocal

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/agent", tags=["AI Agent"])


class AgentRunRequest(BaseModel):
    prompt: str
    user_id: str = "default"
    workflow_type: str = "full_pipeline"


async def _stream_workflow(task_id: str, user_id: str, prompt: str):
    workflow = get_workflow()

    initial_state: WorkflowState = {
        "messages": [HumanMessage(content=prompt)],
        "intent": "full_pipeline",
        "hot_topics": [],
        "topics": [],
        "contents": [],
        "review_results": [],
        "publish_records": [],
        "analytics_data": [],
        "report": None,
        "current_node": "",
        "errors": [],
        "human_feedback": None,
        "task_id": task_id,
        "user_id": user_id,
        "status": "running",
    }

    config = {"configurable": {"thread_id": task_id}}

    yield f"data: {json.dumps({'type': 'init', 'taskId': task_id, 'workflowType': 'full_pipeline'}, ensure_ascii=False)}\n\n"

    try:
        async for event in workflow.astream(initial_state, config):
            for node_name, node_output in event.items():
                yield f"data: {json.dumps({'type': 'node_start', 'node': node_name}, ensure_ascii=False)}\n\n"

                if isinstance(node_output, dict):
                    errors = node_output.get("errors", [])
                    status = node_output.get("status", "running")

                    for err in errors:
                        yield f"data: {json.dumps({'type': 'error', 'node': node_name, 'message': str(err)}, ensure_ascii=False)}\n\n"

                    yield f"data: {json.dumps({'type': 'node_complete', 'node': node_name, 'status': status}, ensure_ascii=False)}\n\n"

                    if status == "requires_action":
                        yield f"data: {json.dumps({'type': 'requires_action', 'node': node_name, 'prompt': '部分内容未通过审核，请提供修改意见'}, ensure_ascii=False)}\n\n"

        yield f"data: {json.dumps({'type': 'done', 'taskId': task_id, 'status': 'completed'}, ensure_ascii=False)}\n\n"

    except Exception as e:
        logger.error("Agent 工作流异常: %s", e, exc_info=True)
        yield f"data: {json.dumps({'type': 'error', 'node': 'system', 'code': 'WORKFLOW_ERROR', 'message': str(e)}, ensure_ascii=False)}\n\n"

    # 异步保存 agent_task 记录
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import text
            await session.execute(
                text("""
                    INSERT INTO agent_tasks (id, user_id, status, title, workflow_type, current_node, thread_id, created_at, updated_at)
                    VALUES (:id, :user_id, :status, :title, :workflow_type, :current_node, :thread_id, NOW(), NOW())
                    ON CONFLICT (id) DO UPDATE SET status=:status, updated_at=NOW()
                """),
                {
                    "id": task_id, "user_id": user_id, "status": "completed",
                    "title": prompt[:200], "workflow_type": "full_pipeline",
                    "current_node": "analytics_reporter", "thread_id": task_id,
                }
            )
            await session.commit()
    except Exception as e:
        logger.error("保存 agent_task 失败: %s", e)


@router.post("/run", summary="运行 Agent 工作流 (SSE)")
async def run_agent(request: AgentRunRequest):
    task_id = str(uuid4())
    stream = _stream_workflow(task_id=task_id, user_id=request.user_id, prompt=request.prompt)
    return StreamingResponse(
        stream,
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/abort/{task_id}", summary="取消 Agent 任务")
async def abort_agent(task_id: str):
    import redis.asyncio as aioredis
    from app.core.config import REDIS_URL
    try:
        r = aioredis.from_url(REDIS_URL, decode_responses=True)
        await r.publish(f"agent:abort:{task_id}", "abort")
        await r.close()
        return {"status": "ok", "message": f"Abort signal sent for task {task_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to abort: {e}")


@router.get("/task/{task_id}", summary="获取 Agent 任务详情")
async def get_agent_task(task_id: str):
    async with AsyncSessionLocal() as session:
        from sqlalchemy import text
        result = await session.execute(
            text("SELECT * FROM agent_tasks WHERE id = :id"), {"id": task_id}
        )
        row = result.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Task not found")
        return dict(row._mapping)
