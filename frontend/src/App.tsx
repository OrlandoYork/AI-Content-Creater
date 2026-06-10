import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import { App as AntApp } from 'antd';
import AppLayout from './components/layout/AppLayout';
import Dashboard from './pages/Dashboard';
import TopicList from './pages/topics/TopicList';
import TopicGenerate from './pages/topics/TopicGenerate';
import TopicDetail from './pages/topics/TopicDetail';
import ContentList from './pages/content/ContentList';
import ContentEditor from './pages/content/ContentEditor';
import ReviewQueue from './pages/review/ReviewQueue';
import DistributionCenter from './pages/distribution/DistributionCenter';
import PublishCalendar from './pages/distribution/PublishCalendar';
import DataOverview from './pages/analytics/DataOverview';
import ContentReport from './pages/analytics/ContentReport';
import OptimizationPanel from './pages/analytics/OptimizationPanel';
import AgentFloatingButton from './components/agent/AgentFloatingButton';
import AgentPanel from './components/agent/AgentPanel';

export default function App() {
  return (
    <ConfigProvider
      theme={{
        token: {
          colorPrimary: '#2563eb',
          colorPrimaryBg: '#eff6ff',
          colorBgBase: '#ffffff',
          colorBgContainer: '#ffffff',
          colorBgElevated: '#ffffff',
          colorBorder: '#e2e8f0',
          colorBorderSecondary: '#f1f5f9',
          colorText: '#0f172a',
          colorTextSecondary: '#475569',
          colorTextTertiary: '#94a3b8',
          borderRadius: 6,
          borderRadiusLG: 8,
          borderRadiusSM: 4,
          fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
          fontSize: 14,
          lineHeight: 1.6,
          controlHeight: 36,
          controlHeightLG: 42,
          controlHeightSM: 30,
          paddingContentHorizontal: 20,
          paddingContentVertical: 16,
          boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
          boxShadowSecondary: '0 4px 6px -1px rgba(0,0,0,0.06)',
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
              <Route path="/reviews" element={<ReviewQueue />} />
              <Route path="/distribution" element={<DistributionCenter />} />
              <Route path="/distribution/calendar" element={<PublishCalendar />} />
              <Route path="/analytics" element={<DataOverview />} />
              <Route path="/analytics/report" element={<ContentReport />} />
              <Route path="/analytics/optimization" element={<OptimizationPanel />} />
              <Route path="*" element={<Dashboard />} />
            </Route>
          </Routes>
        </BrowserRouter>
        <AgentFloatingButton />
        <AgentPanel />
      </AntApp>
    </ConfigProvider>
  );
}
