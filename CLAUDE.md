# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Start Backend (Python FastAPI, autoPort)
```bash
cd backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8082 --reload
```

Note: `.claude/launch.json` uses `autoPort: true` for the backend — the harness assigns a dynamic port when 8082 is occupied. After starting, update `frontend/vite.config.ts` proxy target to match the assigned port.

### Start Frontend (React Vite, port 5173)
```bash
cd frontend && npm run dev
```

Both servers can also be started via `.claude/launch.json` using `preview_start`.

### Other Frontend Commands
```bash
cd frontend && npm run build     # TypeScript check + Vite build
cd frontend && npm run lint      # ESLint
cd frontend && npm run preview   # Preview production build
```

### API Testing
Browse `http://127.0.0.1:8082/docs` for the interactive Swagger UI.

### Running Backend Tests
```bash
cd backend && python -m pytest -v
```

## Critical Version Constraints

The frontend uses **specific major versions** — upgrading blindly will break the app:

| Package | Required | ❌ Do NOT upgrade to |
|---------|----------|---------------------|
| `antd` | `^5.24.8` | v6 (ConfigProvider/theme API changed) |
| `react` / `react-dom` | `^18.3.1` | v19 (peer dependency conflicts with antd 5) |
| `react-router-dom` | `^6.28.2` | v7 (removed BrowserRouter, Routes, Route, Outlet) |

## Architecture

### Backend Layer Stack
```
FastAPI router (api/) → Service layer (services/) → SQLModel ORM → SQLite
                                                    ├── SimulationService (mock data engine)
                                                    ├── CozeService (AI abstraction, DeepSeek优先→Mock回退)
                                                    └── DeepSeekService (OpenAI兼容API封装, 260行)
```

### Data Flow
```
React (Zustand store) → Axios (/api proxy) → FastAPI REST → Service → SQLite
```

### Port Configuration
- Backend: `127.0.0.1:8082` (not 8000; 8000 and 8080 were occupied)
- Frontend: `127.0.0.1:5173` with Vite proxy forwarding `/api` → `http://127.0.0.1:8082`

### AI Service Architecture
- **`DeepSeekService`** (`backend/app/services/deepseek_service.py`): 核心 AI 引擎，通过 OpenAI 兼容接口调用 DeepSeek API（`/v1/chat/completions`）。提供 5 个公有方法：
  - `analyze_hot_topic()` — 热点分析（温度 0.7），返回 8 字段结构化 JSON
  - `generate_topic_suggestions()` — 选题建议生成（温度 0.85），1-5 条
  - `generate_hot_topic_titles()` — 热点标题生成（温度 0.9）
  - `generate_topic_detail()` — 120-300 字详细摘要 + 模拟 URL（温度 0.75）
  - `deduplicate_topics()` — 跨平台语义去重（温度 0.3）
- **`CozeService`** (`backend/app/services/coze_service.py`): AI 抽象层，try DeepSeek → 失败则 fallback `_mock_*()`。方法签名保持不变，上层无感知。
- **`SimulationService`** (`backend/app/services/simulation_service.py`): 单例模拟数据引擎。5 平台×15 条=75 条热点，含 `generate_hot_topics_stream()` 流式生成器（Generator yield SSE 事件）。

### Database
- SQLite via SQLModel, stored at `backend/data/app.db` (auto-created on first startup)
- `Path.mkdir(parents=True, exist_ok=True)` runs before engine creation to ensure the data directory exists
- `check_same_thread=False` is required for FastAPI's concurrent access
- Tables are created in `main.py`'s `lifespan` handler; initial hot topic seed data is inserted in the `startup_event` if the `hot_topics` table is empty

### Backend Exception Handling
- `AppException` base class with `code` + `message`; caught by a global exception handler in `main.py`
- `NotFoundException` (404), `BusinessException` (400), `AIGenerationException` (500)

### Frontend State Pattern
One Zustand store per module (`stores/topicStore.ts`). Each store holds loading flags per operation, data arrays, and async actions that call the API layer and update state in try/finally blocks.

### Frontend API Pattern
- `services/api.ts`: Axios instance with `baseURL: '/api'`. Response interceptor returns `res.data` (unwraps the HTTP response). Error interceptor shows `message.error()` via antd.
- `services/topicApi.ts`: Typed functions wrapping each endpoint. Follow this pattern for new modules.

### Frontend Theme
Dark theme "Newsroom Command Center" defined in two layers:
1. CSS custom properties in `styles/global.css` (colors, fonts, shadows, transitions)
2. Ant Design 5 `ConfigProvider` with `theme.darkAlgorithm` + custom tokens in `App.tsx`

Colors: base `#0b0f19`, cards `#161d2a`, gold accent `#d4a853`, cyan accent `#4fc3f7`.

### SSE Streaming Refresh (Phase 1.2)

The `/api/topics/hot/refresh` endpoint uses `StreamingResponse` (SSE) for real-time progress. The frontend consumes this via `fetch` + `ReadableStream.getReader()`.

**SSE Event Types:**

| Event | Data | When |
|-------|------|------|
| `progress` | `{phase, platform, icon, percent, message}` | 阶段进度（titles/details/dedup） |
| `topic` | `{title, source_platform, hot_index, trend, audience, sentiment, summary, url}` | 每条热点生成完成 |
| `platform_done` | `{platform, count, percent, message}` | 一个平台全部完成 |
| `dedup_result` | `{title, duplicate_of_title}` | 去重标记 |
| `complete` | `{total, dedup_count, unique_count, message, items}` | 全部完成（items 含真实 DB ID） |
| `error` | `{message}` | 异常终止 |

**Frontend SSE Client** (`services/topicApi.ts`):
- `refreshHotTopicsStream(onEvent, onError?, onComplete?)` — 返回 `AbortController`
- 手动解析 SSE 格式 (`event:` / `data:` / 空行分隔)
- Store 中 `refreshAbortController` 支持随时取消

**Backend Generator** (`simulation_service.py`):
- `generate_hot_topics_stream(count=75)` — 逐平台 yield，每个话题立即推送
- 最后 yield `__topics__` 内部事件 → API 层存入 DB 并获取 ID → 发送 `complete`

### Routing
React Router v6 nested routes in `App.tsx`, all wrapped by `AppLayout` (240px fixed sidebar + 64px header + scrollable content). `TopicDetail` uses `:id` path param.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DEEPSEEK_API_KEY` | (空) | DeepSeek API Key；未设置则回退 Mock |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | API 地址 |
| `DEEPSEEK_MODEL` | `deepseek-v4-flash` | 模型名称 |
| `DEEPSEEK_TIMEOUT` | `180` | 请求超时（秒） |
| `DEEPSEEK_ENABLED` | `true` | AI 总开关；设为 `false` 强制 Mock |
| `DATABASE_URL` | `sqlite:///backend/data/app.db` | SQLite 路径 |
| `DEBUG` | `true` | SQL echo 日志 |

### Schema Migration
`main.py` 的 `lifespan` 会在启动时检查 `hot_topics` 表是否缺少新字段（`summary`/`url`/`duplicate_of_id`），缺少则 `DROP TABLE` 并重建。添加新字段时需同步修改此处的检查逻辑和模型定义。

## Project Status: Phase 1 Complete

Phase 1 (Hot Topic Analysis & Topic Planning) is fully implemented and verified:

| Layer | Files | Status |
|-------|-------|--------|
| Backend models | `models/topic.py` — `HotTopic` and `Topic` tables | ✅ |
| Backend schemas | `schemas/topic.py` — Request/Response Pydantic models | ✅ |
| Backend API | `api/topics.py` — 11 REST endpoints under `/api/topics` | ✅ |
| Backend services | `topic_service.py`, `coze_service.py`, `simulation_service.py` | ✅ |
| Frontend pages | `Dashboard`, `TopicList`, `TopicGenerate`, `TopicDetail` | ✅ |
| Frontend infra | `api.ts`, `topicApi.ts`, `topicStore.ts`, `types/index.ts` | ✅ |

### Pending: Phases 2-4

The plan at `.claude/plans/md-ai-shiny-riddle.md` details the remaining phases:
- **Phase 2**: AI Content Creation — `contents`/`materials` tables, expand `CozeService` mock templates, `ContentService`, content/rewrite/expand/title API routes. Frontend: `ContentList`, `ContentEditor`, `TitleGenerator`.
- **Phase 3**: Content Review & Multi-Platform Distribution — `reviews`/`distributions` tables, `ReviewService`, `DistributionService`. Frontend: `ReviewQueue`, `DistributionCenter`, `PublishCalendar`.
- **Phase 4**: Data Monitoring & Effect Analysis — `analytics` table, expand `SimulationService` for platform metrics, `AnalyticsService`. Frontend: `DataOverview`, `ContentReport`, `OptimizationPanel` with ECharts.

### Enums for Reference
- **Content types**: `article | video_script | poster_copy | social_post`
- **Platforms** (data source): `weibo | zhihu | douyin | baidu | sohu`
- **Platforms** (distribution): `wechat | weibo | douyin | xiaohongshu`
- **Content styles**: `formal | humorous | literary | professional`
- **Topic statuses**: `draft | selected | scheduled | in_progress | completed | cancelled`
