import { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Select, Tooltip, message, Modal, Descriptions,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SendOutlined,
  EyeOutlined,
  ReloadOutlined,
  CalendarOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDistributionStore } from '../../stores/distributionStore';
import {
  DISTRIBUTION_STATUS_LABELS,
  DISTRIBUTION_STATUS_COLORS,
  DISTRIBUTION_PLATFORM_LABELS,
  PLATFORM_LABELS,
} from '../../types';
import type { Distribution, DistributionStatus } from '../../types';

export default function DistributionCenter() {
  const {
    distributions, distributionsTotal, distributionsLoading,
    loadDistributions, updateDistribution,
  } = useDistributionStore();

  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedDist, setSelectedDist] = useState<Distribution | null>(null);

  useEffect(() => {
    loadDistributions({
      platform: platformFilter !== 'all' ? platformFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      page, page_size: pageSize,
    });
  }, [platformFilter, statusFilter, page, pageSize]);

  const handlePublish = useCallback(async (id: number) => {
    try {
      await updateDistribution(id, { status: 'published' as DistributionStatus, published_at: new Date().toISOString() });
      message.success('发布成功');
      loadDistributions({ page, page_size: pageSize });
    } catch { message.error('发布失败'); }
  }, [page, pageSize]);

  const showDetail = (record: Distribution) => {
    setSelectedDist(record);
    setDetailVisible(true);
  };

  const columns: ColumnsType<Distribution> = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>#{v}</span>
      ),
    },
    {
      title: '内容ID',
      dataIndex: 'content_id',
      key: 'content_id',
      width: 100,
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>#{v}</span>
      ),
    },
    {
      title: '分发平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 130,
      render: (v: string) => (
        <Tag color="blue">{PLATFORM_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: DistributionStatus) => (
        <Tag color={DISTRIBUTION_STATUS_COLORS[v]}>{DISTRIBUTION_STATUS_LABELS[v]}</Tag>
      ),
    },
    {
      title: '发布链接',
      dataIndex: 'publish_url',
      key: 'publish_url',
      width: 220,
      ellipsis: true,
      render: (v: string) => v ? (
        <a href={v} target="_blank" rel="noreferrer" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
          {v.substring(0, 40)}...
        </a>
      ) : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    },
    {
      title: '计划时间',
      dataIndex: 'scheduled_time',
      key: 'scheduled_time',
      width: 170,
      render: (v: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {v ? dayjs(v).format('YYYY-MM-DD HH:mm') : '即时发布'}
        </span>
      ),
    },
    {
      title: '发布时间',
      dataIndex: 'published_at',
      key: 'published_at',
      width: 170,
      render: (v: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: v ? 'var(--accent-green)' : 'var(--text-muted)' }}>
          {v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_: any, record: Distribution) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)} />
          </Tooltip>
          {record.status === 'pending' && (
            <Tooltip title="立即发布">
              <Button type="text" size="small" icon={<SendOutlined />} style={{ color: 'var(--accent)' }} onClick={() => handlePublish(record.id)} />
            </Tooltip>
          )}
          {record.status === 'pending' && (
            <Tooltip title="排期">
              <Button type="text" size="small" icon={<CalendarOutlined />} />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  const stats = {
    total: distributionsTotal,
    published: distributions.filter((d) => d.status === 'published').length,
    pending: distributions.filter((d) => d.status === 'pending').length,
    failed: distributions.filter((d) => d.status === 'failed').length,
  };

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Stats Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {([
          { label: '总分发', value: stats.total, color: 'var(--accent)' },
          { label: '已发布', value: stats.published, color: 'var(--accent-green)' },
          { label: '待发布', value: stats.pending, color: 'var(--accent-amber)' },
          { label: '失败', value: stats.failed, color: '#dc2626' },
        ]).map((stat) => (
          <div
            key={stat.label}
            style={{
              flex: 1, padding: '16px 20px', borderRadius: 10,
              background: 'var(--bg-card)', border: '1px solid var(--border-default)',
            }}
          >
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>{stat.label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: stat.color, fontFamily: 'var(--font-mono)' }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

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
              { value: 'all', label: '全部分发平台' },
              ...Object.entries(DISTRIBUTION_PLATFORM_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            style={{ width: 130 }}
            options={[
              { value: 'all', label: '全部状态' },
              ...Object.entries(DISTRIBUTION_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadDistributions({ page, page_size: pageSize })}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />}>新建分发</Button>
        </Space>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={distributions}
        rowKey="id"
        loading={distributionsLoading}
        pagination={{
          current: page, pageSize, total: distributionsTotal,
          showSizeChanger: true,
          showTotal: (total) => (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>共 {total} 条分发</span>
          ),
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 1200 }}
      />

      {/* Detail Modal */}
      <Modal
        title={`分发详情 #${selectedDist?.id}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedDist && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="内容ID">{selectedDist.content_id}</Descriptions.Item>
            <Descriptions.Item label="平台">
              <Tag color="blue">{PLATFORM_LABELS[selectedDist.platform] || selectedDist.platform}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={DISTRIBUTION_STATUS_COLORS[selectedDist.status]}>
                {DISTRIBUTION_STATUS_LABELS[selectedDist.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="发布链接">
              {selectedDist.publish_url ? (
                <a href={selectedDist.publish_url} target="_blank" rel="noreferrer">{selectedDist.publish_url}</a>
              ) : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="计划时间">
              {selectedDist.scheduled_time ? dayjs(selectedDist.scheduled_time).format('YYYY-MM-DD HH:mm:ss') : '即时发布'}
            </Descriptions.Item>
            <Descriptions.Item label="发布时间">
              {selectedDist.published_at ? dayjs(selectedDist.published_at).format('YYYY-MM-DD HH:mm:ss') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedDist.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
