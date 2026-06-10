import { Button, Card } from 'antd';
import type { IActionCard as IActionCardType } from '../../types/agent';

export default function ActionCard({ action }: { action: IActionCardType }) {
  return (
    <Card size="small" style={{ marginBottom: 8, borderColor: 'var(--accent-gold)', background: 'rgba(212,168,83,0.04)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{action.title}</div>
          {action.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{action.description}</div>}
        </div>
        <Button size="small" type="primary" ghost>
          {action.type === 'confirm' ? '确认' : action.type === 'edit' ? '编辑' : '执行'}
        </Button>
      </div>
    </Card>
  );
}
