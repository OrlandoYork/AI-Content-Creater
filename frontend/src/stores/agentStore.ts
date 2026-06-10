import { create } from 'zustand';
import type { IDisplayMessage, IMessageStep, AgentTask, AgentContext, SSEEvent } from '../types/agent';
import { runAgentWorkflow, abortAgentTask } from '../services/agentApi';

interface AgentState {
  panelOpen: boolean;
  panelWidth: number;
  currentTaskId: string | null;
  tasks: Record<string, AgentTask>;
  context: AgentContext;
  abortController: AbortController | null;

  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
  sendMessage: (text: string) => Promise<void>;
  abortTask: () => void;
  updateContext: (ctx: Partial<AgentContext>) => void;
  clearTask: (taskId: string) => void;

  _handleSSEEvent: (event: SSEEvent) => void;
  _addMessage: (taskId: string, msg: IDisplayMessage) => void;
  _addStep: (taskId: string, step: IMessageStep) => void;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export const useAgentStore = create<AgentState>((set, get) => ({
  panelOpen: false,
  panelWidth: 420,
  currentTaskId: null,
  tasks: {},
  context: { currentPage: '/', selectedTopics: [], selectedContents: [], formData: {} },
  abortController: null,

  openPanel: () => set({ panelOpen: true }),
  closePanel: () => set({ panelOpen: false }),
  togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),

  sendMessage: async (text: string) => {
    const taskId = `task_${Date.now()}`;
    set({ currentTaskId: taskId });

    const userMsg: IDisplayMessage = {
      id: generateId(), role: 'user', content: text, status: 'done', timestamp: Date.now(),
    };

    const task: AgentTask = {
      id: taskId, messages: [userMsg], steps: [], streamingText: '', progress: 0, status: 'running',
    };

    set((s) => ({ tasks: { ...s.tasks, [taskId]: task } }));

    const controller = runAgentWorkflow(
      text, 'default',
      (event) => get()._handleSSEEvent(event),
      (error) => {
        set((s) => ({
          tasks: {
            ...s.tasks, [taskId]: {
              ...s.tasks[taskId], status: 'error' as const,
              messages: [...s.tasks[taskId].messages, { id: generateId(), role: 'system', content: `错误: ${error.message}`, status: 'error', timestamp: Date.now() }],
            },
          },
        }));
      },
      () => set((s) => ({ tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], status: 'completed' as const, progress: 100 } } })),
    );

    set({ abortController: controller });
  },

  abortTask: () => {
    const { currentTaskId, abortController } = get();
    if (abortController) {
      abortController.abort();
      if (currentTaskId) abortAgentTask(currentTaskId);
      set({ abortController: null });
    }
  },

  updateContext: (ctx) => set((s) => ({ context: { ...s.context, ...ctx } })),
  clearTask: (taskId) => set((s) => {
    const tasks = { ...s.tasks };
    delete tasks[taskId];
    return { tasks, currentTaskId: s.currentTaskId === taskId ? null : s.currentTaskId };
  }),

  _handleSSEEvent: (event: SSEEvent) => {
    const { currentTaskId, tasks } = get();
    if (!currentTaskId) return;
    const task = tasks[currentTaskId];
    if (!task) return;
    const stepId = generateId();

    switch (event.type) {
      case 'init':
        set((s) => ({ tasks: { ...s.tasks, [currentTaskId]: { ...s.tasks[currentTaskId], id: event.taskId || currentTaskId, workflowType: event.workflowType } } }));
        break;
      case 'node_start': {
        const nodeName = event.node || '';
        get()._addStep(currentTaskId, { id: stepId, type: 'thinking', content: `正在执行: ${nodeName}`, toolName: nodeName, isActive: true, status: 'running' });
        break;
      }
      case 'node_complete':
        get()._addStep(currentTaskId, { id: stepId, type: 'thinking', content: `完成: ${event.node}`, toolName: event.node, isActive: false, status: event.status === 'requires_action' ? 'error' : 'done' });
        break;
      case 'error':
        get()._addMessage(currentTaskId, { id: generateId(), role: 'system', content: `⚠ ${event.node}: ${event.message}`, status: 'error', timestamp: Date.now() });
        break;
      case 'requires_action':
        get()._addMessage(currentTaskId, { id: generateId(), role: 'system', content: `需要你的决策: ${event.prompt || '请提供修改意见'}`, status: 'done', timestamp: Date.now(), actions: [
          { type: 'confirm', title: '继续', description: '忽略并继续', action: {} },
          { type: 'edit', title: '修改', description: '提供修改意见', action: {} },
        ] });
        break;
      case 'done':
        get()._addMessage(currentTaskId, { id: generateId(), role: 'assistant', content: '✅ 全流程执行完成！你可以在各页面查看生成的内容。', status: 'done', timestamp: Date.now() });
        break;
    }
  },

  _addMessage: (taskId, msg) => set((s) => ({ tasks: { ...s.tasks, [taskId]: { ...s.tasks[taskId], messages: [...(s.tasks[taskId]?.messages || []), msg] } } })),
  _addStep: (taskId, step) => set((s) => {
    const task = s.tasks[taskId];
    if (!task) return s;
    const steps = task.steps.map((st) => st.toolName === step.toolName ? { ...st, ...step } : st);
    if (!steps.find((st) => st.toolName === step.toolName)) steps.push(step);
    const doneCount = steps.filter((st) => st.status === 'done').length;
    return { tasks: { ...s.tasks, [taskId]: { ...task, steps, progress: Math.round((doneCount / 8) * 100) } } };
  }),
}));
