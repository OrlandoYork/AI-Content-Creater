import { useEffect, useState, useCallback } from 'react';
import {
  Table, Tag, Button, Space, Select, Tooltip, message, Modal, Descriptions,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  CheckOutlined,
  CloseOutlined,
  EyeOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
  SendOutlined,
  RollbackOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useReviewStore } from '../../stores/reviewStore';
import { CONTENT_TYPE_LABELS } from '../../types';
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
    reviews, reviewsTotal, reviewsLoading,
    loadReviews, updateReview, autoReviewContent,
    approveReview, rejectReview,
    contentList, contentListLoading, loadContentList,
  } = useReviewStore();

  const [statusFilter, setStatusFilter] = useState<string>('pending');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [autoReviewVisible, setAutoReviewVisible] = useState(false);
  const [selectedContentId, setSelectedContentId] = useState<number | null>(null);
  const [autoReviewLoading, setAutoReviewLoading] = useState(false);

  useEffect(() => {
    loadReviews({
      review_status: statusFilter !== 'all' ? statusFilter : undefined,
      page,
      page_size: pageSize,
    });
  }, [statusFilter, page, pageSize]);

  const handleApprove = useCallback(async (id: number) => {
    try {
      const result = await approveReview(id);
      message.success(result.message || '审核通过，已分发到发布中心');
      loadReviews({ review_status: statusFilter !== 'all' ? statusFilter : undefined, page, page_size: pageSize });
    } catch { message.error('操作失败'); }
  }, [statusFilter, page, pageSize]);

  const handleReject = useCallback(async (id: number) => {
    try {
      const result = await rejectReview(id);
      message.info(result.message || '审核不通过，已打回内容编辑页面');
      loadReviews({ review_status: statusFilter !== 'all' ? statusFilter : undefined, page, page_size: pageSize });
    } catch { message.error('操作失败'); }
  }, [statusFilter, page, pageSize]);

  const handleAutoReview = useCallback(async () => {
    if (!selectedContentId) {
      message.warning('请选择要审核的内容');
      return;
    }
    setAutoReviewLoading(true);
    try {
      const review = await autoReviewContent(selectedContentId);
      message.success(`AI审核完成 — 风险等级: ${RISK_LEVEL_LABELS[extractRiskLevel(review)]}`);
      setAutoReviewVisible(false);
      setSelectedContentId(null);
      loadReviews({ review_status: statusFilter !== 'all' ? statusFilter : undefined, page, page_size: pageSize });
    } catch { message.error('AI审核失败'); }
    finally { setAutoReviewLoading(false); }
  }, [selectedContentId, statusFilter, page, pageSize]);

  const showDetail = (record: Review) => {
    setSelectedReview(record);
    setDetailVisible(true);
  };

  const openAutoReview = () => {
    loadContentList();
    setAutoReviewVisible(true);
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
      title: '内容标题',
      dataIndex: 'content_title',
      key: 'content_title',
      width: 280,
      ellipsis: true,
      render: (v: string) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{v || '—'}</span>
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
      title: 'AI判断',
      dataIndex: 'is_approved',
      key: 'is_approved',
      width: 90,
      render: (v: boolean) => (
        v
          ? <Tag color="green">合规</Tag>
          : <Tag color="red">有问题</Tag>
      ),
    },
    {
      title: '审核状态',
      dataIndex: 'review_status',
      key: 'review_status',
      width: 100,
      render: (v: string) => {
        const labels: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回' };
        const colors: Record<string, string> = { pending: 'blue', approved: 'green', rejected: 'red' };
        return <Tag color={colors[v] || 'default'}>{labels[v] || v}</Tag>;
      },
    },
    {
      title: '问题摘要',
      dataIndex: 'issues',
      key: 'issues',
      width: 200,
      ellipsis: true,
      render: (v: string) => {
        try {
          const issues = JSON.parse(v);
          return <span style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{issues.length > 0 ? issues.slice(0, 2).join('；') : '无问题'}</span>;
        } catch { return <span>{v || '无问题'}</span>; }
      },
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
      width: 200,
      fixed: 'right',
      render: (_: any, record: Review) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button type="text" size="small" icon={<EyeOutlined />} onClick={() => showDetail(record)} />
          </Tooltip>
          {record.review_status === 'pending' && (
            <>
              <Tooltip title="审核通过并分发">
                <Button type="text" size="small" icon={<CheckOutlined />} style={{ color: 'var(--accent-green)' }} onClick={() => handleApprove(record.id)} />
              </Tooltip>
              <Tooltip title="驳回打回">
                <Button type="text" size="small" danger icon={<CloseOutlined />} onClick={() => handleReject(record.id)} />
              </Tooltip>
            </>
          )}
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
              { value: 'pending', label: '待审核' },
              { value: 'approved', label: '已通过' },
              { value: 'rejected', label: '已驳回' },
              { value: 'all', label: '全部状态' },
            ]}
          />
        </Space>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => loadReviews({ review_status: statusFilter !== 'all' ? statusFilter : undefined, page, page_size: pageSize })}>刷新</Button>
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            onClick={openAutoReview}
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
        scroll={{ x: 1200 }}
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
            <Descriptions.Item label="内容标题">{selectedReview.content_title || '—'}</Descriptions.Item>
            <Descriptions.Item label="内容ID">{selectedReview.content_id}</Descriptions.Item>
            <Descriptions.Item label="安全等级">
              <Tag color={RISK_LEVEL_COLORS[extractRiskLevel(selectedReview)]}>
                {RISK_LEVEL_LABELS[extractRiskLevel(selectedReview)]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="AI判断">
              <Tag color={selectedReview.is_approved ? 'green' : 'red'}>
                {selectedReview.is_approved ? '合规' : '有问题'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="审核状态">
              {(() => {
                const labels: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回' };
                const colors: Record<string, string> = { pending: 'blue', approved: 'green', rejected: 'red' };
                return <Tag color={colors[selectedReview.review_status] || 'default'}>{labels[selectedReview.review_status] || selectedReview.review_status}</Tag>;
              })()}
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

      {/* Auto Review Modal — Select content by title */}
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
          <span style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 8, display: 'block' }}>选择要审核的内容：</span>
          <Select
            showSearch
            placeholder="搜索并选择内容标题..."
            loading={contentListLoading}
            value={selectedContentId}
            onChange={(v) => setSelectedContentId(v)}
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
      </Modal>
    </div>
  );
}
