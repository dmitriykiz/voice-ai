import { useCallback, useState } from 'react';
import { SpeechToTextProvider } from '@/app/components/providers/speech-to-text';
import { NoiseCancellationProvider } from '@/app/components/providers/noise-removal';
import { EndOfSpeechProvider } from '@/app/components/providers/end-of-speech';
import { Metadata } from '@rapidaai/react';
import {
  GetDefaultMicrophoneConfig,
  GetDefaultSpeechToTextIfInvalid,
} from '@/app/components/providers/speech-to-text/provider';
import { VADProvider } from '@/app/components/providers/vad';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/utils';
import { SectionDivider } from '@/app/components/blocks/section-divider';

interface ConfigureAudioInputProviderProps {
  audioInputConfig: { provider: string; parameters: Metadata[] };
  setAudioInputConfig: (config: {
    provider: string;
    parameters: Metadata[];
  }) => void;
}

export const ConfigureAudioInputProvider: React.FC<
  ConfigureAudioInputProviderProps
> = ({ audioInputConfig, setAudioInputConfig }) => {
  const [showAdvanced, setShowAdvanced] = useState(false);

  const onChangeAudioInputProvider = (providerName: string) => {
    setAudioInputConfig({
      provider: providerName,
      parameters: GetDefaultSpeechToTextIfInvalid(
        providerName,
        GetDefaultMicrophoneConfig([]),
      ),
    });
  };

  const onChangeAudioInputParameter = (parameters: Metadata[]) => {
    if (audioInputConfig)
      setAudioInputConfig({ ...audioInputConfig, parameters });
  };

  const getParamValue = useCallback(
    (key: string, defaultValue: any) => {
      const param = audioInputConfig.parameters?.find(p => p.getKey() === key);
      return param ? param.getValue() : defaultValue;
    },
    [JSON.stringify(audioInputConfig.parameters)],
  );

  const updateParameter = (key: string, value: string) => {
    const updatedParams = (audioInputConfig.parameters || []).map(param => {
      if (param.getKey() === key) {
        const updatedParam = new Metadata();
        updatedParam.setKey(key);
        updatedParam.setValue(value);
        return updatedParam;
      }
      return param;
    });
    if (!updatedParams.some(param => param.getKey() === key)) {
      const newParam = new Metadata();
      newParam.setKey(key);
      newParam.setValue(value);
      updatedParams.push(newParam);
    }
    onChangeAudioInputParameter(updatedParams);
  };

  return (
    <div className="border-b border-gray-200 dark:border-gray-800">
      <div className="flex flex-col gap-6 max-w-4xl  px-6 py-8">
        <SpeechToTextProvider
          onChangeProvider={onChangeAudioInputProvider}
          onChangeParameter={onChangeAudioInputParameter}
          provider={audioInputConfig.provider}
          parameters={audioInputConfig.parameters}
        />
        {audioInputConfig.provider && (
          <>
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
            >
              <ChevronDown
                className={cn(
                  'w-4 h-4 transition-transform duration-200',
                  showAdvanced && 'rotate-180',
                )}
                strokeWidth={2}
              />
              {showAdvanced ? 'Hide' : 'Show'} advanced settings
            </button>

            {showAdvanced && (
              <div className="flex flex-col gap-6 pt-6 border-t border-gray-200 dark:border-gray-800">
                <SectionDivider label="Voice Activity Detection" />
                <VADProvider
                  vadProvider={getParamValue(
                    'microphone.vad.provider',
                    'silero_vad',
                  )}
                  onChangeVADProvider={v =>
                    updateParameter('microphone.vad.provider', v)
                  }
                  vadThreshold={getParamValue(
                    'microphone.vad.threshold',
                    '0.8',
                  )}
                  onChangeVadThreshold={timeout =>
                    updateParameter('microphone.vad.threshold', timeout)
                  }
                />
                <SectionDivider label="Background Noise" />
                <NoiseCancellationProvider
                  noiseCancellationProvider={getParamValue(
                    'microphone.denoising.provider',
                    'rn_noise',
                  )}
                  onChangeNoiseCancellationProvider={v =>
                    updateParameter('microphone.denoising.provider', v)
                  }
                />
                <SectionDivider label="End of Speech" />
                <EndOfSpeechProvider
                  endOfSpeechProvider={getParamValue(
                    'microphone.eos.provider',
                    'silence_based_eos',
                  )}
                  onChangeEndOfSpeechProvider={provider =>
                    updateParameter('microphone.eos.provider', provider)
                  }
                  endOfSepeechTimeout={getParamValue(
                    'microphone.eos.timeout',
                    '1000',
                  )}
                  onChangeEndOfSepeechTimeout={timeout =>
                    updateParameter('microphone.eos.timeout', timeout)
                  }
                />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
