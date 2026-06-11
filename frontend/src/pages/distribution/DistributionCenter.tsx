import { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Select, Tooltip, message, Modal, Descriptions, Checkbox,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  SendOutlined,
  EyeOutlined,
  ReloadOutlined,
  CalendarOutlined,
  ThunderboltOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDistributionStore } from '../../stores/distributionStore';
import { useReviewStore } from '../../stores/reviewStore';
import {
  DISTRIBUTION_STATUS_LABELS,
  DISTRIBUTION_STATUS_COLORS,
  DISTRIBUTION_PLATFORM_LABELS,
  PLATFORM_LABELS,
  CONTENT_TYPE_LABELS,
} from '../../types';
import type { Distribution, DistributionStatus } from '../../types';

const ALL_PLATFORMS = ['weibo', 'douyin', 'xiaohongshu', 'zhihu'];

export default function DistributionCenter() {
  const {
    distributions, distributionsTotal, distributionsLoading,
    loadDistributions, updateDistribution,
    batchDistribute, publishDistribution, cancelDistribution,
  } = useDistributionStore();

  const { contentList, contentListLoading, loadContentList } = useReviewStore();

  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedDist, setSelectedDist] = useState<Distribution | null>(null);
  const [batchVisible, setBatchVisible] = useState(false);
  const [selectedBatchContentId, setSelectedBatchContentId] = useState<number | null>(null);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['weibo', 'douyin']);
  const [batchLoading, setBatchLoading] = useState(false);

  useEffect(() => {
    loadDistributions({
      platform: platformFilter !== 'all' ? platformFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      page, page_size: pageSize,
    });
  }, [platformFilter, statusFilter, page, pageSize]);

  const handlePublish = useCallback(async (id: number) => {
    try {
      await publishDistribution(id);
      message.success('发布成功');
      loadDistributions({ platform: platformFilter !== 'all' ? platformFilter : undefined, status: statusFilter !== 'all' ? statusFilter : undefined, page, page_size: pageSize });
    } catch { message.error('发布失败'); }
  }, [platformFilter, statusFilter, page, pageSize]);

  const handleCancel = useCallback(async (id: number) => {
    try {
      await cancelDistribution(id);
      message.info('已取消分发');
      loadDistributions({ platform: platformFilter !== 'all' ? platformFilter : undefined, status: statusFilter !== 'all' ? statusFilter : undefined, page, page_size: pageSize });
    } catch { message.error('取消失败'); }
  }, [platformFilter, statusFilter, page, pageSize]);

  const handleBatchDistribute = useCallback(async () => {
    if (!selectedBatchContentId || selectedPlatforms.length === 0) {
      message.warning('请选择内容和至少一个平台');
      return;
    }
    setBatchLoading(true);
    try {
      const results = await batchDistribute(selectedBatchContentId, selectedPlatforms);
      message.success(`一键分发完成！已为 ${results.length} 个平台创建分发记录`);
      setBatchVisible(false);
      setSelectedBatchContentId(null);
      loadDistributions({ platform: platformFilter !== 'all' ? platformFilter : undefined, status: statusFilter !== 'all' ? statusFilter : undefined, page, page_size: pageSize });
    } catch { message.error('批量分发失败'); }
    finally { setBatchLoading(false); }
  }, [selectedBatchContentId, selectedPlatforms, platformFilter, statusFilter, page, pageSize]);

  const openBatchModal = () => {
    loadContentList();
    setBatchVisible(true);
  };

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
      title: '内容标题',
      dataIndex: 'content_title',
      key: 'content_title',
      width: 260,
      ellipsis: true,
      render: (v: string) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v || '—'}</span>
      ),
    },
    {
      title: '分发平台',
      dataIndex: 'platform',
      key: 'platform',
      width: 130,
      render: (v: string) => (
        <Tag color="blue">{PLATFORM_LABELS[v] || DISTRIBUTION_PLATFORM_LABELS[v] || v}</Tag>
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
      width: 200,
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
      width: 150,
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
      width: 200,
      fixed: 'right',
      render: (_: any, record: Distribution) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)} />
          </Tooltip>
          {(record.status === 'pending' || record.status === 'scheduled') && (
            <>
              <Tooltip title="立即发布">
                <Button type="text" size="small" icon={<SendOutlined />} style={{ color: 'var(--accent)' }} onClick={() => handlePublish(record.id)} />
              </Tooltip>
              <Tooltip title="取消分发">
                <Button type="text" size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleCancel(record.id)} />
              </Tooltip>
            </>
          )}
        </Space>
      ),
    },
  ];

  const stats = {
    total: distributionsTotal,
    published: distributions.filter((d) => d.status === 'published').length,
    pending: distributions.filter((d) => d.status === 'pending' || d.status === 'scheduled').length,
    failed: distributions.filter((d) => d.status === 'failed' || d.status === 'cancelled').length,
  };

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Stats Cards */}
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {([
          { label: '总分发', value: stats.total, color: 'var(--accent)' },
          { label: '已发布', value: stats.published, color: 'var(--accent-green)' },
          { label: '待发布', value: stats.pending, color: 'var(--accent-amber)' },
          { label: '已取消/失败', value: stats.failed, color: '#dc2626' },
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
          <Button icon={<ReloadOutlined />} onClick={() => loadDistributions({ platform: platformFilter !== 'all' ? platformFilter : undefined, status: statusFilter !== 'all' ? statusFilter : undefined, page, page_size: pageSize })}>刷新</Button>
          <Button type="primary" icon={<ThunderboltOutlined />} onClick={openBatchModal}>
            一键分发
          </Button>
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
        scroll={{ x: 1300 }}
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
            <Descriptions.Item label="内容标题">{selectedDist.content_title || '—'}</Descriptions.Item>
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
            <Descriptions.Item label="平台适配数据">
              {(() => {
                try {
                  const data = JSON.parse(selectedDist.platform_data || '{}');
                  return data.adapted_body ? (
                    <div>
                      <div style={{ fontSize: 12, marginBottom: 4 }}>
                        <strong>适配后内容:</strong> {data.adapted_body.substring(0, 200)}...
                      </div>
                      {data.hashtags?.length > 0 && (
                        <div style={{ fontSize: 12, marginBottom: 4 }}>
                          <strong>标签:</strong> {data.hashtags.join(' ')}
                        </div>
                      )}
                      {data.suggested_title && (
                        <div style={{ fontSize: 12 }}>
                          <strong>建议标题:</strong> {data.suggested_title}
                        </div>
                      )}
                    </div>
                  ) : '无适配数据';
                } catch { return selectedDist.platform_data || '无'; }
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="创建时间">
              {dayjs(selectedDist.created_at).format('YYYY-MM-DD HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Batch Distribute Modal */}
      <Modal
        title="一键分发到多平台"
        open={batchVisible}
        onCancel={() => setBatchVisible(false)}
        onOk={handleBatchDistribute}
        confirmLoading={batchLoading}
        okText="确认分发"
        cancelText="取消"
        width={520}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            选择内容和目标平台，AI将自动为每个平台适配内容格式和风格。
          </div>

          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8, display: 'block' }}>选择内容：</span>
            <Select
              showSearch
              placeholder="搜索并选择内容标题..."
              loading={contentListLoading}
              value={selectedBatchContentId}
              onChange={(v) => setSelectedBatchContentId(v)}
              style={{ width: '100%' }}
              filterOption={(input, option) =>
                (option?.label as string || '').toLowerCase().includes(input.toLowerCase())
              }
              options={contentList.map((c) => ({
                value: c.id,
                label: c.title,
              }))}
            />
          </div>

          <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8 }}>选择目标平台:</div>
          <Checkbox.Group
            options={ALL_PLATFORMS.map((p) => ({
              label: (
                <Space>
                  <span>{DISTRIBUTION_PLATFORM_LABELS[p] || PLATFORM_LABELS[p] || p}</span>
                  <Tooltip title={`最佳时间: ${platformInfo[p]?.bestTime || '—'}`}>
                    <InfoCircleOutlined style={{ color: 'var(--text-muted)', fontSize: 12 }} />
                  </Tooltip>
                </Space>
              ),
              value: p,
            }))}
            value={selectedPlatforms}
            onChange={(values) => setSelectedPlatforms(values as string[])}
          />
        </div>

        <div style={{
          padding: 12, borderRadius: 8, background: '#f0f9ff',
          border: '1px solid rgba(37,99,235,0.15)', fontSize: 12, color: 'var(--text-secondary)',
        }}>
          <strong style={{ color: 'var(--accent)' }}>💡 提示：</strong>
          AI 会根据各平台规则（字数限制、标签格式、风格特点、最佳发布时间）自动适配内容，分发后状态为"待发布"。
        </div>
      </Modal>
    </div>
  );
}

const platformInfo: Record<string, { bestTime: string; maxChars: number }> = {
  weibo: { bestTime: '20:00-22:00', maxChars: 140 },
  douyin: { bestTime: '21:00-23:00', maxChars: 500 },
  xiaohongshu: { bestTime: '20:00-22:00', maxChars: 1000 },
  zhihu: { bestTime: '12:00-13:00', maxChars: 10000 },
};
