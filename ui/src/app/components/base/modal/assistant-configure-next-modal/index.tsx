import { GenericModal, ModalProps } from '@/app/components/base/modal';
import { ModalBody } from '@/app/components/base/modal/modal-body';
import { ModalFooter } from '@/app/components/base/modal/modal-footer';
import { ModalHeader } from '@/app/components/base/modal/modal-header';
import { ModalFitHeightBlock } from '@/app/components/blocks/modal-fit-height-block';
import { ModalTitleBlock } from '@/app/components/blocks/modal-title-block';
import { SectionDivider } from '@/app/components/blocks/section-divider';
import { IBlueBGButton, ICancelButton } from '@/app/components/form/button';
import { BarChart2, Bug, CheckCircle, ChevronRight, Code, ExternalLink, Globe, PhoneCall, Webhook } from 'lucide-react';
import { FC } from 'react';
import { useGlobalNavigation } from '@/hooks/use-global-navigator';
import { Assistant } from '@rapidaai/react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ConfigureAssistantNextDialogProps extends ModalProps {
  assistant: Assistant;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const makeDeploymentOptions = (assistantId: string, nav: ReturnType<typeof useGlobalNavigation>) => [
  {
    icon: PhoneCall,
    title: 'Phone call',
    description: 'Enable voice conversations over inbound and outbound phone calls.',
    action: 'Configure phone',
    onClick: () => nav.goToConfigureCall(assistantId),
  },
  {
    icon: Code,
    title: 'API',
    description: 'Integrate into your application using our REST API or SDKs.',
    action: 'Configure API',
    onClick: () => nav.goToConfigureApi(assistantId),
  },
  {
    icon: Globe,
    title: 'Web Widget',
    description: 'Embed on your website to handle text and voice customer queries.',
    action: 'Configure web widget',
    onClick: () => nav.goToConfigureWeb(assistantId),
  },
  {
    icon: Bug,
    title: 'Debugger',
    description: 'Deploy to a sandbox environment for testing and debugging.',
    action: 'Configure debugger',
    onClick: () => nav.goToConfigureDebugger(assistantId),
  },
];

const makeAutomationOptions = (assistantId: string, nav: ReturnType<typeof useGlobalNavigation>) => [
  {
    icon: BarChart2,
    title: 'Post-conversation analysis',
    description:
      'Gain insights from every interaction — transcripts, sentiment scores, quality analysis, and custom reporting dashboards.',
    action: 'Configure analysis',
    onClick: () => nav.goToCreateAssistantAnalysis(assistantId),
  },
  {
    icon: Webhook,
    title: 'Webhooks',
    description:
      'Trigger external events on key actions: conversation start/end, human escalation, or custom CRM sync.',
    action: 'Configure webhooks',
    onClick: () => nav.goToCreateAssistantWebhook(assistantId),
  },
];

// ── Component ─────────────────────────────────────────────────────────────────

export const ConfigureAssistantNextDialog: FC<ConfigureAssistantNextDialogProps> = ({
  assistant,
  modalOpen,
  setModalOpen,
}) => {
  const nav = useGlobalNavigation();
  const assistantId = assistant.getId();

  const deploymentOptions = makeDeploymentOptions(assistantId, nav);
  const automationOptions = makeAutomationOptions(assistantId, nav);

  return (
    <GenericModal className="flex" modalOpen={modalOpen} setModalOpen={setModalOpen}>
      <ModalFitHeightBlock className="w-[860px]">

        {/* ── Header ───────────────────────────────────────────────── */}
        <ModalHeader onClose={() => setModalOpen(false)}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center bg-green-50 dark:bg-green-950/30 shrink-0">
              <CheckCircle className="w-4 h-4 text-green-600" strokeWidth={2} />
            </div>
            <div>
              <ModalTitleBlock>Assistant created</ModalTitleBlock>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                <span className="font-medium text-gray-700 dark:text-gray-300">
                  {assistant.getName()}
                </span>{' '}
                is ready — configure deployments and integrations below.
              </p>
            </div>
          </div>
        </ModalHeader>

        {/* ── Body ─────────────────────────────────────────────────── */}
        <ModalBody className="overflow-y-auto max-h-[68dvh] px-6 py-6 flex flex-col gap-8">

          {/* Deployment channels */}
          <div className="flex flex-col gap-4">
            <SectionDivider label="Deployment Channels" />
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-gray-200 dark:bg-gray-800">
              {deploymentOptions.map(option => (
                <button
                  key={option.title}
                  type="button"
                  onClick={option.onClick}
                  className="
                    bg-white dark:bg-gray-900
                    p-4 flex flex-col text-left
                    group cursor-pointer
                    hover:bg-gray-50 dark:hover:bg-gray-800/60
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary
                    transition-colors duration-100
                  "
                >
                  {/* Icon */}
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 group-hover:bg-primary/10 mb-3 shrink-0 transition-colors duration-100">
                    <option.icon
                      className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-primary transition-colors duration-100"
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* Text */}
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    {option.title}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-[18px] flex-1 mb-4">
                    {option.description}
                  </p>

                  {/* Action link */}
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:gap-1.5 transition-all duration-100">
                    {option.action}
                    <ChevronRight className="w-3 h-3 shrink-0" />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Automation & Integrations */}
          <div className="flex flex-col gap-4">
            <SectionDivider label="Automation & Integrations" />
            <div className="flex flex-col gap-px bg-gray-200 dark:bg-gray-800">
              {automationOptions.map(option => (
                <button
                  key={option.title}
                  type="button"
                  onClick={option.onClick}
                  className="
                    bg-white dark:bg-gray-900
                    px-4 py-4 flex items-center gap-4 text-left
                    group cursor-pointer
                    hover:bg-gray-50 dark:hover:bg-gray-800/60
                    focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary
                    transition-colors duration-100
                  "
                >
                  {/* Icon */}
                  <div className="w-8 h-8 flex items-center justify-center bg-gray-100 dark:bg-gray-800 group-hover:bg-primary/10 shrink-0 transition-colors duration-100">
                    <option.icon
                      className="w-4 h-4 text-gray-600 dark:text-gray-400 group-hover:text-primary transition-colors duration-100"
                      strokeWidth={1.5}
                    />
                  </div>

                  {/* Text */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                      {option.title}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 leading-[18px] mt-0.5">
                      {option.description}
                    </p>
                  </div>

                  {/* Action link */}
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary shrink-0 group-hover:gap-1.5 transition-all duration-100">
                    {option.action}
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </button>
              ))}
            </div>
          </div>

        </ModalBody>

        {/* ── Footer ───────────────────────────────────────────────── */}
        <ModalFooter errorMessage="">
          <ICancelButton onClick={() => setModalOpen(false)}>
            Do this later
          </ICancelButton>
          <IBlueBGButton
            type="button"
            onClick={() => nav.goToAssistantPreview(assistantId)}
          >
            <span>Preview assistant</span>
            <ExternalLink className="w-4 h-4 ml-1" strokeWidth={1.5} />
          </IBlueBGButton>
        </ModalFooter>

      </ModalFitHeightBlock>
    </GenericModal>
  );
};
