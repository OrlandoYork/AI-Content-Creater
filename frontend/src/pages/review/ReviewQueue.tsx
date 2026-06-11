import { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Select, Tooltip, message, Modal, Descriptions, InputNumber,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  ReloadOutlined,
  ExperimentOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useReviewStore } from '../../stores/reviewStore';
import type { Review } from '../../types';

const RISK_LEVEL_LABELS: Record<string, string> = {
  safe: '安全',
  low: '低风险',
  medium: '中风险',
  high: '高风险',
  unknown: '未知',
};

const RISK_LEVEL_COLORS: Record<string, string> = {
  safe: 'green',
  low: 'cyan',
  medium: 'orange',
  high: 'red',
  unknown: 'default',
};

export default function ReviewQueue() {
  const {
    reviews, reviewsTotal, reviewsLoading, loadReviews, updateReview, autoReviewContent,
  } = useReviewStore();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [autoReviewVisible, setAutoReviewVisible] = useState(false);
  const [autoReviewContentId, setAutoReviewContentId] = useState<number | null>(null);
  const [autoReviewLoading, setAutoReviewLoading] = useState(false);

  useEffect(() => {
    loadReviews({
      is_approved: statusFilter !== 'all' ? statusFilter === 'approved' : undefined,
      page,
      page_size: pageSize,
    });
  }, [statusFilter, page, pageSize]);

  const handleApprove = useCallback(async (id: number) => {
    try {
      await updateReview(id, { is_approved: true, reviewer_notes: '审核通过' });
      message.success('审核已通过');
      loadReviews({ is_approved: statusFilter !== 'all' ? statusFilter === 'approved' : undefined, page, page_size: pageSize });
    } catch { message.error('操作失败'); }
  }, [statusFilter, page, pageSize]);

  const handleReject = useCallback(async (id: number) => {
    try {
      await updateReview(id, { is_approved: false, reviewer_notes: '审核不通过，需修改' });
      message.warning('已标记为未通过');
      loadReviews({ is_approved: statusFilter !== 'all' ? statusFilter === 'approved' : undefined, page, page_size: pageSize });
    } catch { message.error('操作失败'); }
  }, [statusFilter, page, pageSize]);

  const handleAutoReview = useCallback(async () => {
    if (!autoReviewContentId) return;
    setAutoReviewLoading(true);
    try {
      const review = await autoReviewContent(autoReviewContentId);
      message.success(`AI审核完成 — 风险等级: ${RISK_LEVEL_LABELS[extractRiskLevel(review)]}`);
      setAutoReviewVisible(false);
      loadReviews({ page, page_size: pageSize });
    } catch { message.error('AI审核失败'); }
    finally { setAutoReviewLoading(false); }
  }, [autoReviewContentId, page, pageSize]);

  const showDetail = (record: Review) => {
    setSelectedReview(record);
    setDetailVisible(true);
  };

  const extractRiskLevel = (review: Review): string => {
    try {
      const notes = review.reviewer_notes || '';
      if (notes.includes('高风险')) return 'high';
      if (notes.includes('中风险')) return 'medium';
      if (notes.includes('低风险')) return 'low';
      return 'safe';
    } catch { return 'unknown'; }
  };

  const columns: ColumnsType<Review> = [
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
      title: '安全等级',
      dataIndex: 'reviewer_notes',
      key: 'risk_level',
      width: 100,
      render: (v: string) => {
        const level = extractRiskLevel({ reviewer_notes: v } as Review);
        return <Tag color={RISK_LEVEL_COLORS[level]}>{RISK_LEVEL_LABELS[level]}</Tag>;
      },
    },
    {
      title: '审核结果',
      dataIndex: 'is_approved',
      key: 'is_approved',
      width: 100,
      render: (v: boolean) => (
        v
          ? <Tag color="green">已通过</Tag>
          : <Tag color="red">未通过</Tag>
      ),
    },
    {
      title: '问题摘要',
      dataIndex: 'issues',
      key: 'issues',
      width: 220,
      ellipsis: true,
      render: (v: string) => {
        try {
          const issues = JSON.parse(v);
          return <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{issues.length > 0 ? issues.slice(0, 2).join('；') : '无问题'}</span>;
        } catch { return <span>{v || '无问题'}</span>; }
      },
    },
    {
      title: '审核备注',
      dataIndex: 'reviewer_notes',
      key: 'reviewer_notes',
      width: 180,
      ellipsis: true,
      render: (v: string) => (
        <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{v || '—'}</span>
      ),
    },
    {
      title: '审核时间',
      dataIndex: 'reviewed_at',
      key: 'reviewed_at',
      width: 170,
      render: (v: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {v ? dayjs(v).format('YYYY-MM-DD HH:mm:ss') : '—'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 240,
      fixed: 'right',
      render: (_: any, record: Review) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)} />
          </Tooltip>
          <Tooltip title="审核通过">
            <Button type="text" size="small" icon={<CheckOutlined />} style={{ color: 'var(--accent-green)' }} onClick={() => handleApprove(record.id)} />
          </Tooltip>
          <Tooltip title="审核不通过">
            <Button type="text" size="small" danger icon={<CloseOutlined />} onClick={() => handleReject(record.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

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
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'approved', label: '已通过' },
              { value: 'rejected', label: '未通过' },
            ]}
          />
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadReviews({ page, page_size: pageSize })}>刷新</Button>
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            onClick={() => setAutoReviewVisible(true)}
          >
            AI 自动审核
          </Button>
        </Space>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={reviews}
        rowKey="id"
        loading={reviewsLoading}
        pagination={{
          current: page, pageSize, total: reviewsTotal,
          showSizeChanger: true,
          showTotal: (total) => (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>共 {total} 条审核</span>
          ),
          onChange: (p, ps) => { setPage(p); setPageSize(ps); },
        }}
        scroll={{ x: 1150 }}
      />

      {/* Detail Modal */}
      <Modal
        title={`审核详情 #${selectedReview?.id}`}
        open={detailVisible}
        onCancel={() => setDetailVisible(false)}
        footer={null}
        width={600}
      >
        {selectedReview && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="内容ID">{selectedReview.content_id}</Descriptions.Item>
            <Descriptions.Item label="安全等级">
              <Tag color={RISK_LEVEL_COLORS[extractRiskLevel(selectedReview)]}>
                {RISK_LEVEL_LABELS[extractRiskLevel(selectedReview)]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="审核结果">
              <Tag color={selectedReview.is_approved ? 'green' : 'red'}>
                {selectedReview.is_approved ? '已通过' : '未通过'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="问题">
              {(() => {
                try {
                  const issues = JSON.parse(selectedReview.issues);
                  return issues.length > 0 ? (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {issues.map((issue: string, i: number) => <li key={i}>{issue}</li>)}
                    </ul>
                  ) : '无问题';
                } catch { return selectedReview.issues || '无问题'; }
              })()}
            </Descriptions.Item>
            <Descriptions.Item label="审核备注">{selectedReview.reviewer_notes || '—'}</Descriptions.Item>
            <Descriptions.Item label="审核时间">{selectedReview.reviewed_at ? dayjs(selectedReview.reviewed_at).format('YYYY-MM-DD HH:mm:ss') : '—'}</Descriptions.Item>
            <Descriptions.Item label="创建时间">{dayjs(selectedReview.created_at).format('YYYY-MM-DD HH:mm:ss')}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      {/* Auto Review Modal */}
      <Modal
        title="AI 自动内容审核"
        open={autoReviewVisible}
        onCancel={() => setAutoReviewVisible(false)}
        onOk={handleAutoReview}
        confirmLoading={autoReviewLoading}
        okText="开始 AI 审核"
        cancelText="取消"
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 12 }}>
            AI 审核将自动检测以下内容风险：
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 2 }}>
            <li>色情低俗内容</li>
            <li>暴力恐怖信息</li>
            <li>政治敏感表述</li>
            <li>违法或违规信息</li>
            <li>广告法违规词</li>
            <li>虚假或误导性信息</li>
            <li>个人隐私泄露</li>
          </ul>
        </div>
        <div>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>内容ID：</span>
          <InputNumber
            min={1}
            placeholder="输入要审核的内容ID"
            value={autoReviewContentId}
            onChange={(v) => setAutoReviewContentId(v)}
            style={{ width: '100%', marginTop: 8 }}
          />
        </div>
      </Modal>
    </div>
  );
}
