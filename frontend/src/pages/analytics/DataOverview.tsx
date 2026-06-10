import { useEffect } from 'react';
import { Button, Spin, Statistic, Row, Col, Table, Tag, Space, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined,
  EyeOutlined,
  LikeOutlined,
  MessageOutlined,
  ShareAltOutlined,
  BookOutlined,
  PlusOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import type { AnalyticsOverview } from '../../types';

export default function DataOverview() {
  const { overview, overviewLoading, loadOverview, collectData } = useAnalyticsStore();

  useEffect(() => {
    loadOverview();
  }, []);

  const handleCollect = async () => {
    await collectData();
    loadOverview();
  };

  const statCards = [
    { title: '总浏览量', value: overview?.total_views || 0, icon: <EyeOutlined />, color: '#2563eb' },
    { title: '总点赞', value: overview?.total_likes || 0, icon: <LikeOutlined />, color: '#dc2626' },
    { title: '总评论', value: overview?.total_comments || 0, icon: <MessageOutlined />, color: '#16a34a' },
    { title: '总分享', value: overview?.total_shares || 0, icon: <ShareAltOutlined />, color: '#0891b2' },
    { title: '总收藏', value: overview?.total_bookmarks || 0, icon: <BookOutlined />, color: '#d97706' },
    { title: '新增粉丝', value: overview?.total_follower_gain || 0, icon: <PlusOutlined />, color: '#7c3aed' },
  ];

  // Platform breakdown chart
  const pieOption = overview?.platform_breakdown?.length ? {
    tooltip: { trigger: 'item' },
    legend: { bottom: 0, textStyle: { fontSize: 12, color: '#64748b' } },
    series: [{
      type: 'pie',
      radius: ['45%', '75%'],
      center: ['50%', '45%'],
      label: { show: true, formatter: '{b}\n{d}%' },
      itemStyle: {
        borderRadius: 4,
        borderColor: '#fff',
        borderWidth: 2,
      },
      data: overview.platform_breakdown.map((p: Record<string, unknown>) => ({
        name: p.platform,
        value: p.views,
      })),
      color: ['#2563eb', '#0891b2', '#16a34a', '#dc2626', '#7c3aed'],
    }],
  } : null;

  const engagementOption = overview?.platform_breakdown?.length ? {
    tooltip: { trigger: 'axis' },
    legend: { data: ['点赞', '评论', '分享'], textStyle: { fontSize: 12, color: '#64748b' } },
    grid: { left: 40, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: overview.platform_breakdown.map((p: Record<string, unknown>) => p.platform),
      axisLabel: { fontSize: 11, color: '#64748b' },
      axisLine: { lineStyle: { color: '#e2e8f0' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { fontSize: 11, color: '#64748b' },
      splitLine: { lineStyle: { color: '#f1f5f9' } },
    },
    series: [
      {
        name: '点赞', type: 'bar',
        data: overview.platform_breakdown.map((p: Record<string, unknown>) => p.likes),
        itemStyle: { color: '#dc2626', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32,
      },
      {
        name: '评论', type: 'bar',
        data: overview.platform_breakdown.map((p: Record<string, unknown>) => p.comments),
        itemStyle: { color: '#16a34a', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32,
      },
      {
        name: '分享', type: 'bar',
        data: overview.platform_breakdown.map((p: Record<string, unknown>) => p.shares),
        itemStyle: { color: '#0891b2', borderRadius: [4, 4, 0, 0] }, barMaxWidth: 32,
      },
    ],
  } : null;

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
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>数据概览</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadOverview()}>刷新</Button>
          <Button type="primary" icon={<ExperimentOutlined />} onClick={handleCollect}>采集模拟数据</Button>
        </Space>
      </div>

      {overviewLoading ? (
        <div style={{ textAlign: 'center', padding: 80 }}><Spin size="large" /></div>
      ) : overview ? (
        <>
          {/* Stats Cards */}
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            {statCards.map((card) => (
              <Col xs={24} sm={12} md={8} lg={4} key={card.title}>
                <div style={{
                  padding: '20px', borderRadius: 10,
                  background: 'var(--bg-card)', border: '1px solid var(--border-default)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{card.title}</span>
                    <span style={{ fontSize: 20, color: card.color }}>{card.icon}</span>
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                    {(card.value || 0).toLocaleString()}
                  </div>
                </div>
              </Col>
            ))}
          </Row>

          {/* Charts */}
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <div style={{
                padding: 20, borderRadius: 10,
                background: 'var(--bg-card)', border: '1px solid var(--border-default)',
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>平台浏览量分布</h3>
                {pieOption ? (
                  <ReactECharts option={pieOption} style={{ height: 320 }} />
                ) : <Empty description="暂无数据" />}
              </div>
            </Col>
            <Col xs={24} lg={12}>
              <div style={{
                padding: 20, borderRadius: 10,
                background: 'var(--bg-card)', border: '1px solid var(--border-default)',
              }}>
                <h3 style={{ margin: '0 0 16px', fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>平台互动对比</h3>
                {engagementOption ? (
                  <ReactECharts option={engagementOption} style={{ height: 320 }} />
                ) : <Empty description="暂无数据" />}
              </div>
            </Col>
          </Row>
        </>
      ) : (
        <Empty description="暂无数据，请先采集模拟数据" />
      )}
    </div>
  );
}
