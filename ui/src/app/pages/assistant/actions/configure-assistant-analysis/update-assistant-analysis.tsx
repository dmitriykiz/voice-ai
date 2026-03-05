import React, { FC, useEffect, useState } from 'react';
import { useConfirmDialog } from '@/app/pages/assistant/actions/hooks/use-confirmation';
import { useGlobalNavigation } from '@/hooks/use-global-navigator';
import {
  IBlueBGArrowButton,
  IBlueBorderButton,
  ICancelButton,
  IRedBorderButton,
} from '@/app/components/form/button';
import { FieldSet } from '@/app/components/form/fieldset';
import { FormLabel } from '@/app/components/form-label';
import { Input } from '@/app/components/form/input';
import { Select } from '@/app/components/form/select';
import { Textarea } from '@/app/components/form/textarea';
import { InputHelper } from '@/app/components/input-helper';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { useCurrentCredential } from '@/hooks/use-credential';
import { randomMeaningfullName } from '@/utils';
import { EndpointDropdown } from '@/app/components/dropdown/endpoint-dropdown';
import {
  Endpoint,
  GetAssistantAnalysis,
  UpdateAnalysis,
} from '@rapidaai/react';
import { useParams } from 'react-router-dom';
import toast from 'react-hot-toast/headless';
import { connectionConfig } from '@/configs';
import { TabForm } from '@/app/components/form/tab-form';
import { SectionDivider } from '@/app/components/blocks/section-divider';

export const UpdateAssistantAnalysis: FC<{ assistantId: string }> = ({
  assistantId,
}) => {
  const navigator = useGlobalNavigation();
  const { analysisId } = useParams();
  const { authId, token, projectId } = useCurrentCredential();
  const { showDialog, ConfirmDialogComponent } = useConfirmDialog({});

  const [activeTab, setActiveTab] = useState('configure');
  const [errorMessage, setErrorMessage] = useState('');

  const [name, setName] = useState(randomMeaningfullName());
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<number>(0);
  const [endpointId, setEndpointId] = useState<string>('');
  const [parameters, setParameters] = useState<
    {
      type:
        | 'assistant'
        | 'conversation'
        | 'argument'
        | 'metadata'
        | 'option'
        | 'analysis';
      key: string;
      value: string;
    }[]
  >([]);

  useEffect(() => {
    GetAssistantAnalysis(
      connectionConfig,
      assistantId,
      analysisId!,
      (err, res) => {
        if (err) {
          toast.error('Unable to load analysis, please try again later.');
          return;
        }
        const wb = res?.getData();
        if (wb) {
          setName(wb.getName());
          setDescription(wb.getDescription());
          setPriority(wb.getExecutionpriority());
          setEndpointId(wb.getEndpointid());
          const parametersMap = wb.getEndpointparametersMap();
          setParameters(
            Array.from(parametersMap.entries()).map(([key, value]) => {
              const [type, paramKey] = key.split('.');
              return {
                type: type as
                  | 'assistant'
                  | 'conversation'
                  | 'argument'
                  | 'metadata'
                  | 'option'
                  | 'analysis',
                key: paramKey,
                value,
              };
            }),
          );
        }
      },
      {
        'x-auth-id': authId,
        authorization: token,
        'x-project-id': projectId,
      },
    );
  }, [assistantId, analysisId, authId, token, projectId]);

  const updateParameter = (index: number, field: string, value: string) => {
    setParameters(prevParams =>
      prevParams.map((param, i) =>
        i === index ? { ...param, [field]: value } : param,
      ),
    );
  };

  const validateConfigure = (): boolean => {
    setErrorMessage('');
    if (!endpointId) {
      setErrorMessage(
        'Please select a valid endpoint to be executed for analysis.',
      );
      return false;
    }
    if (parameters.length === 0) {
      setErrorMessage(
        'Please provide one or more parameters which can be passed as data to your server.',
      );
      return false;
    }
    const keys = parameters.map(param => `${param.type}.${param.key}`);
    const uniqueKeys = new Set(keys);
    if (keys.length !== uniqueKeys.size) {
      setErrorMessage('Duplicate parameter keys are not allowed.');
      return false;
    }
    const emptyKeysOrValues = parameters.filter(
      param => param.key.trim() === '' || param.value.trim() === '',
    );
    if (emptyKeysOrValues.length > 0) {
      setErrorMessage('Empty parameter keys or values are not allowed.');
      return false;
    }
    const values = parameters.map(param => param.value.trim());
    const uniqueValues = new Set(values);
    if (values.length !== uniqueValues.size) {
      setErrorMessage('Duplicate parameter values are not allowed.');
      return false;
    }
    return true;
  };

  const onSubmit = () => {
    setErrorMessage('');
    if (!name) {
      setErrorMessage('Please provide a valid name for analysis.');
      return;
    }

    const parameterKeyValuePairs = parameters.map(param => ({
      key: `${param.type}.${param.key}`,
      value: param.value,
    }));

    UpdateAnalysis(
      connectionConfig,
      assistantId,
      analysisId!,
      name,
      endpointId,
      'latest',
      priority,
      parameterKeyValuePairs,
      (err, response) => {
        if (err) {
          setErrorMessage(
            'Unable to update assistant analysis, please check and try again.',
          );
          return;
        }
        if (response?.getSuccess()) {
          toast.success(`Assistant's analysis updated successfully`);
          navigator.goToConfigureAssistantAnalysis(assistantId);
        } else {
          if (response?.getError()) {
            const message = response.getError()?.getHumanmessage();
            if (message) {
              setErrorMessage(message);
              return;
            }
          }
          setErrorMessage(
            'Unable to update assistant analysis, please check and try again.',
          );
        }
      },
      {
        'x-auth-id': authId,
        authorization: token,
        'x-project-id': projectId,
      },
      description,
    );
  };

  return (
    <>
      <ConfirmDialogComponent />
      <TabForm
        formHeading="Update all steps to reconfigure your analysis."
        activeTab={activeTab}
        onChangeActiveTab={() => {}}
        errorMessage={errorMessage}
        form={[
          {
            code: 'configure',
            name: 'Configure',
            description:
              'Select the endpoint and map the data parameters for analysis.',
            actions: [
              <ICancelButton
                className="w-full h-full"
                type="button"
                onClick={() => showDialog(navigator.goBack)}
              >
                Cancel
              </ICancelButton>,
              <IBlueBGArrowButton
                type="button"
                className="w-full h-full"
                onClick={() => {
                  if (validateConfigure()) setActiveTab('profile');
                }}
              >
                Continue
              </IBlueBGArrowButton>,
            ],
            body: (
              <div className="px-8 pt-6 pb-8 max-w-4xl flex flex-col gap-8">
                {/* Endpoint */}
                <div className="flex flex-col gap-6">
                  <SectionDivider label="Endpoint" />
                  <EndpointDropdown
                    currentEndpoint={endpointId}
                    onChangeEndpoint={(e: Endpoint) => {
                      if (e) setEndpointId(e.getId());
                    }}
                  />
                </div>

                {/* Parameters */}
                <div className="flex flex-col gap-6">
                  <SectionDivider label={`Parameters (${parameters.length})`} />
                  <FieldSet>
                    <div className="text-sm grid w-full">
                      {parameters.map((param, index) => (
                        <div
                          key={index}
                          className="grid grid-cols-2 border-b border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex col-span-1 items-center">
                            <Select
                              value={param.type}
                              onChange={e =>
                                updateParameter(index, 'type', e.target.value)
                              }
                              className="border-none"
                              options={[
                                { name: 'Assistant', value: 'assistant' },
                                {
                                  name: 'Conversation',
                                  value: 'conversation',
                                },
                                { name: 'Argument', value: 'argument' },
                                { name: 'Metadata', value: 'metadata' },
                                { name: 'Option', value: 'option' },
                                { name: 'Analysis', value: 'analysis' },
                              ]}
                            />
                            <TypeKeySelector
                              type={param.type}
                              value={param.key}
                              onChange={newKey =>
                                updateParameter(index, 'key', newKey)
                              }
                            />
                            <div className="bg-light-background dark:bg-gray-950 h-full flex items-center justify-center px-2">
                              <ArrowRight
                                strokeWidth={1.5}
                                className="w-4 h-4"
                              />
                            </div>
                          </div>
                          <div className="col-span-1 flex">
                            <Input
                              value={param.value}
                              onChange={e =>
                                updateParameter(index, 'value', e.target.value)
                              }
                              placeholder="Value"
                              className="w-full border-none"
                            />
                            <IRedBorderButton
                              className="border-none outline-hidden dark:bg-gray-950 h-10"
                              onClick={() =>
                                setParameters(
                                  parameters.filter((_, i) => i !== index),
                                )
                              }
                              type="button"
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                            </IRedBorderButton>
                          </div>
                        </div>
                      ))}
                    </div>
                    <IBlueBorderButton
                      onClick={() =>
                        setParameters([
                          ...parameters,
                          { type: 'assistant', key: '', value: '' },
                        ])
                      }
                      className="justify-between space-x-8"
                      type="button"
                    >
                      <span>Add parameter</span>
                      <Plus className="h-4 w-4 ml-1.5" />
                    </IBlueBorderButton>
                  </FieldSet>
                </div>
              </div>
            ),
          },
          {
            code: 'profile',
            name: 'Profile',
            description:
              'Provide a name and set the execution priority for this analysis.',
            actions: [
              <ICancelButton
                className="w-full h-full"
                type="button"
                onClick={() => showDialog(navigator.goBack)}
              >
                Cancel
              </ICancelButton>,
              <IBlueBGArrowButton
                type="button"
                className="w-full h-full"
                onClick={onSubmit}
              >
                Update analysis
              </IBlueBGArrowButton>,
            ],
            body: (
              <div className="px-8 pt-8 pb-8 max-w-2xl flex flex-col gap-10">
                {/* Identity */}
                <div className="flex flex-col gap-6">
                  <SectionDivider label="Identity" />
                  <FieldSet>
                    <FormLabel>Name</FormLabel>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="A name for your analysis"
                    />
                    <InputHelper>
                      A unique name to identify this analysis configuration.
                    </InputHelper>
                  </FieldSet>
                  <FieldSet>
                    <FormLabel>Description (Optional)</FormLabel>
                    <Textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="An optional description of this analysis..."
                      rows={2}
                    />
                  </FieldSet>
                </div>

                {/* Configuration */}
                <div className="flex flex-col gap-6">
                  <SectionDivider label="Configuration" />
                  <FieldSet className="w-40">
                    <FormLabel>Execution Priority</FormLabel>
                    <Input
                      type="number"
                      min={0}
                      value={priority}
                      onChange={e => setPriority(Number(e.target.value))}
                    />
                    <InputHelper>
                      Lower numbers execute first when multiple analyses are
                      triggered.
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

const TypeKeySelector: FC<{
  type:
    | 'assistant'
    | 'conversation'
    | 'argument'
    | 'metadata'
    | 'option'
    | 'analysis';
  value: string;
  onChange: (newValue: string) => void;
}> = ({ type, value, onChange }) => {
  switch (type) {
    case 'assistant':
      return (
        <Select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="border-none"
          options={[
            { name: 'Name', value: 'name' },
            { name: 'Prompt', value: 'prompt' },
          ]}
        />
      );
    case 'conversation':
      return (
        <Select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="border-none"
          options={[{ name: 'Messages', value: 'messages' }]}
        />
      );
    default:
      return (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Key"
          className="w-full border-none"
        />
      );
  }
};
