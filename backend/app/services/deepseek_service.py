"""DeepSeek AI 服务封装

通过 DeepSeek API（OpenAI 兼容格式）调用云端大模型进行：
- 热点话题分析
- 选题建议生成
- 热点标题生成

DeepSeek API 文档: https://platform.deepseek.com/api-docs
接口格式与 OpenAI Chat Completions 完全兼容。
"""
import re
import json
import logging
from typing import Dict, Any, List, Optional

import httpx

from app.core.config import (
    DEEPSEEK_API_KEY,
    DEEPSEEK_BASE_URL,
    DEEPSEEK_MODEL,
    DEEPSEEK_TIMEOUT,
    DEEPSEEK_ENABLED,
)
from app.core.exceptions import AIGenerationException

logger = logging.getLogger(__name__)


class DeepSeekService:
    """DeepSeek API 服务（OpenAI 兼容接口）"""

    def __init__(self):
        self._api_key = DEEPSEEK_API_KEY
        self._base_url = DEEPSEEK_BASE_URL.rstrip("/")
        self._model = DEEPSEEK_MODEL
        self._timeout = DEEPSEEK_TIMEOUT
        self._enabled = DEEPSEEK_ENABLED
        self._client: Optional[httpx.Client] = None

    @property
    def _get_client(self) -> httpx.Client:
        """延迟初始化 httpx 客户端"""
        if self._client is None:
            self._client = httpx.Client(
                timeout=self._timeout,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
            )
        return self._client

    @property
    def available(self) -> bool:
        """DeepSeek 是否可用（有 API Key 即为可用）"""
        return self._enabled and bool(self._api_key)

    # ==================== 核心 API 调用 ====================

    def _call(
        self, system_prompt: str, user_prompt: str, temperature: float = 0.8
    ) -> str:
        """调用 DeepSeek /v1/chat/completions

        Args:
            system_prompt: 系统提示词
            user_prompt: 用户提示词
            temperature: 生成温度 (0-2)

        Returns:
            模型响应文本

        Raises:
            AIGenerationException: 调用失败时抛出
        """
        if not self._enabled:
            raise AIGenerationException("DeepSeek 已被禁用 (DEEPSEEK_ENABLED=false)")
        if not self._api_key:
            raise AIGenerationException("DeepSeek API Key 未设置")

        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": temperature,
            "max_tokens": 4096,
            "stream": False,
        }

        try:
            resp = self._get_client.post(
                f"{self._base_url}/v1/chat/completions", json=payload
            )
            resp.raise_for_status()
            data = resp.json()
            content = data["choices"][0]["message"]["content"]
            return content.strip()
        except httpx.ConnectError:
            raise AIGenerationException(
                f"无法连接 DeepSeek API ({self._base_url})，请检查网络"
            )
        except httpx.TimeoutException:
            raise AIGenerationException(
                f"DeepSeek 请求超时 ({self._timeout}s)"
            )
        except httpx.HTTPStatusError as e:
            raise AIGenerationException(
                f"DeepSeek API 返回错误 {e.response.status_code}: {e.response.text[:300]}"
            )
        except (KeyError, IndexError):
            raise AIGenerationException(
                f"DeepSeek 返回格式异常: {json.dumps(data, ensure_ascii=False)[:300]}"
            )
        except Exception as e:
            raise AIGenerationException(f"DeepSeek 调用失败: {str(e)}")

    # ==================== JSON 提取工具 ====================

    @staticmethod
    def _extract_json(text: str) -> dict:
        """从 LLM 响应中稳健提取 JSON 对象

        尝试以下策略：
        1. 整个文本直接解析
        2. ```json ... ``` 代码块
        3. ``` ... ```（无语言标记）
        4. 最外层 { ... } 对（大括号深度计数）
        """
        text = text.strip()

        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        m = re.search(r"```json\s*([\s\S]*?)\s*```", text)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                pass

        m = re.search(r"```\s*([\s\S]*?)\s*```", text)
        if m:
            try:
                return json.loads(m.group(1))
            except json.JSONDecodeError:
                pass

        start = text.find("{")
        if start != -1:
            depth = 0
            for i in range(start, len(text)):
                if text[i] == "{":
                    depth += 1
                elif text[i] == "}":
                    depth -= 1
                    if depth == 0:
                        try:
                            return json.loads(text[start : i + 1])
                        except json.JSONDecodeError:
                            break

        raise ValueError(f"无法从响应中提取 JSON，前 500 字符: {text[:500]}")

    @staticmethod
    def _extract_json_array(text: str) -> list:
        """从 LLM 响应中提取 JSON 数组"""
        text = text.strip()

        try:
            result = json.loads(text)
            if isinstance(result, list):
                return result
        except json.JSONDecodeError:
            pass

        m = re.search(r"```json\s*([\s\S]*?)\s*```", text)
        if m:
            try:
                result = json.loads(m.group(1))
                if isinstance(result, list):
                    return result
            except json.JSONDecodeError:
                pass

        m = re.search(r"```\s*([\s\S]*?)\s*```", text)
        if m:
            try:
                result = json.loads(m.group(1))
                if isinstance(result, list):
                    return result
            except json.JSONDecodeError:
                pass

        start = text.find("[")
        if start != -1:
            depth = 0
            for i in range(start, len(text)):
                if text[i] == "[":
                    depth += 1
                elif text[i] == "]":
                    depth -= 1
                    if depth == 0:
                        try:
                            result = json.loads(text[start : i + 1])
                            if isinstance(result, list):
                                return result
                        except json.JSONDecodeError:
                            break

        raise ValueError(f"无法从响应中提取 JSON 数组，前 500 字符: {text[:500]}")

    # ==================== 公开 AI 方法 ====================

    def analyze_hot_topic(self, topic_title: str, platform: str) -> Dict[str, Any]:
        """AI 分析热点话题

        Args:
            topic_title: 热点标题
            platform: 来源平台

        Returns:
            分析结果 dict（topic/platform/hot_degree/estimated_readers/
            sentiment_ratio/analysis/target_audience/suggested_content_type）
        """
        system_prompt = f"""你是一个专业的中文媒体分析师。根据给定的话题进行深入分析，输出纯 JSON（不要 markdown 代码块，不要解释）。

JSON 格式：
{{
  "topic": "清理后的标题",
  "platform": "{platform}",
  "hot_degree": "极高/较高/一般 三选一",
  "estimated_readers": "N万+ 格式，N 为 50-500 的整数",
  "sentiment_ratio": {{
    "positive": "X%（整数百分比，与 neutral、negative 之和为 100%）",
    "neutral": "Y%",
    "negative": "Z%"
  }},
  "analysis": "2-3 句中文字，分析话题传播特点和讨论焦点",
  "target_audience": "18-25岁年轻用户群体/26-35岁职场人群/科技及互联网从业者/大学生及应届毕业生/创业者及自由职业者 五选一",
  "suggested_content_type": "article/social_post/video_script 三选一"
}}
sentiment_ratio 三项之和必须为 100%。"""

        user_prompt = f"分析来自 {platform} 的热点话题：{topic_title}"

        raw = self._call(system_prompt, user_prompt, temperature=0.7)
        logger.info("DeepSeek 热点分析完成: %s", topic_title[:30])

        try:
            result = self._extract_json(raw)
        except ValueError:
            raise AIGenerationException(f"DeepSeek 返回非 JSON 格式: {raw[:300]}")

        # 验证必需字段
        required = [
            "topic", "platform", "hot_degree", "estimated_readers",
            "sentiment_ratio", "analysis", "target_audience", "suggested_content_type"
        ]
        missing = [k for k in required if k not in result]
        if missing:
            raise AIGenerationException(
                f"DeepSeek 响应缺少字段: {missing}，原始: {json.dumps(result, ensure_ascii=False)[:300]}"
            )

        # 确保 sentiment_ratio 子字段存在
        sr = result.setdefault("sentiment_ratio", {})
        for key in ("positive", "neutral", "negative"):
            sr.setdefault(key, "0%")

        return result

    def generate_topic_suggestions(
        self,
        hot_topic_title: str,
        hot_topic_platform: str,
        count: int = 3,
        style_preference: str = "professional",
    ) -> Dict[str, Any]:
        """AI 生成选题建议

        Returns:
            {
                "suggestions": [{title, description, target_audience,
                                 content_type, style, priority}, ...],
                "analysis": str
            }
        """
        count = max(1, min(5, count))

        system_prompt = f"""你是专业的内容策略师。每个热点都是独一无二的，你的任务是**根据热点的具体内容**生成创意选题建议。输出纯 JSON（不要 markdown 代码块，不要解释）。

**重要约束：**
- 绝不要使用模板化的表述（如"深度解析"、"为何"、"盘点"等），每个选题标题必须反映热点的具体内容和独特角度
- 每个选题必须有创意且与热点紧密相关，不能是通用的话题
- 多样化的内容类型：不要全部生成 article，合理搭配 video_script、social_post、poster_copy
- description 要具体，能看出你对这个热点的理解

JSON 格式：
{{
  "suggestions": [
    {{
      "title": "中文选题标题（50字以内，有创意，体现热点独特性，禁止模板化开头）",
      "description": "1-2 句中文描述，具体说明选题角度和切入方式",
      "target_audience": "受众（五选一：18-25岁年轻用户群体/26-35岁职场人群/科技及互联网从业者/大学生及应届毕业生/创业者及自由职业者）",
      "content_type": "类型（四选一：article/social_post/video_script/poster_copy）",
      "style": "风格（四选一：formal/humorous/literary/professional）",
      "priority": "整数 2-5"
    }}
  ],
  "analysis": "2-3 句策略分析，说明为什么选择这些角度"
}}
生成恰好 {count} 个选题，风格偏好：{style_preference}。"""

        user_prompt = f"基于 {hot_topic_platform} 热点「{hot_topic_title}」生成 {count} 个选题建议"

        raw = self._call(system_prompt, user_prompt, temperature=0.85)
        logger.info("DeepSeek 选题生成完成: %s → %d 条", hot_topic_title[:30], count)

        try:
            result = self._extract_json(raw)
        except ValueError:
            raise AIGenerationException(f"DeepSeek 返回非 JSON 格式: {raw[:300]}")

        suggestions = result.get("suggestions", [])
        if not isinstance(suggestions, list):
            raise AIGenerationException(
                f"DeepSeek suggestions 不是数组: {json.dumps(result, ensure_ascii=False)[:300]}"
            )

        # 补齐/裁剪
        if len(suggestions) < count:
            logger.warning("DeepSeek 返回 %d 条（期望 %d 条），补齐", len(suggestions), count)
            while len(suggestions) < count:
                suggestions.append({
                    "title": f"深度解读：{hot_topic_title}",
                    "description": f"从多角度分析该热点话题",
                    "target_audience": "26-35岁职场人群",
                    "content_type": "article",
                    "style": style_preference,
                    "priority": 3,
                })
        elif len(suggestions) > count:
            suggestions = suggestions[:count]

        # 验证/补全每条建议的字段
        defaults = {
            "title": "", "description": "", "target_audience": "26-35岁职场人群",
            "content_type": "article", "style": style_preference, "priority": 3,
        }
        for i, s in enumerate(suggestions):
            for field, default in defaults.items():
                s.setdefault(field, default)
            try:
                s["priority"] = int(s["priority"])
            except (ValueError, TypeError):
                s["priority"] = 3
            s["priority"] = max(1, min(5, s["priority"]))
            if not s["title"]:
                s["title"] = f"选题建议 #{i+1}"

        return {
            "suggestions": suggestions,
            "analysis": result.get("analysis", f"基于「{hot_topic_title}」，共生成 {len(suggestions)} 个选题。"),
        }

    def generate_hot_topic_titles(
        self, platform: str, count: int = 10
    ) -> List[str]:
        """AI 生成热点话题标题

        Returns:
            热点标题字符串列表
        """
        platform_names = {
            "weibo": "微博", "zhihu": "知乎", "douyin": "抖音",
            "baidu": "百度", "sohu": "搜狐新闻",
        }
        platform_display = platform_names.get(platform, platform)

        system_prompt = f"""你是中文社交媒体趋势分析师。为 {platform_display} 生成逼真的热搜话题标题，输出纯 JSON 字符串数组（不要 markdown，不要解释）。

格式：["标题1", "标题2", "标题3"]

要求：
- 像真实{platform_display}热搜内容
- 中文 10-40 字
- 覆盖科技/生活/职场/娱乐/教育/社会等类别"""

        user_prompt = f"生成 {count} 个{platform_display}热搜话题标题"

        raw = self._call(system_prompt, user_prompt, temperature=0.9)
        logger.info("DeepSeek 标题生成: %s → %d 个", platform, count)

        try:
            titles = self._extract_json_array(raw)
        except ValueError:
            raise AIGenerationException(f"DeepSeek 返回非 JSON 数组: {raw[:300]}")

        titles = [str(t) for t in titles if t]
        return titles[:count]

    def generate_topic_detail(self, title: str, platform: str) -> Dict[str, Any]:
        """AI 生成热点话题的详细内容摘要 + 模拟来源URL

        返回包含详细摘要和模拟URL的 dict，
        摘要模拟真实的新闻报道/社交媒体讨论内容。

        Returns:
            {"summary": str, "url": str}
        """
        platform_names = {
            "weibo": "微博", "zhihu": "知乎", "douyin": "抖音",
            "baidu": "百度", "sohu": "搜狐新闻",
        }
        platform_display = platform_names.get(platform, platform)

        system_prompt = f"""你是{platform_display}平台的专业内容编辑。根据给定的热点话题标题，撰写一篇详细的内容摘要。

要求：
1. 120-300字的中文摘要
2. 模仿{platform_display}上真实的新闻报道/帖子风格
3. 包含具体细节：事件起因、关键人物/数据、讨论焦点、传播路径
4. 不要虚构过于离谱的细节，保持新闻的真实感
5. 输出纯 JSON（不要 markdown 代码块），格式：{{"summary": "详细摘要...", "fake_url": "模拟的URL路径"}}
6. fake_url 格式参考：weibo → weibo.com/热搜/..., zhihu → zhihu.com/question/..., douyin → douyin.com/trending/..., baidu → baidu.com/s?wd=..., sohu → sohu.com/a/..."""

        user_prompt = f"为{platform_display}热搜话题「{title}」撰写详细内容摘要"

        raw = self._call(system_prompt, user_prompt, temperature=0.75)
        logger.info("DeepSeek 详情生成: %s", title[:30])

        try:
            result = self._extract_json(raw)
        except ValueError:
            logger.warning("DeepSeek 详情生成非JSON，使用默认摘要")
            return {
                "summary": f"「{title}」是{platform_display}平台上的热门话题，引发了广泛关注和讨论。",
                "fake_url": "",
            }

        return {
            "summary": result.get("summary", f"「{title}」相关内容正在{platform_display}热传……"),
            "fake_url": result.get("fake_url", ""),
        }

    def deduplicate_topics(
        self, topics: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        """AI 智能去重：检测语义重复的话题并标记

        将话题分批发送给 DeepSeek，识别语义相同/高度相似的话题对。
        对每组重复话题，保留 hot_index 最高的作为主话题，
        其余标记为 duplicate_of_id。

        Args:
            topics: [{"id": int, "title": str, "platform": str, "hot_index": int}, ...]

        Returns:
            去重后的 topics 列表，重复项含 duplicate_of_id 字段
        """
        if len(topics) < 2:
            return topics

        # 构建去重 prompt
        topics_json = json.dumps(
            [
                {"id": t["id"], "title": t["title"], "platform": t["platform"]}
                for t in topics
            ],
            ensure_ascii=False,
            indent=2,
        )

        system_prompt = """你是中文内容去重专家。分析以下话题列表，找出语义相同或高度相似的重复话题。

判断标准：
- 标题描述的是同一事件/话题（即使措辞不同）
- 例如 "某明星官宣结婚" 和 "知名艺人宣布婚讯" 是重复的
- 例如 "iPhone 17 发布" 和 "苹果新机开售" 是重复的
- 但如果只是主题领域相同（如都是"AI"话题但具体事件不同），不算重复

输出纯 JSON 数组，列出所有重复组：
[["重复话题1的id", "重复话题2的id"], ["另一组重复1的id", "另一组重复2的id", "另一组重复3的id"]]

每个子数组内的话题互为重复。没有重复则输出 []。不要输出 markdown。"""

        user_prompt = f"请找出以下 {len(topics)} 个话题中的重复组：\n{topics_json}"

        raw = self._call(system_prompt, user_prompt, temperature=0.3)
        logger.info("DeepSeek 去重分析完成，%d 个话题", len(topics))

        try:
            duplicate_groups = self._extract_json_array(raw)
        except ValueError:
            logger.warning("DeepSeek 去重返回非JSON，跳过去重")
            return topics

        if not duplicate_groups:
            logger.info("DeepSeek 未发现重复话题")
            return topics

        # 处理重复组：保留 hot_index 最高的，其余标记
        topic_map = {t["id"]: t for t in topics}
        duplicate_ids = set()

        for group in duplicate_groups:
            if not isinstance(group, list) or len(group) < 2:
                continue

            # 找到该组内 hot_index 最高的
            group_topics = [topic_map[tid] for tid in group if tid in topic_map]
            if len(group_topics) < 2:
                continue

            # 按 hot_index 降序
            group_topics.sort(key=lambda x: x.get("hot_index", 0), reverse=True)
            primary = group_topics[0]

            for dup in group_topics[1:]:
                dup["duplicate_of_id"] = primary["id"]
                dup["hot_index"] = max(0, dup.get("hot_index", 300) - 200)  # 降权
                duplicate_ids.add(dup["id"])
                logger.info(
                    "去重: 「%s」(%s) → 与「%s」(%s) 重复",
                    dup["title"][:30], dup["platform"],
                    primary["title"][:30], primary["platform"],
                )

        logger.info("去重完成：%d 个话题中标记 %d 个为重复", len(topics), len(duplicate_ids))
        return topics

    # ==================== Phase 2: 内容创作 AI 方法 ====================

    def generate_content(
        self,
        topic_title: str,
        topic_description: str,
        content_type: str = "article",
        style: str = "professional",
        target_audience: str = "26-35岁职场人群",
    ) -> dict:
        """AI 生成内容

        Args:
            topic_title: 选题标题
            topic_description: 选题描述
            content_type: article/video_script/poster_copy/social_post
            style: formal/humorous/literary/professional
            target_audience: 目标受众

        Returns:
            article: {title, body} — body为Markdown格式
            video_script: {title, body, visual_style} — body为JSON数组字符串，含visual_style
            poster_copy: {title, body, image_prompt} — body=文案, image_prompt=生图提示词
            social_post: {title, body} — body为纯文本+emoji
        """
        style_names = {
            "formal": "正式", "humorous": "幽默",
            "literary": "文艺", "professional": "专业",
        }
        style_display = style_names.get(style, style)

        if content_type == "article":
            return self._generate_article(
                topic_title, topic_description, style_display, target_audience
            )
        elif content_type == "video_script":
            return self._generate_video_script(
                topic_title, topic_description, style_display, target_audience
            )
        elif content_type == "poster_copy":
            return self._generate_poster_copy(
                topic_title, topic_description, style_display, target_audience
            )
        elif content_type == "social_post":
            return self._generate_social_post(
                topic_title, topic_description, style_display, target_audience
            )
        else:
            raise AIGenerationException(f"不支持的内容类型: {content_type}")

    def _generate_article(
        self, topic_title: str, topic_description: str,
        style_display: str, target_audience: str,
    ) -> dict:
        """AI 生成文章"""
        system_prompt = f"""你是一位资深的内容创作者，擅长撰写{style_display}风格的文章。
根据给定的选题信息，创作一篇高质量的文章，目标受众是{target_audience}。

输出纯 JSON（不要 markdown 代码块，不要解释）：

{{
  "title": "文章标题（吸引人，20-40字）",
  "body": "文章正文（Markdown格式，800-2000字）"
}}

文章要求：
- 开头有吸引人的引言（hook）
- 中间有 3-5 个小标题（用 ## 标记）
- 每个小标题下有充实的内容段落
- 结尾有总结和互动引导
- 语言流畅，符合{style_display}风格
- 包含具体案例或数据支撑（可适当编造逼真的数据）"""

        user_prompt = f"""选题标题：{topic_title}
选题描述：{topic_description}
风格：{style_display}
目标受众：{target_audience}"""

        raw = self._call(system_prompt, user_prompt, temperature=0.8)
        logger.info("DeepSeek 文章生成完成: %s", topic_title[:30])

        try:
            result = self._extract_json(raw)
        except ValueError:
            raise AIGenerationException(f"DeepSeek 文章生成返回非 JSON 格式: {raw[:300]}")

        if "title" not in result or "body" not in result:
            raise AIGenerationException(
                f"DeepSeek 文章生成缺少字段: {json.dumps(result, ensure_ascii=False)[:300]}"
            )

        return {"title": result["title"], "body": result["body"]}

    def _generate_video_script(
        self, topic_title: str, topic_description: str,
        style_display: str, target_audience: str,
    ) -> dict:
        """AI 生成短视频脚本（分镜表）"""
        system_prompt = f"""你是一位短视频导演和编剧，擅长创作{style_display}风格的短视频内容。
根据给定的选题信息，创作一个短视频拍摄脚本（分镜表），目标受众是{target_audience}。

输出纯 JSON（不要 markdown 代码块，不要解释）：

{{
  "title": "视频标题（吸引人，15-30字）",
  "visual_style": "整体视觉风格描述（色调/光影/构图/节奏，50-100字）",
  "body": [
    {{
      "shot_number": 1,
      "duration": "3s",
      "visual": "画面描述：镜头类型、场景、人物动作、构图（详细中文描述，30-80字）",
      "dialogue": "演员台词（无则用空字符串）",
      "subtitle": "屏幕字幕/文字叠加（无则用空字符串）",
      "bgm": "音效/BGM描述（如：轻快的背景音乐起、紧张音效、自然环境音等）"
    }}
  ]
}}

要求：
- 生成 8-15 个分镜
- 总时长约 40-90 秒
- 每个分镜的 visual 描述要详细专业，包含镜头类型（特写/中景/全景）、运镜方式、场景细节
- dialogue 和 subtitle 不同时为空
- bgm 描述要具体
- 整体节奏流畅，有起承转合"""

        user_prompt = f"""选题标题：{topic_title}
选题描述：{topic_description}
风格：{style_display}
目标受众：{target_audience}

请生成一个完整的短视频拍摄分镜表。"""

        raw = self._call(system_prompt, user_prompt, temperature=0.85)
        logger.info("DeepSeek 视频脚本生成完成: %s", topic_title[:30])

        try:
            result = self._extract_json(raw)
        except ValueError:
            raise AIGenerationException(f"DeepSeek 视频脚本返回非 JSON 格式: {raw[:300]}")

        if "body" not in result:
            raise AIGenerationException(
                f"DeepSeek 视频脚本缺少 body 字段: {json.dumps(result, ensure_ascii=False)[:300]}"
            )

        shots = result["body"]
        if not isinstance(shots, list) or len(shots) == 0:
            raise AIGenerationException(
                f"DeepSeek 视频脚本 body 不是有效数组: {json.dumps(result, ensure_ascii=False)[:300]}"
            )

        # 验证每个分镜的必需字段
        required_shot_fields = ["shot_number", "duration", "visual", "dialogue", "subtitle", "bgm"]
        for i, shot in enumerate(shots):
            for field in required_shot_fields:
                shot.setdefault(field, "" if field != "shot_number" else i + 1)

        return {
            "title": result.get("title", f"短视频：{topic_title}"),
            "visual_style": result.get("visual_style", ""),
            "body": json.dumps(shots, ensure_ascii=False),
        }

    def _generate_poster_copy(
        self, topic_title: str, topic_description: str,
        style_display: str, target_audience: str,
    ) -> dict:
        """AI 生成海报文案 + AI 生图提示词"""
        system_prompt = f"""你是一位资深视觉设计师和文案策划，擅长创作{style_display}风格的海报内容。
根据给定的选题信息，创作海报文案和对应的AI图片生成提示词，目标受众是{target_audience}。

输出纯 JSON（不要 markdown 代码块，不要解释）：

{{
  "title": "海报主题（精炼有力，10-20字）",
  "body": "海报主文案，包含：
标题行（大字）
副标题行（解释说明）
行动号召行（引导用户行动）
总计50-200字，用换行符分隔",
  "image_prompt": "AI图片生成提示词，包含以下要素的详细中文描述：
1. 构图方式（居中/三分法/对角线等）
2. 主体元素（人物/物品/场景）
3. 色调与色彩（主色调、辅助色、对比色）
4. 光照与氛围（明亮/暗调/霓虹/自然光等）
5. 风格参考（极简/复古/科技/自然/艺术等）
6. 细节要求（纹理/景深/特殊效果）
总计100-300字，可直接用于 Stable Diffusion / DALL·E 等生图模型"
}}

要求：
- body 文案要有层次感，字号从大到小
- image_prompt 要具体可执行，避免抽象形容词
- 文案和画面风格要统一协调"""

        user_prompt = f"""选题标题：{topic_title}
选题描述：{topic_description}
风格：{style_display}
目标受众：{target_audience}

请生成海报文案和对应的AI生图提示词。"""

        raw = self._call(system_prompt, user_prompt, temperature=0.85)
        logger.info("DeepSeek 海报文案生成完成: %s", topic_title[:30])

        try:
            result = self._extract_json(raw)
        except ValueError:
            raise AIGenerationException(f"DeepSeek 海报文案返回非 JSON 格式: {raw[:300]}")

        # 将 body 和 image_prompt 合并存储为 JSON 字符串
        body_data = {
            "copy": result.get("body", f"海报文案：{topic_title}"),
            "image_prompt": result.get("image_prompt", ""),
        }

        return {
            "title": result.get("title", topic_title),
            "body": json.dumps(body_data, ensure_ascii=False),
            "image_prompt": result.get("image_prompt", ""),
        }

    def _generate_social_post(
        self, topic_title: str, topic_description: str,
        style_display: str, target_audience: str,
    ) -> dict:
        """AI 生成社交媒体帖子"""
        system_prompt = f"""你是一位社交媒体运营专家，擅长创作{style_display}风格的社交媒体内容。
根据给定的选题信息，创作一条适合社交媒体传播的帖子，目标受众是{target_audience}。

输出纯 JSON（不要 markdown 代码块，不要解释）：

{{
  "title": "帖子标题/首句（抓眼球，10-25字）",
  "body": "帖子正文（100-500字，口语化，适合社交传播）
要求：
- 开头用吸引人的钩子（hook）
- 适当使用 emoji 增加表现力
- 使用短句和分段提高可读性
- 加入话题标签 #tag（3-5个）
- 结尾有互动引导（点赞/评论/转发）"
}}"""

        user_prompt = f"""选题标题：{topic_title}
选题描述：{topic_description}
风格：{style_display}
目标受众：{target_audience}"""

        raw = self._call(system_prompt, user_prompt, temperature=0.9)
        logger.info("DeepSeek 社交帖子生成完成: %s", topic_title[:30])

        try:
            result = self._extract_json(raw)
        except ValueError:
            raise AIGenerationException(f"DeepSeek 社交帖子返回非 JSON 格式: {raw[:300]}")

        if "body" not in result:
            raise AIGenerationException(
                f"DeepSeek 社交帖子缺少 body 字段: {json.dumps(result, ensure_ascii=False)[:300]}"
            )

        return {"title": result.get("title", topic_title), "body": result["body"]}

    def rewrite_content(
        self,
        original_body: str,
        content_type: str = "article",
        style: str = "professional",
        instruction: str = "rewrite",
    ) -> dict:
        """AI 改写/润色/扩写内容

        Args:
            original_body: 原始内容正文
            content_type: 内容类型
            style: 目标风格
            instruction: rewrite(重写)/polish(润色)/expand(扩写)

        Returns:
            {body: str} — 改写后的内容
        """
        style_names = {
            "formal": "正式", "humorous": "幽默",
            "literary": "文艺", "professional": "专业",
        }
        style_display = style_names.get(style, style)

        instruction_map = {
            "rewrite": "请换个角度重新撰写以下内容，保持主题不变，但表达方式和结构要不同。让内容焕然一新。",
            "polish": "请润色以下内容，提升语言表达质量。优化用词、句式、逻辑流畅度，但不改变原文结构和核心内容。",
            "expand": "请扩写以下内容至原来的2倍左右长度。增加更多细节、案例、数据或论证，使内容更加充实深入。",
        }
        instruction_text = instruction_map.get(instruction, instruction_map["rewrite"])

        system_prompt = f"""你是一位专业的内容编辑，擅长内容润色和改写。
{instruction_text}

输出纯 JSON（不要 markdown 代码块，不要解释）：

{{
  "body": "改写/润色/扩写后的完整内容"
}}

内容类型：{content_type}
目标风格：{style_display}"""

        user_prompt = f"原始内容：\n\n{original_body[:3000]}"  # 截断过长内容

        raw = self._call(system_prompt, user_prompt, temperature=0.75)
        logger.info("DeepSeek 内容改写完成 (%s)", instruction)

        try:
            result = self._extract_json(raw)
        except ValueError:
            raise AIGenerationException(f"DeepSeek 改写返回非 JSON 格式: {raw[:300]}")

        if "body" not in result:
            raise AIGenerationException(
                f"DeepSeek 改写缺少 body 字段: {json.dumps(result, ensure_ascii=False)[:300]}"
            )

        return {"body": result["body"]}

    def generate_titles(
        self, body: str, content_type: str = "article", count: int = 5
    ) -> list:
        """AI 根据内容生成多个标题

        Args:
            body: 内容正文
            content_type: 内容类型
            count: 生成数量

        Returns:
            标题字符串列表
        """
        import re

        count = max(1, min(10, count))
        body_preview = body[:2000]  # 截断

        system_prompt = f"""你是一位资深的标题策划专家。根据给定的内容生成 {count} 个不同的吸引人的标题。

**严格输出格式：** 你必须只输出一个纯 JSON 字符串数组，不要 markdown 代码块，不要任何额外文字、前缀、解释或标点。格式必须严格为：

["标题1", "标题2", "标题3"]

要求：
- 每个标题 10-35 字
- 覆盖不同类型：悬念式、数字式、反问式、直述式、情感式
- 各有特色，不要雷同
- 适合 {content_type} 类型内容的传播"""

        user_prompt = f"内容正文：\n\n{body_preview}"

        raw = self._call(system_prompt, user_prompt, temperature=0.9)
        logger.info("DeepSeek 标题生成完成: %d 个", count)

        # 清理 body 中的已知前缀
        cleaned = raw.strip()
        cleaned = re.sub(r'^[（(]以下[为是].*?[版本内容][)）]?\s*\n*', '', cleaned)

        # 尝试标准 JSON 数组提取
        try:
            titles = self._extract_json_array(cleaned)
        except ValueError:
            # 容错：尝试手动按行提取 — 匹配引号包裹的中文字符串
            fallback = re.findall(r'"([^"]{5,50})"', cleaned)
            if fallback and len(fallback) >= 2:
                logger.warning("标题生成 JSON 提取失败，手动提取 %d 个候选", len(fallback))
                titles = fallback
            else:
                raise AIGenerationException(f"DeepSeek 标题生成返回非 JSON 数组: {raw[:300]}")

        titles = [str(t).strip() for t in titles if t and str(t).strip()]
        # 过滤掉明显不是标题的内容（太短、错误消息等）
        titles = [t for t in titles if len(t) >= 3 and not t.startswith(('错误', 'Error', '```'))]
        return titles[:count]
