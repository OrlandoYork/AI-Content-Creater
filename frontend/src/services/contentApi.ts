import api from './api';
import type {
  Content,
  ContentListResponse,
  ContentGenerateRequest,
  ContentGenerateResponse,
  ContentUpdate,
  ContentRewriteRequest,
  TitleGenerateRequest,
  TitleGenerateResponse,
} from '../types';

// ==================== Content ====================

export async function fetchContents(params?: {
  content_type?: string;
  style?: string;
  status?: string;
  topic_id?: number;
  page?: number;
  page_size?: number;
}): Promise<ContentListResponse> {
  return api.get('/content', { params });
}

export async function generateContent(
  data: ContentGenerateRequest
): Promise<ContentGenerateResponse> {
  return api.post('/content/generate', data);
}

export async function fetchContentDetail(id: number): Promise<Content> {
  return api.get(`/content/${id}`);
}

export async function updateContent(
  id: number,
  data: ContentUpdate
): Promise<Content> {
  return api.put(`/content/${id}`, data);
}

export async function deleteContent(id: number): Promise<void> {
  return api.delete(`/content/${id}`);
}

export async function rewriteContent(
  id: number,
  data: ContentRewriteRequest
): Promise<Content> {
  return api.post(`/content/${id}/rewrite`, data);
}

// ==================== Titles ====================

export async function generateTitles(
  data: TitleGenerateRequest
): Promise<TitleGenerateResponse> {
  return api.post('/titles/generate', data);
}
