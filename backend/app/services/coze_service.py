"""AI生成服务抽象层

优先使用 DeepSeek API 进行 AI 生成，
DeepSeek 不可用时自动回退到 Mock 实现。
接口签名保持不变，上层无需修改。
"""
import random
import logging
from typing import List, Dict, Any

from app.core.config import COZE_API_KEY, COZE_BOT_ID
from app.services.deepseek_service import DeepSeekService
from app.core.exceptions import AIGenerationException

logger = logging.getLogger(__name__)


class CozeService:
    """AI内容生成服务（DeepSeek优先 / Mock回退）

    统一的AI生成抽象层：
    1. 优先调用 DeepSeek API
    2. DeepSeek 不可用时自动回退到 Mock
    3. 保持方法签名不变，其余模块无需修改
    """

    def __init__(self):
        self._api_key = COZE_API_KEY
        self._bot_id = COZE_BOT_ID
        self._is_mock = not (self._api_key and self._bot_id)
        self._ai = DeepSeekService()

    @property
    def is_mock(self) -> bool:
        """当前是否回退到Mock模式（DeepSeek不可用）"""
        return not self._ai.available

    @property
    def using_real_ai(self) -> bool:
        """是否有真实AI可用"""
        return self._ai.available

    def analyze_hot_topic(self, topic_title: str, platform: str) -> Dict[str, Any]:
        """分析热点话题

        Args:
            topic_title: 热点标题
            platform: 来源平台

        Returns:
            AI分析结果：热度评估、受众分析、选题建议
        """
        # 优先尝试 DeepSeek 真实 AI
        try:
            result = self._ai.analyze_hot_topic(topic_title, platform)
            logger.info("DeepSeek 热点分析成功: %s", topic_title[:30])
            return result
        except Exception as e:
            logger.warning("DeepSeek 热点分析失败，回退 Mock: %s", str(e)[:100])
        # 回退到 Mock
        return self._mock_analyze_hot_topic(topic_title, platform)

    def generate_topic_detail(self, title: str, platform: str) -> Dict[str, Any]:
        """生成热点话题的详细内容摘要

        Args:
            title: 热点标题
            platform: 来源平台

        Returns:
            {"summary": str, "url": str}
        """
        try:
            result = self._ai.generate_topic_detail(title, platform)
            logger.info("DeepSeek 详情生成成功: %s", title[:30])
            return result
        except Exception as e:
            logger.warning("DeepSeek 详情生成失败，回退 Mock: %s", str(e)[:100])
        return self._mock_generate_topic_detail(title, platform)

    def generate_topic_suggestions(
        self,
        hot_topic_title: str,
        hot_topic_platform: str,
        count: int = 3,
        style_preference: str = "professional",
    ) -> Dict[str, Any]:
        """基于热点生成选题建议 — 仅使用真实AI生成，不套用模板

        Args:
            hot_topic_title: 热点标题
            hot_topic_platform: 来源平台
            count: 生成选题数量
            style_preference: 偏好的内容风格

        Returns:
            选题建议列表和分析说明

        Raises:
            AIGenerationException: AI不可用或生成失败时抛出
        """
        result = self._ai.generate_topic_suggestions(
            hot_topic_title, hot_topic_platform, count, style_preference
        )
        logger.info("DeepSeek 选题生成成功: %s → %d 条建议", hot_topic_title[:30], count)
        return result

    # ==================== Mock实现 ====================

    def _mock_generate_topic_detail(
        self, title: str, platform: str
    ) -> Dict[str, Any]:
        """Mock: 生成话题详细内容摘要"""
        platform_names = {
            "weibo": "微博", "zhihu": "知乎", "douyin": "抖音",
            "baidu": "百度", "sohu": "搜狐新闻",
        }
        platform_display = platform_names.get(platform, platform)

        mock_summaries = [
            f"「{title}」近日在{platform_display}平台引发广泛关注。据相关数据显示，该话题在发布后短时间内阅读量突破千万，"
            f"互动量（转评赞）超过百万。多位知名博主和媒体账号参与讨论，话题持续发酵。"
            f"业内人士分析认为，这一话题之所以引发如此大的反响，与其切中了当下公众的核心关切密切相关。",

            f"在{platform_display}上，「{title}」成为热门讨论焦点。该话题源自一则引发广泛共鸣的分享，"
            f"迅速吸引了大量用户的关注和讨论。截至目前，相关内容的累计浏览量已超过500万次，"
            f"评论区呈现出多元化的观点交锋。有支持者认为这反映了社会进步，也有质疑声音提出不同看法。",

            f"{platform_display}热搜「{title}」持续霸榜。这一话题从最初的小范围讨论逐步扩散至全网，"
            f"形成了跨平台的传播态势。据不完全统计，已有超过200家媒体和自媒体对此进行了报道或评论。"
            f"话题热度预计在未来48小时内仍将维持高位，相关衍生话题也在不断涌现。",
        ]

        return {
            "summary": random.choice(mock_summaries),
            "fake_url": "",
        }

    def _mock_analyze_hot_topic(
        self, topic_title: str, platform: str
    ) -> Dict[str, Any]:
        """Mock: 分析热点话题"""
        # 去掉标题中的序号后缀
        clean_title = topic_title.rsplit("（第", 1)[0]

        analyses = [
            f"该话题在{platform}平台引发广泛关注，核心讨论点集中在行业发展趋势和个人选择权两个维度。",
            f"从话题热度曲线来看，'{clean_title}'在发布后3小时内达到峰值，预计未来24小时内仍将保持较高热度。",
            f"该话题引发了不同年龄群体的讨论热情，情感倾向呈现多元化特征。",
        ]

        return {
            "topic": clean_title,
            "platform": platform,
            "hot_degree": random.choice(["极高", "较高", "一般"]),
            "estimated_readers": f"{random.randint(50, 500)}万+",
            "sentiment_ratio": {
                "positive": f"{random.randint(20, 50)}%",
                "neutral": f"{random.randint(20, 40)}%",
                "negative": f"{random.randint(10, 30)}%",
            },
            "analysis": random.choice(analyses),
            "target_audience": random.choice([
                "18-25岁年轻用户群体",
                "26-35岁职场人群",
                "科技及互联网从业者",
                "大学生及应届毕业生",
            ]),
            "suggested_content_type": random.choice([
                "article", "social_post", "video_script"
            ]),
        }

    def _mock_generate_topic_suggestions(
        self,
        hot_topic_title: str,
        hot_topic_platform: str,
        count: int = 3,
        style_preference: str = "professional",
    ) -> Dict[str, Any]:
        """Mock: 生成选题建议"""
        clean_title = hot_topic_title.rsplit("（第", 1)[0]

        # 根据热点主题关键词生成不同角度的选题
        keyword_map = {
            "明星": ["深度解析：{topic}背后的公关策略与舆论博弈",
                     "从{topic}看明星IP的商业价值变迁",
                     "{topic}折射出的粉丝经济新趋势"],
            "AI": ["{topic}：技术突破还是概念炒作？",
                   "AI赋能传统行业：{topic}带来的启示",
                   "从{topic}看2026年AI落地应用前景"],
            "职场": ["{topic}中的职场生存法则",
                   "HR视角解读：{topic}背后的管理哲学",
                   "职场人必读：{topic}的5个深度思考"],
            "消费": ["{topic}揭示的新消费底层逻辑",
                   "品牌如何借势{topic}做内容营销",
                   "{topic}对消费者决策路径的影响"],
            "教育": ["{topic}引发的教育行业变革思考",
                   "从数据看{topic}对教育赛道的影响",
                   "{topic}给教育创业者的机会提示"],
            "城市": ["{topic}的城市运营方法论拆解",
                   "从{topic}看城市品牌IP打造路径",
                   "{topic}背后的文旅产业升级密码"],
            "视频": ["{topic}类内容的爆款公式拆解",
                   "内容创作者如何抓住{topic}红利",
                   "{topic}赛道的内容差异化策略"],
            "旅游": ["{topic}引发的旅游消费新趋势",
                   "文旅营销：{topic}的出圈方法论",
                   "{topic}对小众旅游目的地的带动效应"],
            "科技": ["{topic}的技术底层与应用前景",
                   "科技赛道观察：{topic}的商业化路径",
                   "{topic}对普通用户生活的5个影响"],
        }

        # 匹配关键词
        matched_keyword = None
        for keyword in keyword_map:
            if keyword in clean_title:
                matched_keyword = keyword
                break

        if matched_keyword is None:
            # 通用模板
            templates = [
                "深度解读：{topic}背后的行业逻辑与趋势",
                "从{topic}看当下社会心态变化",
                "{topic}的5个观察角度",
                "{topic}对普通人的影响有多大？",
                "一文读懂{topic}的来龙去脉",
            ]
        else:
            templates = keyword_map[matched_keyword]

        suggestions = []
        styles = [
            "formal", "humorous", "literary", "professional"
        ]
        content_types = [
            "article", "social_post", "video_script", "poster_copy"
        ]
        audiences = [
            "18-25岁年轻用户群体",
            "26-35岁职场人群",
            "科技及互联网从业者",
            "大学生及应届毕业生",
            "创业者及自由职业者",
        ]

        for i in range(min(count, len(templates))):
            template = templates[i % len(templates)]
            title = template.replace("{topic}", clean_title)

            suggestions.append({
                "title": title,
                "description": f"基于'{clean_title}'这一热点，从{'商业分析' if i==0 else '用户视角' if i==1 else '社会观察'}角度切入，"
                               f"结合{style_preference}风格，产出高质量内容。",
                "target_audience": random.choice(audiences),
                "content_type": random.choice(content_types),
                "style": (
                    style_preference
                    if style_preference in styles
                    else random.choice(styles)
                ),
                "priority": random.randint(2, 5),
            })

        analysis_text = (
            f"基于'{clean_title}'（{hot_topic_platform}热搜）的热度趋势分析，"
            f"建议从{len(templates)}个角度进行选题策划。"
            f"该热点当前处于传播上升期，受众以关注{'科技' if matched_keyword == 'AI' else '社会'}话题的用户为主，"
            f"建议优先选择与受众兴趣匹配度高的选题方向。"
            f"（注：以上分析为Mock数据，后续接入Coze将提供实时AI分析）"
        )

        return {
            "suggestions": suggestions,
            "analysis": analysis_text,
        }

    # ==================== Phase 2: 内容创作 ====================

    def generate_content(
        self,
        topic_title: str,
        topic_description: str,
        content_type: str = "article",
        style: str = "professional",
        target_audience: str = "26-35岁职场人群",
    ) -> dict:
        """AI 生成内容（文章/视频脚本/海报文案/社交帖子）"""
        try:
            result = self._ai.generate_content(
                topic_title, topic_description, content_type, style, target_audience
            )
            logger.info("DeepSeek 内容生成成功: %s (%s)", topic_title[:30], content_type)
            return result
        except AIGenerationException as e:
            logger.warning("DeepSeek 内容生成失败，回退 Mock: %s", str(e)[:100])
        except Exception as e:
            logger.error("DeepSeek 内容生成异常: %s", str(e), exc_info=True)
            raise
        return self._mock_generate_content(
            topic_title, topic_description, content_type, style, target_audience
        )

    def rewrite_content(
        self,
        original_body: str,
        content_type: str = "article",
        style: str = "professional",
        instruction: str = "rewrite",
    ) -> dict:
        """AI 改写/润色/扩写内容"""
        try:
            result = self._ai.rewrite_content(original_body, content_type, style, instruction)
            logger.info("DeepSeek 内容改写成功 (%s)", instruction)
            return result
        except AIGenerationException as e:
            logger.warning("DeepSeek 内容改写失败，回退 Mock: %s", str(e)[:100])
        except Exception as e:
            logger.error("DeepSeek 内容改写异常: %s", str(e), exc_info=True)
            raise
        return self._mock_rewrite_content(original_body, content_type, style, instruction)

    def generate_titles(
        self, body: str, content_type: str = "article", count: int = 5
    ) -> list:
        """AI 根据内容生成多个标题"""
        try:
            result = self._ai.generate_titles(body, content_type, count)
            logger.info("DeepSeek 标题生成成功: %d 个", len(result))
            return result
        except AIGenerationException as e:
            logger.warning("DeepSeek 标题生成失败，回退 Mock: %s", str(e)[:100])
        except Exception as e:
            logger.error("DeepSeek 标题生成异常: %s", str(e), exc_info=True)
            raise
        return self._mock_generate_titles(body, content_type, count)

    # ==================== Phase 2 Mock 实现 ====================

    def _mock_generate_content(
        self,
        topic_title: str,
        topic_description: str,
        content_type: str = "article",
        style: str = "professional",
        target_audience: str = "26-35岁职场人群",
    ) -> dict:
        """Mock: 生成内容"""
        clean_title = topic_title.rsplit("（第", 1)[0]

        if content_type == "article":
            return self._mock_generate_article(clean_title, topic_description, style)
        elif content_type == "video_script":
            return self._mock_generate_video_script(clean_title, topic_description, style)
        elif content_type == "poster_copy":
            return self._mock_generate_poster_copy(clean_title, topic_description, style)
        elif content_type == "social_post":
            return self._mock_generate_social_post(clean_title, topic_description, style)
        else:
            return {"title": clean_title, "body": f"内容：{clean_title}"}

    def _mock_generate_article(
        self, title: str, description: str, style: str
    ) -> dict:
        """Mock: 生成文章"""
        style_intros = {
            "formal": "在当前社会发展的大背景下，",
            "humorous": "说实话，这事儿真的让人忍不住想聊聊。",
            "literary": "时光流转，万物更迭，",
            "professional": "从行业发展的角度来看，",
        }
        intro = style_intros.get(style, style_intros["professional"])

        body = f"""# {title}

{intro}{title}这一话题近期引发了广泛关注。{description}

## 背景分析

从宏观层面来看，这一现象背后反映了深刻的行业变革和社会发展趋势。随着数字化转型的深入推进，越来越多的企业和个人开始重新审视传统模式，寻求创新的解决方案。

## 核心观点

首先，我们需要理解{title}的本质。这不仅仅是一个简单的话题讨论，更是一个涉及多方利益、需要系统性思考的复杂议题。

### 关键因素一：技术进步

技术的迭代速度为这一领域带来了前所未有的机遇。据相关数据显示，2026年该领域的投入同比增长超过35%，成为资本和人才争相涌入的热点。

### 关键因素二：用户需求变化

随着用户认知水平的提升，传统的服务模式已经难以满足日益多样化的需求。个性化、精细化的解决方案正在成为新的竞争壁垒。

## 深度解读

从更深层次来看，{title}折射出的是整个社会在数字化转型过程中的阵痛与希望。一方面，变革带来了不确定性；另一方面，也孕育着巨大的创新空间。

业内专家指出，未来3-5年内，这一领域将迎来爆发式增长。提前布局、深耕细作的企业将获得先发优势。

## 总结与展望

{title}不是一个孤立的事件，而是行业大趋势的一个缩影。对于从业者而言，需要在变化中把握机遇，在挑战中寻求突破。

> 变革的时代，唯一不变的就是变化本身。

**互动话题：你对{title}怎么看？欢迎在评论区分享你的观点。**

---

*本文为AI辅助创作，仅供参考。*
"""
        word_count = len(body)
        return {"title": f"深度解读：{title}", "body": body}

    def _mock_generate_video_script(
        self, title: str, description: str, style: str
    ) -> dict:
        """Mock: 生成短视频分镜脚本"""
        import json as _json
        shots = [
            {
                "shot_number": 1, "duration": "3s",
                "visual": f"特写镜头：手机屏幕亮起，推送通知显示标题「{title}」，背景虚化的城市夜景，冷暖对比色调",
                "dialogue": "", "subtitle": f"你听说过「{title}」吗？",
                "bgm": "悬念感电子音效渐入"
            },
            {
                "shot_number": 2, "duration": "5s",
                "visual": "中景：主持人站在现代化办公室落地窗前，自然光从侧面打来，手持平板电脑，自信面对镜头",
                "dialogue": f"大家好，今天我们来聊聊最近刷屏的「{title}」。{description}",
                "subtitle": f"热点解读：{title}",
                "bgm": "轻快科技感BGM起"
            },
            {
                "shot_number": 3, "duration": "8s",
                "visual": "快速剪辑蒙太奇：数据图表飞入→网友评论截图滚动→新闻标题闪现→相关场景快切，画面节奏加快，橙蓝色调",
                "dialogue": "先看几组数据。这个话题在微博阅读量超过2亿，知乎相关回答超过5000条。为什么这么火？有三个关键点。",
                "subtitle": "📊 2亿阅读 | 5000+ 回答 | 3个关键点",
                "bgm": "节奏感鼓点加入"
            },
            {
                "shot_number": 4, "duration": "6s",
                "visual": "三分法构图：左侧动态信息图逐个弹出（图标+数字），右侧主持人半身出镜讲解，背景为科技蓝渐变",
                "dialogue": "第一，这是一个万亿级的市场。第二，技术门槛正在快速降低。第三，政策利好不断加码。",
                "subtitle": "🔑 万亿市场 · 技术降维 · 政策利好",
                "bgm": "节奏递进，加入合成器旋律"
            },
            {
                "shot_number": 5, "duration": "7s",
                "visual": "俯拍桌面：主持人用平板展示案例图片，手指滑动切换，画中画叠加实际应用场景视频片段",
                "dialogue": "我们来看一个实际案例。某品牌通过这个趋势，三个月内用户增长了300%。他们做对了什么？",
                "subtitle": "📈 案例：3个月增长300%",
                "bgm": "保持节奏，弦乐铺垫情绪"
            },
            {
                "shot_number": 6, "duration": "6s",
                "visual": "特写+中景切换：主持人正面直视镜头，表情诚恳，光线温暖柔和，背景书架营造专业感",
                "dialogue": "核心在于，他们抓住了用户的真实痛点，而不是盲目跟风。这一点非常关键。",
                "subtitle": "💡 关键：抓住真实痛点",
                "bgm": "弦乐渐强，营造共鸣感"
            },
            {
                "shot_number": 7, "duration": "5s",
                "visual": "快速动作镜头：用户使用产品的场景快切（办公/户外/家庭），暖色调，笑容表情，强调正面体验",
                "dialogue": "所以，对于普通用户来说，这意味着什么？意味着更高效、更便捷、更有温度的体验。",
                "subtitle": "✨ 更高效 · 更便捷 · 更有温度",
                "bgm": "明亮上扬的钢琴旋律"
            },
            {
                "shot_number": 8, "duration": "8s",
                "visual": "分屏对比：左侧「传统方式」灰色单调画面，右侧「新方式」彩色活力画面，主持人画外音解说",
                "dialogue": "对比一下就很清楚了。过去需要一周才能完成的工作，现在一天就能搞定。这就是技术带来的改变。",
                "subtitle": "传统 vs 现在：效率提升7倍",
                "bgm": "节奏增强，加入打击乐"
            },
            {
                "shot_number": 9, "duration": "5s",
                "visual": "环绕运镜：主持人站在数据可视化大屏前，手势指向动态变化的数字，蓝金配色，科技感十足",
                "dialogue": "展望未来，这个赛道才刚刚开始。预计到2028年，市场规模还将翻一番。",
                "subtitle": "🔮 2028年市场规模翻番",
                "bgm": "恢弘合成器音色，推向高潮"
            },
            {
                "shot_number": 10, "duration": "6s",
                "visual": "回归中景：主持人坐在简约沙发上，表情放松微笑，暖色侧光，绿植虚化前景，温馨自然",
                "dialogue": f"最后想说，面对「{title}」这样的趋势，最好的态度是保持关注、理性参与、抓住属于自己的机会。",
                "subtitle": "保持关注 · 理性参与 · 抓住机会",
                "bgm": "温暖钢琴尾奏开始"
            },
            {
                "shot_number": 11, "duration": "4s",
                "visual": "片尾定格画面：频道Logo居中，渐变金色光芒扫过，下方显示关注引导文案",
                "dialogue": "如果你觉得有收获，记得点赞关注，我们下期见！",
                "subtitle": "👍 点赞 | 🔔 关注 | 💬 评论你的看法",
                "bgm": "BGM渐弱收尾，标志性结束音效"
            },
        ]
        return {
            "title": f"60秒看懂「{title}」",
            "visual_style": "现代科技风格，蓝橙暖色对比为主，光线明亮柔和，构图干净专业，节奏张弛有度",
            "body": _json.dumps(shots, ensure_ascii=False),
        }

    def _mock_generate_poster_copy(
        self, title: str, description: str, style: str
    ) -> dict:
        """Mock: 生成海报文案 + 生图提示词"""
        import json as _json
        style_configs = {
            "formal": {"tone": "庄重大气", "color": "深蓝+金色", "layout": "对称居中"},
            "humorous": {"tone": "轻松活泼", "color": "明黄+白色", "layout": "对角线动态"},
            "literary": {"tone": "诗意雅致", "color": "莫兰迪色系", "layout": "留白三分"},
            "professional": {"tone": "简约商务", "color": "深灰+克莱因蓝", "layout": "几何分割"},
        }
        config = style_configs.get(style, style_configs["professional"])

        copy_text = f"""{title}

{description}

立即了解 → 扫码关注获取更多精彩内容"""

        image_prompt = f"""构图：{config['layout']}构图，视觉焦点位于画面中心偏上
主体：与「{title}」相关的抽象几何元素与文字排版组合，简洁有力的视觉符号
色调：{config['color']}，{config['tone']}风格
光照：柔和散射光，无明显阴影，画面干净通透
风格：现代平面设计风格，极简主义，留白充足，高级感
细节：文字排版层次分明，主标题加粗放大，辅助文字纤细轻盈，加入细微纹理增加质感
尺寸：适合竖版手机海报比例（9:16），关键信息在画面安全区域内"""

        body_data = {"copy": copy_text, "image_prompt": image_prompt}
        return {
            "title": f"海报：{title}",
            "body": _json.dumps(body_data, ensure_ascii=False),
            "image_prompt": image_prompt,
        }

    def _mock_generate_social_post(
        self, title: str, description: str, style: str
    ) -> dict:
        """Mock: 生成社交媒体帖子"""
        style_emojis = {
            "formal": "📢",
            "humorous": "🤣",
            "literary": "✨",
            "professional": "💼",
        }
        emoji = style_emojis.get(style, "📌")

        body = f"""{emoji} 刚刚刷到一个热搜话题，忍不住想和大家分享一下——

「{title}」

{description}

说实话，这个话题能火起来一点都不意外 🤔

为什么这么说呢？几个观察：

1️⃣ 首先，它戳中了很多人的痛点。不管是在职场打拼的白领，还是在学校读书的学生，都能从中找到共鸣。

2️⃣ 其次，话题本身有很大的讨论空间。不是那种非黑即白的问题，而是值得深入思考的议题。

3️⃣ 最重要的是，它让我们看到了趋势和变化。在快速变化的时代，保持敏感度和学习能力真的太重要了 💪

我个人的看法是——不要急着站队，先多看看不同的声音，然后形成自己的判断。这才是面对热点话题最好的姿态 🧠

你们怎么看？评论区聊聊 👇

#热点话题 #行业趋势 #每日思考 #内容创作 #新媒体运营"""

        return {"title": f"🔥 如何看待「{title}」？", "body": body}

    def _mock_rewrite_content(
        self,
        original_body: str,
        content_type: str = "article",
        style: str = "professional",
        instruction: str = "rewrite",
    ) -> dict:
        """Mock: 改写/润色/扩写 — 不在 body 中添加任何前缀标记"""
        if instruction == "expand":
            extra = "\n\n## 补充分析\n\n从更深层次来看，这一话题还涉及到多个值得探讨的维度。首先，行业发展的大趋势为这一话题提供了宏观背景。其次，用户需求的不断演变也在推动相关讨论的深化。此外，技术进步带来的机遇与挑战同样是不可忽视的重要因素。\n\n业内专家指出，未来在政策、技术和市场的共同驱动下，相关领域将迎来更加广阔的发展空间。对于从业者而言，既需要保持对趋势的敏锐洞察，也需要在实操层面不断积累经验、优化策略。\n\n综上所述，这一话题的讨论远未结束，值得我们持续关注和深入思考。"
            return {"body": original_body + extra}
        else:
            return {"body": original_body}

    def _mock_generate_titles(
        self, body: str, content_type: str = "article", count: int = 5
    ) -> list:
        """Mock: 标题生成"""
        import re

        # 清理 body 中的已知前缀模式（改写/润色/扩写标记等）
        cleaned = body.strip()
        cleaned = re.sub(r'^[（(]以下[为是].*?[版本内容][)）]?\s*\n*', '', cleaned)
        cleaned = re.sub(r'^[（(]以下.*?(?:版本|内容)[)）]?\s*\n*', '', cleaned)
        cleaned = re.sub(r'^```(?:json)?\s*\n?', '', cleaned)
        cleaned = re.sub(r'\n?\s*```$', '', cleaned)
        cleaned = cleaned.strip()

        # 从清理后的内容提取第一行作为标题基础
        first_line = cleaned.split("\n")[0] if cleaned else "热门话题"
        # 如果第一行看起来像 JSON 或 code，跳过
        if first_line.strip().startswith(('[', '{', '```')):
            first_line = "热门话题"
        first_line = first_line.replace("#", "").strip()
        if len(first_line) < 3:
            first_line = "热门话题"
        base = first_line[:30] if len(first_line) > 30 else first_line

        templates = [
            f"深度解读：{base}",
            f"关于{base}，你需要知道的5个真相",
            f"为什么{base}正在改变行业格局？",
            f"{base}背后的底层逻辑",
            f"一文读懂{base}的核心要点",
            f"从{base}看未来3大趋势",
            f"别再误解了——{base}的正确打开方式",
            f"行业老兵告诉你：{base}到底意味着什么",
            f"{base}：一个被低估的重大变化",
            f"干货分享：{base}的实战方法论",
        ]

        # 确保不重复，最多 count 个
        seen = set()
        result = []
        for t in templates:
            if t not in seen and len(result) < count:
                seen.add(t)
                result.append(t)
        return result

    # ==================== Phase 5 Mock 实现 ====================

    def review_content(
        self, content_body: str, content_type: str = "article", title: str = ""
    ) -> dict:
        """AI 内容安全审核 — DeepSeek 优先，失败则 Mock"""
        try:
            result = self._ai.review_content(content_body, content_type, title)
            logger.info("DeepSeek AI 审核完成: 风险等级=%s", result.get("risk_level"))
            return result
        except AIGenerationException as e:
            logger.warning("DeepSeek AI 审核失败，回退 Mock: %s", str(e)[:100])
        except Exception as e:
            logger.error("AI 审核异常: %s", str(e), exc_info=True)
            raise
        return self._mock_review_content(content_body, content_type)

    def _mock_review_content(
        self, content_body: str, content_type: str = "article"
    ) -> dict:
        """Mock: 内容安全审核 — 模拟真实审核逻辑"""
        import random as _random
        import re as _re

        body_lower = content_body.lower()

        # 模拟检测关键词
        detected_issues = []

        sensitivity_keywords = [
            ("习近平", "政治敏感", "内容包含国家领导人姓名，需人工确认使用语境"),
            ("台独", "政治敏感", "内容可能涉及分裂言论"),
            ("法轮功", "违法信息", "内容包含非法组织名称"),
            ("赌博", "违法信息", "内容提及赌博相关内容"),
            ("毒品", "违法信息", "内容包含毒品相关词汇"),
            ("最有效", "广告法违规", "使用极限词'最'，可能违反广告法"),
            ("100%有效", "广告法违规", "包含绝对化承诺表述"),
            ("身份证号", "隐私泄露", "可能包含个人身份信息"),
        ]

        for keyword, category, desc in sensitivity_keywords:
            if keyword.lower() in body_lower:
                detected_issues.append(f"[{category}] {desc}")

        # 随机10%概率增加一条轻度提醒（模拟真实审核的不确定性）
        if _random.random() < 0.10:
            generic_notes = [
                "建议确认内容中的引用来源是否可靠",
                "部分表述可能引发争议，建议适当修改",
                "标题党嫌疑，建议标题与正文内容更加一致",
                "建议增加免责声明",
            ]
            detected_issues.append(f"[内容质量] {_random.choice(generic_notes)}")

        if detected_issues:
            risk_levels = {"政治敏感": "high", "违法信息": "high", "广告法违规": "medium",
                          "隐私泄露": "high", "内容质量": "low"}
            max_risk = max((risk_levels.get(issue.split("]")[0][1:], "low") for issue in detected_issues),
                          key=lambda r: {"safe": 0, "low": 1, "medium": 2, "high": 3}.get(r, 0))
            return {
                "is_approved": max_risk != "high",
                "risk_level": max_risk,
                "issues": detected_issues,
                "reviewer_notes": f"检测到 {len(detected_issues)} 个问题（Mock审核模式）",
            }

        return {
            "is_approved": True,
            "risk_level": "safe",
            "issues": [],
            "reviewer_notes": "模拟审核通过 — 未检测到违规内容（Mock模式）",
        }

    def adapt_for_platform(
        self,
        content_body: str,
        content_type: str,
        target_platform: str,
        platform_rules: dict,
    ) -> dict:
        """AI 多平台内容适配 — DeepSeek 优先，失败则 Mock"""
        try:
            result = self._ai.adapt_for_platform(
                content_body, content_type, target_platform, platform_rules
            )
            logger.info("DeepSeek 平台适配完成: %s", target_platform)
            return result
        except AIGenerationException as e:
            logger.warning("DeepSeek 平台适配失败，回退 Mock: %s", str(e)[:100])
        except Exception as e:
            logger.error("平台适配异常: %s", str(e), exc_info=True)
            raise
        return self._mock_adapt_for_platform(content_body, content_type, target_platform, platform_rules)

    def _mock_adapt_for_platform(
        self,
        content_body: str,
        content_type: str,
        target_platform: str,
        platform_rules: dict,
    ) -> dict:
        """Mock: 平台适配 — 应用基础格式转换"""
        max_chars = platform_rules.get("max_chars", 10000)
        hashtag_style = platform_rules.get("hashtag_style", "")
        tone = platform_rules.get("tone", "")

        # 截断到字数限制
        adapted = content_body[:max_chars]
        if len(content_body) > max_chars:
            adapted = adapted[:max_chars - 3] + "..."

        # 根据平台风格添加标签
        hashtags = []
        if "douyin" in target_platform:
            hashtags = ["#热点", "#涨知识", "#内容创作"]
        elif "weibo" in target_platform:
            hashtags = ["#热点话题#", "#内容分享#"]
        elif "xiaohongshu" in target_platform:
            hashtags = ["#干货分享", "#创作灵感", "#内容推荐"]

        # 如果支持标签格式，追加标签
        if hashtag_style and hashtags:
            tag_text = " ".join(hashtags)
            adapted = adapted + f"\n\n{tag_text}"

        # 小红书风格：加 emoji
        if "xiaohongshu" in target_platform and not adapted.startswith("✨"):
            adapted = "✨ " + adapted

        return {
            "adapted_body": adapted,
            "suggested_title": "",
            "hashtags": hashtags,
            "image_suggestions": f"适配{target_platform}平台的配图建议（Mock模式）",
        }
