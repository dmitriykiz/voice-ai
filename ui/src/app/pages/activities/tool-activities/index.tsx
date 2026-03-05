import React, { useState, useEffect } from 'react';
import { Helmet } from '@/app/components/helmet';
import { Datepicker } from '@/app/components/datepicker';
import { useCredential } from '@/hooks/use-credential';
import toast from 'react-hot-toast/headless';
import { useRapidaStore } from '@/hooks';
import { TablePagination } from '@/app/components/base/tables/table-pagination';
import { SearchIconInput } from '@/app/components/form/input/IconInput';
import { Metadata } from '@rapidaai/react';
import { LinkCell } from '@/app/components/base/tables/link-cell';
import { BluredWrapper } from '@/app/components/wrapper/blured-wrapper';
import { formatNanoToReadableMilli, toDateString } from '@/utils/date';
import { getMetadataValue } from '@/utils/metadata';
import { Spinner } from '@/app/components/loader/spinner';
import { ScrollableResizableTable } from '@/app/components/data-table';
import { IButton, ILinkBorderButton } from '@/app/components/form/button';
import { ExternalLink, Eye, RotateCw } from 'lucide-react';
import { TableCell } from '@/app/components/base/tables/table-cell';
import { TableRow } from '@/app/components/base/tables/table-row';
import { StatusIndicator } from '@/app/components/indicators/status';
import { ActionCell } from '@/app/components/base/tables/action-cell';
import { PageTitleWithCount } from '@/app/components/blocks/page-title-with-count';
import { YellowNoticeBlock } from '@/app/components/container/message/notice-block';
import { PaginationButtonBlock } from '@/app/components/blocks/pagination-button-block';
import { PageHeaderBlock } from '@/app/components/blocks/page-header-block';
import { useToolActivityLogPage } from '@/hooks/use-tool-activity-log-page-store';
import { ToolLogDialog } from '@/app/components/base/modal/tool-log-modal';
import { DateCell } from '@/app/components/base/tables/date-cell';
import TooltipPlus from '@/app/components/base/tooltip-plus';
import { IconActionButton } from '@/app/components/form/button/icon-action-button';

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
  } = useToolActivityLogPage();

  const onDateSelect = (to: Date, from: Date) => {
    addCriterias([
      { k: 'created_date', v: toDateString(to), logic: '<=' },
      { k: 'created_date', v: toDateString(from), logic: '>=' },
    ]);
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
        <ToolLogDialog
          modalOpen={showLogModal}
          setModalOpen={setShowLogModal}
          currentActivityId={currentActivityId}
        />
      )}

      <Helmet title="Tool Logs" />
      <PageHeaderBlock>
        <PageTitleWithCount count={activities.length} total={totalCount}>
          Tool Logs
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
          isActionable={false}
          clms={columns.filter(x => {
            return x.visible;
          })}
        >
          {activities.map((at, idx) => {
            return (
              <TableRow key={idx} data-id={at.getId()}>
                {visibleColumn('assistant_id') && (
                  <LinkCell to={`/deployment/assistant/${at.getAssistantid()}`}>
                    {at.getAssistantid()}
                  </LinkCell>
                )}
                {visibleColumn('assistant_conversation_id') && (
                  <LinkCell to={`/deployment/assistant/${at.getAssistantid()}/sessions/${at.getAssistantconversationid()}`}>
                    {at.getAssistantconversationid()}
                  </LinkCell>
                )}
                {visibleColumn('assistant_tool_name') && (
                  <TableCell>{at.getAssistanttoolname()}</TableCell>
                )}

                {visibleColumn('tool_call_id') && (
                  <TableCell>
                    <span className="font-mono">{at.getToolcallid()}</span>
                  </TableCell>
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
                    href={`/deployment/assistant/${at.getAssistantid()}/sessions/${at.getAssistantconversationid()}`}
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
                {visibleColumn('status') && (
                  <TableCell>
                    <StatusIndicator state={at.getStatus()} />
                  </TableCell>
                )}
                {visibleColumn('time_taken') && (
                  <TableCell>
                    {formatNanoToReadableMilli(at.getTimetaken())}
                  </TableCell>
                )}
                {visibleColumn('created_date') && (
                  <DateCell date={at.getCreateddate()} />
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
