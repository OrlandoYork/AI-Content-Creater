import api from './api';
import type { Distribution, DistributionListResponse, DistributionCreate, DistributionUpdate } from '../types';

export function fetchDistributions(params?: {
  content_id?: number;
  platform?: string;
  status?: string;
  page?: number;
  page_size?: number;
}) {
  return api.get('/distributions', { params }) as Promise<DistributionListResponse>;
}

export function fetchDistributionDetail(id: number) {
  return api.get(`/distributions/${id}`) as Promise<Distribution>;
}

export function createDistribution(data: DistributionCreate) {
  return api.post('/distributions', data) as Promise<Distribution>;
}

export function updateDistribution(id: number, data: DistributionUpdate) {
  return api.put(`/distributions/${id}`, data) as Promise<Distribution>;
}

export function fetchCalendar(year: number, month: number) {
  return api.get('/distributions/calendar', { params: { year, month } }) as Promise<Record<string, unknown>>;
}

export function batchDistribute(contentId: number, platforms: string[]) {
  return api.post(`/distributions/batch/${contentId}`, platforms) as Promise<Distribution[]>;
}

export function publishDistribution(id: number) {
  return api.post(`/distributions/${id}/publish`) as Promise<Distribution>;
}

export function cancelDistribution(id: number) {
  return api.post(`/distributions/${id}/cancel`) as Promise<Distribution>;
}
