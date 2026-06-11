/* ============================================
   TypeScript Type Definitions
   Aligned with backend Pydantic Schemas
   ============================================ */

// ==================== Hot Topics ====================

export interface HotTopic {
  id: number;
  title: string;
  source_platform: 'weibo' | 'zhihu' | 'douyin' | 'baidu' | 'sohu';
  hot_index: number;
  trend: 'rising' | 'stable' | 'falling';
  audience: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
  summary: string;
  url: string;
  duplicate_of_id: number | null;
  collected_at: string;
}

export interface HotTopicListResponse {
  items: HotTopic[];
  total: number;
  dedup_count: number;
}

export interface HotTopicAnalysis {
  topic: string;
  platform: string;
  hot_degree: string;
  estimated_readers: string;
  sentiment_ratio: {
    positive: string;
    neutral: string;
    negative: string;
  };
  analysis: string;
  target_audience: string;
  suggested_content_type: string;
}

// ==================== Topics ====================

export type ContentType = 'article' | 'video_script' | 'poster_copy' | 'social_post';
export type ContentStyle = 'formal' | 'humorous' | 'literary' | 'professional';
export type TopicStatus = 'draft' | 'selected' | 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export interface Topic {
  id: number;
  title: string;
  description: string;
  target_audience: string;
  content_type: ContentType;
  style: ContentStyle;
  status: TopicStatus;
  priority: number;
  scheduled_date: string | null;
  source_hot_topic_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface TopicListResponse {
  items: Topic[];
  total: number;
}

export interface TopicCreate {
  title: string;
  description?: string;
  target_audience?: string;
  content_type?: ContentType;
  style?: ContentStyle;
  priority?: number;
  scheduled_date?: string | null;
  source_hot_topic_id?: number | null;
}

export interface TopicUpdate {
  title?: string;
  description?: string;
  target_audience?: string;
  content_type?: ContentType;
  style?: ContentStyle;
  status?: TopicStatus;
  priority?: number;
  scheduled_date?: string | null;
}

export interface TopicGenerateRequest {
  hot_topic_id: number;
  count?: number;
  style_preference?: string;
}

export interface TopicGenerateResponse {
  suggestions: TopicCreate[];
  analysis: string;
}

export interface TopicScheduleRequest {
  scheduled_date: string;
}

// ==================== Platform ====================

export type Platform = 'wechat' | 'weibo' | 'douyin' | 'xiaohongshu';

export const PLATFORM_LABELS: Record<string, string> = {
  weibo: '微博',
  zhihu: '知乎',
  douyin: '抖音',
  baidu: '百度',
  sohu: '搜狐新闻',
  wechat: '微信',
  xiaohongshu: '小红书',
};

export const PLATFORM_COLORS: Record<string, string> = {
  weibo: '#f06565',
  zhihu: '#4fc3f7',
  douyin: '#111111',
  baidu: '#4ade80',
  sohu: '#f9a825',
  wechat: '#4ade80',
  xiaohongshu: '#f06565',
};

export const CONTENT_TYPE_LABELS: Record<string, string> = {
  article: '文章',
  video_script: '短视频脚本',
  poster_copy: '海报文案',
  social_post: '社交媒体帖子',
};

export const STYLE_LABELS: Record<string, string> = {
  formal: '正式',
  humorous: '幽默',
  literary: '文艺',
  professional: '专业',
};

export const STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  selected: '已选',
  scheduled: '已排期',
  in_progress: '创作中',
  completed: '已完成',
  cancelled: '已取消',
};

export const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  selected: 'cyan',
  scheduled: 'gold',
  in_progress: 'purple',
  completed: 'green',
  cancelled: 'red',
};

export const TREND_LABELS: Record<string, string> = {
  rising: '上升',
  stable: '平稳',
  falling: '下降',
};

export const SENTIMENT_LABELS: Record<string, string> = {
  positive: '正面',
  negative: '负面',
  neutral: '中性',
  mixed: '混合',
};

// ==================== Contents (Phase 2) ====================

export type ContentStatus = 'draft' | 'pending_review' | 'approved' | 'completed' | 'archived';

export interface Content {
  id: number;
  topic_id: number | null;
  title: string;
  body: string;
  content_type: ContentType;
  style: ContentStyle;
  word_count: number;
  status: ContentStatus;
  created_at: string;
  updated_at: string;
}

/** Content generate response includes extra fields for poster/video */
export interface ContentGenerateResponse extends Content {
  image_prompt?: string;
  visual_style?: string;
}

export interface ContentListResponse {
  items: Content[];
  total: number;
}

export interface ContentGenerateRequest {
  topic_id: number;
  content_type?: ContentType;
  style?: ContentStyle;
}

export interface ContentUpdate {
  title?: string;
  body?: string;
  content_type?: ContentType;
  style?: ContentStyle;
  word_count?: number;
  status?: ContentStatus;
}

export interface ContentRewriteRequest {
  instruction?: 'rewrite' | 'polish' | 'expand';
  style?: ContentStyle;
}

export interface TitleGenerateRequest {
  body: string;
  content_type?: ContentType;
  count?: number;
}

export interface TitleGenerateResponse {
  titles: string[];
}

export const CONTENT_STATUS_LABELS: Record<string, string> = {
  draft: '草稿',
  pending_review: '待审核',
  approved: '已审核',
  completed: '已完成',
  archived: '已归档',
};

export const CONTENT_STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  pending_review: 'orange',
  approved: 'cyan',
  completed: 'green',
  archived: 'red',
};

export const REWRITE_LABELS: Record<string, string> = {
  rewrite: 'AI 改写',
  polish: 'AI 润色',
  expand: 'AI 扩写',
};

// ==================== Reviews (Phase 3) ====================

export interface Review {
  id: number;
  content_id: number;
  content_title: string;
  is_approved: boolean;
  issues: string;
  reviewer_notes: string;
  review_status: string;
  reviewed_at: string;
  created_at: string;
}

export interface ReviewListResponse {
  items: Review[];
  total: number;
}

export interface ReviewCreate {
  content_id: number;
  is_approved?: boolean;
  issues?: string;
  reviewer_notes?: string;
}

export interface ReviewUpdate {
  is_approved?: boolean;
  issues?: string;
  reviewer_notes?: string;
}

// ==================== Distributions (Phase 3) ====================

export type DistributionStatus = 'pending' | 'published' | 'failed' | 'scheduled' | 'cancelled';

export interface Distribution {
  id: number;
  content_id: number;
  content_title: string;
  platform: string;
  publish_url: string;
  status: DistributionStatus;
  scheduled_time: string | null;
  published_at: string | null;
  platform_data: string;
  created_at: string;
}

export interface DistributionListResponse {
  items: Distribution[];
  total: number;
}

export interface DistributionCreate {
  content_id: number;
  platform: string;
  scheduled_time?: string | null;
}

export interface DistributionUpdate {
  platform?: string;
  status?: DistributionStatus;
  publish_url?: string;
  scheduled_time?: string | null;
  published_at?: string | null;
  platform_data?: string;
}

export const DISTRIBUTION_STATUS_LABELS: Record<string, string> = {
  pending: '待发布',
  published: '已发布',
  failed: '失败',
  scheduled: '已排期',
  cancelled: '已取消',
};

export const DISTRIBUTION_STATUS_COLORS: Record<string, string> = {
  pending: 'default',
  published: 'green',
  failed: 'red',
  scheduled: 'blue',
  cancelled: 'red',
};

export const DISTRIBUTION_PLATFORM_LABELS: Record<string, string> = {
  weibo: '微博',
  douyin: '抖音',
  xiaohongshu: '小红书',
  zhihu: '知乎',
};

// ==================== Analytics (Phase 4) ====================

export interface AnalyticsRecord {
  id: number;
  content_id: number;
  distribution_id: number | null;
  platform: string;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  bookmarks: number;
  follower_gain: number;
  collected_at: string;
}

export interface AnalyticsListResponse {
  items: AnalyticsRecord[];
  total: number;
}

export interface AnalyticsOverview {
  total_views: number;
  total_likes: number;
  total_comments: number;
  total_shares: number;
  total_bookmarks: number;
  total_follower_gain: number;
  total_contents: number;
  platform_breakdown: { platform: string; views: number; likes: number; comments: number }[];
}
