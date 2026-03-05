import {
  AssistantDefinition,
  ConnectionConfig,
  DeleteAssistant,
  GetAssistant,
  GetAssistantRequest,
} from '@rapidaai/react';
import { GetAssistantResponse } from '@rapidaai/react';
import { ServiceError } from '@rapidaai/react';
import { PageHeaderBlock } from '@/app/components/blocks/page-header-block';
import { PageTitleBlock } from '@/app/components/blocks/page-title-block';
import { ErrorContainer } from '@/app/components/error-container';
import { FormLabel } from '@/app/components/form-label';
import { IBlueBGButton, IRedBGButton } from '@/app/components/form/button';
import { FieldSet } from '@/app/components/form/fieldset';
import { Input } from '@/app/components/form/input';
import { CopyInput } from '@/app/components/form/input/copy-input';
import { Textarea } from '@/app/components/form/textarea';
import { InputHelper } from '@/app/components/input-helper';
import { useDeleteConfirmDialog } from '@/app/pages/assistant/actions/hooks/use-delete-confirmation';
import { useRapidaStore } from '@/hooks';
import { useCurrentCredential } from '@/hooks/use-credential';
import { useGlobalNavigation } from '@/hooks/use-global-navigator';
import { AlertTriangle } from 'lucide-react';
import { FC, useEffect, useState } from 'react';
import toast from 'react-hot-toast/headless';
import { useParams } from 'react-router-dom';
import { UpdateAssistantDetail } from '@rapidaai/react';
import { connectionConfig } from '@/configs';
import { ErrorMessage } from '@/app/components/form/error-message';
import { SectionDivider } from '@/app/components/blocks/section-divider';

export function EditAssistantPage() {
  const { assistantId } = useParams();
  const { goToAssistantListing } = useGlobalNavigation();

  if (!assistantId)
    return (
      <div className="flex flex-1">
        <ErrorContainer
          onAction={goToAssistantListing}
          code="403"
          actionLabel="Go to listing"
          title="Assistant not available"
          description="This assistant may be archived or you don't have access to it. Please check with your administrator or try another assistant."
        />
      </div>
    );

  return <EditAssistant assistantId={assistantId!} />;
}

export const EditAssistant: FC<{ assistantId: string }> = ({ assistantId }) => {
  const { authId, token, projectId } = useCurrentCredential();
  const { loading, showLoader, hideLoader } = useRapidaStore();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const { goToAssistantListing } = useGlobalNavigation();

  useEffect(() => {
    showLoader('block');

    const request = new GetAssistantRequest();
    const assistantDef = new AssistantDefinition();
    assistantDef.setAssistantid(assistantId);
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
      .then(car => {
        hideLoader();
        if (car?.getSuccess()) {
          const assistant = car.getData();
          if (assistant) {
            setName(assistant.getName());
            setDescription(assistant.getDescription());
          }
        } else {
          const error = car?.getError();
          if (error) {
            toast.error(error.getHumanmessage());
            return;
          }
          toast.error('Unable to load assistant. Please try again later.');
        }
      })
      .catch(() => {
        hideLoader();
      });
  }, [assistantId]);

  const onUpdateAssistantDetail = () => {
    setErrorMessage('');
    showLoader('block');
    const afterUpdateAssistant = (
      err: ServiceError | null,
      car: GetAssistantResponse | null,
    ) => {
      hideLoader();
      if (car?.getSuccess()) {
        toast.success('The assistant has been successfully updated.');
        const assistant = car.getData();
        if (assistant) {
          setName(assistant.getName());
          setDescription(assistant.getDescription());
        }
      } else {
        const error = car?.getError();
        if (error) {
          setErrorMessage(error.getHumanmessage());
          return;
        }
        setErrorMessage('Unable to update assistant. Please try again later.');
      }
    };
    UpdateAssistantDetail(
      connectionConfig,
      assistantId,
      name,
      description,
      afterUpdateAssistant,
      {
        authorization: token,
        'x-auth-id': authId,
        'x-project-id': projectId,
      },
    );
  };

  const Deletion = useDeleteConfirmDialog({
    onConfirm: () => {
      showLoader('block');
      const afterDeleteAssistant = (
        err: ServiceError | null,
        car: GetAssistantResponse | null,
      ) => {
        if (car?.getSuccess()) {
          toast.success('The assistant has been deleted successfully.');
          goToAssistantListing();
        } else {
          hideLoader();
          const error = car?.getError();
          if (error) {
            toast.error(error.getHumanmessage());
            return;
          }
          toast.error('Unable to delete assistant. Please try again later.');
        }
      };

      DeleteAssistant(connectionConfig, assistantId, afterDeleteAssistant, {
        authorization: token,
        'x-auth-id': authId,
        'x-project-id': projectId,
      });
    },
    name: name,
  });

  return (
    <div className="w-full flex flex-col flex-1">
      <Deletion.ConfirmDeleteDialogComponent />
      <PageHeaderBlock>
        <PageTitleBlock>General Settings</PageTitleBlock>
      </PageHeaderBlock>

      <div className="overflow-auto flex flex-col flex-1">
        <div className="px-8 pt-8 pb-12 flex flex-col gap-10 max-w-2xl">

          {/* ── Identity ───────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <SectionDivider label="Identity" />
            <FieldSet>
              <FormLabel>Assistant ID</FormLabel>
              <CopyInput
                name="id"
                disabled
                value={assistantId}
                className="border-dashed"
                placeholder="eg: your-assistant-id"
              />
              <InputHelper>
                Your assistant's unique identifier. This cannot be changed.
              </InputHelper>
            </FieldSet>
          </div>

          {/* ── General Information ────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <SectionDivider label="General Information" />
            <FieldSet>
              <FormLabel>Name</FormLabel>
              <Input
                name="usecase"
                onChange={e => setName(e.target.value)}
                value={name}
                placeholder="e.g. Customer support bot"
              />
              <InputHelper>
                The display name shown across the platform for this assistant.
              </InputHelper>
            </FieldSet>
            <FieldSet>
              <FormLabel>Description</FormLabel>
              <Textarea
                row={4}
                value={description}
                placeholder="What's the purpose of this assistant?"
                onChange={t => setDescription(t.target.value)}
              />
              <InputHelper>
                Describe what this assistant does and its intended use case.
              </InputHelper>
            </FieldSet>
            {errorMessage && <ErrorMessage message={errorMessage} />}
            <div>
              <IBlueBGButton
                type="button"
                isLoading={loading}
                onClick={onUpdateAssistantDetail}
              >
                Save changes
              </IBlueBGButton>
            </div>
          </div>

          {/* ── Danger Zone ────────────────────────────────────────── */}
          <div className="flex flex-col gap-6">
            <SectionDivider label="Danger Zone" />
            <div className="flex rounded-none border-0">
              {/* Left accent bar — 3px red */}
              <div className="w-[3px] flex-shrink-0 bg-red-600" />
              {/* Notification body */}
              <div className="flex-1 flex items-start justify-between gap-6 px-4 py-4 bg-red-50 dark:bg-red-950/20">
                <div className="flex flex-col gap-1.5">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <AlertTriangle
                      className="w-4 h-4 text-red-600 flex-shrink-0"
                      strokeWidth={1.5}
                    />
                    Delete this assistant
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
                    Once deleted, all active connections will be terminated
                    immediately and data will be permanently removed after the
                    rolling retention period. This action cannot be undone.
                  </p>
                </div>
                <IRedBGButton
                  className="shrink-0"
                  isLoading={loading}
                  onClick={Deletion.showDialog}
                >
                  Delete assistant
                </IRedBGButton>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};
