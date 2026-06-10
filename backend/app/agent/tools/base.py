"""LangChain Tool 基础设施 — 借鉴 AiToEarn wrapTool 模式"""
import functools
import logging
from typing import Callable
from langchain_core.tools import tool

logger = logging.getLogger(__name__)


def tool_wrapper(name: str, description: str):
    """工具包装器：统一错误处理 + 可用性监控"""
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> dict:
            try:
                result = func(*args, **kwargs)
                return {"success": True, "data": result}
            except Exception as e:
                logger.error(f"Tool [{name}] failed: {e}", exc_info=True)
                return {"success": False, "error": str(e)}

        # LangChain @tool 装饰器从函数 __name__ 和 docstring 自动获取 name/description
        wrapper.__name__ = name
        wrapper.__doc__ = description
        return tool(wrapper)
    return decorator
