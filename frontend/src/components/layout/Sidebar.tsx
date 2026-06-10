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
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: '工作台',
  },
  {
    key: 'topics-group',
    icon: <ThunderboltOutlined />,
    label: 'Module 1',
    children: [
      { key: '/topics', icon: <BulbOutlined />, label: '选题策划' },
      { key: '/topics/generate', icon: <EditOutlined />, label: 'AI 生成选题' },
    ],
  },
  {
    key: 'content-group',
    icon: <EditOutlined />,
    label: 'Module 2',
    children: [
      { key: '/content', icon: <FileTextOutlined />, label: '内容列表' },
      { key: '/content/generate', icon: <ThunderboltOutlined />, label: 'AI 生成内容' },
    ],
  },
  {
    key: '/distribution',
    icon: <SendOutlined />,
    label: '审核分发',
    disabled: true,
  },
  {
    key: '/analytics',
    icon: <BarChartOutlined />,
    label: '数据分析',
    disabled: true,
  },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  const selectedKey = location.pathname === '/' ? '/' : location.pathname;

  const handleClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  return (
    <Sider
      width={240}
      style={{
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
        overflow: 'auto',
      }}
    >
      {/* Logo */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          padding: '0 24px',
          borderBottom: '1px solid var(--border-default)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, var(--accent-gold), #8b6914)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
            }}
          >
            ⚡
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-display)',
              fontSize: 15,
              color: 'var(--text-primary)',
              lineHeight: 1.2,
            }}>
              ContentAI
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 9,
              color: 'var(--text-muted)',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}>
              Command Center
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={['topics-group', 'content-group']}
        items={menuItems}
        onClick={handleClick}
        style={{ borderInlineEnd: 'none', marginTop: 8 }}
      />

      {/* Footer Status */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: 24,
          right: 24,
          padding: '12px 16px',
          borderRadius: 8,
          background: 'rgba(74, 222, 128, 0.05)',
          border: '1px solid rgba(74, 222, 128, 0.1)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--accent-mint)',
            boxShadow: '0 0 6px rgba(74, 222, 128, 0.4)',
          }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-mint)' }}>
            SYSTEM ONLINE
          </span>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
          Mock Mode · Coze Offline
        </div>
      </div>
    </Sider>
  );
}
