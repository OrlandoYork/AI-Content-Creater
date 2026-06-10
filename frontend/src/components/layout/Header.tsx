import { useLocation } from 'react-router-dom';
import { Layout, Breadcrumb } from 'antd';

const { Header: AntHeader } = Layout;

const breadcrumbMap: Record<string, string> = {
  '/': '工作台',
  '/topics': '选题策划',
  '/topics/generate': 'AI 生成选题',
  '/content': '内容列表',
  '/content/generate': 'AI 内容创作',
};

const pageTitleMap: Record<string, string> = {
  '/': '工作台',
  '/topics': '选题列表',
  '/topics/generate': 'AI 选题生成',
  '/content': '内容列表',
  '/content/generate': 'AI 内容创作',
};

export default function Header() {
  const location = useLocation();

  const pathParts = location.pathname.split('/').filter(Boolean);
  const breadcrumbItems = [
    { title: 'Home' },
    ...pathParts.map((part, i) => {
      const fullPath = `/${pathParts.slice(0, i + 1).join('/')}`;
      const label = breadcrumbMap[fullPath];
      if (label) return { title: label };
      if (/^\/topics\/\d+$/.test(fullPath)) return { title: '选题详情' };
      if (/^\/content\/\d+$/.test(fullPath)) return { title: '内容详情' };
      return { title: part };
    }),
  ];

  const isTopicDetail = location.pathname.match(/^\/topics\/\d+$/);
  const pageTitle = isTopicDetail ? '选题详情' : pageTitleMap[location.pathname] || '工作台';

  return (
    <AntHeader style={{
      height: 56, padding: '0 32px', display: 'flex', alignItems: 'center',
      justifyContent: 'space-between', background: 'var(--bg-root)',
      borderBottom: '1px solid var(--border-default)',
    }}>
      <div>
        <Breadcrumb items={breadcrumbItems} style={{ marginBottom: 2 }} />
        <h1 style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
          {pageTitle}
        </h1>
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
        {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
      </div>
    </AntHeader>
  );
}
