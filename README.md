<p align="center">
  <img src="https://img.shields.io/badge/version-0.2.0-blue" alt="version">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="license">
  <img src="https://img.shields.io/badge/python-3.12+-blue" alt="python">
  <img src="https://img.shields.io/badge/React-18-61dafb" alt="react">
  <img src="https://img.shields.io/badge/docker-ready-2496ed" alt="docker">
</p>

<h1 align="center">AI 全媒体内容生产与分发系统</h1>
<p align="center"><strong>ContentAI</strong> — AI-Powered Omnimedia Content Production & Distribution</p>

---

## 项目概述

模拟新媒体运营团队的完整工作流，实现 **热点分析 → 选题策划 → AI 创作 → 审核分发 → 效果分析** 全链路 AI 辅助系统。

系统从微博、知乎、抖音、百度、搜狐五大平台实时采集热点，借助 DeepSeek 大模型进行语义分析与去重，自动生成多类型内容（文章/视频脚本/海报文案/社交媒体帖子），通过 AI 审核后一键分发至微信、微博、抖音、小红书，并提供完整的数据分析与优化建议。

---

## 核心功能

<table>
<tr>
<td width="50%">

### 🔥 热点分析与选题策划
- 5 大平台热点实时采集与 SSE 流式刷新
- AI 语义去重，跨平台合并重复话题
- 热度指数 / 情感倾向 / 受众画像分析
- AI 选题建议生成（支持多种内容类型与风格）

</td>
<td width="50%">

### ✍️ AI 内容创作
- 4 种内容类型：文章 / 视频脚本 / 海报文案 / 社交媒体帖子
- 支持 AI 改写 / 润色 / 扩写
- AI 多风格标题生成（悬念式 / 数字式 / 反问式 / 直抒式 / 情感式）
- 视频脚本自动解析为分镜故事板

</td>
</tr>
<tr>
<td width="50%">

### ✅ 审核与多平台分发
- AI 自动安全审核（7 类风险检测）
- 审核通过自动触发多平台分发
- 平台自适应改写（字数限制 / 语气 / 话题标签）
- 发布日历管理与调度

</td>
<td width="50%">

### 📊 数据分析与优化
- 6 维度 KPI 仪表盘（浏览量 / 点赞 / 评论 / 分享 / 收藏 / 涨粉）
- 平台分布与互动对比图表
- AI 优化建议与雷达图可视化
- 内容级与平台级数据报表

</td>
</tr>
</table>

### 🤖 AI Agent 全局助手

基于 **LangGraph** 的多智能体编排系统，8 个工作流节点 + 11 个专业工具，支持 SSE 流式对话交互，可中断/恢复任务执行，上下文感知当前页面状态。

---

## 系统架构

```
┌─────────────────────────────────────────────────────────┐
│                     Frontend (React 18)                  │
│  Ant Design 5 · Zustand · ECharts · Framer Motion      │
│  port: 5173 (dev) / 80 (container via Nginx)            │
└─────────────────────┬───────────────────────────────────┘
                      │ /api proxy
┌─────────────────────▼───────────────────────────────────┐
│                  Backend (FastAPI 0.115)                  │
│  ┌──────────┬──────────┬──────────┬──────────┐         │
│  │  Topics  │ Content  │  Review  │Distribution│        │
│  ├──────────┼──────────┼──────────┼──────────┤         │
│  │ Analytics│  Agent   │ DeepSeek │  Coze    │         │
│  └──────────┴──────────┴──────────┴──────────┘         │
│  port: 8082 (dev) / 8083 (docker host)                   │
└──────┬──────────────────────────────────┬────────────────┘
       │                                  │
┌──────▼──────┐  ┌──────────┐  ┌─────────▼──────────┐
│  PostgreSQL │  │  Redis   │  │  DeepSeek API      │
│  (primary)  │  │ (cache)  │  │  (deepseek-v4-flash)│
│  port: 5433 │  │ port:6380│  │  / Mock fallback   │
└─────────────┘  └──────────┘  └────────────────────┘
```

---

## 技术栈

| 层级 | 技术 | 说明 |
|------|------|------|
| 前端框架 | React 18 + TypeScript | 严格类型，ESM 模块 |
| UI 组件库 | Ant Design 5 | 暗色主题 "Newsroom Command Center" |
| 状态管理 | Zustand 5 | 轻量级响应式状态 |
| 可视化 | ECharts 6 | 柱状图 / 饼图 / 雷达图 |
| 后端框架 | FastAPI 0.115 | 异步 REST API |
| ORM | SQLModel + SQLAlchemy 2 | asyncpg 异步驱动 |
| AI 引擎 | DeepSeek API | OpenAI 兼容接口，Mock 回退 |
| Agent 框架 | LangGraph 1.0 | 多节点状态图编排 |
| 数据库 | PostgreSQL 16 + Redis 7 | Docker 容器化部署 |
| 迁移工具 | Alembic | 自动 schema 迁移 |
| 容器化 | Docker + Docker Compose | 一键部署，4 服务编排 |

---

## 快速开始

### 前置要求

- [Docker Desktop](https://www.docker.com/products/docker-desktop) (推荐)
- 或 Python 3.12+ / Node.js 22+

### Docker 一键部署（推荐）

```bash
# 1. 克隆项目
git clone <your-repo-url> && cd <your-repo>

# 2. 配置环境变量
cp .env.docker .env
# 编辑 .env，填入你的 DEEPSEEK_API_KEY
# 未设置 API Key 时系统自动使用 Mock 数据

# 3. 启动所有服务
docker compose up -d
```

访问地址：

| 服务 | 地址 |
|------|------|
| 前端界面 | http://localhost:5173 |
| API 文档 (Swagger) | http://localhost:8083/docs |
| PostgreSQL | localhost:5433 |
| Redis | localhost:6380 |

```bash
# 停止服务
docker compose down

# 停止并清空数据库
docker compose down -v
```

### 本地开发

```bash
# 后端
cd backend
pip install -r requirements.txt
cp .env.example .env  # 编辑配置
uvicorn app.main:app --host 127.0.0.1 --port 8082 --reload

# 前端（新终端）
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173 访问前端，http://localhost:8082/docs 访问 API 文档。

---

## 环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DEEPSEEK_API_KEY` | (空) | DeepSeek API Key；未设置则自动回退 Mock 模式 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | API 地址 |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | 模型名称 |
| `DEEPSEEK_TIMEOUT` | `180` | 请求超时（秒） |
| `DEEPSEEK_ENABLED` | `true` | 设为 `false` 强制使用 Mock |
| `DATABASE_URL` | `postgresql+asyncpg://...` | PostgreSQL 异步连接串 |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis 连接串 |
| `PG_PORT` | `5433` | PostgreSQL 宿主机端口 |
| `BACKEND_PORT` | `8083` | 后端宿主机端口 |
| `FRONTEND_PORT` | `5173` | 前端宿主机端口 |
| `DEBUG` | `false` | SQL 日志输出 |

---

## API 文档

启动后端后访问 Swagger UI：**http://localhost:8082/docs**

主要 API 模块：

| 模块 | 前缀 | 说明 |
|------|------|------|
| 选题策划 | `/api/topics` | 热点浏览、选题 CRUD、AI 选题生成 |
| 内容创作 | `/api/content` | 内容 CRUD、AI 生成/改写/标题 |
| AI Agent | `/api/agent` | LangGraph 工作流 SSE 流式编排 |
| 内容审核 | `/api/reviews` | AI 审核、审批/驳回 |
| 多平台分发 | `/api/distributions` | 一键分发、发布日历 |
| 数据分析 | `/api/analytics` | 数据采集、概览、优化建议 |

---

## 项目结构

```
├── backend/                # FastAPI 后端
│   ├── app/
│   │   ├── api/            # 6 个路由模块 (REST + SSE)
│   │   ├── models/         # SQLModel 数据模型 (6 张表)
│   │   ├── services/       # 业务逻辑 + AI 服务
│   │   ├── agent/          # LangGraph 多智能体
│   │   ├── schemas/        # Pydantic 请求/响应模型
│   │   └── core/           # 配置 + 异常处理
│   ├── alembic/            # 数据库迁移
│   └── requirements.txt
├── frontend/               # React 18 + Vite
│   ├── src/
│   │   ├── pages/          # 12 个页面 (Dashboard / Content / Review / Analytics ...)
│   │   ├── components/     # 布局 + Agent 交互组件
│   │   ├── stores/         # Zustand 状态管理 (6 个 store)
│   │   ├── services/       # Axios API 封装 + SSE 客户端
│   │   └── types/          # TypeScript 类型定义
│   └── package.json
├── docker-compose.yml      # 4 服务编排
├── Dockerfile.backend      # Python 后端镜像
├── Dockerfile.frontend     # Nginx + SPA 前端镜像
├── nginx.conf              # Nginx 反向代理配置
├── .env.docker             # Docker 环境变量模板
└── CHANGELOG.md            # 完整开发日志
```

---


<p align="center">
  <sub>Built with ❤️ by 计科23_1 第15组 </sub>
</p>
