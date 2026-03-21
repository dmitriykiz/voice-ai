import { FC, useEffect, useState } from 'react';
import { useRapidaStore } from '@/hooks';
import { useCurrentCredential } from '@/hooks/use-credential';
import { useParams } from 'react-router-dom';
import { Helmet } from '@/app/components/helmet';
import {
  IBlueBGArrowButton,
  ICancelButton,
} from '@/app/components/form/button';
import { TabForm } from '@/app/components/form/tab-form';
import { FieldSet } from '@/app/components/form/fieldset';
import { useConfirmDialog } from '@/app/pages/assistant/actions/hooks/use-confirmation';
import { useGlobalNavigation } from '@/hooks/use-global-navigator';
import {
  CreateAssistantProvider,
  GetAssistantProviderResponse,
  GetAssistantRequest,
  GetAssistant,
  CreateAssistantProviderRequest,
  AssistantDefinition,
  Metadata,
  ConnectionConfig,
} from '@rapidaai/react';
import { FormLabel } from '@/app/components/form-label';
import { Textarea } from '@/app/components/form/textarea';
import { ConfigPrompt } from '@/app/components/configuration/config-prompt';
import { ErrorContainer } from '@/app/components/error-container';
import { ChatCompletePrompt, Prompt } from '@/utils/prompt';
import {
  GetDefaultTextProviderConfigIfInvalid,
  TextProvider,
} from '@/app/components/providers/text';
import { randomString } from '@/utils';
import { ValidateTextProviderDefaultOptions } from '@/app/components/providers/text/index';
import { useAllProviderCredentials } from '@/hooks/use-model';
import { connectionConfig } from '@/configs';
import { DocNoticeBlock } from '@/app/components/container/message/notice-block/doc-notice-block';
import { InputHelper } from '@/app/components/input-helper';
import toast from 'react-hot-toast/headless';
import { SectionDivider } from '@/app/components/blocks/section-divider';

/**
 *
 * @returns
 */
export function CreateVersionAssistantPage() {
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
  return <CreateNewVersion assistantId={assistantId!} />;
}

/**
 *
 * @param props
 * @returns
 */
const CreateNewVersion: FC<{ assistantId: string }> = ({ assistantId }) => {
  /**
   *
   */
  const { authId, token, projectId } = useCurrentCredential();
  /**
   * Multistep form stage
   */
  const [activeTab, setActiveTab] = useState('change-assistant');
  const navigator = useGlobalNavigation();
  /**
   * error message
   */
  const [errorMessage, setErrorMessage] = useState('');
  /**
   * confirmation dialog
   */
  const { showDialog, ConfirmDialogComponent } = useConfirmDialog({});
  /**
   * selected model and parameters
   */
  const [selectedModel, setSelectedModel] = useState<{
    provider: string;
    parameters: Metadata[];
  }>({
    provider: 'azure-foundry',
    parameters: GetDefaultTextProviderConfigIfInvalid('azure-foundry', []),
  });

  /**
   * prompt template
   */
  const [template, setTemplate] = useState<{
    prompt: { role: string; content: string }[];
    variables: { name: string; type: string; defaultvalue: string }[];
  }>({
    prompt: [],
    variables: [],
  });

  /**
   * current data used as commit message
   */
  const [versionMessage, setVersionMessage] = useState(
    `Changed on ${new Date().toLocaleDateString()}`,
  );

  /**
   * global loader
   */
  const { loading, showLoader, hideLoader } = useRapidaStore();
  const { providerCredentials } = useAllProviderCredentials();

  const onChangeProvider = (providerName: string) => {
    const parametersWithoutCredential = selectedModel.parameters.filter(
      p => p.getKey() !== 'rapida.credential_id',
    );
    setSelectedModel({
      provider: providerName,
      parameters: GetDefaultTextProviderConfigIfInvalid(
        providerName,
        parametersWithoutCredential,
      ),
    });
  };

  const onChangeProviderParameter = (parameters: Metadata[]) => {
    setSelectedModel({ ...selectedModel, parameters });
  };

  const validateInstruction = (): boolean => {
    setErrorMessage('');
    let err = ValidateTextProviderDefaultOptions(
      selectedModel.provider,
      selectedModel.parameters,
      providerCredentials
        .filter(c => c.getProvider() === selectedModel.provider)
        .map(c => c.getId()),
    );
    if (err) {
      setErrorMessage(err);
      return false;
    }

    // Add template prompt validation
    if (!template.prompt || template.prompt.length === 0) {
      setErrorMessage('Please provide a valid template prompt.');
      return false;
    }

    // Validate each prompt message in the template
    for (const message of template.prompt) {
      if (!message.role || !message.content || message.content.trim() === '') {
        setErrorMessage(
          'Each prompt message must have a valid role and non-empty content.',
        );
        return false;
      }
    }
    return true;
  };

  const createProviderModel = () => {
    setErrorMessage('');
    if (!versionMessage || versionMessage.trim() === '') {
      setErrorMessage('Please provide a valid version description.');
      return;
    }
    showLoader();
    const request = new CreateAssistantProviderRequest();
    const model =
      new CreateAssistantProviderRequest.CreateAssistantProviderModel();
    model.setAssistantmodeloptionsList(selectedModel.parameters);
    model.setTemplate(ChatCompletePrompt(template));
    model.setModelprovidername(selectedModel.provider);
    request.setModel(model);
    request.setAssistantid(assistantId);
    request.setDescription(versionMessage);
    //
    CreateAssistantProvider(
      connectionConfig,
      request,
      ConnectionConfig.WithDebugger({
        authorization: token,
        userId: authId,
        projectId: projectId,
      }),
    )
      .then((car: GetAssistantProviderResponse) => {
        hideLoader();
        if (car?.getSuccess()) {
          toast.success(
            'Assistant version with model has been created successfully.',
          );
          navigator.goToAssistantVersions(assistantId);
        } else {
          const errorMessage =
            'Unable to create assistant version. please try again later.';
          const error = car?.getError();
          if (error) {
            setErrorMessage(error.getHumanmessage());
            return;
          }
          setErrorMessage(errorMessage);
          return;
        }
      })
      .catch(err => {
        setErrorMessage(
          'Unable to create assistant version. please try again later.',
        );
      });
  };

  //
  useEffect(() => {
    showLoader();
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
      .then(response => {
        hideLoader();
        if (response?.getSuccess()) {
          const assistantProvider = response
            .getData()
            ?.getAssistantprovidermodel();
          if (assistantProvider) {
            setTemplate(Prompt(assistantProvider.getTemplate()!));
            setSelectedModel({
              parameters: GetDefaultTextProviderConfigIfInvalid(
                assistantProvider.getModelprovidername(),
                assistantProvider.getAssistantmodeloptionsList(),
              ),
              provider: assistantProvider.getModelprovidername(),
            });
          }
          return;
        }
        const error = response?.getError();
        const errorMsg = error
          ? error.getHumanmessage()
          : 'Unable to get latest assistant provider. Please try again later.';
        setErrorMessage(errorMsg);
      })
      .catch(err => {
        hideLoader();
        setErrorMessage(
          'Unable to get latest assistant provider. Please try again later.',
        );
      });
  }, [assistantId]);

  return (
    <>
      <ConfirmDialogComponent />
      <Helmet title="Create new version"></Helmet>
      <TabForm
        activeTab={activeTab}
        formHeading="Create a new version of this assistant."
        onChangeActiveTab={() => {}}
        errorMessage={errorMessage}
        form={[
          {
            code: 'change-assistant',
            name: 'Update Assistant',
            description:
              "Update the assistant's definition — including the model, instructions, and variables — as needed.",
            actions: [
              <ICancelButton
                className="w-full h-full"
                onClick={() => showDialog(navigator.goBack)}
              >
                Cancel
              </ICancelButton>,
              <IBlueBGArrowButton
                type="button"
                isLoading={loading}
                onClick={() => {
                  if (validateInstruction()) {
                    setActiveTab('commit-assistant');
                  }
                }}
                className="w-full h-full"
              >
                Continue
              </IBlueBGArrowButton>,
            ],
            body: (
              <>
                <DocNoticeBlock
                  docUrl="https://doc.rapida.ai/assistants/create-new-version"
                  linkText="Read docs"
                >
                  New versions of the assistant will not be deployed
                  automatically. You must promote them manually.
                </DocNoticeBlock>
                <div className="px-8 pt-6 pb-8 max-w-4xl flex flex-col gap-8">
                  {/* Model configuration section */}
                  <div className="flex flex-col gap-6">
                    <SectionDivider label="Model Configuration" />
                    <TextProvider
                      onChangeParameter={onChangeProviderParameter}
                      onChangeProvider={onChangeProvider}
                      parameters={selectedModel.parameters}
                      provider={selectedModel.provider}
                    />
                  </div>

                  {/* Prompt template section */}
                  <div className="flex flex-col gap-6">
                    <SectionDivider label="Prompt Template" />
                    <ConfigPrompt
                      instanceId={randomString(10)}
                      existingPrompt={template}
                      onChange={prompt => setTemplate(prompt)}
                    />
                  </div>
                </div>
              </>
            ),
          },
          {
            code: 'commit-assistant',
            name: 'Version note',
            description:
              'Write a brief note describing what changed in this version.',
            actions: [
              <ICancelButton
                className="w-full h-full"
                onClick={() => showDialog(navigator.goBack)}
              >
                Cancel
              </ICancelButton>,
              <IBlueBGArrowButton
                isLoading={loading}
                type="button"
                onClick={() => {
                  createProviderModel();
                }}
                className="w-full h-full"
              >
                Create new version
              </IBlueBGArrowButton>,
            ],
            body: (
              <div className="px-8 pt-8 pb-8 max-w-2xl flex flex-col gap-10">
                <div className="flex flex-col gap-6">
                  <SectionDivider label="Version Description" />
                  <FieldSet>
                    <FormLabel>Version note</FormLabel>
                    <Textarea
                      row={5}
                      value={versionMessage}
                      placeholder="Provide a clear and detailed explanation of the changes made to this assistant."
                      onChange={t => setVersionMessage(t.target.value)}
                    />
                    <InputHelper>
                      Summarize the changes made to the assistant, highlight key
                      updates, and specify why these modifications are
                      necessary.
                    </InputHelper>
                  </FieldSet>
                </div>
              </div>
            ),
          },
        ]}
      />
    </>
  );
};
