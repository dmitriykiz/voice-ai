import { useState, useEffect } from 'react';
import { Helmet } from '@/app/components/helmet';
import { Datepicker } from '@/app/components/datepicker';
import { useCredential } from '@/hooks/use-credential';
import toast from 'react-hot-toast/headless';
import { useRapidaStore } from '@/hooks';
import { TablePagination } from '@/app/components/base/tables/table-pagination';
import { SearchIconInput } from '@/app/components/form/input/IconInput';
import { Metadata } from '@rapidaai/react';
import { EntityLink } from '@/app/components/base/tables/link-cell';
import { BluredWrapper } from '@/app/components/wrapper/blured-wrapper';
import { useActivityLogPage } from '@/hooks/use-activity-log-page-store';
import { formatNanoToReadableMilli, toDateString } from '@/utils/date';
import { getMetadataValue } from '@/utils/metadata';
import { Spinner } from '@/app/components/loader/spinner';
import { ScrollableResizableTable } from '@/app/components/data-table';
import { IButton, ILinkBorderButton } from '@/app/components/form/button';
import { IconActionButton } from '@/app/components/form/button/icon-action-button';
import { ExternalLink, Eye, RotateCw } from 'lucide-react';
import { TableCell } from '@/app/components/base/tables/table-cell';
import { TableRow } from '@/app/components/base/tables/table-row';
import { StatusIndicator } from '@/app/components/indicators/status';
import { LLMLogDialog } from '@/app/components/base/modal/llm-log-modal';
import { HttpStatusSpanIndicator } from '@/app/components/indicators/http-status';
import { ActionCell } from '@/app/components/base/tables/action-cell';
import { PageTitleWithCount } from '@/app/components/blocks/page-title-with-count';
import { YellowNoticeBlock } from '@/app/components/container/message/notice-block';
import { ProviderPill } from '@/app/components/pill/provider-model-pill';
import { PaginationButtonBlock } from '@/app/components/blocks/pagination-button-block';
import { PageHeaderBlock } from '@/app/components/blocks/page-header-block';
import { DateCell } from '@/app/components/base/tables/date-cell';
import TooltipPlus from '@/app/components/base/tooltip-plus';

/**
 * Listing all the audit log for the user organization and selected project
 * @returns
 */

export function ListingPage() {
  /**
   * set loading context
   */
  const { loading, showLoader, hideLoader } = useRapidaStore();

  /**
   * user credentials
   */
  const [userId, token, projectId] = useCredential();

  /**
   * Current activity Id
   */

  const [currentActivityId, setCurrentActivityId] = useState('');

  /**
   *  open modal
   */
  const [showLogModal, setShowLogModal] = useState(false);

  const {
    getActivities,
    addCriterias,
    activities,
    columns,
    page,
    setPage,
    totalCount,
    criteria,
    pageSize,
    visibleColumn,
    setPageSize,
    setColumns,
  } = useActivityLogPage();

  const onDateSelect = (to: Date, from: Date) => {
    addCriterias([
      { k: 'created_date', v: toDateString(to), logic: '<=' },
      { k: 'created_date', v: toDateString(from), logic: '>=' },
    ]);
  };

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const onToggleSelect = (id: string) => {
    setSelectedIds(prevSelectedIds => {
      if (prevSelectedIds.includes(id)) {
        // Remove from selected if already in the array
        return prevSelectedIds.filter(selectedId => selectedId !== id);
      } else {
        // Add to selected if not in the array
        return [...prevSelectedIds, id];
      }
    });
  };
  /**
   *
   */
  useEffect(() => {
    showLoader();
    onGetAcitvities();
  }, [projectId, page, pageSize, JSON.stringify(criteria)]);

  const onGetAcitvities = () => {
    getActivities(
      projectId,
      token,
      userId,
      err => {
        hideLoader();
        toast.error(err);
      },
      logs => {
        hideLoader();
      },
    );
  };
  return (
    <>
      {currentActivityId && (
        <LLMLogDialog
          modalOpen={showLogModal}
          setModalOpen={setShowLogModal}
          currentActivityId={currentActivityId}
        />
      )}

      <Helmet title="LLM Logs" />
      <PageHeaderBlock>
        <PageTitleWithCount count={activities.length} total={totalCount}>
          LLM Logs
        </PageTitleWithCount>
      </PageHeaderBlock>

      <BluredWrapper className="sticky top-0 z-11">
        <SearchIconInput className="bg-light-background flex-1" />
        <Datepicker
          align="right"
          className="bg-light-background"
          onDateSelect={onDateSelect}
        />
        <PaginationButtonBlock>
          <TablePagination
            columns={columns}
            currentPage={page}
            onChangeCurrentPage={setPage}
            totalItem={totalCount}
            pageSize={pageSize}
            onChangePageSize={setPageSize}
            onChangeColumns={setColumns}
          />
          <IButton
            onClick={() => {
              onGetAcitvities();
            }}
          >
            <RotateCw strokeWidth={1.5} className="h-4 w-4" />
          </IButton>
        </PaginationButtonBlock>
      </BluredWrapper>

      {activities && activities.length > 0 ? (
        <ScrollableResizableTable
          isActionable={true}
          clms={columns.filter(x => {
            return x.visible;
          })}
        >
          {activities.map((at, idx) => {
            return (
              <TableRow key={idx} data-id={at.getId()}>
                <td className="px-2 pl-2 text-left text-sm font-medium tracking-wider relative w-1">
                  {selectedIds.indexOf(at.getId()) > 0 && (
                    <div className="absolute top-0 bottom-0 left-0 bg-blue-500 w-[2px]"></div>
                  )}
                  <div className="w-8 h-8 flex justify-center items-center">
                    <input
                      type="checkbox"
                      name={`checkbox-${at.getId()}--name`}
                      id={`checkbox-${at.getId()}--name`}
                      checked={selectedIds.includes(at.getId())}
                      onClick={event => {
                        event.stopPropagation(); // Prevent <tr> onClick from firing
                      }}
                      onChange={() => {
                        onToggleSelect(at.getId());
                      }}
                    />
                  </div>
                </td>
                {visibleColumn('Source') && (
                  <TableCell>
                    <ActivitySource
                      metadatas={at.getExternalauditmetadatasList()}
                    />
                  </TableCell>
                )}
                {visibleColumn('Provider Name') && (
                  <TableCell>
                    <ProviderPill
                      provider={getMetadataValue(
                        at.getExternalauditmetadatasList(),
                        'provider_name',
                      )}
                    />
                  </TableCell>
                )}
                {visibleColumn('Model Name') && (
                  <TableCell>
                    {getMetadataValue(
                      at.getExternalauditmetadatasList(),
                      'model_name',
                    )}
                  </TableCell>
                )}
                {visibleColumn('Created Date') && (
                  <DateCell date={at.getCreateddate()} />
                )}

                <ActionCell>
                  <IconActionButton
                    tooltip="View detail"
                    icon={<Eye strokeWidth={1.5} className="h-4 w-4" />}
                    onClick={event => {
                      event.stopPropagation();
                      setCurrentActivityId(at.getId());
                      setShowLogModal(true);
                    }}
                  />
                  <ILinkBorderButton
                    className="rounded-none border-0"
                    href={
                      getActivityLink(at.getExternalauditmetadatasList()).link
                    }
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
                {visibleColumn('Status') && (
                  <TableCell>
                    <StatusIndicator state={at.getStatus()} />
                  </TableCell>
                )}
                {/*  */}
                {visibleColumn('Time_Taken') && (
                  <TableCell>
                    {formatNanoToReadableMilli(at.getTimetaken())}
                  </TableCell>
                )}
                {visibleColumn('Http_status') && (
                  <TableCell>
                    <HttpStatusSpanIndicator status={at.getResponsestatus()} />
                  </TableCell>
                )}
              </TableRow>
            );
          })}
          {/* </TBody> */}
        </ScrollableResizableTable>
      ) : activities.length > 0 ? (
        <YellowNoticeBlock>
          <span className="font-semibold">No activities found</span>, There are
          no activities matching with your criteria..
        </YellowNoticeBlock>
      ) : !loading ? (
        <YellowNoticeBlock>
          <span className="font-semibold">No activities found</span>, There is
          no activities found for your account and project, Any activity made to
          any of the llms will be listed here.
        </YellowNoticeBlock>
      ) : (
        <div className="h-full flex justify-center items-center grow">
          <Spinner size="md" />
        </div>
      )}
    </>
  );
}
function ActivitySource(props: { metadatas: Metadata[] }) {
  const [activitySource, setActivitySource] = useState('');
  const [activityLink, setActivityLink] = useState('');

  useEffect(() => {
    const { source, link } = getActivityLink(props.metadatas);
    setActivitySource(source);
    setActivityLink(link);
  }, [props.metadatas]);

  return <EntityLink to={activityLink}>{activitySource}</EntityLink>;
}

function getActivityLink(metadatas: Metadata[]): {
  source: string;
  link: string;
} {
  const endpoint = getMetadataValue(metadatas, 'endpoint_id');
  if (endpoint) {
    return { source: endpoint, link: `/deployment/endpoint/${endpoint}` };
  }

  const assistant = getMetadataValue(metadatas, 'assistant_id');
  if (assistant) {
    return { source: assistant, link: `/deployment/assistant/${assistant}` };
  }

  const knowledge = getMetadataValue(metadatas, 'knowledge_id');
  if (knowledge) {
    return { source: knowledge, link: `/knowledge/${knowledge}` };
  }

  const source = getMetadataValue(metadatas, 'source');
  if (source) {
    return { source, link: '' };
  }

  return { source: '', link: '' };
}
