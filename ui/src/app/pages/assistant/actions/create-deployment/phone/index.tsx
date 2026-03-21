import {
  ConfigureExperience,
  ExperienceConfig,
} from '@/app/pages/assistant/actions/create-deployment/commons/configure-experience';
import { ConfigureAudioInputProvider } from '@/app/pages/assistant/actions/create-deployment/commons/configure-audio-input';
import { ConfigureAudioOutputProvider } from '@/app/pages/assistant/actions/create-deployment/commons/configure-audio-output';
import { useRapidaStore } from '@/hooks';
import { useAllProviderCredentials } from '@/hooks/use-model';
import { Phone } from 'lucide-react';
import { FC, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useGlobalNavigation } from '@/hooks/use-global-navigator';
import {
  AssistantPhoneDeployment,
  ConnectionConfig,
  CreateAssistantDeploymentRequest,
  CreateAssistantPhoneDeployment,
  DeploymentAudioProvider,
  GetAssistantDeploymentRequest,
  Metadata,
} from '@rapidaai/react';
import { GetAssistantPhoneDeployment } from '@rapidaai/react';
import { useCurrentCredential } from '@/hooks/use-credential';
import toast from 'react-hot-toast/headless';
import { Helmet } from '@/app/components/helmet';
import { GetCartesiaDefaultOptions } from '@/app/components/providers/text-to-speech/cartesia';
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
import {
  TelephonyProvider,
  ValidateTelephonyOptions,
} from '@/app/components/providers/telephony';
import { TabForm } from '@/app/components/form/tab-form';
import {
  IBlueBGArrowButton,
  ICancelButton,
} from '@/app/components/form/button';

const STEPS = [
  {
    code: 'telephony',
    name: 'Telephony',
    description:
      'Select and configure your telephony provider for inbound and outbound calls.',
  },
  {
    code: 'experience',
    name: 'General Experience',
    description: 'Define how the assistant greets users and handles sessions.',
  },
  {
    code: 'voice-input',
    name: 'Voice Input',
    description:
      'Configure the speech-to-text provider for capturing caller audio.',
  },
  {
    code: 'voice-output',
    name: 'Voice Output',
    description: 'Configure the text-to-speech provider for audio responses.',
  },
];

export function ConfigureAssistantCallDeploymentPage() {
  const { assistantId } = useParams();
  return (
    <>
      <Helmet title="Configure phone deployment" />
      {assistantId && (
        <ConfigureAssistantCallDeployment assistantId={assistantId} />
      )}
    </>
  );
}

const ConfigureAssistantCallDeployment: FC<{ assistantId: string }> = ({
  assistantId,
}) => {
  const { goToDeploymentAssistant } = useGlobalNavigation();
  const { loading, showLoader, hideLoader } = useRapidaStore();
  const { providerCredentials } = useAllProviderCredentials();
  const { authId, projectId, token } = useCurrentCredential();

  const [activeTab, setActiveTab] = useState('telephony');
  const [errorMessage, setErrorMessage] = useState('');

  const [experienceConfig, setExperienceConfig] = useState<ExperienceConfig>({
    greeting: undefined,
    messageOnError: undefined,
    idealTimeout: '30',
    idealMessage: 'Are you there?',
    maxCallDuration: '300',
    idleTimeoutBackoffTimes: '2',
  });

  const [telephonyConfig, setTelephonyConfig] = useState<{
    provider: string;
    parameters: Metadata[];
  }>({
    provider: 'twilio',
    parameters: [],
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
    parameters: GetCartesiaDefaultOptions(GetDefaultSpeakerConfig()),
  });

  const hasFetched = useRef(false);

  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    showLoader('block');
    const request = new GetAssistantDeploymentRequest();
    request.setAssistantid(assistantId);
    GetAssistantPhoneDeployment(
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
        const deployment = response?.getData();
        if (!deployment) return;

        setExperienceConfig({
          greeting: deployment.getGreeting(),
          messageOnError: deployment.getMistake(),
          idealTimeout: deployment.getIdealtimeout(),
          idealMessage: deployment.getIdealtimeoutmessage(),
          maxCallDuration: deployment.getMaxsessionduration(),
          idleTimeoutBackoffTimes: deployment.getIdealtimeoutbackoff(),
        });

        if (deployment.getPhoneprovidername()) {
          setTelephonyConfig({
            provider: deployment.getPhoneprovidername() || '',
            parameters: deployment.getPhoneoptionsList() || [],
          });
        }

        if (deployment.getInputaudio()) {
          const provider = deployment.getInputaudio()!;
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

        if (deployment.getOutputaudio()) {
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
      })
      .catch(err => {
        hideLoader();
        toast.error(
          err?.message ||
            'Error loading phone deployment configuration. Please try again.',
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

    if (activeTab === 'telephony') {
      if (
        !ValidateTelephonyOptions(
          telephonyConfig.provider,
          telephonyConfig.parameters,
        )
      ) {
        setErrorMessage('Please provide a valid telephony configuration.');
        return;
      }
    }

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
    }

    if (idx < STEPS.length - 1) {
      setActiveTab(STEPS[idx + 1].code);
    }
  };

  const handleDeployPhone = () => {
    showLoader('block');
    setErrorMessage('');

    if (
      !ValidateTelephonyOptions(
        telephonyConfig.provider,
        telephonyConfig.parameters,
      )
    ) {
      hideLoader();
      setErrorMessage('Please provide a valid telephony configuration.');
      return;
    }

    if (!audioInputConfig.provider) {
      hideLoader();
      setErrorMessage('Please provide a speech-to-text provider.');
      return;
    }

    const sttError = ValidateSpeechToTextIfInvalid(
      audioInputConfig.provider,
      audioInputConfig.parameters,
      getProviderCredentialIds(audioInputConfig.provider),
    );
    if (sttError) {
      hideLoader();
      setErrorMessage(sttError);
      return;
    }

    if (!audioOutputConfig.provider) {
      hideLoader();
      setErrorMessage('Please provide a text-to-speech provider.');
      return;
    }

    const ttsError = ValidateTextToSpeechIfInvalid(
      audioOutputConfig.provider,
      audioOutputConfig.parameters,
      getProviderCredentialIds(audioOutputConfig.provider),
    );
    if (ttsError) {
      hideLoader();
      setErrorMessage(ttsError);
      return;
    }

    const req = new CreateAssistantDeploymentRequest();
    const deployment = new AssistantPhoneDeployment();
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

    deployment.setPhoneprovidername(telephonyConfig.provider);
    deployment.setPhoneoptionsList(telephonyConfig.parameters);

    const inputAudio = new DeploymentAudioProvider();
    inputAudio.setAudioprovider(audioInputConfig.provider);
    inputAudio.setAudiooptionsList(audioInputConfig.parameters);
    deployment.setInputaudio(inputAudio);

    const outputAudio = new DeploymentAudioProvider();
    outputAudio.setAudioprovider(audioOutputConfig.provider);
    outputAudio.setAudiooptionsList(audioOutputConfig.parameters);
    deployment.setOutputaudio(outputAudio);

    req.setPhone(deployment);

    CreateAssistantPhoneDeployment(
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
          toast.success('Phone call deployment updated successfully.');
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
          err?.message || 'Error deploying phone call. Please try again.',
        );
      });
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-gray-900">
      {/* Page header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0 flex items-center gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Phone Call Deployment
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            Configure inbound and outbound phone call handling.
          </p>
        </div>
      </div>

      <TabForm
        formHeading="Complete all steps to configure your phone call deployment."
        activeTab={activeTab}
        onChangeActiveTab={handleTabChange}
        errorMessage={errorMessage}
        form={[
          {
            code: 'telephony',
            name: 'Telephony',
            description:
              'Select and configure your telephony provider for inbound and outbound calls.',
            body: (
              <TelephonyProvider
                provider={telephonyConfig.provider}
                parameters={telephonyConfig.parameters}
                onChangeProvider={provider =>
                  setTelephonyConfig({ provider, parameters: [] })
                }
                onChangeParameter={parameters =>
                  setTelephonyConfig(c => ({ ...c, parameters }))
                }
              />
            ),
            actions: [
              <ICancelButton
                className="w-full h-full"
                onClick={() => goToDeploymentAssistant(assistantId)}
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
                onClick={() => goToDeploymentAssistant(assistantId)}
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
              'Configure the speech-to-text provider for capturing caller audio.',
            body: (
              <ConfigureAudioInputProvider
                audioInputConfig={audioInputConfig}
                setAudioInputConfig={setAudioInputConfig}
              />
            ),
            actions: [
              <ICancelButton
                className="w-full h-full"
                onClick={() => goToDeploymentAssistant(assistantId)}
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
                onClick={() => goToDeploymentAssistant(assistantId)}
              >
                Cancel
              </ICancelButton>,
              <IBlueBGArrowButton
                type="button"
                className="w-full h-full"
                isLoading={loading}
                onClick={handleDeployPhone}
              >
                Deploy Phone
              </IBlueBGArrowButton>,
            ],
          },
        ]}
      />
    </div>
  );
};
