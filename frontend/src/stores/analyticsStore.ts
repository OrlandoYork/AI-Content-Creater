import { create } from 'zustand';
import type { AnalyticsRecord, AnalyticsOverview } from '../types';
import * as analyticsApi from '../services/analyticsApi';

interface AnalyticsStore {
  records: AnalyticsRecord[];
  recordsTotal: number;
  recordsLoading: boolean;

  overview: AnalyticsOverview | null;
  overviewLoading: boolean;

  suggestions: string[];
  suggestionsLoading: boolean;

  loadRecords: (params?: { content_id?: number; platform?: string; page?: number; page_size?: number }) => Promise<void>;
  loadOverview: () => Promise<void>;
  collectData: (contentIds?: number[]) => Promise<void>;
  loadSuggestions: () => Promise<void>;
}

export const useAnalyticsStore = create<AnalyticsStore>((set) => ({
  records: [],
  recordsTotal: 0,
  recordsLoading: false,

  overview: null,
  overviewLoading: false,

  suggestions: [],
  suggestionsLoading: false,

  loadRecords: async (params) => {
    set({ recordsLoading: true });
    try {
      const res = await analyticsApi.fetchAnalytics(params);
      set({ records: res.items, recordsTotal: res.total });
    } finally {
      set({ recordsLoading: false });
    }
  },

  loadOverview: async () => {
    set({ overviewLoading: true });
    try {
      const overview = await analyticsApi.fetchAnalyticsOverview();
      set({ overview });
    } finally {
      set({ overviewLoading: false });
    }
  },

  collectData: async (contentIds) => {
    const res = await analyticsApi.collectData(contentIds);
    console.log('Collected:', res.collected);
  },

  loadSuggestions: async () => {
    set({ suggestionsLoading: true });
    try {
      const res = await analyticsApi.fetchSuggestions();
      set({ suggestions: res.suggestions });
    } finally {
      set({ suggestionsLoading: false });
    }
  },
}));
