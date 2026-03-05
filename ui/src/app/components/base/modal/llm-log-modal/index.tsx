import React, { useState, useEffect, FC } from 'react';
import toast from 'react-hot-toast/headless';
import { useCredential } from '@/hooks/use-credential';
import { OverviewRow } from '@/app/components/base/modal/overview-row';

import {
  AuditLog,
  GetAuditLogResponse,
  GetActivity,
  ConnectionConfig,
} from '@rapidaai/react';
import { useRapidaStore } from '@/hooks';
import { Metadata } from '@rapidaai/react';
import { ServiceError } from '@rapidaai/react';
import { Tab } from '@/app/components/tab';
import { cn } from '@/utils';
import { StatusIndicator } from '@/app/components/indicators/status';
import { ModalProps } from '@/app/components/base/modal';
import { RightSideModal } from '@/app/components/base/modal/right-side-modal';
import { HttpStatusSpanIndicator } from '@/app/components/indicators/http-status';
import { connectionConfig } from '@/configs';
import { CodeHighlighting } from '@/app/components/code-highlighting';
import { toHumanReadableDateTime } from '@/utils/date';

interface LLMLogModalProps extends ModalProps {
  currentActivityId: string;
}
/**
 *
 * @param props
 * @returns
 */
export function LLMLogDialog(props: LLMLogModalProps) {
  /**
   * user credentials
   */
  const [userId, token, projectId] = useCredential();
  const { showLoader, hideLoader } = useRapidaStore();
  /**
   *
   */
  const [additionalData, setAdditionalData] = useState<Metadata[]>([]);
  /**
   *
   */
  const [activity, setActivity] = useState<AuditLog | null>(null);

  const getActivity = (currentProject: string, currentActivityId) => {
    return GetActivity(
      connectionConfig,
      currentProject,
      currentActivityId,
      afterActivities,
      ConnectionConfig.WithDebugger({
        authorization: token,
        projectId: projectId,
        userId: userId,
      }),
    );
  };

  /**
   *
   */
  useEffect(() => {
    showLoader('overlay');
    getActivity(projectId, props.currentActivityId);
  }, [projectId, props.currentActivityId]);

  /**
   *
   * @param err
   * @param at
   */
  const afterActivities = (
    err: ServiceError | null,
    at: GetAuditLogResponse | null,
  ) => {
    hideLoader();
    if (at?.getSuccess()) {
      let data = at.getData();
      if (data) {
        setActivity(data);
        setAdditionalData(data?.getExternalauditmetadatasList());
      }
    } else {
      let err = at?.getError();
      if (err) toast.error(err?.getHumanmessage());
      toast.error('Unable to resolve the request, please try again later.');
    }
  };

  return (
    <RightSideModal
      modalOpen={props.modalOpen}
      setModalOpen={props.setModalOpen}
      className="w-[580px]"
    >
      <div className="h-12 px-4 flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
          LLM Log
        </span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono truncate">
          {props.currentActivityId}
        </span>
      </div>
      <div className="relative overflow-auto h-[calc(100vh-48px)] flex flex-col flex-1">
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
                          {`${activity.getTimetaken() / 1000000}ms`}
                        </span>
                      </OverviewRow>
                      <OverviewRow label="Created">
                        <span className="text-sm text-gray-900 dark:text-gray-100">
                          {toHumanReadableDateTime(activity.getCreateddate()!)}
                        </span>
                      </OverviewRow>
                      {activity?.getResponsestatus() && (
                        <OverviewRow label="Response Status">
                          <HttpStatusSpanIndicator
                            status={activity.getResponsestatus()}
                          />
                        </OverviewRow>
                      )}
                      {additionalData.map((ad, idx) => (
                        <OverviewRow
                          key={idx}
                          label={ad.getKey().replaceAll('_', ' ')}
                        >
                          <span className="text-sm text-gray-900 dark:text-gray-100 truncate max-w-[20rem]">
                            {ad.getValue()}
                          </span>
                        </OverviewRow>
                      ))}
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
            {
              label: 'Metrics',
              element: (
                <CodeHighlighting
                  lang="json"
                  lineNumbers={false}
                  foldGutter={false}
                  code={JSON.stringify(
                    activity?.getMetricsList().map(metric => metric.toObject()),
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

