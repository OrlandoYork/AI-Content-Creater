import api from './api';
import type { AnalyticsRecord, AnalyticsListResponse, AnalyticsOverview } from '../types';

export function fetchAnalytics(params?: {
  content_id?: number;
  platform?: string;
  page?: number;
  page_size?: number;
}) {
  return api.get('/analytics', { params }) as Promise<AnalyticsListResponse>;
}

export function fetchAnalyticsOverview() {
  return api.get('/analytics/overview') as Promise<AnalyticsOverview>;
}

export function collectData(contentIds?: number[]) {
  return api.post('/analytics/collect', null, { params: { content_ids: contentIds } }) as Promise<{ status: string; collected: number }>;
}

export function fetchSuggestions() {
  return api.get('/analytics/suggestions') as Promise<{ suggestions: string[] }>;
}
