import React, { FC } from 'react';
import { EndpointLog } from '@rapidaai/react';
import { Tab } from '@/app/components/tab';
import { cn } from '@/utils';
import { RightSideModal } from '@/app/components/base/modal/right-side-modal';
import { ModalProps } from '@/app/components/base/modal';
import { StatusIndicator } from '@/app/components/indicators/status';
import { SourceIndicator } from '@/app/components/indicators/source';
import { EndpointMetrics } from '@/app/components/base/modal/endpoint-trace-modal/endpoint-metrics';
import { EndpointMetadatas } from '@/app/components/base/modal/endpoint-trace-modal/endpoint-metadatas';
import { EndpointOptions } from '@/app/components/base/modal/endpoint-trace-modal/endpoint-options';
import { EndpointArguments } from '@/app/components/base/modal/endpoint-trace-modal/endpoint-arguments';
import { toHumanReadableDateTime } from '@/utils/date';
import { getTotalTokenMetric } from '@/utils/metadata';
import { OverviewRow } from '@/app/components/base/modal/overview-row';

interface EndpointTraceModalProps extends ModalProps {
  currentTrace: EndpointLog | null;
}

export const EndpointTraceModal: FC<EndpointTraceModalProps> = ({
  modalOpen,
  setModalOpen,
  currentTrace,
}) => {
  if (!currentTrace) return null;

  return (
    <RightSideModal
      modalOpen={modalOpen}
      setModalOpen={setModalOpen}
      className="w-[580px]"
    >
      {/* Carbon breadcrumb header */}
      <div className="h-12 px-4 flex items-center gap-2 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <span className="text-xs font-medium uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
          Trace
        </span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 font-mono truncate">
          {currentTrace.getId()}
        </span>
      </div>

      <div className="flex flex-col flex-1 overflow-auto h-[calc(100vh-48px)]">
        <Tab
          active="Overview"
          className={cn('bg-white dark:bg-gray-900 sticky top-0 z-1')}
          tabs={[
            {
              label: 'Overview',
              element: (
                <div className="divide-y divide-gray-200 dark:divide-gray-800 w-full">
                  <OverviewRow label="Status">
                    <StatusIndicator
                      state={currentTrace.getStatus()}
                      size="small"
                    />
                  </OverviewRow>
                  <OverviewRow label="Source">
                    <SourceIndicator
                      source={currentTrace.getSource()}
                      size="small"
                    />
                  </OverviewRow>
                  <OverviewRow label="Version">
                    <span className="text-sm font-mono text-gray-900 dark:text-gray-100">
                      vrsn_{currentTrace.getEndpointprovidermodelid()}
                    </span>
                  </OverviewRow>
                  <OverviewRow label="Time Taken">
                    <span className="text-sm tabular-nums text-gray-900 dark:text-gray-100">
                      {Number(currentTrace.getTimetaken()) / 1000000}ms
                    </span>
                  </OverviewRow>
                  <OverviewRow label="Total Tokens">
                    <span className="text-sm tabular-nums text-gray-900 dark:text-gray-100">
                      {getTotalTokenMetric(currentTrace.getMetricsList())}
                    </span>
                  </OverviewRow>
                  {currentTrace.getCreateddate() && (
                    <OverviewRow label="Created">
                      <span className="text-sm text-gray-900 dark:text-gray-100">
                        {toHumanReadableDateTime(
                          currentTrace.getCreateddate()!,
                        )}
                      </span>
                    </OverviewRow>
                  )}
                </div>
              ),
            },
            {
              label: 'Metrics',
              element: (
                <EndpointMetrics metrics={currentTrace.getMetricsList()} />
              ),
            },
            {
              label: 'Metadata',
              element: (
                <EndpointMetadatas metadata={currentTrace.getMetadataList()} />
              ),
            },
            {
              label: 'Options',
              element: (
                <EndpointOptions options={currentTrace.getOptionsList()} />
              ),
            },
            {
              label: 'Arguments',
              element: (
                <EndpointArguments args={currentTrace.getArgumentsList()} />
              ),
            },
          ]}
        />
      </div>
    </RightSideModal>
  );
};

