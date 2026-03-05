import { Assistant, AssistantConversationMessage } from '@rapidaai/react';
import { toDate, toDateString } from '@/utils/date';
import {
  getStatusMetric,
  getTimeTakenMetric,
  getTotalTokenMetric,
} from '@/utils/metadata';
import {
  XAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Bar,
  BarChart,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  NameType,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent';
import { ContentType } from 'recharts/types/component/Tooltip';
import { useAssistantTracePageStore } from '@/hooks/use-assistant-trace-page-store';
import { FC, useEffect, useState } from 'react';
import { BluredWrapper } from '@/app/components/wrapper/blured-wrapper';
import { IButton } from '@/app/components/form/button';
import {
  ChevronDown,
  MessageSquare,
  Clock,
  Zap,
  Hash,
  CheckCircle2,
  Users,
  LucideIcon,
} from 'lucide-react';
import { cn } from '@/utils';
import { Popover } from '@/app/components/popover';
import { useCurrentCredential } from '@/hooks/use-credential';

const CHART_COLORS = [
  '#1e40af',
  '#22d3ee',
  '#f59e0b',
  '#10b981',
  '#f43f5e',
  '#1e40af',
];

interface MetricItem {
  title: string;
  value: string;
  trend: string;
  icon: LucideIcon;
  borderClass: string;
  iconBgClass: string;
  iconTextClass: string;
}

export const AssistantAnalytics: FC<{ assistant: Assistant }> = props => {
  const assistantTraceAction = useAssistantTracePageStore();
  const [openRange, setOpenRange] = useState(false);
  const [openautoRefersh, setOpenautoRefresh] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<null | number>(
    null,
  );
  const [selectedRange, setSelectedRange] = useState<string>('last_30_days');

  const { authId, token, projectId } = useCurrentCredential();

  const getDateRangeCriteria = (range: string) => {
    const now = new Date();
    let startDate: Date;

    switch (range) {
      case 'last_24_hours':
        startDate = new Date(now.setDate(now.getDate() - 1));
        break;
      case 'last_3_days':
        startDate = new Date(now.setDate(now.getDate() - 3));
        break;
      case 'last_7_days':
        startDate = new Date(now.setDate(now.getDate() - 7));
        break;
      case 'last_30_days':
      default:
        startDate = new Date(now.setDate(now.getDate() - 30));
        break;
    }

    return {
      k: 'assistant_conversation_messages.created_date',
      v: toDateString(startDate),
      logic: '>=',
    };
  };

  useEffect(() => {
    assistantTraceAction.clear();
    assistantTraceAction.addCriterias([getDateRangeCriteria(selectedRange)]);
  }, []);

  useEffect(() => {
    fetchAssistantMessages();
  }, [
    props.assistant.getId(),
    projectId,
    selectedRange,
    JSON.stringify(assistantTraceAction.criteria),
    token,
    authId,
  ]);

  const conversationsMap = assistantTraceAction.assistantMessages.reduce(
    (acc, message) => {
      const conversationId = message.getAssistantconversationid();
      if (!acc.has(conversationId)) {
        acc.set(conversationId, []);
      }
      acc.get(conversationId)!.push(message);
      return acc;
    },
    new Map<string, AssistantConversationMessage[]>(),
  );

  const conversations = Array.from(conversationsMap.values());
  const totalSessions = conversations.length;
  const totalMessages = assistantTraceAction.assistantMessages.length;

  const avgDuration =
    conversations.reduce((sum, conversation) => {
      const sortedMessages = conversation.sort(
        (a, b) =>
          toDate(a.getCreateddate()!).getTime() -
          toDate(b.getCreateddate()!).getTime(),
      );
      const duration =
        (toDate(
          sortedMessages[sortedMessages.length - 1].getCreateddate()!,
        ).getTime() -
          toDate(sortedMessages[0].getCreateddate()!).getTime()) /
        1000;
      return sum + duration;
    }, 0) / totalSessions;

  const avgLatency =
    assistantTraceAction.assistantMessages.reduce(
      (sum, message) => sum + getTimeTakenMetric(message.getMetricsList()),
      0,
    ) / totalMessages;

  const languageData = Object.entries(
    assistantTraceAction.assistantMessages.reduce(
      (acc, item) => {
        const language =
          item
            .getMetadataList()
            .find(m => m.getKey() === 'language')
            ?.getValue() || 'Unknown';
        acc[language] = (acc[language] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  ).map(([lang, count]) => ({
    language: lang,
    count,
    percentage: ((count / totalMessages) * 100).toFixed(1),
  }));

  const sourceData = Object.entries(
    assistantTraceAction.assistantMessages.reduce(
      (acc, item) => {
        const source = item.getSource();
        acc[source] = (acc[source] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    ),
  ).map(([source, count]) => ({
    source,
    count,
    percentage: ((count / totalMessages) * 100).toFixed(1),
  }));

  const metricsData: MetricItem[] = [
    {
      title: 'Total Sessions',
      value: totalSessions.toLocaleString(),
      trend: `${((totalSessions / totalMessages) * 100).toFixed(1)}% of total interactions`,
      icon: Users,
      borderClass: 'bg-blue-500',
      iconBgClass: 'bg-blue-50 dark:bg-blue-950/40',
      iconTextClass: 'text-blue-500',
    },
    {
      title: 'Total Messages',
      value: totalMessages.toLocaleString(),
      trend: `${(totalMessages / totalSessions).toFixed(1)} messages per session`,
      icon: MessageSquare,
      borderClass: 'bg-violet-500',
      iconBgClass: 'bg-violet-50 dark:bg-violet-950/40',
      iconTextClass: 'text-violet-500',
    },
    {
      title: 'Avg Duration',
      value: `${Math.round(avgDuration)}s`,
      trend: `${(avgDuration / 60).toFixed(1)} minutes per session`,
      icon: Clock,
      borderClass: 'bg-amber-500',
      iconBgClass: 'bg-amber-50 dark:bg-amber-950/40',
      iconTextClass: 'text-amber-500',
    },
    {
      title: 'Avg Latency',
      value: `${Math.round(avgLatency / 1000000)}ms`,
      trend:
        avgLatency / 1000000 > 2000
          ? 'High latency, optimization needed'
          : 'Good response time',
      icon: Zap,
      borderClass: 'bg-orange-500',
      iconBgClass: 'bg-orange-50 dark:bg-orange-950/40',
      iconTextClass: 'text-orange-500',
    },
    {
      title: 'Token Efficiency',
      value: (
        assistantTraceAction.assistantMessages.reduce(
          (sum, item) => sum + getTotalTokenMetric(item.getMetricsList()),
          0,
        ) / totalMessages
      ).toFixed(1),
      trend: 'Tokens per message',
      icon: Hash,
      borderClass: 'bg-teal-500',
      iconBgClass: 'bg-teal-50 dark:bg-teal-950/40',
      iconTextClass: 'text-teal-500',
    },
    {
      title: 'Success Rate',
      value: `${(
        (assistantTraceAction.assistantMessages.filter(
          item => getStatusMetric(item.getMetricsList()) === 'SUCCESS',
        ).length /
          totalMessages) *
        100
      ).toFixed(1)}%`,
      trend: 'Completed interactions',
      icon: CheckCircle2,
      borderClass: 'bg-emerald-500',
      iconBgClass: 'bg-emerald-50 dark:bg-emerald-950/40',
      iconTextClass: 'text-emerald-500',
    },
  ];

  const activeSessionsData = (() => {
    const now = new Date();
    let interval: number;
    let formatLabel: (date: Date) => string;

    switch (selectedRange) {
      case 'last_24_hours':
        interval = 30;
        formatLabel = date =>
          `${date.getHours().toString().padStart(2, '0')}:${date
            .getMinutes()
            .toString()
            .padStart(2, '0')}`;
        break;
      case 'last_7_days':
        interval = 240;
        formatLabel = date =>
          `${toDateString(date)} ${date
            .getHours()
            .toString()
            .padStart(2, '0')}:00`;
        break;
      case 'last_30_days':
      default:
        interval = 1440;
        formatLabel = date => `${toDateString(date)}`;
        break;
    }

    const startTime = new Date();
    startTime.setMinutes(0, 0, 0);
    switch (selectedRange) {
      case 'last_24_hours':
        startTime.setDate(startTime.getDate() - 1);
        break;
      case 'last_7_days':
        startTime.setDate(startTime.getDate() - 7);
        break;
      case 'last_30_days':
      default:
        startTime.setDate(startTime.getDate() - 30);
        break;
    }

    const buckets: Array<{ date: Date; total: number; latency: number }> = [];
    for (
      let t = startTime.getTime();
      t < now.getTime();
      t += interval * 60 * 1000
    ) {
      buckets.push({ date: new Date(t), total: 0, latency: 0 });
    }

    assistantTraceAction.assistantMessages.forEach(message => {
      const msgTime = toDate(message.getCreateddate()!).getTime();
      const bucketIndex = Math.floor(
        (msgTime - startTime.getTime()) / (interval * 60 * 1000),
      );
      if (bucketIndex >= 0 && bucketIndex < buckets.length) {
        const bucket = buckets[bucketIndex];
        bucket.total += 1;
        bucket.latency +=
          getTimeTakenMetric(message.getMetricsList()) / 1000000;
      }
    });

    return buckets.map(bucket => ({
      dateHour: formatLabel(bucket.date),
      total: bucket.total,
      latency: Math.round(bucket.latency / Math.max(1, bucket.total)),
      label: `From: ${bucket.date.toISOString().split('.')[0].replace('T', ' ')}`,
    }));
  })();

  const fetchAssistantMessages = () => {
    assistantTraceAction.setPageSize(0);
    assistantTraceAction.setFields(['metadata', 'metric']);
    assistantTraceAction.addCriterias([getDateRangeCriteria(selectedRange)]);
    assistantTraceAction.getAssistantMessages(
      props.assistant.getId(),
      projectId,
      token,
      authId,
      (err: string) => {},
      (data: AssistantConversationMessage[]) => {},
    );
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (autoRefreshInterval && autoRefreshInterval > 0) {
      intervalId = setInterval(
        () => {
          fetchAssistantMessages();
        },
        autoRefreshInterval * 60 * 1000,
      );
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefreshInterval]);

  return (
    <div className="w-full">
      {/* Metric cards */}
      <section className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        {metricsData.map((metric, index) => {
          const Icon = metric.icon;
          return (
            <div
              key={index}
              className="relative flex flex-col gap-2.5 p-5 border-r border-b border-gray-200 dark:border-gray-800 xl:border-b-0 last:border-r-0"
            >
              {/* Colored left accent bar */}
              <div
                className={cn('absolute left-0 top-4 bottom-4 w-0.5', metric.borderClass)}
              />
              <div className="flex items-center justify-between pl-3">
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  {metric.title}
                </p>
                <div className={cn('p-1.5', metric.iconBgClass)}>
                  <Icon
                    className={cn('w-3.5 h-3.5', metric.iconTextClass)}
                    strokeWidth={2}
                  />
                </div>
              </div>
              <p className="text-2xl font-semibold tracking-tight pl-3">
                {metric.value}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 pl-3 leading-relaxed">
                {metric.trend}
              </p>
            </div>
          );
        })}
      </section>

      {/* Analytics toolbar */}
      <BluredWrapper>
        <p className="px-4 text-xs font-medium uppercase tracking-[0.08em] text-gray-600 dark:text-gray-400">
          Analytics
        </p>
        <div className="flex items-stretch h-10 border-l border-gray-200 dark:border-gray-800">
          {/* Date range */}
          <div className="border-r border-gray-200 dark:border-gray-800 flex items-stretch">
            <IButton
              className={cn('capitalize', openRange && 'bg-primary/10!')}
              onClick={() => setOpenRange(true)}
            >
              {selectedRange.replaceAll('_', ' ')}
              <ChevronDown
                className={cn('w-4 h-4 transition-all delay-200', openRange && 'rotate-180')}
              />
            </IButton>
            <Popover
              align={'bottom-end'}
              className="w-60"
              open={openRange}
              setOpen={setOpenRange}
            >
              <div className="space-y-0.5 text-sm/6">
                <p className="px-4 py-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-500 dark:text-gray-400">
                  Quick Range
                </p>
                <div className="border-t border-gray-200 dark:border-gray-800" />
                {[
                  'last_24_hours',
                  'last_3_days',
                  'last_7_days',
                  'last_30_days',
                ].map(range => (
                  <IButton
                    key={range}
                    className="w-full justify-start capitalize"
                    onClick={() => {
                      setOpenRange(false);
                      setSelectedRange(range);
                    }}
                  >
                    {range.replaceAll('_', ' ')}
                  </IButton>
                ))}
              </div>
            </Popover>
          </div>

          {/* Auto-refresh */}
          <div className="flex items-stretch">
            <IButton
              className={cn(openautoRefersh && 'bg-primary/10!')}
              onClick={() => setOpenautoRefresh(true)}
            >
              Auto-refresh{' '}
              {autoRefreshInterval === null ? 'Off' : `${autoRefreshInterval} min`}
              <ChevronDown
                className={cn('w-4 h-4 transition-all delay-200', openautoRefersh && 'rotate-180')}
              />
            </IButton>
            <Popover
              align={'bottom-end'}
              className="w-60"
              open={openautoRefersh}
              setOpen={setOpenautoRefresh}
            >
              <div className="space-y-0.5 text-sm/6">
                <p className="px-4 py-2 text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-500 dark:text-gray-400">
                  Auto refresh interval
                </p>
                <div className="border-t border-gray-200 dark:border-gray-800" />
                {[0, 5, 10, 30].map(mins => (
                  <IButton
                    key={mins}
                    className="w-full justify-start"
                    onClick={() => {
                      setAutoRefreshInterval(mins === 0 ? null : mins);
                      setOpenautoRefresh(false);
                    }}
                  >
                    {mins === 0 ? 'Off' : `Every ${mins} min`}
                  </IButton>
                ))}
              </div>
            </Popover>
          </div>
        </div>
      </BluredWrapper>

      {/* Charts */}
      <div className="bg-white dark:bg-gray-900">
        {/* Sessions bar chart — full width */}
        <div className="border-b border-gray-200 dark:border-gray-800">
          <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
            <h2 className="text-sm font-semibold">Sessions served</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Number of sessions over time
            </p>
          </div>
          <div className="h-[280px] px-2 py-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeSessionsData}
                margin={{ top: 0, right: 16, left: 0, bottom: 0 }}
              >
                <YAxis
                  dataKey="total"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  width={36}
                />
                <XAxis
                  dataKey="dateHour"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 11, fill: '#9ca3af' }}
                  interval="preserveStartEnd"
                />
                <Tooltip
                  cursor={{ fill: '#6366f1', fillOpacity: 0.06, radius: 4 }}
                  content={
                    (({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg px-3 py-2.5 text-sm min-w-[140px]">
                          <p className="text-gray-400 dark:text-gray-500 text-xs mb-1.5">
                            {payload[0]?.payload?.label}
                          </p>
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 bg-primary" />
                            <span className="text-gray-600 dark:text-gray-300">
                              Sessions
                            </span>
                            <span className="ml-auto font-semibold tabular-nums">
                              {payload[0]?.value}
                            </span>
                          </div>
                        </div>
                      );
                    }) as ContentType<ValueType, NameType>
                  }
                />
                <Bar
                  dataKey="total"
                  fill="#1e40af"
                  fillOpacity={0.85}
                  radius={[2, 2, 0, 0]}
                  maxBarSize={32}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie charts row */}
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Source Distribution */}
          <div className="border-r border-gray-200 dark:border-gray-800">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold">Source Distribution</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Messages by deployment source
              </p>
            </div>
            <div className="relative">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sourceData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={85}
                      innerRadius={52}
                      dataKey="count"
                      nameKey="source"
                      stroke="none"
                    >
                      {sourceData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={
                        (({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const item = payload[0];
                          return (
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg px-3 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                                  style={{
                                    backgroundColor: item.color || '#6366f1',
                                  }}
                                />
                                <span className="text-gray-700 dark:text-gray-300">
                                  {item.name || 'Unknown'}
                                </span>
                                <span className="ml-3 font-semibold">
                                  {item.value}
                                </span>
                              </div>
                            </div>
                          );
                        }) as ContentType<ValueType, NameType>
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Centered donut label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-lg font-bold">{totalMessages}</p>
                  <p className="text-xs text-gray-400">Total</p>
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="px-5 pb-5 pt-3 space-y-2.5">
              {sourceData.map((item, index) => (
                <div
                  key={item.source}
                  className="flex items-center gap-2.5 text-xs"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{
                      backgroundColor:
                        CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />
                  <span className="text-gray-600 dark:text-gray-400 truncate flex-1 capitalize">
                    {item.source || 'Unknown'}
                  </span>
                  <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                    {item.percentage}%
                  </span>
                  <span className="text-gray-400 tabular-nums">
                    ({item.count})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Language Distribution */}
          <div>
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-800">
              <h2 className="text-sm font-semibold">Language Distribution</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Messages by detected language
              </p>
            </div>
            <div className="relative">
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={languageData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={85}
                      innerRadius={52}
                      dataKey="count"
                      nameKey="language"
                      stroke="none"
                    >
                      {languageData.map((_, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={CHART_COLORS[index % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      content={
                        (({ active, payload }) => {
                          if (!active || !payload?.length) return null;
                          const item = payload[0];
                          return (
                            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-lg px-3 py-2 text-sm">
                              <div className="flex items-center gap-2">
                                <div
                                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                                  style={{
                                    backgroundColor: item.color || '#6366f1',
                                  }}
                                />
                                <span className="text-gray-700 dark:text-gray-300">
                                  {item.name || 'Unknown'}
                                </span>
                                <span className="ml-3 font-semibold">
                                  {item.value}
                                </span>
                              </div>
                            </div>
                          );
                        }) as ContentType<ValueType, NameType>
                      }
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              {/* Centered donut label */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center">
                  <p className="text-lg font-bold">{totalMessages}</p>
                  <p className="text-xs text-gray-400">Total</p>
                </div>
              </div>
            </div>
            {/* Legend */}
            <div className="px-5 pb-5 pt-3 space-y-2.5">
              {languageData.map((item, index) => (
                <div
                  key={item.language}
                  className="flex items-center gap-2.5 text-xs"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{
                      backgroundColor:
                        CHART_COLORS[index % CHART_COLORS.length],
                    }}
                  />
                  <span className="text-gray-600 dark:text-gray-400 truncate flex-1">
                    {item.language}
                  </span>
                  <span className="font-semibold tabular-nums text-gray-800 dark:text-gray-200">
                    {item.percentage}%
                  </span>
                  <span className="text-gray-400 tabular-nums">
                    ({item.count})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
