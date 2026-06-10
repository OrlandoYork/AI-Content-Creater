import { create } from 'zustand';
import type {
  Content,
  ContentGenerateRequest,
  ContentGenerateResponse,
  ContentUpdate,
  ContentRewriteRequest,
} from '../types';
import * as contentApi from '../services/contentApi';

interface ContentStore {
  // Content list
  contents: Content[];
  contentsTotal: number;
  contentsLoading: boolean;

  // Current detail
  currentContent: Content | null;
  currentContentLoading: boolean;

  // AI generation
  generatingContent: boolean;
  generatedResult: ContentGenerateResponse | null;

  // Rewrite
  rewritingContent: boolean;

  // Title generation
  generatingTitles: boolean;
  generatedTitles: string[];

  // Actions
  loadContents: (params?: {
    content_type?: string;
    style?: string;
    status?: string;
    topic_id?: number;
    page?: number;
    page_size?: number;
  }) => Promise<void>;
  generateContent: (data: ContentGenerateRequest) => Promise<ContentGenerateResponse | null>;
  loadContentDetail: (id: number) => Promise<void>;
  updateContent: (id: number, data: ContentUpdate) => Promise<void>;
  deleteContent: (id: number) => Promise<void>;
  rewriteContent: (id: number, data: ContentRewriteRequest) => Promise<Content | null>;
  generateTitles: (body: string, content_type?: string, count?: number) => Promise<string[]>;
  clearGeneratedResult: () => void;
  clearGeneratedTitles: () => void;
  clearCurrentContent: () => void;
}

export const useContentStore = create<ContentStore>((set, get) => ({
  contents: [],
  contentsTotal: 0,
  contentsLoading: false,

  currentContent: null,
  currentContentLoading: false,

  generatingContent: false,
  generatedResult: null,

  rewritingContent: false,

  generatingTitles: false,
  generatedTitles: [],

  loadContents: async (params) => {
    set({ contentsLoading: true });
    try {
      const res = await contentApi.fetchContents(params);
      set({ contents: res.items, contentsTotal: res.total });
    } finally {
      set({ contentsLoading: false });
    }
  },

  generateContent: async (data) => {
    set({ generatingContent: true });
    try {
      const result = await contentApi.generateContent(data);
      set({ generatedResult: result });
      return result;
    } finally {
      set({ generatingContent: false });
    }
  },

  loadContentDetail: async (id) => {
    set({ currentContentLoading: true });
    try {
      const content = await contentApi.fetchContentDetail(id);
      set({ currentContent: content });
    } finally {
      set({ currentContentLoading: false });
    }
  },

  updateContent: async (id, data) => {
    const updated = await contentApi.updateContent(id, data);
    set({ currentContent: updated });
  },

  deleteContent: async (id) => {
    await contentApi.deleteContent(id);
  },

  rewriteContent: async (id, data) => {
    set({ rewritingContent: true });
    try {
      const result = await contentApi.rewriteContent(id, data);
      set({ currentContent: result });
      return result;
    } finally {
      set({ rewritingContent: false });
    }
  },

  generateTitles: async (body, content_type = 'article', count = 5) => {
    set({ generatingTitles: true });
    try {
      const res = await contentApi.generateTitles({ body, content_type, count });
      set({ generatedTitles: res.titles });
      return res.titles;
    } finally {
      set({ generatingTitles: false });
    }
  },

  clearGeneratedResult: () => set({ generatedResult: null }),
  clearGeneratedTitles: () => set({ generatedTitles: [] }),
  clearCurrentContent: () => set({ currentContent: null }),
}));
