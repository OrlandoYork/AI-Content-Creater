import { useEffect, useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
  Tabs,
  Slider,
  Empty,
  Tooltip,
  Descriptions,
} from 'antd';
import {
  ThunderboltOutlined,
  EditOutlined,
  SaveOutlined,
  ArrowLeftOutlined,
  ReloadOutlined,
  BulbOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
  PictureOutlined,
  ShareAltOutlined,
  ExpandOutlined,
  ScissorOutlined,
  FormatPainterOutlined,
} from '@ant-design/icons';
import { useTopicStore } from '../../stores/topicStore';
import { useContentStore } from '../../stores/contentStore';
import {
  CONTENT_TYPE_LABELS,
  STYLE_LABELS,
  CONTENT_STATUS_LABELS,
  REWRITE_LABELS,
} from '../../types';
import type { ContentType, ContentStyle, Topic, ContentGenerateResponse } from '../../types';

const { TextArea } = Input;

const TYPE_ICONS: Record<string, React.ReactNode> = {
  article: <FileTextOutlined />,
  video_script: <VideoCameraOutlined />,
  poster_copy: <PictureOutlined />,
  social_post: <ShareAltOutlined />,
};

const TYPE_COLORS: Record<string, string> = {
  article: 'var(--accent-cyan)',
  video_script: 'var(--accent-purple)',
  poster_copy: 'var(--accent-gold)',
  social_post: 'var(--accent-mint)',
};

export default function ContentEditor() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editContentId = searchParams.get('id');  // ?id=N 加载已有内容

  // Topic store
  const { topics, loadTopics } = useTopicStore();

  // Content store
  const {
    generatingContent,
    generatedResult,
    rewritingContent,
    generatingTitles,
    generatedTitles,
    currentContent,
    generateContent,
    generateTitles,
    rewriteContent,
    clearGeneratedResult,
    clearGeneratedTitles,
    updateContent,
    loadContentDetail,
    clearCurrentContent,
    currentContentLoading,
  } = useContentStore();

  // Form state
  const [selectedTopicId, setSelectedTopicId] = useState<number | null>(null);
  const [contentType, setContentType] = useState<ContentType>('article');
  const [style, setStyle] = useState<ContentStyle>('professional');
  const [editingTitle, setEditingTitle] = useState('');
  const [editingBody, setEditingBody] = useState('');
  const [saving, setSaving] = useState(false);

  // Topic search
  const [topicSearch, setTopicSearch] = useState('');

  // 判断模式：新建 / 查看编辑已有
  const isViewMode = !!editContentId;

  useEffect(() => {
    loadTopics({ page_size: 100 });
    if (editContentId) {
      loadContentDetail(Number(editContentId));
    }
    return () => { clearGeneratedResult(); clearCurrentContent(); };
  }, [editContentId]);

  // 已有内容 → 填入编辑状态
  useEffect(() => {
    if (isViewMode && currentContent) {
      setEditingTitle(currentContent.title);
      setEditingBody(currentContent.body);
      setContentType(currentContent.content_type as ContentType);
      setStyle(currentContent.style as ContentStyle);
      if (currentContent.topic_id) {
        setSelectedTopicId(currentContent.topic_id);
      }
    }
  }, [isViewMode, currentContent]);

  const selectedTopic = useMemo(
    () => topics.find((t) => t.id === selectedTopicId) || null,
    [topics, selectedTopicId]
  );

  const filteredTopics = useMemo(() => {
    if (!topicSearch) return topics;
    return topics.filter((t) =>
      t.title.toLowerCase().includes(topicSearch.toLowerCase())
    );
  }, [topics, topicSearch]);

  // 选择选题时自动继承其类型和风格
  const handleSelectTopic = (id: number) => {
    setSelectedTopicId(id);
    const topic = topics.find((t) => t.id === id);
    if (topic) {
      if (topic.content_type) setContentType(topic.content_type as ContentType);
      if (topic.style) setStyle(topic.style as ContentStyle);
    }
  };

  // Sync editing state when generated result changes
  useEffect(() => {
    if (generatedResult) {
      setEditingTitle(generatedResult.title);
      setEditingBody(generatedResult.body);
    }
  }, [generatedResult]);

  const handleGenerate = async () => {
    if (!selectedTopicId) {
      message.warning('请先选择一个选题');
      return;
    }
    clearGeneratedResult();
    clearGeneratedTitles();
    await generateContent({
      topic_id: selectedTopicId,
      content_type: contentType,
      style,
    });
  };

  const handleSave = async () => {
    // 查看模式：保存 currentContent；生成模式：保存 generatedResult
    const targetId = isViewMode ? currentContent?.id : generatedResult?.id;
    if (!targetId) return;
    setSaving(true);
    try {
      await updateContent(targetId, {
        title: editingTitle,
        body: editingBody,
        status: 'completed',
      });
      message.success('内容已保存');
    } catch {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleRewrite = async (instruction: 'rewrite' | 'polish' | 'expand') => {
    const targetId = isViewMode ? currentContent?.id : generatedResult?.id;
    if (!targetId) return;
    try {
      const result = await rewriteContent(targetId, {
        instruction,
        style,
      });
      if (result) {
        setEditingTitle(result.title);
        setEditingBody(result.body);
        message.success(`${REWRITE_LABELS[instruction]}完成`);
      }
    } catch {
      message.error(`${REWRITE_LABELS[instruction]}失败`);
    }
  };

  const handleGenerateTitles = async () => {
    if (!editingBody.trim()) return;
    try {
      await generateTitles(editingBody, contentType, 5);
    } catch {
      message.error('标题生成失败');
    }
  };

  const handleUseTitle = (title: string) => {
    setEditingTitle(title);
    message.success('标题已应用');
  };

  // ==================== Render helpers ====================

  const renderArticleBody = (body: string) => (
    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.9, fontSize: 14, color: 'var(--text-primary)' }}>
      {body}
    </div>
  );

  const renderVideoScript = (body: string) => {
    const tryParse = (text: string) => {
      try {
        const result = JSON.parse(text);
        if (Array.isArray(result)) return result;
        return null;
      } catch {
        return null;
      }
    };

    // 第一层：直接解析
    let shots = tryParse(body);

    // 第二层：清理常见前缀和 markdown 标记后再试
    if (!shots) {
      let cleaned = body
        .replace(/^[（(]以下[为是].*?[版本内容][)）]?\s*\n*/g, '')
        .replace(/^[（(]以下.*?(?:版本|内容)[)）]?\s*\n*/g, '')
        .replace(/^```(?:json)?\s*\n?/, '')
        .replace(/\n?\s*```$/, '')
        .trim();
      shots = tryParse(cleaned);
    }

    // 第三层：从文本中提取 JSON 数组
    if (!shots) {
      const arrMatch = body.match(/\[[\s\S]*\]/);
      if (arrMatch) {
        shots = tryParse(arrMatch[0]);
      }
    }

    if (!shots) return <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8 }}>{body}</div>;
      return (
        <div style={{ overflow: 'auto' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            fontSize: 12,
          }}>
            <thead>
              <tr style={{ background: 'var(--bg-surface)' }}>
                <th style={{ padding: '8px 10px', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, width: 60, textAlign: 'center' }}>分镜</th>
                <th style={{ padding: '8px 10px', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, width: 60, textAlign: 'center' }}>时长</th>
                <th style={{ padding: '8px 10px', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 180 }}>画面</th>
                <th style={{ padding: '8px 10px', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 130 }}>台词</th>
                <th style={{ padding: '8px 10px', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 100 }}>字幕</th>
                <th style={{ padding: '8px 10px', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', fontFamily: 'var(--font-mono)', fontSize: 11, minWidth: 120 }}>音效/BGM</th>
              </tr>
            </thead>
            <tbody>
              {shots.map((shot: any, i: number) => (
                <tr key={i} style={{
                  background: i % 2 === 0 ? 'transparent' : 'var(--bg-card-hover)',
                }}>
                  <td style={{ padding: '8px 10px', border: '1px solid var(--border-default)', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--accent-gold)' }}>
                    {shot.shot_number || i + 1}
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid var(--border-default)', textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                    {shot.duration || '-'}
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid var(--border-default)', color: 'var(--text-primary)', lineHeight: 1.6 }}>
                    {shot.visual || '-'}
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid var(--border-default)', color: 'var(--text-secondary)', lineHeight: 1.5, fontStyle: 'italic' }}>
                    {shot.dialogue || '—'}
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid var(--border-default)', color: 'var(--accent-cyan)', lineHeight: 1.5 }}>
                    {shot.subtitle || '—'}
                  </td>
                  <td style={{ padding: '8px 10px', border: '1px solid var(--border-default)', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {shot.bgm || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  };

  const renderPosterCopy = (body: string, imagePrompt?: string) => {
    try {
      const data = JSON.parse(body);
      return (
        <div>
          <Card
            size="small"
            title={
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-gold)', letterSpacing: '0.05em' }}>
                📋 海报文案
              </span>
            }
            style={{ marginBottom: 16 }}
          >
            <div style={{ whiteSpace: 'pre-wrap', lineHeight: 2, fontSize: 15, color: 'var(--text-primary)', textAlign: 'center', padding: '20px 0' }}>
              {data.copy || body}
            </div>
          </Card>
          {(imagePrompt || data.image_prompt) && (
            <Card
              size="small"
              title={
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-purple)', letterSpacing: '0.05em' }}>
                  🎨 AI 生图提示词
                </span>
              }
            >
              <div style={{
                padding: '12px 16px',
                borderRadius: 8,
                background: 'rgba(167,139,250,0.06)',
                border: '1px solid rgba(167,139,250,0.12)',
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.8,
                whiteSpace: 'pre-wrap',
              }}>
                {imagePrompt || data.image_prompt}
              </div>
              <div style={{ marginTop: 12, textAlign: 'right' }}>
                <Tag color="purple" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                  🔮 待对接生图模型 (SD / DALL·E / Midjourney)
                </Tag>
              </div>
            </Card>
          )}
        </div>
      );
    } catch {
      return <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.8, fontSize: 15 }}>{body}</div>;
    }
  };

  const renderSocialPost = (body: string) => (
    <div style={{
      whiteSpace: 'pre-wrap',
      lineHeight: 1.9,
      fontSize: 14,
      color: 'var(--text-primary)',
      padding: '16px 20px',
      borderRadius: 10,
      background: 'var(--bg-surface)',
      border: '1px solid var(--border-default)',
    }}>
      {body}
    </div>
  );

  const renderBody = (result: ContentGenerateResponse) => {
    switch (result.content_type) {
      case 'video_script': return renderVideoScript(result.body);
      case 'poster_copy': return renderPosterCopy(result.body, result.image_prompt);
      case 'social_post': return renderSocialPost(result.body);
      default: return renderArticleBody(result.body);
    }
  };

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <Button
          type="text"
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/content')}
          style={{ marginBottom: 12, color: 'var(--text-secondary)' }}
        >
          返回内容列表
        </Button>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, margin: 0 }}>
          AI 内容创作
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginTop: 4 }}>
          选择选题 → 选择类型与风格 → AI 智能生成 → 编辑优化 → 一键保存
        </p>
      </div>

      <Row gutter={20}>
        {/* Left: Controls */}
        <Col xs={24} lg={8}>
          {/* Step 1: Topic Selection */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <BulbOutlined style={{ color: 'var(--accent-gold)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em' }}>
                  步骤 1 · 选择选题
                </span>
              </div>
            }
            style={{ marginBottom: 20 }}
          >
            <Input
              placeholder="搜索选题..."
              prefix={<span style={{ color: 'var(--text-muted)' }}>🔍</span>}
              value={topicSearch}
              onChange={(e) => setTopicSearch(e.target.value)}
              style={{ marginBottom: 12 }}
              allowClear
            />
            <div style={{ maxHeight: 240, overflow: 'auto' }}>
              {filteredTopics.length === 0 ? (
                <Empty description="暂无选题" image={Empty.PRESENTED_IMAGE_SIMPLE} />
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {filteredTopics.slice(0, 20).map((topic) => (
                    <div
                      key={topic.id}
                      onClick={() => handleSelectTopic(topic.id)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        border: '1px solid',
                        borderColor:
                          selectedTopicId === topic.id
                            ? 'var(--accent-gold)'
                            : 'transparent',
                        background:
                          selectedTopicId === topic.id
                            ? 'rgba(212,168,83,0.08)'
                            : 'transparent',
                        transition: 'all 0.2s var(--ease-out)',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedTopicId !== topic.id) {
                          e.currentTarget.style.background = 'var(--bg-card-hover)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (selectedTopicId !== topic.id) {
                          e.currentTarget.style.background = 'transparent';
                        }
                      }}
                    >
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', marginBottom: 4 }}>
                        {topic.title}
                      </div>
                      <Space size="small">
                        <Tag color="cyan" style={{ fontSize: 10 }}>
                          {CONTENT_TYPE_LABELS[topic.content_type]}
                        </Tag>
                        <Tag style={{ fontSize: 10 }}>{STYLE_LABELS[topic.style]}</Tag>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {topic.target_audience}
                        </span>
                      </Space>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Step 2: Content Type (风格继承自选题) */}
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <EditOutlined style={{ color: 'var(--accent-cyan)' }} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em' }}>
                  步骤 2 · 内容类型
                </span>
                {selectedTopic && (
                  <Tag color="gold" style={{ fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                    风格继承自选题：{STYLE_LABELS[style] || style}
                  </Tag>
                )}
              </div>
            }
            style={{ marginBottom: 20 }}
          >
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(Object.entries(CONTENT_TYPE_LABELS) as [ContentType, string][]).map(
                ([key, label]) => (
                  <Button
                    key={key}
                    type={contentType === key ? 'primary' : 'default'}
                    icon={TYPE_ICONS[key]}
                    onClick={() => setContentType(key)}
                    style={{
                      borderColor: contentType === key ? undefined : TYPE_COLORS[key],
                      color: contentType === key ? undefined : TYPE_COLORS[key],
                      opacity: contentType === key ? 1 : 0.7,
                      transition: 'all 0.2s var(--ease-out)',
                    }}
                  >
                    {label}
                  </Button>
                )
              )}
            </div>
          </Card>

          {/* Step 3: Generate (新建模式) */}
          {!isViewMode && (
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={handleGenerate}
              loading={generatingContent}
              disabled={!selectedTopicId}
              block
              size="large"
            >
              {generatingContent ? 'AI 生成中…' : 'AI 生成内容'}
            </Button>
          )}
        </Col>

        {/* Right: Result */}
        <Col xs={24} lg={16}>
          {(() => {
            const displayContent = generatedResult || currentContent;
            if (!displayContent) {
              return (
                <Card style={{ minHeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Spin spinning={generatingContent || currentContentLoading}>
                    <Empty
                      description={
                        <span style={{ color: 'var(--text-muted)' }}>
                          {generatingContent ? 'AI 正在创作中……' : '选择左侧的选题，设置类型和风格，点击"AI 生成内容"开始创作'}
                        </span>
                      }
                    />
                  </Spin>
                </Card>
              );
            }
            return (
            <>
              {/* Result Header */}
              <Card
                style={{ marginBottom: 20 }}
                title={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="cyan">{CONTENT_TYPE_LABELS[displayContent.content_type]}</Tag>
                    <Tag>{STYLE_LABELS[displayContent.style]}</Tag>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-muted)' }}>
                      {displayContent.word_count.toLocaleString()} 字/分镜
                    </span>
                    {(displayContent as any).visual_style && (
                      <Tag color="purple" style={{ maxWidth: 200 }} title={(displayContent as any).visual_style}>
                        视觉风格
                      </Tag>
                    )}
                    {isViewMode && (
                      <Tag color="gold" style={{ fontFamily: 'var(--font-mono)', fontSize: 10 }}>
                        已有内容
                      </Tag>
                    )}
                  </div>
                }
                extra={
                  <Space>
                    <Button
                      icon={<SaveOutlined />}
                      type="primary"
                      onClick={handleSave}
                      loading={saving}
                    >
                      保存
                    </Button>
                  </Space>
                }
              >
                {/* Title Edit */}
                <div style={{ marginBottom: 16 }}>
                  <Input
                    value={editingTitle}
                    onChange={(e) => setEditingTitle(e.target.value)}
                    style={{
                      fontSize: 18,
                      fontWeight: 500,
                      fontFamily: 'var(--font-display)',
                      border: 'none',
                      padding: 0,
                      background: 'transparent',
                    }}
                    placeholder="内容标题"
                  />
                </div>

                <Divider style={{ borderColor: 'var(--border-default)', margin: '12px 0' }} />

                {/* Body Preview / Edit */}
                <div style={{ marginBottom: 16, maxHeight: 500, overflow: 'auto' }}>
                  {renderBody(displayContent)}
                </div>

                <Divider style={{ borderColor: 'var(--border-default)', margin: '12px 0' }} />

                {/* Edit Body */}
                <TextArea
                  value={editingBody}
                  onChange={(e) => setEditingBody(e.target.value)}
                  rows={8}
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 13,
                    lineHeight: 1.7,
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border-default)',
                  }}
                  placeholder="编辑内容正文..."
                />
              </Card>

              {/* Actions: Rewrite + Titles */}
              <Row gutter={[16, 16]}>
                {/* Rewrite Actions */}
                <Col xs={24} lg={12}>
                  <Card
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <FormatPainterOutlined style={{ color: 'var(--accent-coral)' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em' }}>
                          AI 改写
                        </span>
                      </div>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      {(Object.entries(REWRITE_LABELS) as [string, string][]).map(([key, label]) => (
                        <Button
                          key={key}
                          block
                          loading={rewritingContent}
                          onClick={() => handleRewrite(key as 'rewrite' | 'polish' | 'expand')}
                          icon={
                            key === 'rewrite' ? <ScissorOutlined /> :
                            key === 'polish' ? <FormatPainterOutlined /> :
                            <ExpandOutlined />
                          }
                        >
                          {label}
                        </Button>
                      ))}
                    </Space>
                  </Card>
                </Col>

                {/* Title Generation */}
                <Col xs={24} lg={12}>
                  <Card
                    title={
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <ThunderboltOutlined style={{ color: 'var(--accent-gold)' }} />
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, letterSpacing: '0.05em' }}>
                          AI 标题生成
                        </span>
                      </div>
                    }
                    extra={
                      <Button
                        size="small"
                        onClick={handleGenerateTitles}
                        loading={generatingTitles}
                        disabled={!editingBody.trim()}
                      >
                        生成标题
                      </Button>
                    }
                  >
                    {generatedTitles.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {generatedTitles.map((t, i) => (
                          <div
                            key={i}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: 6,
                              background: 'var(--bg-surface)',
                              border: '1px solid var(--border-default)',
                              cursor: 'pointer',
                              transition: 'all 0.2s var(--ease-out)',
                            }}
                            onClick={() => handleUseTitle(t)}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.borderColor = 'var(--accent-gold)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.borderColor = 'var(--border-default)';
                            }}
                          >
                            <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--accent-gold)', marginRight: 8 }}>
                                #{i + 1}
                              </span>
                              {t}
                            </span>
                            <Button size="small" type="text" onClick={(e) => { e.stopPropagation(); handleUseTitle(t); }}>
                              使用
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ padding: '20px 0', textAlign: 'center', color: 'var(--text-muted)' }}>
                        <p>点击"生成标题"按钮，AI 会生成多个吸引人的标题供选择</p>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            </>
          )})()}
        </Col>
      </Row>
    </div>
  );
}
