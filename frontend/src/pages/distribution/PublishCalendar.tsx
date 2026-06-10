import { useEffect, useState } from 'react';
import { Button, Table, Tag, Space, Select, Spin, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  LeftOutlined,
  RightOutlined,
  ReloadOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useDistributionStore } from '../../stores/distributionStore';
import {
  DISTRIBUTION_STATUS_COLORS,
  DISTRIBUTION_STATUS_LABELS,
  PLATFORM_LABELS,
} from '../../types';
import type { Distribution, DistributionStatus } from '../../types';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];
const PLATFORM_DOT_COLORS: Record<string, string> = {
  weibo: '#dc2626',
  douyin: '#111111',
  xiaohongshu: '#f06565',
  zhihu: '#2563eb',
};

export default function PublishCalendar() {
  const { distributions, distributionsLoading, loadDistributions } = useDistributionStore();

  const [currentDate, setCurrentDate] = useState(dayjs());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const year = currentDate.year();
  const month = currentDate.month(); // 0-indexed

  useEffect(() => {
    loadDistributions({ page: 1, page_size: 100 });
  }, []);

  // Calendar computation
  const daysInMonth = currentDate.daysInMonth();
  const firstDayOfWeek = currentDate.startOf('month').day();
  const todayStr = dayjs().format('YYYY-MM-DD');

  // Group distributions by scheduled date
  const distsByDate: Record<string, Distribution[]> = {};
  distributions.forEach((d) => {
    const key = d.scheduled_time ? dayjs(d.scheduled_time).format('YYYY-MM-DD') : dayjs(d.created_at).format('YYYY-MM-DD');
    if (!distsByDate[key]) distsByDate[key] = [];
    distsByDate[key].push(d);
  });

  const selectedDists = selectedDate ? (distsByDate[selectedDate] || []) : [];

  const goPrevMonth = () => setCurrentDate(currentDate.subtract(1, 'month'));
  const goNextMonth = () => setCurrentDate(currentDate.add(1, 'month'));
  const goToday = () => setCurrentDate(dayjs());

  const statColumns: ColumnsType<Distribution> = [
    { title: 'ID', dataIndex: 'id', width: 80 },
    { title: '内容ID', dataIndex: 'content_id', width: 100 },
    {
      title: '平台', dataIndex: 'platform', width: 120,
      render: (v: string) => <Tag color="blue">{PLATFORM_LABELS[v] || v}</Tag>,
    },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: (v: DistributionStatus) => <Tag color={DISTRIBUTION_STATUS_COLORS[v]}>{DISTRIBUTION_STATUS_LABELS[v]}</Tag>,
    },
    {
      title: '时间', dataIndex: 'scheduled_time', width: 170,
      render: (v: string, r: Distribution) => {
        const t = v || r.published_at || r.created_at;
        return <span style={{ fontSize: 12 }}>{t ? dayjs(t).format('MM-DD HH:mm') : '—'}</span>;
      },
    },
  ];

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Calendar Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        marginBottom: 24, padding: '20px 24px', borderRadius: 10,
        background: 'var(--bg-card)', border: '1px solid var(--border-default)',
      }}>
        <Space size="middle">
          <Button icon={<LeftOutlined />} onClick={goPrevMonth} />
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 600, minWidth: 160, textAlign: 'center', color: 'var(--text-primary)' }}>
            {currentDate.format('YYYY 年 M 月')}
          </h2>
          <Button icon={<RightOutlined />} onClick={goNextMonth} />
        </Space>
        <Space>
          <Button onClick={goToday}>今天</Button>
          <Button icon={<ReloadOutlined />} onClick={() => loadDistributions({ page: 1, page_size: 100 })}>刷新</Button>
        </Space>
      </div>

      {/* Calendar Grid + Side Panel */}
      <div style={{ display: 'flex', gap: 24 }}>
        {/* Calendar Grid */}
        <div style={{ flex: 1 }}>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4,
            background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border-default)',
            padding: 16,
          }}>
            {/* Weekday headers */}
            {WEEKDAYS.map((d) => (
              <div key={d} style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
                {d}
              </div>
            ))}

            {/* Empty cells for first week */}
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}

            {/* Day cells */}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateStr = currentDate.date(day).format('YYYY-MM-DD');
              const dayDists = distsByDate[dateStr] || [];
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(dateStr)}
                  style={{
                    padding: '8px', minHeight: 80, borderRadius: 6, cursor: 'pointer',
                    background: isSelected ? 'var(--accent-soft)' : isToday ? '#f0f9ff' : 'transparent',
                    border: isSelected ? '2px solid var(--accent)' : isToday ? '1px solid var(--accent)' : '1px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{
                    fontSize: 13, fontWeight: isToday ? 700 : 400,
                    color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                    marginBottom: 4,
                  }}>
                    {day}
                  </div>
                  {dayDists.slice(0, 3).map((d) => (
                    <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
                      <div style={{
                        width: 6, height: 6, borderRadius: '50%',
                        background: PLATFORM_DOT_COLORS[d.platform] || '#999',
                        flexShrink: 0,
                      }} />
                      <span style={{ fontSize: 10, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {PLATFORM_LABELS[d.platform] || d.platform}
                      </span>
                    </div>
                  ))}
                  {dayDists.length > 3 && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>+{dayDists.length - 3} 更多</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Side Panel — Selected Date Detail */}
        <div style={{
          width: 360, padding: 20, borderRadius: 10,
          background: 'var(--bg-card)', border: '1px solid var(--border-default)',
          minHeight: 400,
        }}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, color: 'var(--text-primary)' }}>
            {selectedDate ? (
              <Space>
                <EnvironmentOutlined style={{ color: 'var(--accent)' }} />
                {selectedDate}
              </Space>
            ) : '选择一个日期'}
          </div>
          {selectedDate ? (
            selectedDists.length > 0 ? (
              <Table
                columns={statColumns}
                dataSource={selectedDists}
                rowKey="id"
                size="small"
                pagination={false}
                loading={distributionsLoading}
                scroll={{ x: 300 }}
              />
            ) : (
              <Empty description="当天无分发计划" />
            )
          ) : (
            <div style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', paddingTop: 60 }}>
              点击日历日期查看当天分发计划
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
