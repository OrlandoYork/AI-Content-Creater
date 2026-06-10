import { useAgentStore } from '../../stores/agentStore';
import AgentChat from './AgentChat';
import AgentProgress from './AgentProgress';
import { Button, Space } from 'antd';
import { CloseOutlined } from '@ant-design/icons';

export default function AgentPanel() {
  const panelOpen = useAgentStore((s) => s.panelOpen);
  const closePanel = useAgentStore((s) => s.closePanel);
  const currentTaskId = useAgentStore((s) => s.currentTaskId);
  const tasks = useAgentStore((s) => s.tasks);
  const task = currentTaskId ? tasks[currentTaskId] : null;

  if (!panelOpen) return null;

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 420,
      background: '#ffffff', borderLeft: '1px solid var(--border-default)',
      display: 'flex', flexDirection: 'column', zIndex: 999,
      boxShadow: '-4px 0 24px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        height: 56, padding: '0 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid var(--border-default)', flexShrink: 0,
      }}>
        <Space>
          <span style={{ fontSize: 18 }}>🤖</span>
          <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>AI Agent</span>
          {task && <span style={{
            fontSize: 10, fontWeight: 500,
            color: task.status === 'running' ? '#16a34a' : 'var(--text-muted)',
          }}>{task.status === 'running' ? 'LIVE' : task.status.toUpperCase()}</span>}
        </Space>
        <Button type="text" icon={<CloseOutlined />} onClick={closePanel} size="small" />
      </div>

      {task && task.status === 'running' && <AgentProgress task={task} />}
      <AgentChat />

      {task && task.status === 'running' && (
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-default)' }}>
          <Button danger size="small" block onClick={() => useAgentStore.getState().abortTask()}>停止执行</Button>
        </div>
      )}
    </div>
  );
}
