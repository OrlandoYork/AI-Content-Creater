import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Table,
  Tag,
  Button,
  Space,
  Select,
  Input,
  Popconfirm,
  Tooltip,
  message,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  PlusOutlined,
  EyeOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  EditOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useContentStore } from '../../stores/contentStore';
import {
  CONTENT_TYPE_LABELS,
  STYLE_LABELS,
  CONTENT_STATUS_LABELS,
  CONTENT_STATUS_COLORS,
} from '../../types';
import type { Content, ContentType, ContentStyle, ContentStatus } from '../../types';

export default function ContentList() {
  const navigate = useNavigate();
  const {
    contents,
    contentsTotal,
    contentsLoading,
    loadContents,
    deleteContent,
  } = useContentStore();

  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [styleFilter, setStyleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  useEffect(() => {
    loadContents({
      content_type: typeFilter !== 'all' ? typeFilter : undefined,
      style: styleFilter !== 'all' ? styleFilter : undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      page,
      page_size: pageSize,
    });
  }, [typeFilter, styleFilter, statusFilter, page, pageSize]);

  const handleDelete = useCallback(
    async (id: number) => {
      try {
        await deleteContent(id);
        message.success('内容已删除');
        loadContents({
          content_type: typeFilter !== 'all' ? typeFilter : undefined,
          style: styleFilter !== 'all' ? styleFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          page,
          page_size: pageSize,
        });
      } catch {
        message.error('删除失败');
      }
    },
    [typeFilter, styleFilter, statusFilter, page, pageSize]
  );

  const filteredContents = contents.filter((c) =>
    searchText
      ? c.title.toLowerCase().includes(searchText.toLowerCase())
      : true
  );

  const columns: ColumnsType<Content> = [
    {
      title: '内容标题',
      dataIndex: 'title',
      key: 'title',
      width: 280,
      ellipsis: true,
      render: (text: string) => (
        <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{text}</span>
      ),
    },
    {
      title: '类型',
      dataIndex: 'content_type',
      key: 'content_type',
      width: 130,
      render: (v: ContentType) => (
        <Tag color="cyan">{CONTENT_TYPE_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: '风格',
      dataIndex: 'style',
      key: 'style',
      width: 90,
      render: (v: ContentStyle) => (
        <Tag>{STYLE_LABELS[v] || v}</Tag>
      ),
    },
    {
      title: '字数/分镜',
      dataIndex: 'word_count',
      key: 'word_count',
      width: 100,
      align: 'center',
      render: (v: number) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-secondary)' }}>
          {v.toLocaleString()}
        </span>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (v: ContentStatus) => (
        <Tag color={CONTENT_STATUS_COLORS[v]}>{CONTENT_STATUS_LABELS[v] || v}</Tag>
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
      width: 160,
      fixed: 'right',
      render: (_: any, record: Content) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/content/generate?id=${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="编辑">
            <Button
              type="text"
              size="small"
              icon={<EditOutlined />}
              onClick={() => navigate(`/content/generate?id=${record.id}`)}
            />
          </Tooltip>
          <Popconfirm
            title="确认删除此内容？"
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
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <Space size="middle" wrap>
          <Select
            value={typeFilter}
            onChange={(v) => { setTypeFilter(v); setPage(1); }}
            style={{ width: 150 }}
            options={[
              { value: 'all', label: '全部类型' },
              ...Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
          <Select
            value={styleFilter}
            onChange={(v) => { setStyleFilter(v); setPage(1); }}
            style={{ width: 130 }}
            options={[
              { value: 'all', label: '全部风格' },
              ...Object.entries(STYLE_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
          <Select
            value={statusFilter}
            onChange={(v) => { setStatusFilter(v); setPage(1); }}
            style={{ width: 130 }}
            options={[
              { value: 'all', label: '全部状态' },
              ...Object.entries(CONTENT_STATUS_LABELS).map(([k, v]) => ({ value: k, label: v })),
            ]}
          />
          <Input
            placeholder="搜索内容..."
            prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 220 }}
            allowClear
          />
        </Space>

        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => loadContents({ page, page_size: pageSize })}
          >
            刷新
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/content/generate')}
          >
            AI 生成内容
          </Button>
        </Space>
      </div>

      {/* Table */}
      <Table
        columns={columns}
        dataSource={filteredContents}
        rowKey="id"
        loading={contentsLoading}
        pagination={{
          current: page,
          pageSize,
          total: searchText ? filteredContents.length : contentsTotal,
          showSizeChanger: true,
          showTotal: (total) => (
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--text-muted)' }}>
              共 {total} 篇内容
            </span>
          ),
          onChange: (p, ps) => {
            setPage(p);
            setPageSize(ps);
          },
        }}
        scroll={{ x: 1100 }}
      />
    </div>
  );
}
