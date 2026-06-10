import { useState, useRef, useEffect } from 'react';
import { Input, Button, Space, Spin, Empty } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { useAgentStore } from '../../stores/agentStore';
import type { IDisplayMessage } from '../../types/agent';
import ActionCard from './ActionCard';

function MessageBubble({ msg }: { msg: IDisplayMessage }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: isUser ? 'flex-end' : 'flex-start', marginBottom: 12 }}>
      <div style={{
        maxWidth: '85%', padding: '10px 14px', borderRadius: 10,
        background: isUser ? 'var(--accent)' : msg.status === 'error' ? '#fef2f2' : '#f8fafc',
        border: isUser ? 'none' : '1px solid var(--border-default)',
        color: isUser ? '#fff' : 'var(--text-primary)', fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap',
      }}>
        {msg.status === 'streaming' && <Spin size="small" style={{ marginRight: 8 }} />}
        {msg.content}
      </div>

      {msg.steps && msg.steps.length > 0 && (
        <div style={{ marginTop: 4, width: '100%' }}>
          {msg.steps.map((step) => (
            <div key={step.id} style={{ fontSize: 11, color: step.status === 'running' ? 'var(--accent-cyan)' : 'var(--text-muted)', padding: '2px 12px' }}>
              {step.status === 'running' ? '⟳' : step.status === 'done' ? '✓' : '✗'} {step.content}
            </div>
          ))}
        </div>
      )}

      {msg.actions && msg.actions.length > 0 && (
        <div style={{ marginTop: 8, width: '100%' }}>
          {msg.actions.map((action, i) => <ActionCard key={i} action={action} />)}
        </div>
      )}
    </div>
  );
}

export default function AgentChat() {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const sendMessage = useAgentStore((s) => s.sendMessage);
  const currentTaskId = useAgentStore((s) => s.currentTaskId);
  const tasks = useAgentStore((s) => s.tasks);
  const task = currentTaskId ? tasks[currentTaskId] : null;
  const messages = task?.messages || [];

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleSend = () => { if (!input.trim()) return; sendMessage(input.trim()); setInput(''); };

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>
        {!task && (
          <div style={{ padding: '40px 0' }}>
            <Empty description={<span style={{ color: 'var(--text-muted)', fontSize: 13 }}>输入指令让 AI Agent 帮你完成工作<br />例如：「分析今天的微博热搜并生成内容」</span>} image={Empty.PRESENTED_IMAGE_SIMPLE} />
          </div>
        )}
        {messages.map((msg) => <MessageBubble key={msg.id} msg={msg} />)}
        <div ref={messagesEndRef} />
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-default)' }}>
        <Space.Compact style={{ width: '100%' }}>
          <Input value={input} onChange={(e) => setInput(e.target.value)} onPressEnter={handleSend}
            placeholder="输入指令..." disabled={task?.status === 'running'} style={{ fontSize: 13 }} />
          <Button type="primary" icon={<SendOutlined />} onClick={handleSend}
            disabled={!input.trim() || task?.status === 'running'} loading={task?.status === 'running'} />
        </Space.Compact>
      </div>
    </div>
  );
}
