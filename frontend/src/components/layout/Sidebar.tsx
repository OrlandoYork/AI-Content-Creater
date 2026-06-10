import { useLocation, useNavigate } from 'react-router-dom';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  BulbOutlined,
  EditOutlined,
  SendOutlined,
  BarChartOutlined,
  ThunderboltOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import type { MenuProps } from 'antd';

const { Sider } = Layout;

const menuItems: MenuProps['items'] = [
  { key: '/', icon: <DashboardOutlined />, label: '工作台' },
  {
    key: 'topics-group', icon: <ThunderboltOutlined />, label: '选题策划',
    children: [
      { key: '/topics', icon: <BulbOutlined />, label: '选题列表' },
      { key: '/topics/generate', icon: <EditOutlined />, label: 'AI 生成选题' },
    ],
  },
  {
    key: 'content-group', icon: <EditOutlined />, label: '内容创作',
    children: [
      { key: '/content', icon: <FileTextOutlined />, label: '内容列表' },
      { key: '/content/generate', icon: <ThunderboltOutlined />, label: 'AI 生成内容' },
    ],
  },
  {
    key: '/distribution', icon: <SendOutlined />, label: '审核分发', disabled: true,
  },
  {
    key: '/analytics', icon: <BarChartOutlined />, label: '数据分析', disabled: true,
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = location.pathname === '/' ? '/' : location.pathname;
  const handleClick: MenuProps['onClick'] = ({ key }) => navigate(key);

  return (
    <Sider width={240} style={{ height: '100vh', position: 'fixed', left: 0, top: 0, bottom: 0, overflow: 'auto' }}>
      {/* Logo */}
      <div style={{ height: 56, display: 'flex', alignItems: 'center', padding: '0 20px', borderBottom: '1px solid var(--border-default)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 600, fontSize: 14,
          }}>AI</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.2, letterSpacing: '-0.02em' }}>
              ContentAI
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.05em', fontFamily: 'var(--font-mono)' }}>
              COMMAND CENTER
            </div>
          </div>
        </div>
      </div>

      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={['topics-group', 'content-group']}
        items={menuItems}
        onClick={handleClick}
        style={{ borderInlineEnd: 'none', marginTop: 8 }}
      />

      {/* Footer */}
      <div style={{
        position: 'absolute', bottom: 20, left: 16, right: 16,
        padding: '12px 16px', borderRadius: 8,
        background: 'var(--accent-green-soft)', border: '1px solid rgba(22,163,74,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent-green)' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--accent-green)', letterSpacing: '0.05em', fontWeight: 500 }}>
            SYSTEM ONLINE
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          v0.2.0 · Agent Ready
        </div>
      </div>
    </Sider>
  );
}
