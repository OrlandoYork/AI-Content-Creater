import api from './api';
import type {
  HotTopicListResponse,
  HotTopicAnalysis,
  Topic,
  TopicCreate,
  TopicUpdate,
  TopicListResponse,
  TopicGenerateRequest,
  TopicGenerateResponse,
  TopicScheduleRequest,
} from '../types';

// ==================== Hot Topics ====================

export async function fetchHotTopics(params?: {
  platform?: string;
  page?: number;
  page_size?: number;
}): Promise<HotTopicListResponse> {
  return api.get('/topics/hot', { params });
}

/** SSE 流式刷新热点 — 返回 AbortController 用于取消 */
export function refreshHotTopicsStream(
  onEvent: (event: string, data: any) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void,
): AbortController {
  const controller = new AbortController();

  fetch('/api/topics/hot/refresh', {
    method: 'POST',
    signal: controller.signal,
    headers: { 'Accept': 'text/event-stream' },
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('ReadableStream not supported');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE events from buffer
        const lines = buffer.split('\n');
        buffer = '';  // reset, keep incomplete line

        let currentEvent = '';
        let currentData = '';

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            currentData = line.slice(6);
          } else if (line === '' && currentEvent && currentData) {
            // End of event — dispatch
            try {
              const parsed = JSON.parse(currentData);
              onEvent(currentEvent, parsed);
            } catch {
              // ignore parse errors for incomplete chunks
            }
            currentEvent = '';
            currentData = '';
          } else if (line === '') {
            // empty line without preceding event — ignore
          } else {
            // continuation line or incomplete — save back to buffer
            buffer += line + '\n';
          }
        }
      }
    })
    .then(() => {
      onComplete?.();
    })
    .catch((err) => {
      if (err.name !== 'AbortError') {
        onError?.(err);
      }
    });

  return controller;
}

/** 兼容旧版：阻塞式刷新（内部调用流式接口，等待 complete 事件后返回） */
export async function refreshHotTopics(): Promise<HotTopicListResponse> {
  return new Promise((resolve, reject) => {
    refreshHotTopicsStream(
      (_event, data) => {
        if (_event === 'complete' && data.items) {
          resolve({
            items: data.items,
            total: data.total,
            dedup_count: data.dedup_count,
          });
        }
      },
      reject,
    );
  });
}

export async function fetchHotTopicDetail(
  id: number
): Promise<HotTopicListResponse['items'][0]> {
  return api.get(`/topics/hot/${id}`);
}

export async function analyzeHotTopic(id: number): Promise<HotTopicAnalysis> {
  return api.get(`/topics/hot/${id}/analyze`);
}

// ==================== Topics ====================

export async function fetchTopics(params?: {
  status?: string;
  content_type?: string;
  page?: number;
  page_size?: number;
}): Promise<TopicListResponse> {
  return api.get('/topics', { params });
}

export async function createTopic(data: TopicCreate): Promise<Topic> {
  return api.post('/topics', data);
}

export async function generateTopics(
  data: TopicGenerateRequest
): Promise<TopicGenerateResponse> {
  return api.post('/topics/generate', data);
}

export async function fetchTopicDetail(id: number): Promise<Topic> {
  return api.get(`/topics/${id}`);
}

export async function updateTopic(
  id: number,
  data: TopicUpdate
): Promise<Topic> {
  return api.put(`/topics/${id}`, data);
}

export async function deleteTopic(id: number): Promise<void> {
  return api.delete(`/topics/${id}`);
}

export async function scheduleTopic(
  id: number,
  data: TopicScheduleRequest
): Promise<Topic> {
  return api.post(`/topics/${id}/schedule`, data);
}
