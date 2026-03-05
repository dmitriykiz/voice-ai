import { FC, useEffect, useState } from 'react';
import { ScrollableResizableTable } from '@/app/components/data-table';
import { useCredential } from '@/hooks/use-credential';
import { useRapidaStore } from '@/hooks/use-rapida-store';
import toast from 'react-hot-toast/headless';
import { BluredWrapper } from '@/app/components/wrapper/blured-wrapper';
import { SearchIconInput } from '@/app/components/form/input/IconInput';
import { TablePagination } from '@/app/components/base/tables/table-pagination';
import { AssistantConversationMessage, Criteria } from '@rapidaai/react';
import { SectionLoader } from '@/app/components/loader/section-loader';
import { YellowNoticeBlock } from '@/app/components/container/message/notice-block';
import { IButton, ILinkBorderButton } from '@/app/components/form/button';
import { IconActionButton } from '@/app/components/form/button/icon-action-button';
import {
  Download,
  ExternalLink,
  Eye,
  ListFilterPlus,
  RotateCw,
  Telescope,
} from 'lucide-react';
import TooltipPlus from '@/app/components/base/tooltip-plus';
import { AssistantTraceFilterDialog } from '@/app/components/base/modal/assistant-trace-filter-modal';
import { useBoolean } from 'ahooks';
import {
  formatNanoToReadableMilli,
  toDate,
  toHumanReadableDateTime,
} from '@/utils/date';
import {
  getMetricValueOrDefault,
  getTimeTakenMetric,
  getTotalTokenMetric,
} from '@/utils/metadata';
import { Spinner } from '@/app/components/loader/spinner';
import { PaginationButtonBlock } from '@/app/components/blocks/pagination-button-block';
import { useConversationLogPageStore } from '@/hooks/use-conversation-log-page-store';
import { Helmet } from '@/app/components/helmet';
import { PageHeaderBlock } from '@/app/components/blocks/page-header-block';
import { PageTitleWithCount } from '@/app/components/blocks/page-title-with-count';
import { ActionCell } from '@/app/components/base/tables/action-cell';
import { ConversationTelemetryDialog } from '@/app/components/base/modal/conversation-telemetry-modal';
import { CONFIG } from '@/configs';
import { TableCell } from '@/app/components/base/tables/table-cell';
import { LinkCell } from '@/app/components/base/tables/link-cell';
import { TableRow } from '@/app/components/base/tables/table-row';
import { StatusIndicator } from '@/app/components/indicators/status';
import SourceIndicator from '@/app/components/indicators/source';
import { ConversationLogDialog } from '@/app/components/base/modal/conversation-log-modal';

export const ListingPage: FC<{}> = () => {
  const [userId, token, projectId] = useCredential();
  const rapidaContext = useRapidaStore();
  const [downloading, setDownloading] = useState(false);
  const conversationLogAction = useConversationLogPageStore();
  const [isFilterOpen, { setTrue: setFilterOpen, setFalse: setFilterClose }] =
    useBoolean(false);

  const [currentActivity, setCurrentActivity] =
    useState<AssistantConversationMessage | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [criterias, setCriterias] = useState<Criteria[]>([]);
  const [telemetryAssistantId, setTelemetryAssistantId] = useState('');
  const [isTelemetryDialogOpen, setTelemetryDialogOpen] = useState(false);

  const handleTraceClick = (trace: AssistantConversationMessage) => {
    const convCtr = new Criteria();
    convCtr.setKey('conversationId');
    convCtr.setLogic('match');
    convCtr.setValue(trace.getAssistantconversationid());
    const msgCtr = new Criteria();
    msgCtr.setKey('messageId');
    msgCtr.setLogic('match');
    msgCtr.setValue(trace.getMessageid());
    setCriterias([convCtr, msgCtr]);
    setTelemetryAssistantId(trace.getAssistantid());
    setTelemetryDialogOpen(true);
  };

  const [filters, setFilters] = useState<{
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    source?: string;
    sessionId?: string;
    id?: string;
    status?: string;
  }>({});

  const applyFilter = (newFilter: {
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    source?: string;
    sessionId?: string;
    id?: string;
    status?: string;
  }) => {
    setFilters(newFilter);
    const criterias: { k: string; v: string; logic: string }[] = [];
    if (newFilter.dateFrom) {
      criterias.push({
        k: 'assistant_conversation_messages.created_date',
        v: newFilter.dateFrom,
        logic: '>=',
      });
    }

    if (newFilter.dateTo) {
      criterias.push({
        k: 'assistant_conversation_messages.created_date',
        v: newFilter.dateTo,
        logic: '<=',
      });
    }

    if (newFilter.source) {
      criterias.push({
        k: 'assistant_conversation_messages.source',
        v: newFilter.source,
        logic: '=',
      });
    }

    if (newFilter.sessionId) {
      criterias.push({
        k: 'assistant_conversation_messages.assistant_conversation_id',
        v: newFilter.sessionId,
        logic: '=',
      });
    }
    if (newFilter.id) {
      criterias.push({
        k: 'assistant_conversation_messages.id',
        v: newFilter.id,
        logic: '=',
      });
    }

    if (newFilter.status) {
      criterias.push({
        k: 'assistant_conversation_messages.status',
        v: newFilter.status,
        logic: '=',
      });
    }
    conversationLogAction.setCriterias(criterias);
  };

  useEffect(() => {
    conversationLogAction.clear();
  }, []);

  const get = () => {
    rapidaContext.showLoader();
    conversationLogAction.getMessages(
      projectId,
      token,
      userId,
      (err: string) => {
        rapidaContext.hideLoader();
        toast.error(err);
      },
      (data: AssistantConversationMessage[]) => {
        rapidaContext.hideLoader();
      },
    );
  };

  useEffect(() => {
    get();
  }, [
    projectId,
    conversationLogAction.page,
    conversationLogAction.pageSize,
    JSON.stringify(conversationLogAction.criteria),
  ]);

  if (rapidaContext.loading) {
    return (
      <div className="h-full flex flex-col items-center justify-center">
        <SectionLoader />
      </div>
    );
  }

  const csvEscape = (str: string): string => {
    return `"${str.replace(/"/g, '""')}"`;
  };
  const onDownloadAllTraces = () => {
    setDownloading(true);
    const csvContent = [
      // Header row using column names
      conversationLogAction.columns
        .filter(column => column.visible)
        .map(column => column.name)
        .join(','),
      // Data rows
      ...conversationLogAction.assistantMessages.map(
        (row: AssistantConversationMessage) =>
          conversationLogAction.columns
            .filter(column => column.visible)
            .map(column => {
              switch (column.key) {
                case 'id':
                  return row.getId();
                case 'session_id':
                  return row.getAssistantconversationid();
                case 'assistant_id':
                  return row.getAssistantid();
                case 'source':
                  return row.getSource();
                case 'role':
                  return csvEscape(row.getRole());
                case 'message':
                  return csvEscape(row.getBody());
                case 'created_date':
                  return row.getCreateddate()
                    ? toDate(row.getCreateddate()!)
                    : '';
                case 'status':
                  return row.getStatus();
                case 'time_taken':
                  return `${getTimeTakenMetric(row.getMetricsList()) / 1000000}ms`;
                default:
                  return '';
              }
            })
            .join(','),
      ),
    ].join('\n');
    const url = URL.createObjectURL(
      new Blob([csvContent], { type: 'text/csv;charset=utf-8;' }),
    );

    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', projectId + '-trace-messages.csv');
    document.body.appendChild(link);
    setDownloading(false);

    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <>
      {isTelemetryDialogOpen && (
        <ConversationTelemetryDialog
          modalOpen={isTelemetryDialogOpen}
          setModalOpen={setTelemetryDialogOpen}
          assistantId={telemetryAssistantId}
          criterias={criterias}
        />
      )}

      {currentActivity && (
        <ConversationLogDialog
          modalOpen={showLogModal}
          setModalOpen={setShowLogModal}
          currentAssistantMessage={currentActivity}
        />
      )}
      <Helmet title="Conversation Logs" />
      <AssistantTraceFilterDialog
        modalOpen={isFilterOpen}
        setModalOpen={setFilterClose}
        filters={filters}
        onFiltersChange={applyFilter}
      />
      <PageHeaderBlock>
        <PageTitleWithCount
          count={conversationLogAction.assistantMessages.length}
          total={conversationLogAction.totalCount}
        >
          Conversation Logs
        </PageTitleWithCount>
      </PageHeaderBlock>
      <BluredWrapper className="sticky top-0 z-11">
        <SearchIconInput
          className="bg-light-background flex-1"
          value={filters.search}
          onChange={value => {
            const newValue = value.target.value;
            const newFilters = { ...filters };
            const filterRegex = /(id|session):(\S+)/g;
            let match;
            let hasMatch = false;
            newFilters.id = '';
            newFilters.sessionId = '';

            if (newValue === '') {
              // Reset all filters when input is cleared
              setFilters({ search: '', id: '', sessionId: '' });
              applyFilter({ search: '', id: '', sessionId: '' });
              return;
            }

            while ((match = filterRegex.exec(newValue)) !== null) {
              const [, filterType, filterValue] = match;
              hasMatch = true;
              switch (filterType) {
                case 'id':
                  newFilters.id = filterValue;
                  break;
                case 'session':
                  newFilters.sessionId = filterValue;
                  break;
              }
            }
            newFilters.search = newValue;
            setFilters(newFilters);
            if (hasMatch) {
              applyFilter(newFilters);
            }
          }}
          placeholder="Search by id:trace-id, session:session-id"
        />
        <PaginationButtonBlock>
          <TablePagination
            columns={conversationLogAction.columns}
            currentPage={conversationLogAction.page}
            onChangeCurrentPage={conversationLogAction.setPage}
            totalItem={conversationLogAction.totalCount}
            pageSize={conversationLogAction.pageSize}
            onChangePageSize={conversationLogAction.setPageSize}
            onChangeColumns={conversationLogAction.setColumns}
          />
          <IButton
            type="button"
            onClick={() => {
              setFilterOpen();
            }}
          >
            <TooltipPlus
              className="bg-white dark:bg-gray-950 border-[0.5px] rounded-[2px] px-0 py-0"
              popupContent={
                <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-500">
                  Filter
                </div>
              }
            >
              <ListFilterPlus className="w-4 h-4" strokeWidth={1.5} />
            </TooltipPlus>
          </IButton>
          <IButton
            type="button"
            onClick={() => {
              onDownloadAllTraces();
            }}
          >
            <TooltipPlus
              className="bg-white dark:bg-gray-950 border-[0.5px] rounded-[2px] px-0 py-0"
              popupContent={
                <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-500">
                  Export as report
                </div>
              }
            >
              {downloading ? (
                <Spinner size="sm"></Spinner>
              ) : (
                <Download className="w-4 h-4" strokeWidth={1.5} />
              )}
            </TooltipPlus>
          </IButton>
          <IButton
            onClick={() => {
              get();
            }}
          >
            <RotateCw strokeWidth={1.5} className="h-4 w-4" />
          </IButton>
        </PaginationButtonBlock>
      </BluredWrapper>
      {conversationLogAction.assistantMessages.length > 0 ? (
        <ScrollableResizableTable
          isExpandable={false}
          isActionable={false}
          clms={conversationLogAction.columns.filter(x => x.visible)}
        >
          {conversationLogAction.assistantMessages.map((row, idx) => (
            <TableRow key={idx} data-id={row.getId()}>
              {conversationLogAction.visibleColumn('id') && (
                <TableCell>{row.getMessageid().split('-')[0]}</TableCell>
              )}
              {conversationLogAction.visibleColumn('version') && (
                <TableCell>vrsn_{row.getAssistantprovidermodelid()}</TableCell>
              )}
              {conversationLogAction.visibleColumn(
                'assistant_conversation_id',
              ) && (
                <LinkCell to={`/deployment/assistant/${row.getAssistantid()}/sessions/${row.getAssistantconversationid()}`}>
                  {row.getAssistantconversationid()}
                </LinkCell>
              )}
              {conversationLogAction.visibleColumn('assistant_id') && (
                <LinkCell to={`/deployment/assistant/${row.getAssistantid()}`}>
                  {row.getAssistantid()}
                </LinkCell>
              )}
              {conversationLogAction.visibleColumn('source') && (
                <TableCell>
                  <SourceIndicator source={row.getSource()} />
                </TableCell>
              )}

              {conversationLogAction.visibleColumn('role') && (
                <TableCell>
                  {row.getRole() ? (
                    <p className="line-clamp-2 uppercase">{row.getRole()}</p>
                  ) : (
                    <p className="line-clamp-2 opacity-65">Not available</p>
                  )}
                </TableCell>
              )}
              {conversationLogAction.visibleColumn('message') && (
                <TableCell>
                  {row.getBody() ? (
                    <p className="line-clamp-2">{row.getBody()}</p>
                  ) : (
                    <p className="line-clamp-2 opacity-65">Not available</p>
                  )}
                </TableCell>
              )}
              {conversationLogAction.visibleColumn('created_date') && (
                <TableCell>
                  {row.getCreateddate() &&
                    toHumanReadableDateTime(row.getCreateddate()!)}
                </TableCell>
              )}
              <ActionCell>
                <IconActionButton
                  tooltip="View detail"
                  icon={<Eye strokeWidth={1.5} className="h-4 w-4" />}
                  onClick={() => {
                    setCurrentActivity(row);
                    setShowLogModal(true);
                  }}
                />
                {CONFIG.workspace.features?.telemetry !== false && (
                  <IconActionButton
                    tooltip="View telemetry"
                    icon={<Telescope strokeWidth={1.5} className="h-4 w-4" />}
                    onClick={() => handleTraceClick(row)}
                  />
                )}
                <ILinkBorderButton
                  className="rounded-none border-0"
                  href={`/deployment/assistant/${row.getAssistantid()}/sessions/${row.getAssistantconversationid()}`}
                >
                  <TooltipPlus
                    className="bg-white dark:bg-gray-950 border-[0.5px] rounded-[2px] px-0 py-0"
                    popupContent={
                      <div className="px-3 py-2 text-sm text-gray-600 dark:text-gray-500">
                        View conversation
                      </div>
                    }
                  >
                    <ExternalLink strokeWidth={1.5} className="h-4 w-4" />
                  </TooltipPlus>
                </ILinkBorderButton>
              </ActionCell>
              {conversationLogAction.visibleColumn('status') && (
                <TableCell>
                  <StatusIndicator state={row.getStatus()} />
                </TableCell>
              )}
              {conversationLogAction.visibleColumn('time_taken') && (
                <TableCell>
                  {formatNanoToReadableMilli(
                    getTimeTakenMetric(row.getMetricsList()),
                  )}
                </TableCell>
              )}
              {conversationLogAction.visibleColumn('total_token') && (
                <TableCell>
                  {getTotalTokenMetric(row.getMetricsList())}
                </TableCell>
              )}
              {conversationLogAction.visibleColumn('user_feedback') && (
                <TableCell>
                  {getMetricValueOrDefault(
                    row.getMetricsList(),
                    'custom.feedback',
                    '__',
                  )}
                </TableCell>
              )}
              {conversationLogAction.visibleColumn('user_text_feedback') && (
                <TableCell>
                  {getMetricValueOrDefault(
                    row.getMetricsList(),
                    'custom.feedback_text',
                    '--',
                  )}
                </TableCell>
              )}
            </TableRow>
          ))}
        </ScrollableResizableTable>
      ) : (
        <YellowNoticeBlock>
          <span className="font-semibold">No activities found</span>, Any
          activities performed by the assistant will be listed here.
        </YellowNoticeBlock>
      )}
    </>
  );
};
