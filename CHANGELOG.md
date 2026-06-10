# AI全媒体内容生产与分发系统 — 开发日志

> 最后更新: 2026-06-10  
> 当前阶段: **Phase 2 完成** ✅

---

## 项目概述

模拟新媒体运营团队的内容生产与分发全流程，实现：
**热点分析 → 选题策划 → AI创作 → 审核分发 → 效果分析** 的全链路AI辅助系统。

---

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 后端框架 | Python FastAPI | 0.115.6 |
| ORM | SQLModel (SQLite) | 0.0.22 |
| 前端框架 | React 18 + TypeScript | 18.3.1 |
| 构建工具 | Vite | 5.x |
| 组件库 | Ant Design 5 | 5.24.8 |
| 状态管理 | Zustand | — |
| HTTP 客户端 | Axios (前) / httpx (后) | — |
| AI 模型 | DeepSeek API (deepseek-v4-flash) | — |
| 可视化 | ECharts (echarts-for-react) | — |

---

## Phase 1 完成内容

### 1. 项目骨架搭建

**后端：**
- `backend/app/main.py` — FastAPI 入口，CORS、异常处理、lifespan 生命周期管理
- `backend/app/database.py` — SQLite 连接、Session 管理、auto-create 表
- `backend/app/core/config.py` — 统一配置管理（环境变量 + 默认值）
- `backend/app/core/exceptions.py` — 自定义异常体系（`AppException` / `NotFoundException` / `BusinessException` / `AIGenerationException`）

**前端：**
- `frontend/src/main.tsx` — React 18 入口
- `frontend/src/App.tsx` — 路由配置（React Router v6）+ Ant Design 暗色主题
- `frontend/src/styles/global.css` — CSS 变量体系 + 暗色主题覆盖 + 动画
- `frontend/vite.config.ts` — Vite 配置 + `/api` 代理

### 2. 数据模型 & API 设计

**数据库表（2张）：**

| 表 | 关键字段 | 说明 |
|----|----------|------|
| `hot_topics` | id, title, source_platform, hot_index, trend, audience, sentiment, summary, url, duplicate_of_id, collected_at | 热点话题（5平台×15条=75条） |
| `topics` | id, title, description, target_audience, content_type, style, status, priority, scheduled_date, source_hot_topic_id | AI生成/手动创建的选题 |

**API 端点（11个）：**

| Method | Path                           | 说明                    |
| ------ | ------------------------------ | --------------------- |
| GET    | `/api/topics/hot`              | 热点列表（分页+平台筛选）         |
| GET    | `/api/topics/hot/stats`        | 热点统计（平台/情感/趋势分布）      |
| POST   | `/api/topics/hot/refresh`      | **SSE流式刷新热点**（实时进度推送） |
| GET    | `/api/topics/hot/{id}`         | 热点详情                  |
| GET    | `/api/topics/hot/{id}/analyze` | AI分析热点                |
| GET    | `/api/topics`                  | 选题列表（分页+筛选）           |
| POST   | `/api/topics`                  | 创建选题                  |
| POST   | `/api/topics/generate`         | AI生成选题建议              |
| GET    | `/api/topics/{id}`             | 选题详情                  |
| PUT    | `/api/topics/{id}`             | 更新选题                  |
| DELETE | `/api/topics/{id}`             | 删除选题                  |
| POST   | `/api/topics/{id}/schedule`    | 选题排期                  |

### 3. AI 生成服务

**架构: DeepSeek 优先 → Mock 回退**

```
CozeService (抽象层)
   ├── 1. try DeepSeekService (云端大模型)
   │     └── 失败/不可用
   └── 2. fallback _mock_*() (内置模板)
```

**DeepSeekService 核心能力（4个公有方法）：**

| 方法 | 温度 | 说明 |
|------|------|------|
| `analyze_hot_topic()` | 0.7 | 分析热点：热度/受众/情感/阅读量 |
| `generate_topic_suggestions()` | 0.85 | 生成选题建议（1-5条） |
| `generate_hot_topic_titles()` | 0.9 | 生成逼真热搜标题 |
| `generate_topic_detail()` | 0.75 | 生成120-300字详细内容摘要 |
| `deduplicate_topics()` | 0.3 | 跨平台语义去重 |

**JSON 提取：** 内置 `_extract_json()` / `_extract_json_array()` 4级稳健解析（裸JSON → ```json → ``` → 深度计数匹配）

### 4. 模拟数据引擎

**SimulationService** — 单例统一生成所有模拟数据：
- 5 平台：微博 / 知乎 / 抖音 / 百度 / 搜狐新闻
- 每平台 15 条 = 75 条热点
- 每平台内置 15 条回退模板
- 热度 300-980 随机，趋势/情感/受众加权随机
- **流式生成器** `generate_hot_topics_stream()` — Generator yield SSE 事件

### 5. SSE 流式刷新

**事件类型：**

| 事件 | 数据 |
|------|------|
| `progress` | phase / platform / icon / percent / message |
| `topic` | 单条热点预览（title/hot_index/summary…） |
| `platform_done` | 平台完成（count/percent） |
| `dedup_result` | 去重标记 |
| `complete` | 全部完成（total/dedup_count/items含ID） |
| `error` | 错误信息 |

**前端 SSE 客户端：** `refreshHotTopicsStream()` — `fetch` + `ReadableStream.getReader()` 手动解析，返回 `AbortController` 支持取消。

### 6. 前端页面（4个）

| 页面 | 路由 | 核心功能 |
|------|------|----------|
| **Dashboard** | `/` | 热点/选题统计卡片、5平台柱状图、情感饼图、实时热榜TOP15、选题状态进度、流式刷新进度条 |
| **TopicList** | `/topics` | 表格筛选（状态/类型/搜索）、分页、快速排期弹窗、删除确认 |
| **TopicGenerate** | `/topics/generate` | 左侧热点选取（平台筛选+搜索）、AI分析面板、选题参数控制（风格/数量）、选题建议卡片+一键保存 |
| **TopicDetail** | `/topics/:id` | 查看模式（Descriptions展示）、编辑模式（Form表单）、排期/删除操作 |

### 7. 前端架构

| 层 | 文件 | 职责 |
|----|------|------|
| 类型 | `types/index.ts` | 全部 TS 类型 + 枚举标签/颜色映射 |
| API | `services/api.ts` | Axios 实例 + 拦截器 |
| API | `services/topicApi.ts` | 11 个 API 函数 + SSE 客户端 |
| Store | `stores/topicStore.ts` | Zustand — 热点/选题/分析/刷新进度/AbortController |
| 布局 | `components/layout/` | Sidebar(240px固定) + Header(面包屑+标题) + Content(Outlet) |

### 8. 设计系统

**"Newsroom Command Center" 暗色主题：**

| 元素 | 色值 |
|------|------|
| 底层背景 | `#0b0f19` |
| 卡片 | `#161d2a` |
| 悬浮 | `#1e2740` |
| 暖金强调 | `#d4a853` |
| 青蓝数据 | `#4fc3f7` |
| 珊瑚警示 | `#f06565` |
| 薄荷状态 | `#4ade80` |

**字体：** DM Serif Display (英文标题) + Noto Sans SC (中文正文) + JetBrains Mono (数据/代码)  
**动画：** `fadeInUp` 交错入场 (`stagger-in`) + `pulse` 心跳指示灯

---

## Phase 1 迭代记录

### v0.1.0 — 初始搭建
- FastAPI + SQLite 骨架
- 4平台热点（微博/知乎/抖音/百度）
- Mock AI 生成服务
- 前端 4 页面 + 深色主题

### v1.0.0 — DeepSeek 集成
- DeepSeek API 替换 Ollama
- `DeepSeekService` 完整封装（OpenAI 兼容接口）
- `CozeService` 改为 DeepSeek 优先 + Mock 回退
- 环境变量 `DEEPSEEK_API_KEY` 控制

### v1.1.0 — 5平台扩展 + 智能去重
- 新增搜狐新闻平台，5平台 × 15 = 75条
- `HotTopic` 模型增加 `summary` / `url` / `duplicate_of_id` 字段
- `generate_topic_detail()` — 120-300字 AI 摘要 + 模拟URL
- `deduplicate_topics()` — 跨平台语义去重
- 数据库 Schema 迁移逻辑

### v1.2.0 — SSE 流式刷新
- `DEEPSEEK_TIMEOUT` 60s → **180s**
- `/hot/refresh` 改为 `StreamingResponse` (SSE)
- `generate_hot_topics_stream()` — 生成器逐条推送
- 前端：流式进度条 + 实时话题追加 + AbortController 取消
- Dashboard / TopicGenerate 同步升级

---

## 已确认可用

- [x] 前后端联通（Vite proxy → FastAPI）
- [x] 75条热点数据加载（5平台）
- [x] SSE 流式刷新 + 进度显示 + 取消
- [x] AI 热点分析（DeepSeek / Mock 回退）
- [x] AI 选题生成（1-5条）+ 一键保存
- [x] 选题 CRUD + 排期
- [x] Dashboard 统计图表（ECharts）
- [x] TypeScript 零编译错误
- [x] Swagger 文档 `/docs` 可交互测试

---

## Phase 2 完成内容

### 1. 内容数据模型

**`contents` 表：**

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER PK | 主键 |
| topic_id | INTEGER FK → topics.id | 关联选题 |
| title | VARCHAR(200) | 内容标题 |
| body | TEXT | 内容正文 |
| content_type | VARCHAR(50) | article/video_script/poster_copy/social_post |
| style | VARCHAR(50) | formal/humorous/literary/professional |
| word_count | INTEGER | 字数/分镜数 |
| status | VARCHAR(50) | draft/completed/archived |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### 2. API 端点（9个）

| Method | Path | 说明 |
|--------|------|------|
| GET | `/api/contents` | 内容列表（类型/风格/状态/选题筛选 + 分页） |
| POST | `/api/contents/generate` | AI生成内容（基于选题ID、类型、风格） |
| GET | `/api/contents/{id}` | 内容详情 |
| PUT | `/api/contents/{id}` | 编辑保存 |
| DELETE | `/api/contents/{id}` | 删除 |
| POST | `/api/contents/{id}/rewrite` | AI改写/润色/扩写（3种模式） |
| POST | `/api/titles/generate` | AI批量生成标题（1-10个） |
| 🔮 POST | `/api/contents/{id}/generate-image` | **预留** 海报生图 |
| 🔮 POST | `/api/contents/{id}/generate-video` | **预留** 脚本生视频 |

### 3. AI 内容生成

**DeepSeekService 新增 3 个方法：**

| 方法                   | 温度      | 说明                                                                         |
| -------------------- | ------- | -------------------------------------------------------------------------- |
| `generate_content()` | 0.8-0.9 | 4种内容类型生成：文章(Markdown)/视频脚本(分镜JSON)/海报文案(copy+image_prompt)/社交帖子(emoji+tag) |
| `rewrite_content()`  | 0.75    | 3种改写模式：rewrite(重写)/polish(润色)/expand(扩写)                                   |
| `generate_titles()`  | 0.9     | 批量标题生成（悬念式/数字式/反问式/直述式/情感式）                                                |

**短视频脚本分镜格式：**
```json
[{shot_number, duration, visual, dialogue, subtitle, bgm}]
```
8-15个分镜，总时长40-90秒，每镜详细信息（镜头类型/场景/台词/字幕/音效）

**海报文案特殊设计：**
- `copy`: 海报主文案（标题+副标题+行动号召）
- `image_prompt`: AI生图提示词（构图/色调/光照/风格/细节，100-300字），兼容SD/DALL·E/Midjourney

**Mock 回退：**
- 文章：4种风格模板，结构化Markdown
- 视频脚本：11镜完整分镜表
- 海报：4种风格配置 + 完整image_prompt
- 社交帖子：emoji+分段+话题标签

### 4. 前端页面（2个）

| 页面 | 路由 | 核心功能 |
|------|------|----------|
| **ContentList** | `/content` | 类型/风格/状态筛选、搜索、分页表格、查看/编辑/删除 |
| **ContentEditor** | `/content/generate` | 双模式：新建（选题→类型→生成→编辑→保存）/ 查看已有（`?id=N`） |

**ContentEditor 工作流：**
- 步骤1：选择选题（搜索+列表，自动继承类型和风格）
- 步骤2：选择内容类型（文章/视频脚本/海报/社交帖子，可切换）
- 生成：点击"AI生成内容"，结果即时展示+可编辑
- 右侧特效渲染：
  - 视频脚本 → **分镜表**（6列表格：分镜号/时长/画面/台词/字幕/BGM）
  - 海报文案 → 文案卡片 + **AI生图提示词**面板
  - 社交帖子 → 模拟社交媒体卡片样式
  - 文章 → Markdown富文本预览
- AI改写面板：改写/润色/扩写三个按钮
- AI标题生成面板：5个标题供选择，点击即用
- 底部TextArea全文编辑 + 保存按钮

### 5. 内容持久化

- `POST /api/contents/generate` 生成后**自动保存**到数据库，返回完整Content对象（含ID）
- `PUT /api/contents/{id}` 手动编辑保存
- 从列表页"查看"进入 → URL带 `?id=N` 参数 → 加载已有内容并填充编辑区
- 从列表页可直接编辑已有内容的标题、正文

---

## Phase 2 文件变更

| 文件                                             | 操作     | 说明                          |
| ---------------------------------------------- | ------ | --------------------------- |
| `backend/app/models/content.py`                | **新建** | Content 模型                  |
| `backend/app/schemas/content.py`               | **新建** | 全套 Pydantic Schema（8个类）     |
| `backend/app/services/content_service.py`      | **新建** | 内容CRUD + AI集成（~170行）        |
| `backend/app/api/content.py`                   | **新建** | 9个端点（含2个预留）                 |
| `backend/app/services/deepseek_service.py`     | 修改     | +3个AI方法（~400行）              |
| `backend/app/services/coze_service.py`         | 修改     | +3 public + 7 mock方法（~300行） |
| `backend/app/main.py`                          | 修改     | +2 router注册                 |
| `frontend/src/types/index.ts`                  | 修改     | +Content类型、状态标签等            |
| `frontend/src/services/contentApi.ts`          | **新建** | 7个API函数                     |
| `frontend/src/stores/contentStore.ts`          | **新建** | Zustand store（~140行）        |
| `frontend/src/pages/content/ContentList.tsx`   | **新建** | 内容列表页（筛选+表格）                |
| `frontend/src/pages/content/ContentEditor.tsx` | **新建** | 内容创作编辑器（~650行）              |
| `frontend/src/App.tsx`                         | 修改     | +2路由                        |
| `frontend/src/components/layout/Sidebar.tsx`   | 修改     | 启用Module 2导航                |
| `frontend/src/components/layout/Header.tsx`    | 修改     | +breadcrumb映射               |

**总计：9个新文件 + 6个修改文件 = 15个文件，约2000+行新增代码**

---

## 已确认可用

- [x] 4种内容类型AI生成（文章/视频脚本/海报文案/社交帖子）
- [x] 4种风格定制（正式/幽默/文艺/专业）
- [x] 短视频分镜表（8-15镜，6字段详细描述）
- [x] 海报文案 + AI生图提示词
- [x] 内容改写/润色/扩写（3种模式）
- [x] AI标题批量生成（1-10个）
- [x] 内容CRUD + 数据库持久化
- [x] 风格继承自选题（减少重复选择）
- [x] 已有内容加载编辑（`?id=N`）
- [x] 一键生图/生视频预留接口
- [x] Mock回退全覆盖（DeepSeek不可用时）
- [x] TypeScript 零编译错误
- [x] Swagger `/docs` 可直接测试

---

## 待开发

| 阶段 | 模块 | 预计内容 |
|------|------|----------|
| **Phase 2** | 内容创作 | `contents`/`materials` 表、文章/脚本/海报/帖子生成、改写/扩写/标题生成、`ContentList`/`ContentEditor`/`TitleGenerator` |
| **Phase 3** | 审核分发 | `reviews`/`distributions` 表、敏感词检测、4平台分发模拟、`ReviewQueue`/`DistributionCenter`/`PublishCalendar` |
| **Phase 4** | 数据分析 | `analytics` 表、模拟平台数据、ECharts可视化报表、`DataOverview`/`ContentReport`/`OptimizationPanel` |

---

## 文件清单（55个源文件）

### 后端（21个）

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                          # FastAPI入口
│   ├── database.py                      # SQLite连接
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py                    # 配置管理
│   │   └── exceptions.py               # 自定义异常
│   ├── models/
│   │   ├── __init__.py
│   │   └── topic.py                     # HotTopic + Topic 模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   └── topic.py                     # Pydantic Schema
│   ├── api/
│   │   ├── __init__.py
│   │   └── topics.py                    # 12个API端点(含SSE)
│   │   └── content.py                   # 9个API端点(含2个预留🔮)
│   └── services/
│       ├── __init__.py
│       ├── topic_service.py             # 选题CRUD逻辑
│       ├── coze_service.py              # AI抽象层(DeepSeek优先→Mock回退)
│       ├── deepseek_service.py          # DeepSeek API封装(Phase1 260行→Phase2 +400行)
│       ├── simulation_service.py        # 模拟数据引擎(流式生成器)
│       ├── content_service.py           # 内容创作CRUD+AI集成
├── data/app.db                          # SQLite数据库
└── requirements.txt
```

### 前端（24个）

```
frontend/src/
├── main.tsx                             # React入口
├── App.tsx                              # 路由+暗色主题
├── styles/
│   └── global.css                       # CSS变量+Ant Design覆盖
├── components/
│   └── layout/
│       ├── AppLayout.tsx                # 主布局(侧边栏+顶栏+内容)
│       ├── Sidebar.tsx                  # 导航+系统状态
│       └── Header.tsx                   # 面包屑+页面标题
├── pages/
│   ├── Dashboard.tsx                    # 首页仪表盘
│   ├── topics/
│   │   ├── TopicList.tsx                # 选题列表(表格+筛选+排期)
│   │   ├── TopicGenerate.tsx            # AI选题生成(热点选取+分析+建议)
│   │   └── TopicDetail.tsx              # 选题详情/编辑
│   └── content/
│       ├── ContentList.tsx              # 内容列表(筛选+分页+操作)
│       └── ContentEditor.tsx            # AI内容创作(选题→生成→编辑→保存)
├── services/
│   ├── api.ts                           # Axios实例+拦截器
│   ├── topicApi.ts                      # 选题API函数+SSE客户端
│   └── contentApi.ts                    # 内容API函数
├── stores/
│   ├── topicStore.ts                    # Zustand选题状态
│   └── contentStore.ts                  # Zustand内容状态
└── types/
    └── index.ts                         # TS类型+枚举映射(Phase1+Phase2)

### 配置（8个）

```
.claude/launch.json                      # 前后端启动配置
frontend/vite.config.ts                  # Vite+代理
frontend/package.json                    # npm依赖
frontend/tsconfig.json                   # TS配置
frontend/tsconfig.app.json
frontend/tsconfig.node.json
backend/requirements.txt                 # Python依赖
CLAUDE.md                                # 项目文档
```

---

## 启动方式

```bash
# 终端1 — 后端
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 127.0.0.1 --port 8082 --reload

# 终端2 — 前端
cd frontend
npm install
npm run dev
```

- 后端 API 文档: `http://127.0.0.1:8082/docs`
- 前端页面: `http://127.0.0.1:5173`
- 可选: 设置 `DEEPSEEK_API_KEY` 环境变量开启真实 AI

---

## 环境变量

| 变量                 | 默认值                             | 说明                         |
| ------------------ | ------------------------------- | -------------------------- |
| `DEEPSEEK_API_KEY` | (空)                             | DeepSeek API Key，未设置则用Mock |
| `DEEPSEEK_MODEL`   | `deepseek-v4-flash`             | 模型名称                       |
| `DEEPSEEK_TIMEOUT` | `180`                           | API超时(秒)                   |
| `DEEPSEEK_ENABLED` | `true`                          | AI总开关                      |
| `DATABASE_URL`     | `sqlite:///backend/data/app.db` | 数据库路径                      |
| `DEBUG`            | `true`                          | SQL echo                   |
