import { useEffect, useState, useMemo } from 'react';
import { Row, Col, Card, Statistic, Tag, Spin, Progress, Button } from 'antd';
import {
  FireOutlined,
  RiseOutlined,
  BulbOutlined,
  ThunderboltOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  MinusOutlined,
  CloseOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { useTopicStore } from '../stores/topicStore';
import {
  PLATFORM_LABELS,
  PLATFORM_COLORS,
  TREND_LABELS,
  SENTIMENT_LABELS,
  STATUS_LABELS,
  STATUS_COLORS,
} from '../types';
import type { HotTopic, Topic } from '../types';

// Platform icon map (using emoji as distinctive choice)
const PLATFORM_ICONS: Record<string, string> = {
  weibo: '🔴',
  zhihu: '🔵',
  douyin: '🎵',
  baidu: '🔍',
  sohu: '🦊',
};

export default function Dashboard() {
  const {
    hotTopics,
    hotTopicsLoading,
    topics,
    topicsLoading,
    loadHotTopics,
    loadTopics,
    refreshHotTopicsStream,
    cancelRefresh,
    refreshProgress,
  } = useTopicStore();

  const [hotPage, _] = useState(1);

  useEffect(() => {
    loadHotTopics({ page_size: 25 });
    loadTopics({ page_size: 100 });
  }, []);

  // 清理：组件卸载时取消流式刷新
  useEffect(() => {
    return () => {
      cancelRefresh();
    };
  }, []);

  const platformStats = useMemo(() => {
    const map: Record<string, { count: number; totalIndex: number; items: HotTopic[] }> = {};
    hotTopics.forEach((t) => {
      if (!map[t.source_platform]) map[t.source_platform] = { count: 0, totalIndex: 0, items: [] };
      map[t.source_platform].count++;
      map[t.source_platform].totalIndex += t.hot_index;
      map[t.source_platform].items.push(t);
    });
    return Object.entries(map).sort((a, b) => b[1].totalIndex - a[1].totalIndex);
  }, [hotTopics]);

  const topicStatusStats = useMemo(() => {
    const map: Record<string, number> = {};
    topics.forEach((t) => {
      map[t.status] = (map[t.status] || 0) + 1;
    });
    return map;
  }, [topics]);

  const sentimentData = useMemo(() => {
    const map: Record<string, number> = { positive: 0, neutral: 0, negative: 0, mixed: 0 };
    hotTopics.forEach((t) => { map[t.sentiment] = (map[t.sentiment] || 0) + 1; });
    return map;
  }, [hotTopics]);

  const topHot = hotTopics.slice(0, 3);
  const hotTopicCount = hotTopics.length;
  const dedupCount = hotTopics.filter(t => t.duplicate_of_id !== null).length;
  const uniqueCount = hotTopicCount - dedupCount;

  // ECharts options
  const platformChartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 20, top: 20, bottom: 30 },
    xAxis: {
      type: 'category',
      data: platformStats.map(([p]) => PLATFORM_LABELS[p] || p),
      axisLabel: { color: '#8b95a8', fontSize: 11, fontFamily: 'var(--font-mono)' },
      axisLine: { lineStyle: { color: '#1e2a3a' } },
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#8b95a8', fontSize: 11, fontFamily: 'var(--font-mono)' },
      splitLine: { lineStyle: { color: '#1e2a3a' } },
    },
    series: [
      {
        name: '热点数量',
        type: 'bar',
        data: platformStats.map(([, s]) => s.count),
        itemStyle: {
          borderRadius: [4, 4, 0, 0],
          color: (params: any) => {
            const colors = ['#d4a853', '#4fc3f7', '#4ade80', '#f06565', '#a78bfa'];
            return colors[params.dataIndex % colors.length];
          },
        },
        barWidth: 32,
      },
    ],
  }), [platformStats]);

  const sentimentChartOption = useMemo(() => ({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item' },
    series: [
      {
        type: 'pie',
        radius: ['55%', '80%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        itemStyle: { borderRadius: 4, borderColor: '#0b0f19', borderWidth: 3 },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 14, fontWeight: 'bold', color: '#e8ecf1' },
        },
        data: [
          { value: sentimentData.positive, name: '正面', itemStyle: { color: '#4ade80' } },
          { value: sentimentData.neutral, name: '中性', itemStyle: { color: '#4fc3f7' } },
          { value: sentimentData.negative, name: '负面', itemStyle: { color: '#f06565' } },
          { value: sentimentData.mixed, name: '混合', itemStyle: { color: '#a78bfa' } },
        ].filter((d) => d.value > 0),
      },
    ],
  }), [sentimentData]);

  const trendingIcon = (trend: string) => {
    if (trend === 'rising') return <ArrowUpOutlined style={{ color: 'var(--accent-mint)' }} />;
    if (trend === 'falling') return <ArrowDownOutlined style={{ color: 'var(--accent-coral)' }} />;
    return <MinusOutlined style={{ color: 'var(--text-muted)' }} />;
  };

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Hero Banner */}
      <div
        style={{
          position: 'relative',
          padding: '32px 40px',
          marginBottom: 32,
          borderRadius: 12,
          background: 'linear-gradient(135deg, rgba(212,168,83,0.08) 0%, rgba(79,195,247,0.04) 50%, rgba(11,15,25,0.4) 100%)',
          border: '1px solid var(--border-default)',
          overflow: 'hidden',
        }}
      >
        {/* Decorative line */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 2,
          background: 'linear-gradient(90deg, var(--accent-gold), var(--accent-cyan), transparent)',
        }} />

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              color: 'var(--accent-gold)',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              marginBottom: 8,
            }}>
              Phase 1 · Module Active
            </div>
            <h1 style={{
              fontFamily: 'var(--font-display)',
              fontSize: 36,
              fontWeight: 400,
              color: 'var(--text-primary)',
              margin: '0 0 8px',
              letterSpacing: '-0.02em',
            }}>
              选题策划指挥中心
            </h1>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: 15,
              maxWidth: 500,
              margin: 0,
            }}>
              实时热点监控 · AI 智能选题 · 多平台内容策划
            </p>
          </div>

          {/* Live indicator + Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Button
              icon={<ReloadOutlined spin={hotTopicsLoading} />}
              onClick={refreshHotTopicsStream}
              loading={false}
              disabled={hotTopicsLoading}
              size="small"
              style={{
                background: 'rgba(74,222,128,0.06)',
                border: '1px solid rgba(74,222,128,0.12)',
                color: 'var(--accent-mint)',
              }}
            >
              {hotTopicsLoading ? '刷新中…' : '流式刷新'}
            </Button>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '8px 16px',
              borderRadius: 20,
              background: 'rgba(74,222,128,0.08)',
              border: '1px solid rgba(74,222,128,0.15)',
            }}>
              <div style={{
                width: 8, height: 8,
                borderRadius: '50%',
                background: 'var(--accent-mint)',
                animation: 'pulse 2s infinite',
              }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-mint)' }}>
                LIVE · {hotTopicCount} 条热点 · 5 平台
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 🔄 Streaming Refresh Progress Bar */}
      {refreshProgress && (
        <div
          style={{
            marginBottom: 24,
            padding: '16px 20px',
            borderRadius: 10,
            background: 'linear-gradient(135deg, rgba(212,168,83,0.08) 0%, rgba(79,195,247,0.06) 100%)',
            border: '1px solid var(--border-default)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{refreshProgress.icon}</span>
              <div>
                <div style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  color: 'var(--accent-gold)',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                }}>
                  {refreshProgress.phase === 'error' ? 'REFRESH ERROR' : 'STREAMING REFRESH'}
                </div>
                <div style={{
                  fontSize: 14,
                  color: refreshProgress.phase === 'error' ? 'var(--accent-coral)' : 'var(--text-primary)',
                  marginTop: 2,
                }}>
                  {refreshProgress.message}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {refreshProgress.phase !== 'error' && (
                <span style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 14,
                  color: 'var(--accent-cyan)',
                }}>
                  {refreshProgress.percent}%
                </span>
              )}
              <Button
                size="small"
                icon={<CloseOutlined />}
                onClick={cancelRefresh}
                danger={refreshProgress.phase === 'error'}
                type={refreshProgress.phase === 'error' ? 'primary' : 'default'}
              >
                {refreshProgress.phase === 'error' ? '关闭' : '取消'}
              </Button>
            </div>
          </div>
          {refreshProgress.phase !== 'error' && (
            <Progress
              percent={refreshProgress.percent}
              showInfo={false}
              strokeColor={{
                '0%': '#4fc3f7',
                '50%': '#d4a853',
                '100%': '#4ade80',
              }}
              trailColor="var(--border-default)"
              size="small"
              status={refreshProgress.phase === 'error' ? 'exception' : 'active'}
            />
          )}
        </div>
      )}

      {/* Stats Row */}
      <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ height: '100%' }}>
            <Spin spinning={hotTopicsLoading}>
              <Statistic
                title="热点总数"
                value={hotTopicCount}
                prefix={<FireOutlined style={{ color: 'var(--accent-coral)', fontSize: 20 }} />}
                valueStyle={{ fontFamily: 'var(--font-display)', fontSize: 28 }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                覆盖 {platformStats.length} 个平台 · {uniqueCount} 条有效热点
              </div>
            </Spin>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ height: '100%' }}>
            <Spin spinning={hotTopicsLoading}>
              <Statistic
                title="平均热度指数"
                value={hotTopics.length ? Math.round(hotTopics.reduce((s, t) => s + t.hot_index, 0) / hotTopics.length) : 0}
                prefix={<RiseOutlined style={{ color: 'var(--accent-cyan)', fontSize: 20 }} />}
                valueStyle={{ fontFamily: 'var(--font-display)', fontSize: 28 }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                热度指数 · 0-1000
              </div>
            </Spin>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ height: '100%' }}>
            <Spin spinning={topicsLoading}>
              <Statistic
                title="选题总数"
                value={topics.length}
                prefix={<BulbOutlined style={{ color: 'var(--accent-gold)', fontSize: 20 }} />}
                valueStyle={{ fontFamily: 'var(--font-display)', fontSize: 28 }}
              />
              <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
                {topicStatusStats['scheduled'] || 0} 个已排期
              </div>
            </Spin>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ height: '100%' }}>
            <Statistic
              title="AI 生成能力"
              value="就绪"
              prefix={<ThunderboltOutlined style={{ color: 'var(--accent-purple)', fontSize: 20 }} />}
              valueStyle={{ fontFamily: 'var(--font-display)', fontSize: 24, color: 'var(--accent-mint)' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-muted)' }}>
              Mock · Coze Standby
            </div>
          </Card>
        </Col>
      </Row>

      {/* Charts Row */}
      <Row gutter={[20, 20]} style={{ marginBottom: 32 }}>
        <Col xs={24} lg={14}>
          <Card title={
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Platform Distribution
            </span>
          }>
            <ReactECharts option={platformChartOption} style={{ height: 280 }} />
          </Card>
        </Col>
        <Col xs={24} lg={10}>
          <Card title={
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
              Sentiment Analysis
            </span>
          }>
            <ReactECharts option={sentimentChartOption} style={{ height: 280 }} />
          </Card>
        </Col>
      </Row>

      {/* Hot Topics Feed */}
      <Row gutter={[20, 20]}>
        <Col xs={24} lg={14}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FireOutlined style={{ color: 'var(--accent-coral)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  实时热榜 TOP {hotTopics.length}
                </span>
              </div>
            }
            style={{ height: '100%' }}
          >
            <Spin spinning={hotTopicsLoading}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {hotTopics.slice(0, 15).map((topic, i) => {
                  const isDuplicate = topic.duplicate_of_id !== null;
                  return (
                  <div
                    key={topic.id}
                    className="stagger-in"
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '10px 14px',
                      borderRadius: 6,
                      background: i === 0 ? 'rgba(212,168,83,0.06)' : isDuplicate ? 'rgba(160,160,160,0.03)' : 'transparent',
                      border: i === 0 ? '1px solid rgba(212,168,83,0.15)' : isDuplicate ? '1px solid rgba(160,160,160,0.08)' : '1px solid transparent',
                      animationDelay: `${i * 0.04}s`,
                      transition: 'all 0.2s var(--ease-out)',
                      cursor: 'default',
                      opacity: isDuplicate ? 0.55 : 1,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isDuplicate ? 'rgba(160,160,160,0.06)' : 'var(--bg-card-hover)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = i === 0 ? 'rgba(212,168,83,0.06)' : isDuplicate ? 'rgba(160,160,160,0.03)' : 'transparent';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{
                        fontFamily: 'var(--font-display)',
                        fontSize: 18,
                        color: i < 3 ? 'var(--accent-gold)' : 'var(--text-muted)',
                        minWidth: 28,
                        textAlign: 'center',
                      }}>
                        {isDuplicate ? '~' : i + 1}
                      </span>
                      <span style={{ fontSize: 12 }}>{PLATFORM_ICONS[topic.source_platform]}</span>
                      <span style={{
                        flex: 1,
                        color: 'var(--text-primary)',
                        fontSize: 14,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {topic.title.replace(/（第\d+期）$/, '')}
                      </span>
                      <Tag color="gold" style={{ fontFamily: 'var(--font-mono)', fontSize: 10, margin: 0 }}>
                        {topic.hot_index}°
                      </Tag>
                      {trendingIcon(topic.trend)}
                      {isDuplicate && (
                        <Tag color="default" style={{ fontFamily: 'var(--font-mono)', fontSize: 9, margin: 0 }}>
                          重复#{topic.duplicate_of_id}
                        </Tag>
                      )}
                    </div>
                    {/* Summary preview for top items */}
                    {i < 5 && topic.summary && (
                      <div style={{
                        marginTop: 6,
                        marginLeft: 52,
                        fontSize: 12,
                        color: 'var(--text-muted)',
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {topic.summary}
                      </div>
                    )}
                    {isDuplicate && topic.summary && (
                      <div style={{
                        marginTop: 4,
                        marginLeft: 52,
                        fontSize: 11,
                        color: 'var(--text-muted)',
                        lineHeight: 1.4,
                        display: '-webkit-box',
                        WebkitLineClamp: 1,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        fontStyle: 'italic',
                      }}>
                        {topic.summary.slice(0, 80)}……
                      </div>
                    )}
                  </div>
                )})}
              </div>
            </Spin>
          </Card>
        </Col>

        {/* Topic Status Summary */}
        <Col xs={24} lg={10}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BulbOutlined style={{ color: 'var(--accent-gold)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-secondary)' }}>
                  选题状态
                </span>
              </div>
            }
            style={{ height: '100%' }}
          >
            <Spin spinning={topicsLoading}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {Object.entries(STATUS_LABELS).map(([key, label]) => {
                  const count = topicStatusStats[key] || 0;
                  const pct = topics.length ? Math.round((count / topics.length) * 100) : 0;
                  return (
                    <div key={key}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <Tag color={STATUS_COLORS[key]}>{label}</Tag>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--text-secondary)' }}>
                          {count} · {pct}%
                        </span>
                      </div>
                      <Progress
                        percent={pct}
                        showInfo={false}
                        strokeColor={{
                          '0%': key === 'completed' ? '#4ade80' : key === 'scheduled' ? '#d4a853' : '#4fc3f7',
                          '100%': key === 'completed' ? '#4ade80' : key === 'scheduled' ? '#d4a853' : '#a78bfa',
                        }}
                        trailColor="var(--border-default)"
                        size="small"
                      />
                    </div>
                  );
                })}
              </div>
            </Spin>
          </Card>
        </Col>
      </Row>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
