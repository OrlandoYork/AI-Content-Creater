import api from './api';
import type { Review, ReviewListResponse, ReviewCreate, ReviewUpdate } from '../types';

export function fetchReviews(params?: {
  content_id?: number;
  is_approved?: boolean;
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
