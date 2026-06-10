import { Steps } from 'antd';
import type { AgentTask } from '../../types/agent';
import { NODE_ORDER, NODE_LABELS } from '../../types/agent';

export default function AgentProgress({ task }: { task: AgentTask }) {
  return (
    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-default)' }}>
      <Steps
        direction="vertical"
        size="small"
        status={task.status === 'error' ? 'error' : 'process'}
        items={NODE_ORDER.slice(1).map((node) => {
          const stepDone = task.steps.some((s) => s.toolName === node && s.status === 'done');
          const stepRunning = task.steps.some((s) => s.toolName === node && s.status === 'running');
          return {
            title: NODE_LABELS[node] || node,
            status: stepDone ? 'finish' : stepRunning ? 'process' : ('wait' as const),
          };
        })}
        style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
      />
    </div>
  );
}
