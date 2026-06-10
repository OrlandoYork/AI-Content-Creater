import { FloatButton } from 'antd';
import { RobotOutlined } from '@ant-design/icons';
import { useAgentStore } from '../../stores/agentStore';

export default function AgentFloatingButton() {
  const panelOpen = useAgentStore((s) => s.panelOpen);
  const togglePanel = useAgentStore((s) => s.togglePanel);
  const currentTaskId = useAgentStore((s) => s.currentTaskId);
  const tasks = useAgentStore((s) => s.tasks);
  const runningTask = currentTaskId ? tasks[currentTaskId] : null;

  return (
    <FloatButton
      icon={<RobotOutlined />}
      type={panelOpen ? 'primary' : 'default'}
      tooltip={panelOpen ? '关闭 AI 助手' : 'AI 助手'}
      badge={runningTask?.status === 'running' ? { dot: true, color: 'var(--accent-mint)' } : undefined}
      onClick={togglePanel}
      style={{
        position: 'fixed',
        right: panelOpen ? 440 : 24,
        bottom: 24,
        transition: 'right 0.3s var(--ease-out)',
        zIndex: 1000,
      }}
    />
  );
}
