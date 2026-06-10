import { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Select, message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  ReloadOutlined,
  ExperimentOutlined,
} from '@ant-design/icons';
import { useAnalyticsStore } from '../../stores/analyticsStore';
import { PLATFORM_LABELS } from '../../types';
import type { AnalyticsRecord } from '../../types';

export default function ContentReport() {
  const {
    records, recordsTotal, recordsLoading, loadRecords,
  } = useAnalyticsStore();

  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    loadRecords({
      platform: platformFilter !== 'all' ? platformFilter : undefined,
      page, page_size: pageSize,
    });
  }, [platformFilter, page, pageSize]);

  const formatNumber = (v: number) => {
    if (v >= 10000) return `${(v / 10000).toFixed(1)}万`;
    if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
    return v.toLocaleString();
  };

  const columns: ColumnsType<AnalyticsRecord> = [
    {
      title: '内容ID',
      dataIndex: 'content_id',
      key: 'content_id',
      width: 100,
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500 }}>#{v}</span>
      ),
    },
    {
      title: '平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 120,
      render: (v: string) => <Tag color="blue">{PLATFORM_LABELS[v] || v}</Tag>,
    },
    {
      title: '浏览量',
      dataIndex: 'views',
      key: 'views',
      width: 100,
      align: 'right',
      sorter: (a: AnalyticsRecord, b: AnalyticsRecord) => a.views - b.views,
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
          {formatNumber(v)}
        </span>
      ),
    },
    {
      title: '点赞',
      dataIndex: 'likes',
      key: 'likes',
      width: 90,
      align: 'right',
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatNumber(v)}</span>
      ),
    },
    {
      title: '评论',
      dataIndex: 'comments',
      key: 'comments',
      width: 90,
      align: 'right',
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatNumber(v)}</span>
      ),
    },
    {
      title: '分享',
      dataIndex: 'shares',
      key: 'shares',
      width: 90,
      align: 'right',
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatNumber(v)}</span>
      ),
    },
    {
      title: '收藏',
      dataIndex: 'bookmarks',
      key: 'bookmarks',
      width: 90,
      align: 'right',
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{formatNumber(v)}</span>
      ),
    },
    {
      title: '新增粉丝',
      dataIndex: 'follower_gain',
      key: 'follower_gain',
      width: 100,
      align: 'right',
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-green)', fontWeight: v > 0 ? 600 : 400 }}>
          {v > 0 ? '+' : ''}{formatNumber(v)}
        </span>
      ),
    },
    {
      title: '采集时间',
      dataIndex: 'collected_at',
      key: 'collected_at',
      width: 170,
      render: (v: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {new Date(v).toLocaleString('zh-CN')}
        </span>
      ),
    },
  ];

  // Summary row
  const summary = records.length > 0 ? {
    views: records.reduce((s, r) => s + r.views, 0),
    likes: records.reduce((s, r) => s + r.likes, 0),
    comments: records.reduce((s, r) => s + r.comments, 0),
    shares: records.reduce((s, r) => s + r.shares, 0),
    bookmarks: records.reduce((s, r) => s + r.bookmarks, 0),
    follower_gain: records.reduce((s, r) => s + r.follower_gain, 0),
  } : null;

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, padding: '16px 20px', borderRadius: 10,
          background: 'var(--bg-card)', border: '1px solid var(--border-default)',
          flexWrap: 'wrap', gap: 12,
        }}
      >
        <Space size="middle" wrap>
          <Select
            value={platformFilter}
            onChange={(v) => { setPlatformFilter(v); setPage(1); }}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: '全部平台' },
              ...Object.entries(PLATFORM_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadRecords({ page, page_size: pageSize })}>刷新</Button>
        </Space>
      </div>

      {/* Summary */}
      {summary && (
        <div style={{
          display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap',
        }}>
          {[
            { label: '总浏览', value: summary.views },
            { label: '总点赞', value: summary.likes },
            { label: '总评论', value: summary.comments },
            { label: '总分享', value: summary.shares },
            { label: '总收藏', value: summary.bookmarks },
            { label: '总涨粉', value: summary.follower_gain },
          ].map((s) => (
            <div key={s.label} style={{
              padding: '10px 18px', borderRadius: 8,
              background: 'var(--bg-card)', border: '1px solid var(--border-default)',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginRight: 8 }}>{s.label}</span>
              <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                {formatNumber(s.value)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <Table
        columns={columns}
        dataSource={records}
        rowKey="id"
        loading={recordsLoading}
        pagination={{
          current: page, pageSize, total: recordsTotal,
          showSizeChanger: true,
          showTotal: (total) => (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>共 {total} 条数据</span>
          ),
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 1000 }}
      />
    </div>
  );
}
