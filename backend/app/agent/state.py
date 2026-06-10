"""LangGraph WorkflowState 定义"""
from typing import TypedDict, List, Optional, Literal, Annotated
from langgraph.graph.message import add_messages
from langchain_core.messages import BaseMessage


class WorkflowState(TypedDict):
    """Agent 工作流全局状态"""
    # === 消息历史 (自动追加) ===
    messages: Annotated[List[BaseMessage], add_messages]

    # === 用户意图 ===
    intent: Literal["full_pipeline", "analyze_hotspot", "generate_topic",
                    "create_content", "review_content", "distribute", "analyze"]

    # === 各阶段产出 ===
    hot_topics: List[dict]
    topics: List[dict]
    contents: List[dict]
    review_results: List[dict]
    publish_records: List[dict]
    analytics_data: List[dict]
    report: Optional[dict]

    # === 控制流 ===
    current_node: str
    errors: List[str]
    human_feedback: Optional[str]

    # === 任务元数据 ===
    task_id: str
    user_id: str
    status: Literal["running", "completed", "error", "aborted", "requires_action"]
