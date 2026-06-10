import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import { App as AntApp } from 'antd';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import TopicList from './pages/topics/TopicList';
import TopicGenerate from './pages/topics/TopicGenerate';
import TopicDetail from './pages/topics/TopicDetail';
import ContentList from './pages/content/ContentList';
import ContentEditor from './pages/content/ContentEditor';

export default function App() {
  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorPrimary: '#d4a853',
          colorBgBase: '#0b0f19',
          colorBgContainer: '#161d2a',
          colorBgElevated: '#1e2740',
          colorBorder: '#1e2a3a',
          colorText: '#e8ecf1',
          colorTextSecondary: '#8b95a8',
          borderRadius: 6,
          fontFamily: "'Noto Sans SC', -apple-system, sans-serif",
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/topics" element={<TopicList />} />
              <Route path="/topics/generate" element={<TopicGenerate />} />
              <Route path="/topics/:id" element={<TopicDetail />} />
              <Route path="/content" element={<ContentList />} />
              <Route path="/content/generate" element={<ContentEditor />} />
              <Route path="*" element={<Dashboard />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
}
