// === SSE 事件类型 (借鉴 AiToEarn chunk types) ===
export type SSEEventType =
  | 'init' | 'keep_alive' | 'node_start' | 'node_complete'
  | 'tool_call' | 'tool_result' | 'text_delta'
  | 'error' | 'requires_action' | 'done';

export interface SSEEvent {
  type: SSEEventType;
  taskId?: string;
  workflowType?: string;
  node?: string;
  status?: string;
  toolName?: string;
  content?: string;
  code?: string;
  message?: string;
  prompt?: string;
  timestamp?: number;
}

// === 消息类型 (借鉴 AiToEarn IDisplayMessage) ===
export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'pending' | 'streaming' | 'done' | 'error';

export interface IMessageStep {
  id: string;
  type: 'tool_call' | 'tool_result' | 'thinking' | 'text_delta';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: Record<string, unknown>;
  isActive?: boolean;
  status: 'running' | 'done' | 'error';
}

export interface IActionCard {
  type: 'navigate' | 'save' | 'publish' | 'edit' | 'confirm';
  title: string;
  description?: string;
  action: { route?: string; params?: Record<string, unknown> };
}

export interface IDisplayMessage {
  id: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  steps?: IMessageStep[];
  actions?: IActionCard[];
  timestamp: number;
}

// === 任务实例 (借鉴 AiToEarn TaskInstance) ===
export interface AgentTask {
  id: string;
  messages: IDisplayMessage[];
  steps: IMessageStep[];
  streamingText: string;
  progress: number;
  status: 'running' | 'completed' | 'error' | 'aborted';
  currentNode?: string;
  workflowType?: string;
}

// === Agent 面板上下文 ===
export interface AgentContext {
  currentPage: string;
  selectedTopics: number[];
  selectedContents: number[];
  formData: Record<string, unknown>;
}

// === 节点标签映射 ===
export const NODE_LABELS: Record<string, string> = {
  classifier: '分析意图',
  hot_spot_analyzer: '热点分析',
  topic_planner: '选题策划',
  content_creator: '内容创作',
  content_reviewer: '内容审核',
  distribution_node: '多平台分发',
  data_collector: '数据采集',
  analytics_reporter: '效果分析',
};

export const NODE_ORDER = [
  'classifier',
  'hot_spot_analyzer',
  'topic_planner',
  'content_creator',
  'content_reviewer',
  'distribution_node',
  'data_collector',
  'analytics_reporter',
];
