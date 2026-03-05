import { PageHeaderBlock } from '@/app/components/blocks/page-header-block';
import { PageTitleBlock } from '@/app/components/blocks/page-title-block';
import { FormLabel } from '@/app/components/form-label';
import { IBlueBGButton, IButton } from '@/app/components/form/button';
import { CopyButton } from '@/app/components/form/button/copy-button';
import { FieldSet } from '@/app/components/form/fieldset';
import { Helmet } from '@/app/components/helmet';
import { ActionableEmptyMessage } from '@/app/components/container/message/actionable-empty-message';
import { RevisionIndicator } from '@/app/components/indicators/revision';
import { useCurrentCredential } from '@/hooks/use-credential';
import { useGlobalNavigation } from '@/hooks/use-global-navigator';
import {
  Bug,
  Code,
  ExternalLink,
  Eye,
  Globe,
  Pencil,
  Phone,
  RotateCw,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Assistant,
  AssistantDefinition,
  ConnectionConfig,
  GetAssistant,
  GetAssistantRequest,
} from '@rapidaai/react';
import toast from 'react-hot-toast/headless';
import { connectionConfig } from '@/configs';
import { PlusIcon } from '@/app/components/Icon/plus';
import { Popover } from '@/app/components/popover';
import { toHumanReadableDateTime } from '@/utils/date';
import { InputHelper } from '@/app/components/input-helper';
import { useRapidaStore } from '@/hooks';
import { AssistantPhoneCallDeploymentDialog } from '@/app/components/base/modal/assistant-phone-call-deployment-modal';
import { AssistantDebugDeploymentDialog } from '@/app/components/base/modal/assistant-debug-deployment-modal';
import { AssistantWebWidgetlDeploymentDialog } from '@/app/components/base/modal/assistant-web-widget-deployment-modal';
import { AssistantApiDeploymentDialog } from '@/app/components/base/modal/assistant-api-deployment-modal';
import { cn } from '@/utils';
import { BaseCard } from '@/app/components/base/cards';

const CHANNEL_OPTIONS = [
  {
    key: 'web',
    icon: Globe,
    label: 'Web Widget',
    description: 'Embed a chat widget on your website',
  },
  {
    key: 'api',
    icon: Code,
    label: 'SDK / API',
    description: 'Integrate via React or REST SDK',
  },
  {
    key: 'phone',
    icon: Phone,
    label: 'Phone Call',
    description: 'Deploy on inbound or outbound calls',
  },
  {
    key: 'debug',
    icon: Bug,
    label: 'Debugger',
    description: 'Internal testing and debugging',
  },
];

/** IBM Carbon ghost button — small */
const CardAction = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Bug;
  label: string;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className="flex items-center gap-2 px-4 h-8 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors whitespace-nowrap"
  >
    <Icon className="w-4 h-4 shrink-0" strokeWidth={1.5} />
    {label}
  </button>
);

/** Plain key-value information item */
const Info = ({ label, value }: { label: string; value: string }) => (
  <div>
    <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-gray-400 dark:text-gray-500">
      {label}
    </dt>
    <dd className="mt-0.5 text-xs font-medium text-gray-700 dark:text-gray-200">
      {value}
    </dd>
  </div>
);

export const ConfigureAssistantDeploymentPage = () => {
  const { assistantId } = useParams();
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const navi = useGlobalNavigation();
  const { token, authId, projectId } = useCurrentCredential();
  const { showLoader, hideLoader } = useRapidaStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [isApiExpanded, setIsApiExpanded] = useState(false);
  const [isPhoneExpanded, setIsPhoneExpanded] = useState(false);
  const [isWidgetExpanded, setIsWidgetExpanded] = useState(false);
  const [createDeploymentPopover, setCreateDeploymentPopover] = useState(false);

  const get = useCallback(
    (id: typeof assistantId) => {
      if (id) {
        showLoader('block');
        const request = new GetAssistantRequest();
        const assistantDef = new AssistantDefinition();
        assistantDef.setAssistantid(id);
        request.setAssistantdefinition(assistantDef);
        GetAssistant(
          connectionConfig,
          request,
          ConnectionConfig.WithDebugger({
            authorization: token,
            userId: authId,
            projectId: projectId,
          }),
        )
          .then(epmr => {
            hideLoader();
            if (epmr?.getSuccess()) {
              const a = epmr.getData();
              if (a) setAssistant(a);
            } else {
              const error = epmr?.getError();
              toast.error(
                error?.getHumanmessage() ??
                  'Unable to get your assistant. please try again later.',
              );
            }
          })
          .catch(() => hideLoader());
      }
    },
    [token, authId, projectId],
  );

  useEffect(() => {
    get(assistantId);
  }, [assistantId]);

  const deploymentCount = [
    assistant?.getApideployment(),
    assistant?.getWebplugindeployment(),
    assistant?.getDebuggerdeployment(),
    assistant?.getPhonedeployment(),
  ].filter(Boolean).length;

  const hasAnyDeployment = deploymentCount > 0;

  return (
    <div className="flex flex-col w-full flex-1 overflow-auto bg-white dark:bg-gray-900">
      {/* Modals */}
      {assistant?.getPhonedeployment() && (
        <AssistantPhoneCallDeploymentDialog
          modalOpen={isPhoneExpanded}
          setModalOpen={setIsPhoneExpanded}
          deployment={assistant.getPhonedeployment()!}
        />
      )}
      {assistant?.getDebuggerdeployment() && (
        <AssistantDebugDeploymentDialog
          modalOpen={isExpanded}
          setModalOpen={setIsExpanded}
          deployment={assistant.getDebuggerdeployment()!}
        />
      )}
      {assistant?.getWebplugindeployment() && (
        <AssistantWebWidgetlDeploymentDialog
          modalOpen={isWidgetExpanded}
          setModalOpen={setIsWidgetExpanded}
          deployment={assistant.getWebplugindeployment()!}
        />
      )}
      {assistant?.getApideployment() && (
        <AssistantApiDeploymentDialog
          modalOpen={isApiExpanded}
          setModalOpen={setIsApiExpanded}
          deployment={assistant.getApideployment()!}
        />
      )}

      <Helmet title="Assistant deployment" />

      {/* Page header */}
      <PageHeaderBlock>
        <div className="flex items-center gap-3">
          <PageTitleBlock>Deployments</PageTitleBlock>
          {hasAnyDeployment && (
            <span className="text-xs px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 font-medium tabular-nums">
              {deploymentCount}
            </span>
          )}
        </div>
        <div className="flex items-stretch self-stretch border-l border-gray-200 dark:border-gray-800">
          <IBlueBGButton
            className="h-full px-4"
            onClick={() => setCreateDeploymentPopover(true)}
          >
            Add deployment
            <PlusIcon className="w-4 h-4 ml-2" />
          </IBlueBGButton>
          <Popover
            align={'bottom-end'}
            className="w-72 p-1"
            open={createDeploymentPopover}
            setOpen={setCreateDeploymentPopover}
          >
            <p className="px-3 py-2 text-xs font-medium text-gray-400 dark:text-gray-500 uppercase tracking-[0.08em]">
              Choose channel
            </p>
            {CHANNEL_OPTIONS.map(opt => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    setCreateDeploymentPopover(false);
                    if (opt.key === 'web') navi.goToConfigureWeb(assistantId!);
                    if (opt.key === 'api') navi.goToConfigureApi(assistantId!);
                    if (opt.key === 'phone')
                      navi.goToConfigureCall(assistantId!);
                    if (opt.key === 'debug')
                      navi.goToConfigureDebugger(assistantId!);
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
                >
                  <Icon
                    className="w-4 h-4 shrink-0 text-gray-500 dark:text-gray-400"
                    strokeWidth={1.5}
                  />
                  <div>
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {opt.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {opt.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </Popover>
          <div className="w-px self-stretch bg-gray-200 dark:bg-gray-800 shrink-0" />
          <IButton
            type="button"
            className="h-full"
            onClick={() => get(assistantId)}
          >
            <RotateCw className="w-4 h-4" strokeWidth={1.5} />
          </IButton>
        </div>
      </PageHeaderBlock>

      {hasAnyDeployment ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 content-start gap-[2px] m-4">
          {/* Debugger */}
          {assistant?.hasDebuggerdeployment() && (
            <BaseCard>
              <div className="flex-1 p-4 md:p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <Bug
                    className="w-6 h-6 text-orange-500 shrink-0"
                    strokeWidth={1.5}
                  />
                  <RevisionIndicator status="DEPLOYED" size="small" />
                </div>
                {/* Title + description */}
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Debugger
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 leading-snug">
                    Internal testing and debugging channel
                  </p>
                </div>
                {/* Info */}
                <dl className="grid grid-cols-3 gap-x-3 gap-y-3 pt-1">
                  <Info
                    label="Input"
                    value={`Text${assistant.getDebuggerdeployment()?.getInputaudio() ? ' + Audio' : ''}`}
                  />
                  <Info
                    label="Output"
                    value={`Text${assistant.getDebuggerdeployment()?.getOutputaudio() ? ' + Audio' : ''}`}
                  />
                  <Info
                    label="Updated"
                    value={toHumanReadableDateTime(
                      assistant.getDebuggerdeployment()?.getCreateddate()!,
                    )}
                  />
                </dl>
              </div>
              <div className="flex items-stretch border-t border-gray-200 dark:border-gray-800 divide-x divide-gray-200 dark:divide-gray-800">
                <CardAction
                  icon={Pencil}
                  label="Edit"
                  onClick={() => navi.goToConfigureDebugger(assistantId!)}
                />
                <CardAction
                  icon={ExternalLink}
                  label="Preview"
                  onClick={() => navi.goToAssistantPreview(assistantId!)}
                />
                <CardAction
                  icon={Eye}
                  label="Details"
                  onClick={() => setIsExpanded(!isExpanded)}
                />
              </div>
            </BaseCard>
          )}

          {/* SDK / API */}
          {assistant?.hasApideployment() && (
            <BaseCard>
              <div className="flex-1 p-4 md:p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <Code
                    className="w-6 h-6 text-blue-600 shrink-0"
                    strokeWidth={1.5}
                  />
                  <RevisionIndicator status="DEPLOYED" size="small" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    SDK / API
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 leading-snug">
                    Integrate via React SDK or direct REST API
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-x-3 gap-y-3 pt-1">
                  <Info label="SDK" value="React" />
                  <Info
                    label="Input"
                    value={`Text${assistant.getApideployment()?.getInputaudio() ? ' + Audio' : ''}`}
                  />
                  <Info
                    label="Output"
                    value={`Text${assistant.getApideployment()?.getOutputaudio() ? ' + Audio' : ''}`}
                  />
                  <Info
                    label="Updated"
                    value={toHumanReadableDateTime(
                      assistant.getApideployment()?.getCreateddate()!,
                    )}
                  />
                </dl>
                {/* Public URL */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
                  <FieldSet>
                    <FormLabel>Public URL</FormLabel>
                    <div className="flex items-stretch mt-1">
                      <code className="flex-1 bg-gray-50 dark:bg-gray-950 border border-gray-200 dark:border-gray-800 px-3 py-2 font-mono text-[11px] min-w-0 overflow-hidden text-ellipsis whitespace-nowrap text-gray-700 dark:text-gray-300">
                        {`https://app.rapida.ai/preview/public/assistant/${assistantId}?token={{PROJECT_CRDENTIAL_KEY}}`}
                      </code>
                      <div className="flex shrink-0 border border-l-0 border-gray-200 dark:border-gray-800">
                        <CopyButton className="h-auto w-9">
                          {`https://app.rapida.ai/preview/public/assistant/${assistantId}?token={{PROJECT_CRDENTIAL_KEY}}`}
                        </CopyButton>
                      </div>
                    </div>
                    <InputHelper>
                      Pass agent arguments as query params — e.g.{' '}
                      <code className="text-red-600">`?name=your-name`</code>
                    </InputHelper>
                  </FieldSet>
                </div>
              </div>
              <div className="flex items-stretch border-t border-gray-200 dark:border-gray-800 divide-x divide-gray-200 dark:divide-gray-800">
                <CardAction
                  icon={Pencil}
                  label="Edit"
                  onClick={() => navi.goToConfigureApi(assistantId!)}
                />
                <CardAction
                  icon={Code}
                  label="Integration guide"
                  onClick={() => setIsApiExpanded(!isApiExpanded)}
                />
              </div>
            </BaseCard>
          )}

          {/* Phone Call */}
          {assistant?.hasPhonedeployment() && (
            <BaseCard>
              <div className="flex-1 p-4 md:p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <Phone
                    className="w-6 h-6 text-green-600 shrink-0"
                    strokeWidth={1.5}
                  />
                  <RevisionIndicator status="DEPLOYED" size="small" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Phone Call
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 leading-snug">
                    Deploy on inbound or outbound phone calls
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-x-3 gap-y-3 pt-1">
                  <Info
                    label="Telephony"
                    value={
                      assistant.getPhonedeployment()?.getPhoneprovidername() ||
                      '—'
                    }
                  />
                  <Info label="Input" value="Audio" />
                  <Info label="Output" value="Audio" />
                  <Info
                    label="Updated"
                    value={toHumanReadableDateTime(
                      assistant.getPhonedeployment()?.getCreateddate()!,
                    )}
                  />
                </dl>
              </div>
              <div className="flex items-stretch border-t border-gray-200 dark:border-gray-800 divide-x divide-gray-200 dark:divide-gray-800">
                <CardAction
                  icon={Pencil}
                  label="Edit"
                  onClick={() => navi.goToConfigureCall(assistantId!)}
                />
                <CardAction
                  icon={ExternalLink}
                  label="Preview"
                  onClick={() => navi.goToAssistantPreviewCall(assistantId!)}
                />
                <CardAction
                  icon={Code}
                  label="Inbound guide"
                  onClick={() => setIsPhoneExpanded(!isPhoneExpanded)}
                />
              </div>
            </BaseCard>
          )}

          {/* Web Widget */}
          {assistant?.hasWebplugindeployment() && (
            <BaseCard>
              <div className="flex-1 p-4 md:p-5 space-y-4">
                <div className="flex items-start justify-between">
                  <Globe
                    className="w-6 h-6 text-violet-600 shrink-0"
                    strokeWidth={1.5}
                  />
                  <RevisionIndicator status="DEPLOYED" size="small" />
                </div>
                <div>
                  <p className="text-base font-semibold text-gray-900 dark:text-gray-100">
                    Web Widget
                  </p>
                  <p className="mt-0.5 text-sm text-gray-500 dark:text-gray-400 leading-snug">
                    Embed a chat widget on your website
                  </p>
                </div>
                <dl className="grid grid-cols-3 gap-x-3 gap-y-3 pt-1">
                  <Info label="SDK" value="JavaScript" />
                  <Info
                    label="Input"
                    value={`Text${assistant.getWebplugindeployment()?.getInputaudio() ? ' + Audio' : ''}`}
                  />
                  <Info
                    label="Output"
                    value={`Text${assistant.getWebplugindeployment()?.getOutputaudio() ? ' + Audio' : ''}`}
                  />
                  <Info
                    label="Updated"
                    value={toHumanReadableDateTime(
                      assistant.getWebplugindeployment()?.getCreateddate()!,
                    )}
                  />
                </dl>
              </div>
              <div className="flex items-stretch border-t border-gray-200 dark:border-gray-800 divide-x divide-gray-200 dark:divide-gray-800">
                <CardAction
                  icon={Pencil}
                  label="Edit"
                  onClick={() => navi.goToConfigureWeb(assistantId!)}
                />
                <CardAction
                  icon={Code}
                  label="Embed guide"
                  onClick={() => setIsWidgetExpanded(!isWidgetExpanded)}
                />
              </div>
            </BaseCard>
          )}
        </div>
      ) : (
        <div className="flex flex-col flex-1 items-center justify-center">
          <ActionableEmptyMessage
            title="No deployments yet"
            subtitle="Add a channel to make your assistant available to users."
            action="Add deployment"
            onActionClick={() => setCreateDeploymentPopover(true)}
          />
        </div>
      )}
    </div>
  );
};
