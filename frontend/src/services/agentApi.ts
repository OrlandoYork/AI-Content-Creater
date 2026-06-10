import type { SSEEvent } from '../types/agent';

const AGENT_BASE = '/api/agent';

export function runAgentWorkflow(
  prompt: string,
  userId: string = 'default',
  onEvent: (event: SSEEvent) => void,
  onError?: (error: Error) => void,
  onComplete?: () => void,
): AbortController {
  const controller = new AbortController();

  const run = async () => {
    try {
      const response = await fetch(`${AGENT_BASE}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, user_id: userId, workflow_type: 'full_pipeline' }),
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`Agent API error: ${response.status}`);

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event: SSEEvent = JSON.parse(line.slice(6));
              onEvent(event);
              if (event.type === 'done') onComplete?.();
            } catch { /* skip malformed events */ }
          }
        }
      }

      if (buffer.startsWith('data: ')) {
        try {
          const event: SSEEvent = JSON.parse(buffer.slice(6));
          onEvent(event);
        } catch { /* skip */ }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      onError?.(err instanceof Error ? err : new Error(String(err)));
    }
  };

  run();
  return controller;
}

export async function abortAgentTask(taskId: string): Promise<void> {
  await fetch(`${AGENT_BASE}/abort/${taskId}`, { method: 'POST' });
}

export async function getAgentTask(taskId: string): Promise<Record<string, unknown>> {
  const res = await fetch(`${AGENT_BASE}/task/${taskId}`);
  if (!res.ok) throw new Error(`Failed to fetch task: ${res.status}`);
  return res.json();
}
