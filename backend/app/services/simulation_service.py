"""模拟数据生成引擎

负责生成所有模拟数据：热点话题、平台数据、用户画像等。
所有模块的模拟数据都由此服务统一生产，保证数据一致性。

热点话题标题 + 详细内容通过 DeepSeek AI 生成，
DeepSeek 不可用时回退到内置模板。
生成后通过 AI 智能去重，消除跨平台重复话题。

v2.0: 5平台（微博/知乎/抖音/百度/搜狐新闻），每平台5条 = 25条热点
"""
import random
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Any

from app.models.topic import HotTopic
from app.services.deepseek_service import DeepSeekService

logger = logging.getLogger(__name__)


class SimulationService:
    """全局模拟数据生成引擎"""

    def __init__(self):
        self._ai = DeepSeekService()

    # 模拟热点话题素材库（5平台，每平台5条模板）
    _HOT_TOPIC_TEMPLATES: Dict[str, List[str]] = {
        "weibo": [
            "某顶流明星深夜发文回应恋情传闻",
            "网友曝光某知名品牌食品安全问题",
            "热播剧大结局争议片段登热搜",
            "某科技企业CEO内部全员信流出",
            "00后整顿职场话题再登热搜榜首",
            "一线城市地铁新线开通首日盛况",
            "某国产手机品牌发布革命性新品",
            "国际体育赛事中国队夺冠引热议",
            "某地文旅局长变装视频走红网络",
            "大学生特种兵旅游挑战风靡全网",
            "某知名导演新片预告片播放量破亿",
            "某电商平台双十一数据造假传闻",
            "某地突降暴雨引发城市内涝关注",
            "娱乐圈某模范夫妻宣布离婚",
            "某网红主播直播带货翻车事件",
        ],
        "zhihu": [
            "如何看待2026年AI行业裁员潮",
            "35岁职场危机是伪命题吗？深度分析",
            "一线城市房价连续下跌的深层原因",
            "年轻人该不该裸辞？10万人的真实回答",
            "学历贬值时代，读书还值得投入吗",
            "副业刚需：普通人如何建立第二收入",
            "北上广深生活成本对比：谁最难生存",
            "自由职业3年，我后悔了吗",
            "大厂裁员背后的产业变迁信号",
            "从人口数据看中国消费趋势变化",
            "ChatGPT时代，文科生的出路在哪里",
            "电动汽车真的比燃油车更环保吗",
            "为什么越来越多年轻人选择不婚",
            "县城体制内工作的真实收入与生活",
            "中国制造业转型升级的痛点在哪",
        ],
        "douyin": [
            "新晋网红城市打卡攻略播放量破亿",
            "美食博主探店隐藏老店意外走红",
            "萌宠日常分享治愈百万网友焦虑",
            "乡村生活类短视频播放量持续飙高",
            "职场穿搭教程系列一周涨粉百万",
            "简单易学的居家健身动作教学走红",
            "旅行博主穷游中国系列引发模仿潮",
            "手工制作解压视频成新晋流量密码",
            "素人翻唱走红原唱本尊回应",
            "创意家居收纳小技巧收藏量破千万",
            "某高校军训才艺表演视频全网刷屏",
            "大叔跳女团舞反差萌圈粉无数",
            "用AI还原历史人物动态视频走红",
            "街头随机采访路人金句频出爆火",
            "沉浸式做饭视频治愈都市打工人",
        ],
        "baidu": [
            "2026年高考志愿填报指南搜索量激增",
            "新能源汽车购置补贴政策最新动态",
            "五一假期火车票抢票攻略大全",
            "全国多地持续高温红色预警发布",
            "暑期档电影票房最新排名出炉",
            "2027年考研大纲变动引发关注",
            "央行数字货币跨境支付最新进展",
            "医保个人账户改革方案引发热议",
            "新消费品牌融资与关店潮并存",
            "碳达峰行动方案各行业实施进展",
            "某地楼市新政：取消限购限售",
            "中小学教师轮岗制度全国推行",
            "国产大飞机C929首飞时间确定",
            "全国居民人均可支配收入最新数据",
            "某知名企业家被立案调查进展",
        ],
        "sohu": [
            "国际局势新变化对全球经济影响分析",
            "某汽车巨头宣布全面转型新能源时间表",
            "最新研究发现：睡眠不足与慢性病关联",
            "某地古镇保护与商业开发之争",
            "年度十大经济人物评选结果揭晓",
            "某跨国企业中国区裁员千人引关注",
            "新型诈骗手法曝光：已有多人中招",
            "国家医保目录新增多款抗癌药物",
            "某知名高校学术造假事件调查进展",
            "全民健身日：运动消费市场爆发式增长",
            "多地推行灵活就业人员社保新政",
            "某快时尚品牌因环保问题被约谈",
            "极端天气频发：气候专家解读背后原因",
            "养老产业成新蓝海：各路资本争相布局",
            "某地探索四天工作制试点效果显著",
        ],
    }

    _AUDIENCE_POOL = [
        "18-25岁年轻用户群体",
        "26-35岁职场人群",
        "35-50岁中年消费者",
        "大学生及应届毕业生",
        "创业者及自由职业者",
        "科技及互联网从业者",
        "宝妈及家庭消费者",
        "时尚及潮流爱好者",
        "理财及投资者",
        "教育及学生群体",
    ]

    def generate_hot_topics(self, count: int = 25) -> List[HotTopic]:
        """生成一批模拟热点话题

        优先通过 DeepSeek AI 生成逼真的热点标题 + 详细内容，
        DeepSeek 不可用时回退到内置模板。
        生成后通过 AI 智能去重，消除跨平台重复话题。

        5平台 × 每平台5条 = 25条热点

        Args:
            count: 生成数量（默认75）

        Returns:
            HotTopic对象列表
        """
        platforms = ["weibo", "zhihu", "douyin", "baidu", "sohu"]
        per_platform = max(1, count // len(platforms))  # 75/5 = 15
        remaining = count - per_platform * len(platforms)

        # 用于AI去重的临时ID
        temp_id_counter = 0
        all_topic_dicts: List[Dict[str, Any]] = []  # 临时存储用于去重
        topics: List[HotTopic] = []

        for idx, platform in enumerate(platforms):
            need = per_platform + (1 if idx < remaining else 0)

            # ========== Step 1: 生成标题 ==========
            titles = []
            try:
                titles = self._ai.generate_hot_topic_titles(platform, need)
                logger.info("DeepSeek 生成 %s 平台 %d 个标题成功", platform, len(titles))
            except Exception as e:
                logger.warning("DeepSeek 生成 %s 平台标题失败，回退模板: %s", platform, str(e)[:100])

            # 模板补齐
            if len(titles) < need:
                templates = self._HOT_TOPIC_TEMPLATES.get(platform, self._HOT_TOPIC_TEMPLATES["baidu"])
                shortage = need - len(titles)
                for _ in range(shortage):
                    fallback_title = random.choice(templates)
                    titles.append(fallback_title)

            # ========== Step 2: 为每个标题生成详细内容 ==========
            for title in titles[:need]:
                temp_id_counter += 1

                # 随机热度
                hot_index = random.randint(300, 980)

                # 随机趋势（偏向rising/stable）
                trend = random.choice(["rising"] * 4 + ["stable"] * 4 + ["falling"] * 2)

                # 随机情感
                sentiment = random.choice(
                    ["positive"] * 3 + ["neutral"] * 4 + ["negative"] * 2 + ["mixed"] * 1
                )

                # 随机受众
                audience = random.choice(self._AUDIENCE_POOL)

                # 采集时间
                hours_ago = random.randint(0, 24)
                collected_at = datetime.now() - timedelta(hours=hours_ago)

                # 生成详细内容摘要
                summary = ""
                url = ""
                try:
                    detail = self._ai.generate_topic_detail(title, platform)
                    summary = detail.get("summary", "")
                    url = detail.get("fake_url", "")
                    logger.info("DeepSeek 详情生成成功: %s", title[:30])
                except Exception as e:
                    logger.warning("DeepSeek 生成详情失败: %s", str(e)[:100])
                    summary = f"「{title}」是{platform}平台上的热门话题，引发了广泛关注和热烈讨论。"
                    url = ""

                topic = HotTopic(
                    title=title,
                    source_platform=platform,
                    hot_index=hot_index,
                    trend=trend,
                    audience=audience,
                    sentiment=sentiment,
                    summary=summary,
                    url=url,
                    collected_at=collected_at,
                )
                topics.append(topic)

                # 保存临时dict用于去重
                all_topic_dicts.append({
                    "id": temp_id_counter,
                    "title": title,
                    "platform": platform,
                    "hot_index": hot_index,
                    "topic_ref": topic,  # 反向引用
                })

        # ========== Step 3: AI 智能去重 ==========
        dedup_count = 0
        try:
            deduped_dicts = self._ai.deduplicate_topics(all_topic_dicts)
            # 应用去重结果
            for dd in deduped_dicts:
                dup_of = dd.get("duplicate_of_id")
                if dup_of is not None:
                    # 找到对应的话题对象
                    topic_ref = dd.get("topic_ref")
                    if topic_ref:
                        # 找到主话题的ID
                        primary_dict = next(
                            (d for d in all_topic_dicts if d["id"] == dup_of), None
                        )
                        if primary_dict and primary_dict.get("topic_ref"):
                            topic_ref.duplicate_of_id = primary_dict["topic_ref"].id
                            topic_ref.hot_index = dd.get("hot_index", topic_ref.hot_index)
                            dedup_count += 1
            logger.info("AI去重完成：%d 个话题被标记为重复", dedup_count)
        except Exception as e:
            logger.warning("AI去重失败，跳过: %s", str(e)[:100])

        # ========== Step 4: 按热度降序，去重话题排后面 ==========
        topics.sort(key=lambda x: (0 if x.duplicate_of_id is None else 1, -x.hot_index))
        return topics[:count]

    def refresh_hot_topics(self, existing_count: int = 0) -> List[HotTopic]:
        """刷新热点数据（用于定期更新）

        生成新的热点话题，模拟热点榜单的变化。
        新一批话题约占已有数量的30-50%。
        """
        # 生成 5-10 条新热点
        new_count = random.randint(5, 10)
        return self.generate_hot_topics(new_count)

    # ==================== 流式生成 ====================

    def generate_hot_topics_stream(self, count: int = 25):
        """流式生成热点话题（Generator）

        逐平台生成，每个话题完成后立即 yield SSE 事件，
        前端可实时看到进度和已生成的话题。

        事件类型：
        - progress: 阶段进度
        - topic: 单个话题生成完成
        - platform_done: 一个平台完成
        - dedup_start: 开始 AI 去重
        - dedup_result: 去重标记
        - complete: 全部完成

        Args:
            count: 总生成数量（默认25）

        Yields:
            dict: {"event": str, "data": dict}
        """
        platforms = ["weibo", "zhihu", "douyin", "baidu", "sohu"]
        per_platform = max(1, count // len(platforms))
        remaining = count - per_platform * len(platforms)

        total_steps = len(platforms) * 2  # titles + details per platform = 10 steps
        current_step = 0

        temp_id_counter = 0
        all_topic_dicts: List[Dict[str, Any]] = []
        all_topics: List[HotTopic] = []

        for idx, platform in enumerate(platforms):
            need = per_platform + (1 if idx < remaining else 0)

            # ========== Phase: 生成标题 ==========
            current_step += 1
            yield {
                "event": "progress",
                "data": {
                    "phase": "titles",
                    "platform": platform,
                    "icon": {"weibo": "🔴", "zhihu": "🔵", "douyin": "🎵", "baidu": "🔍", "sohu": "🦊"}.get(platform, "📡"),
                    "percent": round(current_step / total_steps * 100),
                    "message": f"正在采集 {platform} 平台热点标题……",
                },
            }

            titles = []
            try:
                titles = self._ai.generate_hot_topic_titles(platform, need)
                logger.info("DeepSeek 生成 %s 平台 %d 个标题成功", platform, len(titles))
            except Exception as e:
                logger.warning("DeepSeek 生成 %s 平台标题失败，回退模板: %s", platform, str(e)[:100])

            # 模板补齐
            if len(titles) < need:
                templates = self._HOT_TOPIC_TEMPLATES.get(platform, self._HOT_TOPIC_TEMPLATES["baidu"])
                shortage = need - len(titles)
                for _ in range(shortage):
                    titles.append(random.choice(templates))

            # ========== Phase: 生成详细内容 ==========
            current_step += 1
            yield {
                "event": "progress",
                "data": {
                    "phase": "details",
                    "platform": platform,
                    "icon": {"weibo": "🔴", "zhihu": "🔵", "douyin": "🎵", "baidu": "🔍", "sohu": "🦊"}.get(platform, "📡"),
                    "percent": round(current_step / total_steps * 100),
                    "message": f"正在为 {platform} 的 {len(titles[:need])} 条热点生成详细内容……",
                },
            }

            platform_topics = []
            for title in titles[:need]:
                temp_id_counter += 1

                hot_index = random.randint(300, 980)
                trend = random.choice(["rising"] * 4 + ["stable"] * 4 + ["falling"] * 2)
                sentiment = random.choice(
                    ["positive"] * 3 + ["neutral"] * 4 + ["negative"] * 2 + ["mixed"] * 1
                )
                audience = random.choice(self._AUDIENCE_POOL)
                hours_ago = random.randint(0, 24)
                collected_at = datetime.now() - timedelta(hours=hours_ago)

                # 生成详细摘要
                summary = ""
                url = ""
                try:
                    detail = self._ai.generate_topic_detail(title, platform)
                    summary = detail.get("summary", "")
                    url = detail.get("fake_url", "")
                except Exception as e:
                    logger.warning("DeepSeek 生成详情失败: %s", str(e)[:100])
                    summary = f"「{title}」是{platform}平台上的热门话题，引发了广泛关注和热烈讨论。"

                topic = HotTopic(
                    title=title,
                    source_platform=platform,
                    hot_index=hot_index,
                    trend=trend,
                    audience=audience,
                    sentiment=sentiment,
                    summary=summary,
                    url=url,
                    collected_at=collected_at,
                )
                all_topics.append(topic)
                platform_topics.append(topic)

                all_topic_dicts.append({
                    "id": temp_id_counter,
                    "title": title,
                    "platform": platform,
                    "hot_index": hot_index,
                    "topic_ref": topic,
                })

                # ========== 立即 yield：单个话题完成 ==========
                yield {
                    "event": "topic",
                    "data": {
                        "title": title,
                        "source_platform": platform,
                        "hot_index": hot_index,
                        "trend": trend,
                        "audience": audience,
                        "sentiment": sentiment,
                        "summary": summary[:150] + "……" if len(summary) > 150 else summary,
                        "url": url,
                    },
                }

            # ========== 平台完成 ==========
            yield {
                "event": "platform_done",
                "data": {
                    "platform": platform,
                    "icon": {"weibo": "🔴", "zhihu": "🔵", "douyin": "🎵", "baidu": "🔍", "sohu": "🦊"}.get(platform, "📡"),
                    "count": len(platform_topics),
                    "percent": round((idx + 1) / len(platforms) * 100),
                    "message": f"✓ {platform} 平台完成，已采集 {len(platform_topics)} 条热点",
                },
            }

        # ========== Phase: AI 智能去重 ==========
        yield {
            "event": "progress",
            "data": {
                "phase": "dedup",
                "platform": "",
                "icon": "🔍",
                "percent": 95,
                "message": f"正在进行跨平台智能去重（{len(all_topic_dicts)} 条热点）……",
            },
        }

        dedup_count = 0
        try:
            deduped_dicts = self._ai.deduplicate_topics(all_topic_dicts)
            for dd in deduped_dicts:
                dup_of = dd.get("duplicate_of_id")
                if dup_of is not None:
                    topic_ref = dd.get("topic_ref")
                    if topic_ref:
                        primary_dict = next(
                            (d for d in all_topic_dicts if d["id"] == dup_of), None
                        )
                        if primary_dict and primary_dict.get("topic_ref"):
                            topic_ref.duplicate_of_id = primary_dict["topic_ref"].id
                            topic_ref.hot_index = dd.get("hot_index", topic_ref.hot_index)
                            dedup_count += 1
                            yield {
                                "event": "dedup_result",
                                "data": {
                                    "title": topic_ref.title[:40],
                                    "duplicate_of_title": primary_dict["topic_ref"].title[:40],
                                },
                            }
            logger.info("AI去重完成：%d 个话题被标记为重复", dedup_count)
        except Exception as e:
            logger.warning("AI去重失败，跳过: %s", str(e)[:100])

        # 排序
        all_topics.sort(key=lambda x: (0 if x.duplicate_of_id is None else 1, -x.hot_index))

        # 最后 yield 实际对象列表供调用方存储（API 层负责 DB 操作 + 发送 complete）
        yield {
            "event": "__topics__",
            "data": all_topics[:count],
        }
