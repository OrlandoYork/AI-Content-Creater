import { useLocation } from 'react-router-dom';
import { Layout, Breadcrumb, Tag } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';

const { Header: AntHeader } = Layout;

const breadcrumbMap: Record<string, string> = {
  '/': '工作台',
  '/topics': '选题策划',
  '/topics/generate': 'AI 生成选题',
  '/topics/:id': '选题详情',
  '/content': '内容列表',
  '/content/generate': 'AI 生成内容',
  '/distribution': '审核分发',
  '/analytics': '数据分析',
};

const pageTitleMap: Record<string, string> = {
  '/': '指挥中心',
  '/topics': '选题列表',
  '/topics/generate': 'AI 选题生成',
  '/content': '内容列表',
  '/content/generate': 'AI 内容创作',
  '/distribution': '审核分发',
  '/analytics': '数据分析',
};

export default function Header() {
  const location = useLocation();

  // Determine breadcrumb items
  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbItems = [
    { title: 'Home' },
    ...pathParts.map((part, i) => {
      const fullPath = `/${pathParts.slice(0, i + 1).join('/')}`;
      const label = breadcrumbMap[fullPath];
      if (label) return { title: label };
      // 对于动态路由 /topics/:id，匹配模式
      if (/^\/topics\/\d+$/.test(fullPath)) return { title: '选题详情' };
      if (/^\/content\/\d+$/.test(fullPath)) return { title: '内容详情' };
      return { title: part };
    }),
  ];

  // Check if on topic detail page
  const isTopicDetail = location.pathname.match(/^\/topics\/\d+$/);

  const pageTitle = isTopicDetail
    ? '选题详情'
    : pageTitleMap[location.pathname] || '指挥中心';

  return (
    <AntHeader
      style={{
        height: 64,
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'var(--bg-root)',
        borderBottom: '1px solid var(--border-default)',
      }}
    >
      <div>
        <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 2 }} />
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 20,
          fontWeight: 400,
          color: 'var(--text-primary)',
          margin: 0,
          letterSpacing: '-0.01em',
        }}>
          {pageTitle}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Tag
          icon={<ThunderboltOutlined />}
          color="gold"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}
        >
          Phase 1 · Module 1 Active
        </Tag>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          color: 'var(--text-muted)',
        }}>
          {new Date().toLocaleDateString('zh-CN', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long',
          })}
        </div>
      </div>
    </AntHeader>
  );
}
