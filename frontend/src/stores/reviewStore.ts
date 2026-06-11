import { create } from 'zustand';
import type { Content, Review, ReviewCreate } from '../types';
import * as reviewApi from '../services/reviewApi';
import * as contentApi from '../services/contentApi';

interface ReviewStore {
  reviews: Review[];
  reviewsTotal: number;
  reviewsLoading: boolean;

  currentReview: Review | null;
  currentReviewLoading: boolean;

  contentList: Content[];
  contentListLoading: boolean;

  loadReviews: (params?: { content_id?: number; is_approved?: boolean; review_status?: string; page?: number; page_size?: number }) => Promise<void>;
  createReview: (data: ReviewCreate) => Promise<Review>;
  loadReviewDetail: (id: number) => Promise<void>;
  updateReview: (id: number, data: { is_approved?: boolean; issues?: string; reviewer_notes?: string }) => Promise<void>;
  autoReviewContent: (contentId: number) => Promise<Review>;
  approveReview: (id: number) => Promise<{ message: string; distribution_ids: number[] }>;
  rejectReview: (id: number) => Promise<{ message: string }>;
  loadContentList: () => Promise<void>;
  clearCurrentReview: () => void;
}

export const useReviewStore = create<ReviewStore>((set) => ({
  reviews: [],
  reviewsTotal: 0,
  reviewsLoading: false,

  currentReview: null,
  currentReviewLoading: false,

  contentList: [],
  contentListLoading: false,

  loadReviews: async (params) => {
    set({ reviewsLoading: true });
    try {
      const res = await reviewApi.fetchReviews(params);
      set({ reviews: res.items, reviewsTotal: res.total });
    } finally {
      set({ reviewsLoading: false });
    }
  },

  createReview: async (data) => {
    const review = await reviewApi.createReview(data);
    return review;
  },

  loadReviewDetail: async (id) => {
    set({ currentReviewLoading: true });
    try {
      const review = await reviewApi.fetchReviewDetail(id);
      set({ currentReview: review });
    } finally {
      set({ currentReviewLoading: false });
    }
  },

  updateReview: async (id, data) => {
    const updated = await reviewApi.updateReview(id, data);
    set({ currentReview: updated });
  },

  autoReviewContent: async (contentId) => {
    const review = await reviewApi.autoReviewContent(contentId);
    return review;
  },

  approveReview: async (id) => {
    const result = await reviewApi.approveReview(id);
    return result;
  },

  rejectReview: async (id) => {
    const result = await reviewApi.rejectReview(id);
    return result;
  },

  loadContentList: async () => {
    set({ contentListLoading: true });
    try {
      const res = await contentApi.fetchContents({ page_size: 100 });
      set({ contentList: res.items });
    } finally {
      set({ contentListLoading: false });
    }
  },

  clearCurrentReview: () => set({ currentReview: null }),
}));
