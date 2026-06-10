import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Tag,
  Button,
  Space,
  Spin,
  Form,
  Input,
  Select,
  DatePicker,
  InputNumber,
  Divider,
  message,
  Row,
  Col,
} from 'antd';
import {
  EditOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  CalendarOutlined,
  DeleteOutlined,
  BulbOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTopicStore } from '../../stores/topicStore';
import {
  CONTENT_TYPE_LABELS,
  STYLE_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../../types';
import type { TopicUpdate } from '../../types';

const { TextArea } = Input;

export default function TopicDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    currentTopic,
    currentTopicLoading,
    loadTopicDetail,
    updateTopic,
    deleteTopic,
    scheduleTopic,
    clearCurrentTopic,
  } = useTopicStore();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (id) {
      loadTopicDetail(Number(id));
    }
    return () => clearCurrentTopic();
  }, [id]);

  const handleEdit = () => {
    form.setFieldsValue({
      ...currentTopic,
      scheduled_date: currentTopic?.scheduled_date ? dayjs(currentTopic.scheduled_date) : null,
    });
    setEditing(true);
  };

  const handleSave = async () => {
    if (!currentTopic) return;
    setSaving(true);
    try {
      const values = await form.validateFields();
      const data: TopicUpdate = {
        ...values,
        scheduled_date: values.scheduled_date
          ? values.scheduled_date.toISOString()
          : undefined,
      };
      await updateTopic(currentTopic.id, data);
      message.success('更新成功');
      setEditing(false);
    } catch (err: any) {
      if (err?.errorFields) return; // Form validation
      message.error('更新失败');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!currentTopic) return;
    try {
      await deleteTopic(currentTopic.id);
      message.success('选题已删除');
      navigate('/topics');
    } catch {
      message.error('删除失败');
    }
  };

  const handleSchedule = async () => {
    if (!currentTopic) return;
    try {
      const date = form.getFieldValue('scheduled_date');
      if (!date) {
        message.warning('请先选择排期日期');
        return;
      }
      await scheduleTopic(currentTopic.id, date.toISOString());
      message.success('排期成功');
      await loadTopicDetail(currentTopic.id);
    } catch {
      message.error('排期失败');
    }
  };

  if (currentTopicLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!currentTopic) {
    return (
      <div style={{ textAlign: 'center', padding: 80 }}>
        <p style={{ color: 'var(--text-muted)' }}>选题不存在或已被删除</p>
        <Button onClick={() => navigate('/topics')}>返回列表</Button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000 }}>
      {/* Back + Title */}
      <div style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/topics')}
          style={{ marginBottom: 12, color: 'var(--text-secondary)' }}
        >
          返回选题列表
        </Button>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <BulbOutlined style={{ fontSize: 24, color: 'var(--accent-gold)' }} />
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 24,
              fontWeight: 400,
              margin: 0,
              letterSpacing: '-0.01em',
            }}>
              {editing ? '编辑选题' : currentTopic.title}
            </h1>
            <Tag color={STATUS_COLORS[currentTopic.status]}>
              {STATUS_LABELS[currentTopic.status]}
            </Tag>
          </div>
          <Space>
            {!editing ? (
              <>
                <Button icon={<CalendarOutlined />} onClick={handleSchedule}>
                  快速排期
                </Button>
                <Button icon={<EditOutlined />} onClick={handleEdit}>
                  编辑
                </Button>
                <Button danger icon={<DeleteOutlined />} onClick={handleDelete}>
                  删除
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setEditing(false)}>取消</Button>
                <Button
                  type="primary"
                  icon={<SaveOutlined />}
                  onClick={handleSave}
                  loading={saving}
                >
                  保存
                </Button>
              </>
            )}
          </Space>
        </div>
      </div>

      <Spin spinning={currentTopicLoading}>
        {!editing ? (
          /* View Mode */
          <Row gutter={[20, 20]}>
            <Col span={24}>
              <Card>
                <Descriptions column={2} size="small">
                  <Descriptions.Item label="选题标题" span={2}>
                    <span style={{ fontSize: 16, fontWeight: 500 }}>
                      {currentTopic.title}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="选题描述" span={2}>
                    <p style={{ color: 'var(--text-secondary)', lineHeight: 1.8, margin: 0 }}>
                      {currentTopic.description || '暂无描述'}
                    </p>
                  </Descriptions.Item>
                  <Descriptions.Item label="目标受众">
                    {currentTopic.target_audience || '未指定'}
                  </Descriptions.Item>
                  <Descriptions.Item label="关联热点ID">
                    {currentTopic.source_hot_topic_id ? (
                      <Tag color="gold">#{currentTopic.source_hot_topic_id}</Tag>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>无</span>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="内容类型">
                    <Tag color="cyan">
                      {CONTENT_TYPE_LABELS[currentTopic.content_type]}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="风格">
                    <Tag>{STYLE_LABELS[currentTopic.style]}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="优先级">
                    <span style={{ color: 'var(--accent-gold)', letterSpacing: 1 }}>
                      {'★'.repeat(currentTopic.priority)}
                      {'☆'.repeat(5 - currentTopic.priority)}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="状态">
                    <Tag color={STATUS_COLORS[currentTopic.status]}>
                      {STATUS_LABELS[currentTopic.status]}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="计划发布日期">
                    {currentTopic.scheduled_date ? (
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                        {dayjs(currentTopic.scheduled_date).format('YYYY-MM-DD HH:mm')}
                      </span>
                    ) : (
                      <span style={{ color: 'var(--text-muted)' }}>未排期</span>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label="创建时间">
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {dayjs(currentTopic.created_at).format('YYYY-MM-DD HH:mm')}
                    </span>
                  </Descriptions.Item>
                  <Descriptions.Item label="更新时间">
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                      {dayjs(currentTopic.updated_at).format('YYYY-MM-DD HH:mm')}
                    </span>
                  </Descriptions.Item>
                </Descriptions>
              </Card>
            </Col>
          </Row>
        ) : (
          /* Edit Mode */
          <Row gutter={[20, 20]}>
            <Col span={24}>
              <Card title="编辑选题信息">
                <Form form={form} layout="vertical" style={{ maxWidth: 700 }}>
                  <Form.Item
                    name="title"
                    label="选题标题"
                    rules={[{ required: true, message: '请输入选题标题' }]}
                  >
                    <Input placeholder="请输入选题标题" />
                  </Form.Item>
                  <Form.Item name="description" label="选题描述">
                    <TextArea rows={4} placeholder="请输入选题描述" />
                  </Form.Item>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="target_audience" label="目标受众">
                        <Input placeholder="如：26-35岁职场人群" />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="content_type" label="内容类型">
                        <Select
                          options={Object.entries(CONTENT_TYPE_LABELS).map(([k, v]) => ({
                            value: k,
                            label: v,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="style" label="内容风格">
                        <Select
                          options={Object.entries(STYLE_LABELS).map(([k, v]) => ({
                            value: k,
                            label: v,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="status" label="选题状态">
                        <Select
                          options={Object.entries(STATUS_LABELS).map(([k, v]) => ({
                            value: k,
                            label: v,
                          }))}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                  <Row gutter={16}>
                    <Col span={12}>
                      <Form.Item name="priority" label="优先级 (0-5)">
                        <InputNumber min={0} max={5} style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                    <Col span={12}>
                      <Form.Item name="scheduled_date" label="计划发布日期">
                        <DatePicker showTime style={{ width: '100%' }} />
                      </Form.Item>
                    </Col>
                  </Row>
                </Form>
              </Card>
            </Col>
          </Row>
        )}
      </Spin>
    </div>
  );
}
