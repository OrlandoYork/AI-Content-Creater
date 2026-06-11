import api from './api';
import type { Review, ReviewListResponse, ReviewCreate, ReviewUpdate } from '../types';

export function fetchReviews(params?: {
  content_id?: number;
  is_approved?: boolean;
  review_status?: string;
  page?: number;
  page_size?: number;
}) {
  return api.get('/reviews', { params }) as Promise<ReviewListResponse>;
}

export function fetchReviewDetail(id: number) {
  return api.get(`/reviews/${id}`) as Promise<Review>;
}

export function createReview(data: ReviewCreate) {
  return api.post('/reviews', data) as Promise<Review>;
}

export function updateReview(id: number, data: ReviewUpdate) {
  return api.put(`/reviews/${id}`, data) as Promise<Review>;
}

export function autoReviewContent(contentId: number) {
  return api.post(`/reviews/auto/${contentId}`) as Promise<Review>;
}

export function approveReview(id: number) {
  return api.post(`/reviews/${id}/approve`) as Promise<{ message: string; distribution_ids: number[] }>;
}

export function rejectReview(id: number) {
  return api.post(`/reviews/${id}/reject`) as Promise<{ message: string }>;
}
