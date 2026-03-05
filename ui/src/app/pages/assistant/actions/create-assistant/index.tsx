import { useState } from 'react';
import { Helmet } from '@/app/components/helmet';
import { useRapidaStore } from '@/hooks';
import { TabForm } from '@/app/components/form/tab-form';
import {
  IBlueBGArrowButton,
  IBlueButton,
  ICancelButton,
} from '@/app/components/form/button';
import {
  Assistant,
  ConnectionConfig,
  CreateAssistantProviderRequest,
  CreateAssistantRequest,
  GetAssistantResponse,
  Metadata,
} from '@rapidaai/react';
import { useConfirmDialog } from '@/app/pages/assistant/actions/hooks/use-confirmation';
import { useGlobalNavigation } from '@/hooks/use-global-navigator';
import { useCurrentCredential } from '@/hooks/use-credential';
import { ConfigPrompt } from '@/app/components/configuration/config-prompt';
import { randomMeaningfullName, randomString } from '@/utils';
import { FieldSet } from '@/app/components/form/fieldset';
import { FormLabel } from '@/app/components/form-label';
import { Input } from '@/app/components/form/input';
import { Textarea } from '@/app/components/form/textarea';
import { TagInput } from '@/app/components/form/tag-input';
import { AssistantTag } from '@/app/components/form/tag-input/assistant-tags';
import {
  GetDefaultTextProviderConfigIfInvalid,
  TextProvider,
  ValidateTextProviderDefaultOptions,
} from '@/app/components/providers/text';
import { BuildinToolConfig } from '@/app/components/tools';
import {
  BaseCard,
  CardDescription,
  CardTitle,
} from '@/app/components/base/cards';
import { ArrowUpRight, Plus, SquareFunction } from 'lucide-react';
import { PageHeaderBlock } from '@/app/components/blocks/page-header-block';
import { PageTitleBlock } from '@/app/components/blocks/page-title-block';
import { ActionableEmptyMessage } from '@/app/components/container/message/actionable-empty-message';
import { ConfigureAssistantToolDialog } from '@/app/components/base/modal/assistant-configure-tool-modal';
import { DocNoticeBlock } from '@/app/components/container/message/notice-block/doc-notice-block';
import { CardOptionMenu } from '@/app/components/menu';
import { CreateAssistant } from '@rapidaai/react';
import { CreateAssistantToolRequest } from '@rapidaai/react';
import { Struct } from 'google-protobuf/google/protobuf/struct_pb';
import { connectionConfig } from '@/configs';
import { ChatCompletePrompt } from '@/utils/prompt';
import toast from 'react-hot-toast/headless';
import { InputHelper } from '@/app/components/input-helper';
import { ConfigureAssistantNextDialog } from '@/app/components/base/modal/assistant-configure-next-modal';
import { SectionDivider } from '@/app/components/blocks/section-divider';
import { CornerBorderOverlay } from '@/app/components/base/corner-border';
import {
  AssistantTemplate,
  ConfigureAssistantTemplateDialog,
} from '@/app/components/base/modal/configure-assistant-template-modal';

/**
 *
 * @returns
 */
export function CreateAssistantPage() {
  /**
   * credentils and authentication parameters
   */
  const { authId, token, projectId } = useCurrentCredential();

  /**
   * global reloading
   */
  const { loading, showLoader, hideLoader } = useRapidaStore();

  /**
   * after creation of assistant maintaining stage
   */
  const [assistant, setAssistant] = useState<null | Assistant>(null);

  /**
   * navigation
   */
  const { goBack, goToAssistant } = useGlobalNavigation();

  /**
   *
   */
  const [createAssistantSuccess, setCreateAssistantSuccess] = useState(false);

  /**
   * multi step form
   */
  const [activeTab, setActiveTab] = useState<
    'choose-model' | 'tools' | 'define-assistant'
  >('choose-model');

  /**
   * Error message
   */
  const [errorMessage, setErrorMessage] = useState('');

  /**
   * Form fields
   */
  const [name, setName] = useState(randomMeaningfullName('assistant'));
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tools, setTools] = useState<
    {
      name: string;
      description: string;
      fields: string;
      buildinToolConfig: BuildinToolConfig;
    }[]
  >([]);
  const [editingTool, setEditingTool] = useState<{
    name: string;
    description: string;
    fields: string;
    buildinToolConfig: BuildinToolConfig;
  } | null>(null);
  const [selectedModel, setSelectedModel] = useState<{
    provider: string;
    parameters: Metadata[];
  }>({
    provider: 'azure-foundry',
    parameters: GetDefaultTextProviderConfigIfInvalid('azure-foundry', []),
  });
  const [template, setTemplate] = useState<{
    prompt: { role: string; content: string }[];
    variables: { name: string; type: string; defaultvalue: string }[];
  }>({
    prompt: [{ role: 'system', content: '' }],
    variables: [],
  });
  const { showDialog, ConfirmDialogComponent } = useConfirmDialog({});
  const [configureToolOpen, setConfigureToolOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  /**
   * Applies a selected usecase template to pre-fill the form state.
   */
  const handleSelectTemplate = (tmpl: AssistantTemplate) => {
    setName(tmpl.name);
    setDescription(tmpl.description);

    // Build prompt messages
    const promptMessages = tmpl.instruction.map(inst => ({
      role: inst.role,
      content: inst.content,
    }));

    // Extract {{variable}} references from all prompt content
    const variableRegex = /\{\{\s*(\w+)\s*\}\}/g;
    const variables: { name: string; type: string; defaultvalue: string }[] = [];
    const seen = new Set<string>();
    tmpl.instruction.forEach(inst => {
      let match;
      while ((match = variableRegex.exec(inst.content)) !== null) {
        const varName = match[1];
        if (!seen.has(varName)) {
          seen.add(varName);
          variables.push({ name: varName, type: 'string', defaultvalue: '' });
        }
      }
    });

    setTemplate({
      prompt: promptMessages,
      variables: variables.length > 0 ? variables : [],
    });

    // Apply model/provider settings
    const newParams = GetDefaultTextProviderConfigIfInvalid(tmpl.provider, []);
    const setOrCreate = (key: string, value: string) => {
      const existing = newParams.find(p => p.getKey() === key);
      if (existing) {
        existing.setValue(value);
      } else {
        const m = new Metadata();
        m.setKey(key);
        m.setValue(value);
        newParams.push(m);
      }
    };
    setOrCreate('model.temperature', String(tmpl.parameters.temperature));
    setOrCreate('model.name', tmpl.model);
    setOrCreate('model.id', `${tmpl.provider}/${tmpl.model}`);

    setSelectedModel({ provider: tmpl.provider, parameters: newParams });
  };
  const onAddTag = (tag: string) => {
    setTags([...tags, tag]);
  };
  const onRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };
  const onChangeProvider = (providerName: string) => {
    setSelectedModel({
      provider: providerName,
      parameters: GetDefaultTextProviderConfigIfInvalid(
        providerName,
        selectedModel.parameters,
      ),
    });
  };
  const onChangeParameter = (parameters: Metadata[]) => {
    setSelectedModel({ ...selectedModel, parameters });
  };

  /**
   *
   * @returns
   */
  const createAssistant = () => {
    showLoader('overlay');
    if (!name) {
      setErrorMessage('Please provide a valid name for assistant.');
      return false;
    }
    const assistantToolConfig = tools.map(t => {
      const req = new CreateAssistantToolRequest();
      req.setName(t.name);
      req.setDescription(t.description);
      req.setFields(Struct.fromJavaScript(JSON.parse(t.fields)));
      req.setExecutionmethod(t.buildinToolConfig.code);
      req.setExecutionoptionsList(t.buildinToolConfig.parameters);
      return req;
    });
    const assistantProvider = new CreateAssistantProviderRequest();
    const assistantModel =
      new CreateAssistantProviderRequest.CreateAssistantProviderModel();
    assistantModel.setTemplate(ChatCompletePrompt(template));
    assistantModel.setModelprovidername(selectedModel.provider);
    assistantModel.setAssistantmodeloptionsList(selectedModel.parameters);
    assistantProvider.setModel(assistantModel);
    const request = new CreateAssistantRequest();
    request.setAssistantprovider(assistantProvider);
    request.setAssistanttoolsList(assistantToolConfig);
    request.setName(name);
    request.setTagsList(tags);
    request.setDescription(description);
    CreateAssistant(
      connectionConfig,
      request,
      ConnectionConfig.WithDebugger({
        authorization: token,
        userId: authId,
        projectId: projectId,
      }),
    )
      .then((car: GetAssistantResponse) => {
        hideLoader();
        if (car?.getSuccess()) {
          let ast = car.getData();
          if (ast) {
            toast.success(
              'Assistant Created Successfully, Your AI assistant is ready to be deployed.',
            );
            setAssistant(ast);
            setCreateAssistantSuccess(true);
          }
        } else {
          const errorMessage =
            'Unable to create assistant. please try again later.';
          const error = car?.getError();
          if (error) {
            setErrorMessage(error.getHumanmessage());
            return;
          }
          setErrorMessage(errorMessage);
          return;
        }
      })
      .catch(er => {
        hideLoader();
        const errorMessage =
          'Unable to create assistant. please try again later.';
        setErrorMessage(errorMessage);
        return;
      });
  };

  /**
   * validate instruction
   * @returns
   */
  const validateInstruction = (): boolean => {
    setErrorMessage('');
    let err = ValidateTextProviderDefaultOptions(
      selectedModel.provider,
      selectedModel.parameters,
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

  /**
   * validation of tools
   * @returns
   */
  const validateTool = (): boolean => {
    setErrorMessage('');
    if (tools.length === 0) {
      setErrorMessage('Please add atleast one tool for the assistant.');
      return false;
    }
    return true;
  };

  //
  return (
    <>
      <Helmet title="Create an assistant"></Helmet>
      <ConfirmDialogComponent />

      <ConfigureAssistantTemplateDialog
        modalOpen={templateModalOpen}
        setModalOpen={setTemplateModalOpen}
        onSelectTemplate={handleSelectTemplate}
      />

      {assistant && (
        <ConfigureAssistantNextDialog
          assistant={assistant}
          modalOpen={createAssistantSuccess}
          setModalOpen={() => {
            setCreateAssistantSuccess(false);
            goToAssistant(assistant.getId());
          }}
        />
      )}

      <ConfigureAssistantToolDialog
        modalOpen={configureToolOpen}
        setModalOpen={v => {
          setEditingTool(null);
          setConfigureToolOpen(v);
        }}
        initialData={editingTool}
        onValidateConfig={updatedTool => {
          // Check for empty name
          if (!updatedTool.name.trim()) {
            return 'Please provide a valid tool name.';
          }

          // Check for duplicate name
          const isDuplicate = tools.some(
            tool =>
              tool.name !== editingTool?.name && tool.name === updatedTool.name,
          );

          if (isDuplicate) {
            return 'Please provide a unique tool name for tools.';
          }

          return null;
        }}
        onChange={updatedTool => {
          if (editingTool) {
            setTools(
              tools.map(tool =>
                tool.name === editingTool.name ? updatedTool : tool,
              ),
            );
          } else {
            setTools([...tools, updatedTool]);
          }
          setEditingTool(null);
          setConfigureToolOpen(false);
        }}
      />
      <TabForm
        formHeading="Complete all steps to create a new assistant."
        activeTab={activeTab}
        onChangeActiveTab={() => {}}
        errorMessage={errorMessage}
        form={[
          {
            name: 'Configuration',
            description:
              'Select the LLM provider and configure your prompt template.',
            code: 'choose-model',
            body: (
              <>
                <DocNoticeBlock docUrl="https://doc.rapida.ai/assistants/overview" linkText="Read docs">
                  Rapida Assistant enables you to deploy intelligent
                  conversational agents across multiple channels.
                </DocNoticeBlock>
                <div className="px-8 pt-6 pb-8 max-w-4xl flex flex-col gap-8">
                  {/* Quick start — Usecase Template tile */}
                  <button
                    type="button"
                    className="group relative w-full flex items-start justify-between gap-4 p-4 text-left bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors duration-100"
                    onClick={() => setTemplateModalOpen(true)}
                  >
                    <CornerBorderOverlay />
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-[10px] font-semibold tracking-[0.12em] uppercase text-gray-500 dark:text-gray-400">
                        Quick start
                      </span>
                      <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                        Usecase Template
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-500 leading-relaxed">
                        Browse 8 pre-configured assistant templates and auto-fill your form.
                      </span>
                    </div>
                    <ArrowUpRight
                      className="shrink-0 mt-0.5 text-gray-500 dark:text-gray-400 group-hover:text-primary transition-colors"
                      strokeWidth={1.5}
                      size={16}
                    />
                  </button>

                  {/* Model configuration section */}
                  <div className="flex flex-col gap-6">
                    <SectionDivider label="Model Configuration" />
                    <TextProvider
                      onChangeParameter={onChangeParameter}
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
            actions: [
              <ICancelButton
                className="w-full h-full"
                onClick={() => showDialog(goBack)}
              >
                Cancel
              </ICancelButton>,
              <IBlueBGArrowButton
                type="button"
                isLoading={loading}
                className="w-full h-full"
                onClick={() => {
                  if (validateInstruction()) setActiveTab('tools');
                }}
              >
                Continue
              </IBlueBGArrowButton>,
            ],
          },
          {
            code: 'tools',
            name: 'Tools (optional)',
            description:
              'Let your assistant work with different tools on behalf of you.',
            actions: [
              <ICancelButton
                className="w-full h-full"
                onClick={() => showDialog(goBack)}
              >
                Cancel
              </ICancelButton>,
              <IBlueBGArrowButton
                type="button"
                isLoading={loading}
                className="w-full h-full"
                onClick={() => {
                  if (tools.length === 0) {
                    setTools([]);
                    setErrorMessage('');
                    setActiveTab('define-assistant');
                    return;
                  }
                  if (validateTool()) setActiveTab('define-assistant');
                }}
              >
                {tools.length === 0 ? 'Skip for now' : 'Continue'}
              </IBlueBGArrowButton>,
            ],
            body: (
              <div className="relative flex flex-col flex-1">
                <PageHeaderBlock>
                  <PageTitleBlock>Tools and MCPs</PageTitleBlock>
                  <div className="flex items-stretch border-l border-gray-200 dark:border-gray-800">
                    <IBlueButton
                      onClick={() => {
                        setConfigureToolOpen(true);
                      }}
                    >
                      Add another tool
                      <Plus className="w-4 h-4 ml-1.5" />
                    </IBlueButton>
                  </div>
                </PageHeaderBlock>
                <DocNoticeBlock docUrl="https://doc.rapida.ai/assistants/tools/">
                  Activate the tools you want your assistant to use, allowing
                  it to perform actions like fetching real-time data,
                  processing complex tasks, and more.
                </DocNoticeBlock>
                <div className="overflow-auto flex flex-col flex-1">
                  {tools.length > 0 ? (
                    <section className="grid content-start grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-px bg-gray-200 dark:bg-gray-800 grow shrink-0 m-4">
                      {tools.map((itm, idx) => {
                        const isMCP = itm.buildinToolConfig.code === 'mcp';

                        return (
                          <BaseCard key={idx} className="p-4 md:p-5 col-span-1">
                            <header className="flex justify-between items-start">
                              <div className="flex items-center gap-2">
                                <SquareFunction
                                  className="w-7 h-7"
                                  strokeWidth={1.5}
                                />
                                {isMCP && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 font-medium">
                                    MCP
                                  </span>
                                )}
                              </div>
                              <CardOptionMenu
                                options={[
                                  {
                                    option: (
                                      <span className="text-red-600">
                                        Delete tool
                                      </span>
                                    ),
                                    onActionClick: () => {
                                      setTools(prevTools =>
                                        prevTools.filter(tool => tool !== itm),
                                      );
                                    },
                                  },
                                  {
                                    option: 'Edit tool',
                                    onActionClick: () => {
                                      setEditingTool(itm);
                                      setConfigureToolOpen(true);
                                    },
                                  },
                                ]}
                                classNames="h-8 w-8 p-1 opacity-60"
                              />
                            </header>
                            <div className="flex-1 mt-3">
                              <CardTitle>{itm.name}</CardTitle>
                              <CardDescription>{itm.description}</CardDescription>
                            </div>
                          </BaseCard>
                        );
                      })}
                    </section>
                  ) : (
                    <div className="flex flex-1 items-center justify-center">
                      <ActionableEmptyMessage
                        title="No Tools"
                        subtitle="There are no tools given added to the assistant"
                        action="Add a tool"
                        onActionClick={() => setConfigureToolOpen(true)}
                      />
                    </div>
                  )}
                </div>
              </div>
            ),
          },
          {
            code: 'define-assistant',
            name: 'Profile',
            description:
              'Provide the name, a brief description, and relevant tags for your assistant to help identify and categorize it.',
            actions: [
              <ICancelButton
                className="w-full h-full"
                onClick={() => showDialog(goBack)}
              >
                Cancel
              </ICancelButton>,
              <IBlueBGArrowButton
                isLoading={loading}
                type="button"
                onClick={createAssistant}
                className="w-full h-full"
              >
                Create assistant
              </IBlueBGArrowButton>,
            ],
            body: (
              <div className="px-8 pt-8 pb-8 max-w-2xl flex flex-col gap-10">
                {/* Identity section */}
                <div className="flex flex-col gap-6">
                  <SectionDivider label="Identity" />

                  <FieldSet>
                    <FormLabel
                      htmlFor="agent_name"
                      className="text-xs tracking-wide uppercase"
                    >
                      Name{' '}
                      <span className="text-red-500 ml-0.5 normal-case">*</span>
                    </FormLabel>
                    <Input
                      name="agent_name"
                      onChange={e => {
                        setName(e.target.value);
                      }}
                      value={name}
                      placeholder="e.g. customer-support-assistant"
                    />
                    <InputHelper>
                      Provide a name that will appear in the assistant list and
                      help identify it.
                    </InputHelper>
                  </FieldSet>

                  <FieldSet>
                    <FormLabel
                      htmlFor="description"
                      className="text-xs tracking-wide uppercase"
                    >
                      Description (Optional)
                    </FormLabel>
                    <Textarea
                      row={4}
                      value={description}
                      placeholder="What's the purpose of the assistant?"
                      onChange={t => setDescription(t.target.value)}
                    />
                    <InputHelper>
                      Provide a description to explain what this assistant is
                      about.
                    </InputHelper>
                  </FieldSet>
                </div>

                {/* Labels section */}
                <div className="flex flex-col gap-6">
                  <SectionDivider label="Labels" />
                  <TagInput
                    tags={tags}
                    addTag={onAddTag}
                    removeTag={onRemoveTag}
                    allTags={AssistantTag}
                  />
                  <InputHelper>
                    Tags help you organize and filter assistants across your
                    workspace.
                  </InputHelper>
                </div>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
