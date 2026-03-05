import React, { useState, useEffect, FC } from 'react';
import toast from 'react-hot-toast/headless';
import { useCredential } from '@/hooks/use-credential';
import { OverviewRow } from '@/app/components/base/modal/overview-row';
import {
  ConnectionConfig,
  GetKnowledgeLog,
  GetKnowledgeLogRequest,
  KnowledgeLog,
} from '@rapidaai/react';
import { useRapidaStore } from '@/hooks';
import { Tab } from '@/app/components/tab';
import { cn } from '@/utils';
import { StatusIndicator } from '@/app/components/indicators/status';
import { ModalProps } from '@/app/components/base/modal';
import { RightSideModal } from '@/app/components/base/modal/right-side-modal';
import { connectionConfig } from '@/configs';
import { CodeHighlighting } from '@/app/components/code-highlighting';
import { toHumanReadableDateTime } from '@/utils/date';

interface KnowledgeLogModalProps extends ModalProps {
  currentActivityId: string;
}
/**
 *
 * @param props
 * @returns
 */
export function KnowledgeLogDialog(props: KnowledgeLogModalProps) {
  const [userId, token, projectId] = useCredential();
  const { showLoader, hideLoader } = useRapidaStore();
  const [activity, setActivity] = useState<KnowledgeLog | null>(null);

  const getActivity = (currentProject: string, currentActivityId) => {
    const request = new GetKnowledgeLogRequest();
    request.setId(currentActivityId);
    request.setProjectid(currentProject);
    return GetKnowledgeLog(
      connectionConfig,
      request,
      ConnectionConfig.WithDebugger({
        authorization: token,
        projectId: projectId,
        userId: userId,
      }),
    )
      .then(at => {
        hideLoader();
        if (at?.getSuccess()) {
          let data = at.getData();
          if (data) {
            setActivity(data);
          }
        } else {
          let err = at?.getError();
          if (err) toast.error(err?.getHumanmessage());
          toast.error('Unable to resolve the request, please try again later.');
        }
      })
      .catch(x => {
        hideLoader();
        toast.error('Unable to resolve the request, please try again later.');
      });
  };

  /**
   *
   */
  useEffect(() => {
    showLoader('overlay');
    getActivity(projectId, props.currentActivityId);
  }, [projectId, props.currentActivityId]);

  return (
    <RightSideModal
      modalOpen={props.modalOpen}
      setModalOpen={props.setModalOpen}
      className="w-[580px]"
    >
      <div className="h-12 px-4 flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
          Knowledge Log
        </span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono truncate">
          {props.currentActivityId}
        </span>
      </div>
      <div className="relative overflow-auto h-[calc(100vh-48px)] flex-1 flex flex-col">
        <Tab
          active="Overview"
          className={cn('bg-white dark:bg-gray-900 sticky top-0 z-1')}
          tabs={[
            {
              label: 'Overview',
              element: (
                <div className="divide-y divide-gray-200 dark:divide-gray-800 w-full">
                  {activity && (
                    <>
                      <OverviewRow label="Status">
                        <StatusIndicator
                          state={activity.getStatus()}
                          size="small"
                        />
                      </OverviewRow>
                      <OverviewRow label="Time Taken">
                        <span className="text-sm tabular-nums text-gray-900 dark:text-gray-100">
                          {`${Number(activity.getTimetaken()) / 1000000}ms`}
                        </span>
                      </OverviewRow>
                      <OverviewRow label="Created">
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {toHumanReadableDateTime(activity.getCreateddate()!)}
                        </span>
                      </OverviewRow>
                    </>
                  )}
                </div>
              ),
            },
            {
              label: 'Request',
              element: (
                <CodeHighlighting
                  lang="json"
                  lineNumbers={false}
                  foldGutter={false}
                  code={JSON.stringify(
                    activity?.getRequest()?.toJavaScript(),
                    null,
                    2,
                  )}
                />
              ),
            },
            {
              label: 'Response',
              element: (
                <CodeHighlighting
                  lang="json"
                  lineNumbers={false}
                  foldGutter={false}
                  code={JSON.stringify(
                    activity?.getResponse()?.toJavaScript(),
                    null,
                    2,
                  )}
                />
              ),
            },
          ]}
        />
      </div>
    </RightSideModal>
  );
}

