import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Button,
  Tag,
  Spin,
  Select,
  Input,
  Space,
  Divider,
  message,
  Descriptions,
  Slider,
  Empty,
  Tooltip,
  Progress,
} from 'antd';
import {
  ThunderboltOutlined,
  FireOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  SearchOutlined,
  BulbOutlined,
  BarChartOutlined,
  CloseOutlined,
} from '@ant-design/icons';
import { useTopicStore } from '../../stores/topicStore';
import {
  PLATFORM_LABELS,
  TREND_LABELS,
  CONTENT_TYPE_LABELS,
  STYLE_LABELS,
} from '../../types';
import type { HotTopic, TopicCreate } from '../../types';

const PLATFORM_ICONS: Record<string, string> = {
  weibo: '🔴',
  zhihu: '🔵',
  douyin: '🎵',
  baidu: '🔍',
  sohu: '🦊',
};

const TREND_COLORS: Record<string, string> = {
  rising: 'var(--accent-mint)',
  stable: 'var(--accent-cyan)',
  falling: 'var(--accent-coral)',
};

export default function TopicGenerate() {
  const navigate = useNavigate();
  const {
    hotTopics,
    hotTopicsLoading,
    analysis,
    analysisLoading,
    suggestions,
    suggestionAnalysis,
    generatingTopics,
    loadHotTopics,
    refreshHotTopicsStream,
    cancelRefresh,
    refreshProgress,
    analyzeHotTopic,
    generateTopics,
    createTopic,
    clearSuggestions,
  } = useTopicStore();

  const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
  const [selectedHotId, setSelectedHotId] = useState<number | null>(null);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [stylePreference, setStylePreference] = useState<string>('professional');
  const [generationCount, setGenerationCount] = useState(3);
  const [savingIds, setSavingIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    loadHotTopics({ page_size: 75 });
    return () => { cancelRefresh(); };
  }, []);

  const filteredTopics = hotTopics.filter((t) => {
    const matchPlatform = selectedPlatform === 'all' || t.source_platform === selectedPlatform;
    const matchSearch = searchKeyword
      ? t.title.toLowerCase().includes(searchKeyword.toLowerCase())
      : true;
    return matchPlatform && matchSearch;
  });

  const selectedHot = hotTopics.find((t) => t.id === selectedHotId);

  const handleSelectHot = async (id: number) => {
    setSelectedHotId(id);
    clearSuggestions();
    await analyzeHotTopic(id);
  };

  const handleGenerate = async () => {
    if (!selectedHotId) {
      message.warning('请先选择一个热点话题');
      return;
    }
    await generateTopics(selectedHotId, generationCount, stylePreference);
  };

  const handleSaveSuggestion = async (suggestion: TopicCreate, index: number) => {
    setSavingIds((prev) => new Set(prev).add(index));
    try {
      await createTopic({
        ...suggestion,
        source_hot_topic_id: selectedHotId,
      });
      message.success(`已保存选题: ${suggestion.title}`);
    } catch {
      message.error('保存失败');
    } finally {
      setSavingIds((prev) => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
    }
  };

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/topics')}
          style={{ marginBottom: 12, color: 'var(--text-secondary)' }}
        >
          返回选题列表
        </Button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, margin: 0 }}>
          AI 选题生成
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
          选择热点话题 → AI 智能分析 → 生成选题建议 → 一键保存
        </p>
      </div>

      <Row gutter={20}>
        {/* Left: Hot Topic Selection */}
        <Col xs={24} lg={9}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FireOutlined style={{ color: 'var(--accent-coral)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em' }}>
                  热点话题
                </span>
              </div>
            }
            extra={
              <Button
                size="small"
                icon={<ReloadOutlined spin={hotTopicsLoading} />}
                onClick={refreshHotTopicsStream}
                disabled={hotTopicsLoading}
              >
                {hotTopicsLoading ? '刷新中…' : '流式刷新'}
              </Button>
            }
            style={{ height: 'calc(100vh - 200px)', overflow: 'auto' }}
          >
            <Space direction="vertical" style={{ width: '100%', marginBottom: 16 }} size="small">
              <Space>
                <Select
                  value={selectedPlatform}
                  onChange={setSelectedPlatform}
                  style={{ width: 120 }}
                  options={[
                    { value: 'all', label: '全部平台' },
                    ...Object.entries(PLATFORM_LABELS).map(([k, v]) => ({ value: k, label: v })),
                  ]}
                />
                <Input
                  placeholder="搜索热点..."
                  prefix={<SearchOutlined style={{ color: 'var(--text-muted)' }} />}
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  style={{ width: 160 }}
                />
              </Space>
            </Space>

            {/* Streaming progress */}
            {refreshProgress && (
              <div style={{
                marginBottom: 12,
                padding: '10px 14px',
                borderRadius: 8,
                background: 'rgba(79,195,247,0.05)',
                border: '1px solid rgba(79,195,247,0.1)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--accent-cyan)' }}>
                    {refreshProgress.icon} {refreshProgress.message}
                  </span>
                  <Button size="small" icon={<CloseOutlined />} onClick={cancelRefresh} type="text" danger />
                </div>
                <Progress percent={refreshProgress.percent} showInfo={false} size="small"
                  strokeColor={{ '0%': '#4fc3f7', '100%': '#4ade80' }}
                  trailColor="var(--border-default)"
                  status={refreshProgress.phase === 'error' ? 'exception' : 'active'}
                />
              </div>
            )}

            <Spin spinning={hotTopicsLoading}>
              {filteredTopics.length === 0 ? (
                <Empty description="暂无热点数据" />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filteredTopics.map((topic, i) => (
                    <div
                      key={topic.id}
                      onClick={() => handleSelectHot(topic.id)}
                      className="stagger-in"
                      style={{
                        padding: '10px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor:
                          selectedHotId === topic.id
                            ? 'var(--accent-gold)'
                            : 'transparent',
                        background:
                          selectedHotId === topic.id
                            ? 'rgba(212,168,83,0.08)'
                            : 'transparent',
                        animationDelay: `${i * 0.02}s`,
                        transition: 'all 0.2s var(--ease-out)',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedHotId !== topic.id) {
                          e.currentTarget.style.background = 'var(--bg-card-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedHotId !== topic.id) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span>{PLATFORM_ICONS[topic.source_platform]}</span>
                        <Tag
                          color="gold"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: 10, margin: 0, lineHeight: '18px' }}
                        >
                          {topic.hot_index}°
                        </Tag>
                        <span style={{
                          flex: 1,
                          fontSize: 13,
                          color: 'var(--text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}>
                          {topic.title.replace(/（第\d+期）$/, '')}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span style={{ color: TREND_COLORS[topic.trend] }}>
                          {TREND_LABELS[topic.trend]}
                        </span>
                        <span>{PLATFORM_LABELS[topic.source_platform]}</span>
                        <span>{topic.audience}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Spin>
          </Card>
        </Col>

        {/* Right: AI Analysis + Generated Suggestions */}
        <Col xs={24} lg={15}>
          {/* AI Analysis Panel */}
          {selectedHot && (
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BarChartOutlined style={{ color: 'var(--accent-cyan)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em' }}>
                    AI 分析报告
                  </span>
                </div>
              }
              style={{ marginBottom: 20 }}
            >
              <Spin spinning={analysisLoading}>
                {analysis ? (
                  <Descriptions column={2} size="small">
                    <Descriptions.Item label="话题">
                      {analysis.topic}
                    </Descriptions.Item>
                    <Descriptions.Item label="受众人群">
                      {analysis.target_audience}
                    </Descriptions.Item>
                    <Descriptions.Item label="热度等级">
                      <Tag color="gold">{analysis.hot_degree}</Tag>
                    </Descriptions.Item>
                    <Descriptions.Item label="预估阅读量">
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                        {analysis.estimated_readers}
                      </span>
                    </Descriptions.Item>
                    <Descriptions.Item label="情感分布" span={2}>
                      <Space>
                        <Tag color="green">正面 {analysis.sentiment_ratio.positive}</Tag>
                        <Tag color="blue">中性 {analysis.sentiment_ratio.neutral}</Tag>
                        <Tag color="red">负面 {analysis.sentiment_ratio.negative}</Tag>
                      </Space>
                    </Descriptions.Item>
                    <Descriptions.Item label="分析摘要" span={2}>
                      <p style={{ color: 'var(--text-secondary)', margin: 0, lineHeight: 1.8 }}>
                        {analysis.analysis}
                      </p>
                    </Descriptions.Item>
                  </Descriptions>
                ) : (
                  <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <p>点击左侧热点话题进行AI分析</p>
                  </div>
                )}
              </Spin>

              {/* Generation Controls */}
              <Divider style={{ borderColor: 'var(--border-default)', margin: '16px 0' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>生成参数:</span>
                <Select
                  value={stylePreference}
                  onChange={setStylePreference}
                  style={{ width: 130 }}
                  options={Object.entries(STYLE_LABELS).map(([k, v]) => ({ value: k, label: v }))}
                />
                <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>数量:</span>
                <Slider
                  min={1}
                  max={5}
                  value={generationCount}
                  onChange={setGenerationCount}
                  style={{ width: 120 }}
                />
                <Button
                  type="primary"
                  icon={<ThunderboltOutlined />}
                  onClick={handleGenerate}
                  loading={generatingTopics}
                  size="large"
                >
                  AI 生成选题
                </Button>
              </div>
            </Card>
          )}

          {/* Generated Suggestions */}
          {suggestions.length > 0 && (
            <Card
              title={
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <BulbOutlined style={{ color: 'var(--accent-gold)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em' }}>
                    AI 选题建议
                  </span>
                </div>
              }
            >
              {/* Analysis Text */}
              {suggestionAnalysis && (
                <div
                  style={{
                    padding: '12px 16px',
                    marginBottom: 20,
                    borderRadius: 8,
                    background: 'rgba(79,195,247,0.05)',
                    border: '1px solid rgba(79,195,247,0.1)',
                    fontSize: 13,
                    color: 'var(--accent-cyan)',
                    lineHeight: 1.8,
                  }}
                >
                  💡 {suggestionAnalysis}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {suggestions.map((s, i) => (
                  <div
                    key={i}
                    className="stagger-in"
                    style={{
                      padding: '20px',
                      borderRadius: 10,
                      background: 'var(--bg-card)',
                      border: '1px solid var(--border-default)',
                      animationDelay: `${i * 0.1}s`,
                      transition: 'all 0.2s var(--ease-out)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                      <div style={{ flex: 1 }}>
                        <h3 style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 16,
                          fontWeight: 400,
                          color: 'var(--text-primary)',
                          margin: '0 0 8px',
                          letterSpacing: '-0.01em',
                        }}>
                          {s.title}
                        </h3>
                        <p style={{
                          fontSize: 13,
                          color: 'var(--text-secondary)',
                          margin: '0 0 12px',
                          lineHeight: 1.7,
                        }}>
                          {s.description}
                        </p>
                        <Space size="small" wrap>
                          <Tag color="cyan">{CONTENT_TYPE_LABELS[s.content_type || 'article']}</Tag>
                          <Tag>{STYLE_LABELS[s.style || 'professional']}</Tag>
                          <Tag color="purple">{s.target_audience}</Tag>
                          <Tag color="gold">
                            {'★'.repeat(s.priority || 0)}
                            {'☆'.repeat(5 - (s.priority || 0))}
                          </Tag>
                        </Space>
                      </div>
                      <Tooltip title="保存选题">
                        <Button
                          type="primary"
                          icon={<SaveOutlined />}
                          loading={savingIds.has(i)}
                          onClick={() => handleSaveSuggestion(s, i)}
                        >
                          保存
                        </Button>
                      </Tooltip>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Button onClick={() => navigate('/topics')}>
                  前往选题列表查看
                </Button>
              </div>
            </Card>
          )}

          {/* Empty state when no hot topic selected */}
          {!selectedHot && (
            <Card>
              <Empty
                description={
                  <span style={{ color: 'var(--text-muted)' }}>
                    选择左侧热点话题，AI 将为您生成选题建议
                  </span>
                }
              />
            </Card>
          )}
        </Col>
      </Row>
    </div>
  );
}
