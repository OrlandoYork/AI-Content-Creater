"""自定义异常类"""


class AppException(Exception):
    """应用基础异常"""
    def __init__(self, message: str, code: int = 400):
        self.message = message
        self.code = code
        super().__init__(self.message)


class NotFoundException(AppException):
    """资源未找到"""
    def __init__(self, message: str = "资源未找到"):
        super().__init__(message, code=404)


class BusinessException(AppException):
    """业务逻辑异常"""
    def __init__(self, message: str = "操作失败"):
        super().__init__(message, code=400)


class AIGenerationException(AppException):
    """AI生成异常"""
    def __init__(self, message: str = "AI内容生成失败"):
        super().__init__(message, code=500)
