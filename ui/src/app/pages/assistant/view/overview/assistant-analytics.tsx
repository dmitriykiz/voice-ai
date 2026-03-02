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
} from 'recharts';
import {
  NameType,
  ValueType,
} from 'recharts/types/component/DefaultTooltipContent';
import { ContentType } from 'recharts/types/component/Tooltip';
import { useAssistantTracePageStore } from '@/hooks/use-assistant-trace-page-store';
import { FC, useEffect, useState } from 'react';
import { BluredWrapper } from '@/app/components/wrapper/blured-wrapper';
import { PageTitleBlock } from '@/app/components/blocks/page-title-block';
import { IButton } from '@/app/components/form/button';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';
import { Popover } from '@/app/components/popover';
import { useCurrentCredential } from '@/hooks/use-credential';

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

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];
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

  // Calculate total sessions (unique conversations)
  const totalSessions = conversations.length;

  // Calculate total messages
  const totalMessages = assistantTraceAction.assistantMessages.length;

  // Calculate average duration
  const avgDuration =
    conversations.reduce((sum, conversation) => {
      const sortedMessages = conversation.sort(
        (a, b) =>
          toDate(a.getCreateddate()!).getTime() -
          toDate(b.getCreateddate()!).getTime(),
      );
      const duration =
        (toDate(sortedMessages[sortedMessages.length - 1].getCreateddate()!).getTime() -
          toDate(sortedMessages[0].getCreateddate()!).getTime()) /
        1000;
      return sum + duration;
    }, 0) / totalSessions;

  // Calculate average latency
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
    percentage: (
      (count / assistantTraceAction.assistantMessages.length) *
      100
    ).toFixed(1),
  }));

  // Source distribution for pie chart
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
    percentage: (
      (count / assistantTraceAction.assistantMessages.length) *
      100
    ).toFixed(1),
  }));

  //
  const metricsData = [
    {
      title: 'Total Sessions',
      value: totalSessions.toLocaleString(),
      trend: `${((totalSessions / assistantTraceAction.assistantMessages.length) * 100).toFixed(1)}% of total interactions`,
    },
    {
      title: 'Total Messages',
      value: totalMessages.toLocaleString(),
      trend: `${(totalMessages / totalSessions).toFixed(1)} messages per session`,
    },
    {
      title: 'Avg Duration',
      value: `${Math.round(avgDuration)}s`,
      trend: `${(avgDuration / 60).toFixed(1)} minutes per session`,
    },
    {
      title: 'Avg Latency',
      value: `${Math.round(avgLatency / 1000000)}ms`,
      trend:
        avgLatency / 1000000 > 2000
          ? 'High latency, optimization needed'
          : 'Good response time',
    },
    {
      title: 'Token Efficiency',
      value: `${(assistantTraceAction.assistantMessages.reduce((sum, item) => sum + getTotalTokenMetric(item.getMetricsList()), 0) / totalMessages).toFixed(1)}`,
      trend: 'Tokens per message',
    },
    {
      title: 'Success Rate',
      value: `${((assistantTraceAction.assistantMessages.filter(item => getStatusMetric(item.getMetricsList()) === 'SUCCESS').length / totalMessages) * 100).toFixed(1)}%`,
      trend: 'Completed interactions',
    },
  ];

  //
  const activeSessionsData = (() => {
    const now = new Date();
    let interval: number; // Bucket size in minutes
    let formatLabel: (date: Date) => string;

    // Determine grouping interval and label format based on selected range
    switch (selectedRange) {
      case 'last_24_hours':
        interval = 30; // 30-minute intervals
        formatLabel = date =>
          `${date.getHours().toString().padStart(2, '0')}:${date
            .getMinutes()
            .toString()
            .padStart(2, '0')}`;
        break;
      case 'last_7_days':
        interval = 240; // 4-hour intervals
        formatLabel = date =>
          `${toDateString(date)} ${date
            .getHours()
            .toString()
            .padStart(2, '0')}:00`;
        break;
      case 'last_30_days':
      default:
        interval = 1440; // 1-day intervals
        formatLabel = date => `${toDateString(date)}`;
        break;
    }

    // Start time based on range
    const startTime = new Date();
    startTime.setMinutes(0, 0, 0); // Reset to the start of the current hour
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

    // Generate buckets for the desired interval
    const buckets: Array<{ date: Date; total: number; latency: number }> = [];
    for (
      let t = startTime.getTime();
      t < now.getTime();
      t += interval * 60 * 1000
    ) {
      const bucketDate = new Date(t);
      buckets.push({
        date: bucketDate,
        total: 0,
        latency: 0,
      });
    }

    // Group the assistant messages into buckets
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

    // Calculate averages and format the final data
    return buckets.map(bucket => ({
      dateHour: formatLabel(bucket.date),
      total: bucket.total,
      latency: Math.round(bucket.latency / Math.max(1, bucket.total)),
      label: `From: ${bucket.date.toISOString().split('.')[0].replace('T', ' ')}`,
    }));
  })();
  //

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
    // Implement auto-refresh logic
    let intervalId: NodeJS.Timeout | null = null;

    if (autoRefreshInterval && autoRefreshInterval > 0) {
      intervalId = setInterval(
        () => {
          fetchAssistantMessages();
        },
        autoRefreshInterval * 60 * 1000,
      ); // Convert minutes to milliseconds
    }

    return () => {
      // Cleanup interval
      if (intervalId) clearInterval(intervalId);
    };
  }, [autoRefreshInterval]); // Dependency: autoRefreshInterval

  return (
    <div className="w-full">
      <section className="bg-white dark:bg-gray-950 border-b relative grid grid-cols-1  md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 ">
        {metricsData.map((metric, index) => (
          <div
            key={index}
            className="grid grid-rows-[1fr_auto] md:border-r md:border-gray-200 dark:border-gray-800"
          >
            <div className="grid grid-cols-1 items-center">
              <div className="px-4 py-2 sm:px-2">
                <div className="text-2xl font-medium mt-4">{metric.value}</div>
                <div className="flex items-center gap-2 mt-4">
                  <h3 className="text-base/7 font-medium text-muted">
                    <div className="absolute inset-0" />
                    {metric.title}
                  </h3>
                </div>
              </div>
            </div>
            <div className="border-t border-gray-200 dark:border-gray-800 px-4 py-2 max-md:border-y sm:px-2">
              <p className="text-sm/6 text-gray-600 dark:text-gray-400 opacity-70">
                {metric.trend}
              </p>
            </div>
          </div>
        ))}
      </section>

      <BluredWrapper className="mt-4 dark:bg-gray-950">
        <PageTitleBlock className="px-4 text-base/7 font-medium py-2">
          Analytics
        </PageTitleBlock>
        <div className=" dark:divide-gray-800 flex">
          <div className="flex border-l">
            <IButton
              className={cn(
                'px-4 border-none capitalize',
                openRange && 'bg-light-background!  dark:bg-gray-950!',
              )}
              onClick={() => {
                setOpenRange(true);
              }}
            >
              {selectedRange.replaceAll('_', ' ')}
              <ChevronDown
                className={cn(
                  'w-4 h-4 ml-2 transition-all delay-200',
                  openRange && 'rotate-180',
                )}
              />
            </IButton>
            <Popover
              align={'bottom-end'}
              className="w-60"
              open={openRange}
              setOpen={setOpenRange}
              arrowClass={'!fill-white dark:!fill-gray-700'}
            >
              <div className="space-y-0.5 text-sm/6">
                <p className="px-2 py-1 text-xs/5 text-muted uppercase">
                  Quick Range
                </p>
                <hr className="w-full h-[1px] bg-gray-800" />
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

          <div className="flex border-l">
            <IButton
              className={cn(
                'px-4 border-none',
                openautoRefersh && 'bg-light-background!  dark:bg-gray-950!',
              )}
              onClick={() => {
                setOpenautoRefresh(true);
              }}
            >
              Auto-refresh{' '}
              {autoRefreshInterval === null
                ? 'Off'
                : `${autoRefreshInterval} Minute`}
              <ChevronDown
                className={cn(
                  'w-4 h-4 ml-2 transition-all delay-200',
                  openautoRefersh && 'rotate-180',
                )}
              />
            </IButton>
            <Popover
              align={'bottom-end'}
              className="w-60"
              open={openautoRefersh}
              setOpen={setOpenautoRefresh}
              arrowClass={'!fill-white dark:!fill-gray-700'}
            >
              <div className="space-y-0.5 text-sm/6">
                <p className="px-2 py-1 text-xs/5 text-muted uppercase">
                  Auto refresh interval
                </p>
                <hr className="w-full h-[1px] bg-gray-800" />
                {[0, 5, 10, 30].map(mins => (
                  <IButton
                    key={mins}
                    className="w-full justify-start"
                    onClick={() => {
                      setAutoRefreshInterval(mins === 0 ? null : mins);
                      setOpenautoRefresh(false);
                    }}
                  >
                    {mins === 0 ? 'Off' : `Every ${mins} Minute`}
                  </IButton>
                ))}
              </div>
            </Popover>
          </div>
        </div>
      </BluredWrapper>
      <div className="bg-white dark:bg-gray-950 grid grid-cols-2">
        <div className="col-span-2 border-b">
          <div className="border-b px-4 py-4 opacity-80">
            <h2 className="text-base/6 font-semibold">Sessions served</h2>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={activeSessionsData}
                margin={{ top: 5, right: 0, left: -30, bottom: 5 }}
              >
                <g className="stroke-gray-300 dark:stroke-gray-800">
                  <YAxis
                    dataKey="total"
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    axisLine={
                      <line
                        stroke="stroke-gray-300 dark:stroke-gray-800"
                        strokeWidth={1}
                      />
                    } // gray-200
                  />
                </g>
                <g className="stroke-gray-300 dark:stroke-gray-800">
                  <XAxis
                    dataKey="dateHour"
                    tickLine={true}
                    tick={{ fontSize: 12 }}
                    axisLine={
                      <line
                        stroke="stroke-gray-300 dark:stroke-gray-800"
                        strokeWidth={1}
                        // Tailwind stroke color
                      />
                    }
                  />
                </g>

                <Tooltip
                  cursor={false}
                  content={
                    (({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-white dark:bg-gray-950 border-[0.5px] rounded-[2px] px-0 py-0 w-64">
                            <div className="divide-y text-sm dark:text-gray-400 text-gray-700">
                              <div className="px-3 py-3 space-y-1.5">
                                {payload.map((entry, index) => (
                                  <div
                                    className="flex items-center justify-between"
                                    key={index}
                                  >
                                    <div className="flex items-center space-x-1.5">
                                      <div
                                        className="w-2 h-2"
                                        style={{
                                          backgroundColor:
                                            entry.color || '#ccc',
                                          borderRadius: '2px',
                                        }}
                                      ></div>
                                      <span className="font-medium capitalize">
                                        {entry.name}
                                      </span>
                                    </div>
                                    <span className="font-medium">
                                      {entry.value}
                                    </span>
                                  </div>
                                ))}
                              </div>
                              <div className="px-3 py-2">
                                {/* Updated to show 'From' and 'To' for tooltip */}
                                <div>{payload[0]?.payload?.label}</div>
                              </div>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    }) as ContentType<ValueType, NameType>
                  }
                />
                <g className="dark:text-blue-600/50 text-blue-600/70">
                  <Bar dataKey="total" stackId="a" fill="currentColor" />
                </g>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="col-span-1 border-r">
          <div className="border-b px-4 py-4 opacity-80">
            <h2 className="text-base/6 font-semibold">Source Distribution</h2>
          </div>

          <div className="p-4 pt-0">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={sourceData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ source, percentage }) =>
                      `${source} (${percentage}%)`
                    }
                    outerRadius={80}
                    innerRadius={40} // Added for donut chart
                    fill="#8884d8"
                    dataKey="count"
                    stroke="none"
                  >
                    {sourceData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        <div className="col-span-1">
          <div className="border-b px-4 py-4 opacity-80">
            <h2 className="text-base/6 font-semibold">Language Distribution</h2>
          </div>

          <div className="p-4 pt-0">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={languageData}
                    cx="50%"
                    cy="50%"
                    stroke="none"
                    labelLine={false}
                    label={({ language, percentage }) =>
                      `${language} (${percentage}%)`
                    }
                    outerRadius={80}
                    innerRadius={40} // Added for donut chart
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {languageData.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
