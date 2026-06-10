import { create } from 'zustand';
import type { HotTopic, Topic, TopicCreate, HotTopicAnalysis } from '../types';
import * as topicApi from '../services/topicApi';

export interface RefreshProgress {
  phase: string;
  platform: string;
  icon: string;
  percent: number;
  message: string;
}

interface TopicStore {
  // Hot Topics
  hotTopics: HotTopic[];
  hotTopicsTotal: number;
  hotTopicsLoading: boolean;

  // Streaming refresh state
  refreshProgress: RefreshProgress | null;
  refreshAbortController: AbortController | null;

  // AI Analysis
  analysis: HotTopicAnalysis | null;
  analysisLoading: boolean;

  // Generated Suggestions
  suggestions: TopicCreate[];
  suggestionAnalysis: string;
  generatingTopics: boolean;

  // Topics
  topics: Topic[];
  topicsTotal: number;
  topicsLoading: boolean;

  // Current
  currentTopic: Topic | null;
  currentTopicLoading: boolean;

  // Actions — Hot Topics
  loadHotTopics: (params?: { platform?: string; page?: number; page_size?: number }) => Promise<void>;
  refreshHotTopics: () => Promise<void>;
  refreshHotTopicsStream: () => void;
  cancelRefresh: () => void;
  analyzeHotTopic: (id: number) => Promise<void>;

  // Actions — Topics
  loadTopics: (params?: { status?: string; content_type?: string; page?: number; page_size?: number }) => Promise<void>;
  createTopic: (data: TopicCreate) => Promise<Topic>;
  generateTopics: (hotTopicId: number, count?: number, stylePreference?: string) => Promise<void>;
  loadTopicDetail: (id: number) => Promise<void>;
  updateTopic: (id: number, data: Partial<Topic>) => Promise<void>;
  deleteTopic: (id: number) => Promise<void>;
  scheduleTopic: (id: number, scheduledDate: string) => Promise<void>;

  // Clear
  clearSuggestions: () => void;
  clearCurrentTopic: () => void;
}

export const useTopicStore = create<TopicStore>((set, get) => ({
  // Hot Topics
  hotTopics: [],
  hotTopicsTotal: 0,
  hotTopicsLoading: false,

  // Streaming refresh
  refreshProgress: null,
  refreshAbortController: null,

  // AI Analysis
  analysis: null,
  analysisLoading: false,

  // Generated Suggestions
  suggestions: [],
  suggestionAnalysis: '',
  generatingTopics: false,

  // Topics
  topics: [],
  topicsTotal: 0,
  topicsLoading: false,

  // Current
  currentTopic: null,
  currentTopicLoading: false,

  // ==================== Actions ====================

  loadHotTopics: async (params) => {
    set({ hotTopicsLoading: true });
    try {
      const res = await topicApi.fetchHotTopics(params);
      set({ hotTopics: res.items, hotTopicsTotal: res.total });
    } finally {
      set({ hotTopicsLoading: false });
    }
  },

  /** 流式刷新：实时显示进度和逐个话题 */
  refreshHotTopicsStream: () => {
    // 取消已有的刷新
    const existing = get().refreshAbortController;
    if (existing) {
      existing.abort();
    }

    set({
      hotTopicsLoading: true,
      hotTopics: [],  // 清空旧数据，逐个追加
      refreshProgress: {
        phase: 'start',
        platform: '',
        icon: '🚀',
        percent: 0,
        message: '正在连接 AI 采集引擎……',
      },
    });

    const controller = topicApi.refreshHotTopicsStream(
      // onEvent
      (event, data) => {
        switch (event) {
          case 'progress':
            set({
              refreshProgress: {
                phase: data.phase,
                platform: data.platform,
                icon: data.icon || '📡',
                percent: data.percent,
                message: data.message,
              },
            });
            break;

          case 'topic':
            // 逐个追加话题到列表
            set((state) => ({
              hotTopics: [
                ...state.hotTopics,
                {
                  id: -(state.hotTopics.length + 1),  // 临时负ID
                  title: data.title,
                  source_platform: data.source_platform,
                  hot_index: data.hot_index,
                  trend: data.trend,
                  audience: data.audience,
                  sentiment: data.sentiment,
                  summary: data.summary,
                  url: data.url || '',
                  duplicate_of_id: null,
                  collected_at: new Date().toISOString(),
                },
              ],
              hotTopicsTotal: state.hotTopics.length + 1,
            }));
            break;

          case 'platform_done':
            set({
              refreshProgress: {
                phase: 'platform_done',
                platform: data.platform,
                icon: data.icon || '✅',
                percent: data.percent,
                message: data.message,
              },
            });
            break;

          case 'dedup_result':
            set({
              refreshProgress: {
                phase: 'dedup',
                platform: '',
                icon: '🔍',
                percent: 96,
                message: `去重: 「${data.title}……」 → 已合并`,
              },
            });
            break;

          case 'complete':
            // 用服务端返回的完整数据替换（含真实ID）
            if (data.items) {
              set({
                hotTopics: data.items,
                hotTopicsTotal: data.total,
                hotTopicsLoading: false,
                refreshProgress: null,
                refreshAbortController: null,
              });
            } else {
              set({
                hotTopicsLoading: false,
                refreshProgress: null,
                refreshAbortController: null,
              });
            }
            break;

          case 'error':
            set({
              hotTopicsLoading: false,
              refreshProgress: {
                phase: 'error',
                platform: '',
                icon: '❌',
                percent: 0,
                message: data.message,
              },
              refreshAbortController: null,
            });
            break;
        }
      },
      // onError
      (error) => {
        set({
          hotTopicsLoading: false,
          refreshProgress: {
            phase: 'error',
            platform: '',
            icon: '❌',
            percent: 0,
            message: `连接失败: ${error.message}`,
          },
          refreshAbortController: null,
        });
      },
      // onComplete (stream ended normally)
      () => {
        set({
          hotTopicsLoading: false,
          refreshAbortController: null,
        });
      },
    );

    set({ refreshAbortController: controller });
  },

  /** 取消正在进行的流式刷新 */
  cancelRefresh: () => {
    const controller = get().refreshAbortController;
    if (controller) {
      controller.abort();
    }
    set({
      hotTopicsLoading: false,
      refreshProgress: null,
      refreshAbortController: null,
    });
  },

  /** 兼容旧版：阻塞式刷新（等待完成后一次性返回） */
  refreshHotTopics: async () => {
    set({ hotTopicsLoading: true });
    try {
      const res = await topicApi.refreshHotTopics();
      set({ hotTopics: res.items, hotTopicsTotal: res.total });
    } finally {
      set({ hotTopicsLoading: false });
    }
  },

  analyzeHotTopic: async (id) => {
    set({ analysisLoading: true });
    try {
      const res = await topicApi.analyzeHotTopic(id);
      set({ analysis: res });
    } finally {
      set({ analysisLoading: false });
    }
  },

  loadTopics: async (params) => {
    set({ topicsLoading: true });
    try {
      const res = await topicApi.fetchTopics(params);
      set({ topics: res.items, topicsTotal: res.total });
    } finally {
      set({ topicsLoading: false });
    }
  },

  createTopic: async (data) => {
    const topic = await topicApi.createTopic(data);
    return topic;
  },

  generateTopics: async (hotTopicId, count = 3, stylePreference = 'professional') => {
    set({ generatingTopics: true });
    try {
      const res = await topicApi.generateTopics({
        hot_topic_id: hotTopicId,
        count,
        style_preference: stylePreference,
      });
      set({
        suggestions: res.suggestions,
        suggestionAnalysis: res.analysis,
      });
    } finally {
      set({ generatingTopics: false });
    }
  },

  loadTopicDetail: async (id) => {
    set({ currentTopicLoading: true });
    try {
      const topic = await topicApi.fetchTopicDetail(id);
      set({ currentTopic: topic });
    } finally {
      set({ currentTopicLoading: false });
    }
  },

  updateTopic: async (id, data) => {
    const updated = await topicApi.updateTopic(id, data);
    set({ currentTopic: updated });
  },

  deleteTopic: async (id) => {
    await topicApi.deleteTopic(id);
  },

  scheduleTopic: async (id, scheduledDate) => {
    const updated = await topicApi.scheduleTopic(id, { scheduled_date: scheduledDate });
    set((s) => ({
      currentTopic: s.currentTopic?.id === id ? updated : s.currentTopic,
    }));
  },

  clearSuggestions: () => set({ suggestions: [], suggestionAnalysis: '', analysis: null }),
  clearCurrentTopic: () => set({ currentTopic: null }),
}));
