import {
  ConfigureExperience,
  ExperienceConfig,
} from '@/app/pages/assistant/actions/create-deployment/commons/configure-experience';
import { ConfigureAudioOutputProvider } from '@/app/pages/assistant/actions/create-deployment/commons/configure-audio-output';
import { ConfigureAudioInputProvider } from '@/app/pages/assistant/actions/create-deployment/commons/configure-audio-input';
import { useRapidaStore } from '@/hooks';
import { useAllProviderCredentials } from '@/hooks/use-model';
import { useCurrentCredential } from '@/hooks/use-credential';
import { useGlobalNavigation } from '@/hooks/use-global-navigator';
import { Code } from 'lucide-react';
import { FC, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  AssistantDebuggerDeployment,
  ConnectionConfig,
  CreateAssistantApiDeployment,
  CreateAssistantDeploymentRequest,
  DeploymentAudioProvider,
  GetAssistantDeploymentRequest,
  Metadata,
} from '@rapidaai/react';
import { GetAssistantApiDeployment } from '@rapidaai/react';
import toast from 'react-hot-toast/headless';
import { Helmet } from '@/app/components/helmet';
import {
  GetDefaultMicrophoneConfig,
  GetDefaultSpeechToTextIfInvalid,
  ValidateSpeechToTextIfInvalid,
} from '@/app/components/providers/speech-to-text/provider';
import {
  GetDefaultSpeakerConfig,
  GetDefaultTextToSpeechIfInvalid,
  ValidateTextToSpeechIfInvalid,
} from '@/app/components/providers/text-to-speech/provider';
import { connectionConfig } from '@/configs';
import { useConfirmDialog } from '@/app/pages/assistant/actions/hooks/use-confirmation';
import { TabForm } from '@/app/components/form/tab-form';
import { ISecondaryButton } from '../../../../../components/form/button/index';
import {
  IBlueBGArrowButton,
  ICancelButton,
} from '@/app/components/form/button';

const STEPS = [
  {
    code: 'experience',
    name: 'General Experience',
    description: 'Define how the assistant greets users and handles sessions.',
  },
  {
    code: 'voice-input',
    name: 'Voice Input',
    description:
      'Configure the speech-to-text provider for capturing user audio.',
  },
  {
    code: 'voice-output',
    name: 'Voice Output',
    description: 'Configure the text-to-speech provider for audio responses.',
  },
];

export function ConfigureAssistantApiDeploymentPage() {
  const { assistantId } = useParams();
  return (
    <>
      <Helmet title="Configure api deployment" />
      {assistantId && (
        <ConfigureAssistantApiDeployment assistantId={assistantId} />
      )}
    </>
  );
}

const ConfigureAssistantApiDeployment: FC<{ assistantId: string }> = ({
  assistantId,
}) => {
  const { goToDeploymentAssistant } = useGlobalNavigation();
  const { loading, showLoader, hideLoader } = useRapidaStore();
  const { providerCredentials } = useAllProviderCredentials();
  const { authId, projectId, token } = useCurrentCredential();
  const { showDialog, ConfirmDialogComponent } = useConfirmDialog({});

  const [activeTab, setActiveTab] = useState('experience');
  const [errorMessage, setErrorMessage] = useState('');
  const [voiceInputEnable, setVoiceInputEnable] = useState(false);

  const [experienceConfig, setExperienceConfig] = useState<ExperienceConfig>({
    greeting: undefined,
    messageOnError: undefined,
    idealTimeout: '30',
    idealMessage: 'Are you there?',
    maxCallDuration: '300',
    idleTimeoutBackoffTimes: '2',
  });

  const [audioInputConfig, setAudioInputConfig] = useState<{
    provider: string;
    parameters: Metadata[];
  }>({
    provider: 'deepgram',
    parameters: GetDefaultSpeechToTextIfInvalid(
      'deepgram',
      GetDefaultMicrophoneConfig(),
    ),
  });

  const [audioOutputConfig, setAudioOutputConfig] = useState<{
    provider: string;
    parameters: Metadata[];
  }>({
    provider: 'cartesia',
    parameters: GetDefaultTextToSpeechIfInvalid(
      'cartesia',
      GetDefaultSpeakerConfig(),
    ),
  });

  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    showLoader('block');
    const request = new GetAssistantDeploymentRequest();
    request.setAssistantid(assistantId);
    GetAssistantApiDeployment(
      connectionConfig,
      request,
      ConnectionConfig.WithDebugger({
        authorization: token,
        userId: authId,
        projectId,
      }),
    )
      .then(response => {
        hideLoader();
        if (response?.getData()) {
          const deployment = response.getData();
          setExperienceConfig({
            greeting: deployment?.getGreeting(),
            messageOnError: deployment?.getMistake(),
            idealTimeout: deployment?.getIdealtimeout(),
            idealMessage: deployment?.getIdealtimeoutmessage(),
            maxCallDuration: deployment?.getMaxsessionduration(),
            idleTimeoutBackoffTimes: deployment?.getIdealtimeoutbackoff(),
          });

          if (deployment?.getInputaudio()) {
            const provider = deployment.getInputaudio()!;
            setVoiceInputEnable(true);
            setAudioInputConfig({
              provider: provider.getAudioprovider() || 'deepgram',
              parameters: GetDefaultSpeechToTextIfInvalid(
                provider.getAudioprovider() || 'deepgram',
                GetDefaultMicrophoneConfig(
                  provider.getAudiooptionsList() || [],
                ),
              ),
            });
          }

          if (deployment?.getOutputaudio()) {
            const provider = deployment.getOutputaudio()!;
            setAudioOutputConfig({
              provider: provider.getAudioprovider() || 'cartesia',
              parameters: GetDefaultTextToSpeechIfInvalid(
                provider.getAudioprovider() || 'cartesia',
                GetDefaultSpeakerConfig(
                  provider.getAudiooptionsList() || [],
                ),
              ),
            });
          }
        }
      })
      .catch(err => {
        hideLoader();
        setErrorMessage(
          err?.message || 'Failed to fetch deployment configuration',
        );
      });
  }, [assistantId, token, authId, projectId]);

  const getProviderCredentialIds = (provider: string) =>
    providerCredentials
      .filter(c => c.getProvider() === provider)
      .map(c => c.getId());

  const handleTabChange = (code: string) => {
    const clickedIndex = STEPS.findIndex(s => s.code === code);
    const currentIndex = STEPS.findIndex(s => s.code === activeTab);
    if (clickedIndex < currentIndex) {
      setActiveTab(code);
      setErrorMessage('');
    }
  };

  const handleNext = () => {
    setErrorMessage('');
    const idx = STEPS.findIndex(s => s.code === activeTab);

    if (activeTab === 'voice-input') {
      if (!audioInputConfig.provider) {
        setErrorMessage('Please select a speech-to-text provider.');
        return;
      }
      const err = ValidateSpeechToTextIfInvalid(
        audioInputConfig.provider,
        audioInputConfig.parameters,
        getProviderCredentialIds(audioInputConfig.provider),
      );
      if (err) {
        setErrorMessage(err);
        return;
      }
      setVoiceInputEnable(true);
    }

    if (idx < STEPS.length - 1) {
      setActiveTab(STEPS[idx + 1].code);
    }
  };

  const handleSkipVoiceInput = () => {
    setErrorMessage('');
    setVoiceInputEnable(false);
    setActiveTab('voice-output');
  };

  // includeVoiceOutput is passed directly to avoid React state timing issues
  // on the last step where Skip and Deploy are on the same step.
  const handleDeployApi = (includeVoiceOutput: boolean) => {
    showLoader('block');
    setErrorMessage('');

    if (voiceInputEnable) {
      if (!audioInputConfig.provider) {
        hideLoader();
        setErrorMessage(
          'Please provide a provider for interpreting input audio.',
        );
        return;
      }
      const err = ValidateSpeechToTextIfInvalid(
        audioInputConfig.provider,
        audioInputConfig.parameters,
        getProviderCredentialIds(audioInputConfig.provider),
      );
      if (err) {
        hideLoader();
        setErrorMessage(err);
        return;
      }
    }

    if (includeVoiceOutput) {
      if (!audioOutputConfig.provider) {
        hideLoader();
        setErrorMessage(
          'Please provide a provider for interpreting output audio.',
        );
        return;
      }
      const err = ValidateTextToSpeechIfInvalid(
        audioOutputConfig.provider,
        audioOutputConfig.parameters,
        getProviderCredentialIds(audioOutputConfig.provider),
      );
      if (err) {
        hideLoader();
        setErrorMessage(err);
        return;
      }
    }

    const req = new CreateAssistantDeploymentRequest();
    const deployment = new AssistantDebuggerDeployment();
    deployment.setAssistantid(assistantId);
    if (experienceConfig.greeting)
      deployment.setGreeting(experienceConfig.greeting);
    if (experienceConfig.messageOnError)
      deployment.setMistake(experienceConfig.messageOnError);
    if (experienceConfig.idealTimeout)
      deployment.setIdealtimeout(experienceConfig.idealTimeout);
    if (experienceConfig.idleTimeoutBackoffTimes)
      deployment.setIdealtimeoutbackoff(
        experienceConfig.idleTimeoutBackoffTimes,
      );
    if (experienceConfig.idealMessage)
      deployment.setIdealtimeoutmessage(experienceConfig.idealMessage);
    if (experienceConfig.maxCallDuration)
      deployment.setMaxsessionduration(experienceConfig.maxCallDuration);

    if (voiceInputEnable) {
      const inputAudio = new DeploymentAudioProvider();
      inputAudio.setAudioprovider(audioInputConfig.provider);
      inputAudio.setAudiooptionsList(audioInputConfig.parameters);
      deployment.setInputaudio(inputAudio);
    }

    if (includeVoiceOutput) {
      const outputAudio = new DeploymentAudioProvider();
      outputAudio.setAudioprovider(audioOutputConfig.provider);
      outputAudio.setAudiooptionsList(audioOutputConfig.parameters);
      deployment.setOutputaudio(outputAudio);
    }

    req.setApi(deployment);
    CreateAssistantApiDeployment(
      connectionConfig,
      req,
      ConnectionConfig.WithDebugger({
        authorization: token,
        userId: authId,
        projectId,
      }),
    )
      .then(response => {
        hideLoader();
        if (response?.getData() && response.getSuccess()) {
          toast.success('SDK / API deployment updated successfully.');
          goToDeploymentAssistant(assistantId);
        } else {
          toast.error(
            response?.getError()?.getHumanmessage() ||
              'Unable to create deployment, please try again.',
          );
        }
      })
      .catch(err => {
        hideLoader();
        setErrorMessage(
          err?.message || 'Error deploying as API. Please try again.',
        );
      });
  };

  return (
    <>
      <ConfirmDialogComponent />
      <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-900">
        {/* Page header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0 flex items-center gap-3">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              SDK / API Deployment
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Configure your assistant for React and REST SDK integration.
            </p>
          </div>
        </div>

        <TabForm
          formHeading="Complete all steps to configure your SDK / API deployment."
          activeTab={activeTab}
          onChangeActiveTab={handleTabChange}
          errorMessage={errorMessage}
          form={[
            {
              code: 'experience',
              name: 'General Experience',
              description:
                'Define how the assistant greets users and handles sessions.',
              body: (
                <ConfigureExperience
                  experienceConfig={experienceConfig}
                  setExperienceConfig={setExperienceConfig}
                />
              ),
              actions: [
                <ICancelButton
                  className="w-full h-full"
                  onClick={() =>
                    showDialog(() => goToDeploymentAssistant(assistantId))
                  }
                >
                  Cancel
                </ICancelButton>,
                <IBlueBGArrowButton
                  type="button"
                  className="w-full h-full"
                  onClick={handleNext}
                >
                  Next
                </IBlueBGArrowButton>,
              ],
            },
            {
              code: 'voice-input',
              name: 'Voice Input',
              description:
                'Configure the speech-to-text provider for capturing user audio.',
              body: (
                <ConfigureAudioInputProvider
                  audioInputConfig={audioInputConfig}
                  setAudioInputConfig={setAudioInputConfig}
                />
              ),
              actions: [
                <ICancelButton
                  className="w-full h-full"
                  onClick={() =>
                    showDialog(() => goToDeploymentAssistant(assistantId))
                  }
                >
                  Cancel
                </ICancelButton>,
                <ISecondaryButton
                  className="w-full h-full"
                  onClick={handleSkipVoiceInput}
                >
                  Skip
                </ISecondaryButton>,
                <IBlueBGArrowButton
                  type="button"
                  className="w-full h-full"
                  onClick={handleNext}
                >
                  Next
                </IBlueBGArrowButton>,
              ],
            },
            {
              code: 'voice-output',
              name: 'Voice Output',
              description:
                'Configure the text-to-speech provider for audio responses.',
              body: (
                <ConfigureAudioOutputProvider
                  audioOutputConfig={audioOutputConfig}
                  setAudioOutputConfig={setAudioOutputConfig}
                />
              ),
              actions: [
                <ICancelButton
                  className="w-full h-full"
                  onClick={() =>
                    showDialog(() => goToDeploymentAssistant(assistantId))
                  }
                >
                  Cancel
                </ICancelButton>,
                <ISecondaryButton
                  className="w-full h-full"
                  onClick={() => handleDeployApi(false)}
                >
                  Skip
                </ISecondaryButton>,
                <IBlueBGArrowButton
                  type="button"
                  className="w-full h-full"
                  isLoading={loading}
                  onClick={() => handleDeployApi(true)}
                >
                  Deploy API
                </IBlueBGArrowButton>,
              ],
            },
          ]}
        />
      </div>
    </>
  );
};
