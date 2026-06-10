import { useEffect, useState } from 'react';
import { Button, Spin, Empty, Tag, Space, List, Tooltip } from 'antd';
import {
  BulbOutlined,
  ReloadOutlined,
  RiseOutlined,
  ExperimentOutlined,
  TrophyOutlined,
  WarningOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useAnalyticsStore } from '../../stores/analyticsStore';

const SUGGESTION_ICONS: Record<number, React.ReactNode> = {
  0: <TrophyOutlined />,
  1: <RiseOutlined />,
  2: <WarningOutlined />,
  3: <ThunderboltOutlined />,
};

const SUGGESTION_TAGS: Record<number, { color: string; label: string }> = {
  0: { color: 'purple', label: '策略' },
  1: { color: 'blue', label: '增长' },
  2: { color: 'orange', label: '优化' },
  3: { color: 'cyan', label: '建议' },
};

export default function OptimizationPanel() {
  const { suggestions, suggestionsLoading, loadSuggestions } = useAnalyticsStore();

  useEffect(() => {
    loadSuggestions();
  }, []);

  // Radar chart for content strategy visualization
  const radarOption = {
    tooltip: {},
    legend: { data: ['当前表现', '优化目标'], bottom: 0, textStyle: { fontSize: 12, color: '#64748b' } },
    radar: {
      center: ['50%', '45%'],
      radius: '60%',
      indicator: [
        { name: '阅读量', max: 100 },
        { name: '互动率', max: 100 },
        { name: '转化率', max: 100 },
        { name: '传播力', max: 100 },
        { name: '粉丝增长', max: 100 },
      ],
      axisName: { fontSize: 11, color: '#64748b' },
      splitArea: {
        areaStyle: { color: ['#f8fafc', '#f1f5f9'] },
      },
    },
    series: [{
      type: 'radar',
      data: [
        {
          value: [65, 48, 52, 55, 42],
          name: '当前表现',
          lineStyle: { color: '#2563eb', width: 2 },
          areaStyle: { color: 'rgba(37,99,235,0.1)' },
          itemStyle: { color: '#2563eb' },
        },
        {
          value: [80, 72, 68, 75, 65],
          name: '优化目标',
          lineStyle: { color: '#16a34a', width: 2 },
          areaStyle: { color: 'rgba(22,163,74,0.06)' },
          itemStyle: { color: '#16a34a' },
        },
      ],
    }],
  };

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, padding: '16px 20px', borderRadius: 10,
          background: 'var(--bg-card)', border: '1px solid var(--border-default)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BulbOutlined style={{ fontSize: 22, color: '#d97706' }} />
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>AI 优化建议</h2>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadSuggestions()}>刷新</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
        {/* Suggestions List */}
        <div style={{ flex: '1 1 500px' }}>
          {suggestionsLoading ? (
            <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
          ) : suggestions.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {suggestions.map((suggestion, i) => (
                <div
                  key={i}
                  style={{
                    padding: '20px 24px', borderRadius: 10,
                    background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                    borderLeft: `3px solid ${i === 0 ? '#7c3aed' : i === 1 ? '#2563eb' : i === 2 ? '#d97706' : '#0891b2'}`,
                    transition: 'box-shadow 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      background: i === 0 ? '#f5f3ff' : i === 1 ? '#eff6ff' : i === 2 ? '#fffbeb' : '#ecfeff',
                      color: i === 0 ? '#7c3aed' : i === 1 ? '#2563eb' : i === 2 ? '#d97706' : '#0891b2',
                      fontSize: 16, flexShrink: 0,
                    }}>
                      {SUGGESTION_ICONS[i] || <BulbOutlined />}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Tag color={SUGGESTION_TAGS[i]?.color}>{(SUGGESTION_TAGS[i]?.label || '建议')} {i + 1}</Tag>
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>
                        {suggestion}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <Empty description="暂无AI建议，请先采集数据" />
          )}
        </div>

        {/* Radar Chart */}
        <div style={{ flex: '0 0 380px' }}>
          <div style={{
            padding: 20, borderRadius: 10,
            background: 'var(--bg-card)', border: '1px solid var(--border-default)',
          }}>
            <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>内容能力雷达</h3>
            <ReactECharts option={radarOption} style={{ height: 340 }} />
            <div style={{
              marginTop: 16, padding: 12, borderRadius: 8,
              background: '#f0fdf4', border: '1px solid rgba(22,163,74,0.15)',
            }}>
              <div style={{ fontSize: 12, color: 'var(--accent-green)', fontWeight: 600, marginBottom: 4 }}>
                ✓ AI 建议：提升互动率
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                互动率是当前最需要提升的维度。建议增加投票、提问等互动型内容比例至30%以上。
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
