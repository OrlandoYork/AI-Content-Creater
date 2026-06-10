import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Tag,
  Button,
  Space,
  Select,
  Input,
  Modal,
  DatePicker,
  message,
  Popconfirm,
  Tooltip,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  CalendarOutlined,
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTopicStore } from '../../stores/topicStore';
import {
  CONTENT_TYPE_LABELS,
  STYLE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../../types';
import type { Topic, TopicStatus, ContentType } from '../../types';

export default function TopicList() {
  const navigate = useNavigate();
  const {
    topics,
    topicsTotal,
    topicsLoading,
    loadTopics,
    deleteTopic,
    scheduleTopic,
  } = useTopicStore();

  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Schedule modal
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleTopicId, setScheduleTopicId] = useState<number | null>(null);
  const [scheduleDate, setScheduleDate] = useState<dayjs.Dayjs | null>(null);

  useEffect(() => {
    loadTopics({
      status: statusFilter !== 'all' ? statusFilter : undefined,
      content_type: typeFilter !== 'all' ? typeFilter : undefined,
      page,
      page_size: pageSize,
    });
  }, [statusFilter, typeFilter, page, pageSize]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteTopic(id);
        message.success('选题已删除');
        loadTopics({
          status: statusFilter !== 'all' ? statusFilter : undefined,
          content_type: typeFilter !== 'all' ? typeFilter : undefined,
          page,
          page_size: pageSize,
        });
      } catch {
        message.error('删除失败');
      }
    },
    [statusFilter, typeFilter, page, pageSize]
  );

  const handleSchedule = useCallback(async () => {
    if (!scheduleTopicId || !scheduleDate) return;
    try {
      await scheduleTopic(scheduleTopicId, scheduleDate.toISOString());
      message.success('排期成功');
      setScheduleModalOpen(false);
      loadTopics({
        status: statusFilter !== 'all' ? statusFilter : undefined,
        content_type: typeFilter !== 'all' ? typeFilter : undefined,
        page,
        page_size: pageSize,
      });
    } catch {
      message.error('排期失败');
    }
  }, [scheduleTopicId, scheduleDate, statusFilter, typeFilter, page, pageSize]);

  const filteredTopics = topics.filter((t) =>
    searchText
      ? t.title.toLowerCase().includes(searchText.toLowerCase()) ||
        t.description.toLowerCase().includes(searchText.toLowerCase())
      : true
  );

  const columns: ColumnsType<Topic> = [
    {
      title: '选题标题',
      dataIndex: 'title',
      key: 'title',
      width: 300,
      ellipsis: true,
      render: (text: string, record: Topic) => (
        <a
          onClick={() => navigate(`/topics/${record.id}`)}
          style={{ fontWeight: 500, color: 'var(--text-primary)' }}
        >
          {text}
        </a>
      ),
    },
    {
      title: '类型',
      dataIndex: 'content_type',
      key: 'content_type',
      width: 120,
      render: (v: ContentType) => (
        <Tag color="cyan">{CONTENT_TYPE_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: '风格',
      dataIndex: 'style',
      key: 'style',
      width: 90,
      render: (v: string) => (
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {STYLE_LABELS[v] || v}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (v: TopicStatus) => (
        <Tag color={STATUS_COLORS[v]}>{STATUS_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      width: 80,
      align: 'center',
      render: (v: number) => {
        const stars = '★'.repeat(v) + '☆'.repeat(5 - v);
        return (
          <span style={{ color: 'var(--accent-gold)', fontSize: 12, letterSpacing: 1 }}>
            {stars}
          </span>
        );
      },
    },
    {
      title: '排期',
      dataIndex: 'scheduled_date',
      key: 'scheduled_date',
      width: 140,
      render: (v: string | null) =>
        v ? (
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--accent-cyan)' }}>
            {dayjs(v).format('MM-DD HH:mm')}
          </span>
        ) : (
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>未排期</span>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 120,
      render: (v: string) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
          {dayjs(v).format('MM-DD HH:mm')}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_: any, record: Topic) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/topics/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="排期">
            <Button
              type="text"
              size="small"
              icon={<CalendarOutlined />}
              onClick={() => {
                setScheduleTopicId(record.id);
                setScheduleDate(record.scheduled_date ? dayjs(record.scheduled_date) : null);
                setScheduleModalOpen(true);
              }}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/topics/${record.id}`)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除此选题？"
            onConfirm={() => handleDelete(record.id)}
            okText="确认"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button type="text" size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
          padding: '16px 20px',
          borderRadius: 10,
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
        }}
      >
        <Space size="middle" wrap>
          <Select
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            style={{ width: 130 }}
            options={[
              { value: 'all', label: '全部状态' },
              ...Object.entries(STATUS_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
          <Select
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: '全部类型' },
              ...Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
          <Input
            placeholder="搜索选题..."
            prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
        </Space>

        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadTopics({ page, page_size: pageSize })}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/topics/generate')}
          >
            AI 生成选题
          </Button>
        </Space>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filteredTopics}
        rowKey="id"
        loading={topicsLoading}
        pagination={{
          current: page,
          pageSize,
          total: topicsTotal,
          showSizeChanger: true,
          showTotal: (total) => (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
              共 {total} 个选题
            </span>
          ),
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        scroll={{ x: 1200 }}
      />

      {/* Schedule Modal */}
      <Modal
        title="选题排期"
        open={scheduleModalOpen}
        onOk={handleSchedule}
        onCancel={() => setScheduleModalOpen(false)}
        okText="确认排期"
        cancelText="取消"
      >
        <div style={{ marginTop: 16 }}>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 12 }}>
            选择计划发布日期
          </p>
          <DatePicker
            showTime
            value={scheduleDate}
            onChange={(v) => setScheduleDate(v)}
            style={{ width: '100%' }}
            placeholder="选择日期时间"
          />
        </div>
      </Modal>
    </div>
  );
}
