import { ProviderComponentProps } from '@/app/components/providers';
import { ConfigureSileroVAD } from '@/app/components/providers/vad/silero-vad';
import { ConfigureTenVAD } from '@/app/components/providers/vad/ten-vad';
import { ConfigureFireRedVAD } from '@/app/components/providers/vad/firered-vad';
import { SetMetadata } from '@/utils/metadata';
import { Metadata } from '@rapidaai/react';
import { FC } from 'react';

const VAD_DEFAULTS: Record<string, Record<string, string>> = {
  silero_vad: {
    'microphone.vad.threshold': '0.6',
  },
  ten_vad: {
    'microphone.vad.threshold': '0.6',
  },
  firered_vad: {
    'microphone.vad.threshold': '0.5',
    'microphone.vad.min_silence_frame': '10',
    'microphone.vad.min_speech_frame': '3',
  },
};

export const GetDefaultVADConfig = (
  provider: string,
  current: Metadata[],
): Metadata[] => {
  const defaults = VAD_DEFAULTS[provider] || {};

  const nonVad = current.filter(
    m => !m.getKey().startsWith('microphone.vad.'),
  );

  const vadParams: Metadata[] = [];

  const providerMeta = new Metadata();
  providerMeta.setKey('microphone.vad.provider');
  providerMeta.setValue(provider);
  vadParams.push(providerMeta);

  for (const [key, defaultValue] of Object.entries(defaults)) {
    const meta = SetMetadata(current, key, defaultValue);
    if (meta) vadParams.push(meta);
  }

  return [...nonVad, ...vadParams];
};

export const VADConfigComponent: FC<ProviderComponentProps> = ({
  provider,
  parameters,
  onChangeParameter,
}) => {
  switch (provider) {
    case 'silero_vad':
      return (
        <ConfigureSileroVAD
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'ten_vad':
      return (
        <ConfigureTenVAD
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'firered_vad':
      return (
        <ConfigureFireRedVAD
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    default:
      return null;
  }
};
