import { Outlet } from 'react-router-dom';
import { Layout } from 'antd';
import Sidebar from './Sidebar';
import Header from './Header';

const { Content } = Layout;

export default function AppLayout() {
  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sidebar />
      <Layout style={{ marginLeft: 240 }}>
        <Header />
        <Content
          style={{
            padding: 32,
            minHeight: 'calc(100vh - 64px)',
            background: 'var(--bg-root)',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
