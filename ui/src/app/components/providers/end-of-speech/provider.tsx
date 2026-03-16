import { ProviderComponentProps } from '@/app/components/providers';
import { ConfigureSilenceBasedEOS } from '@/app/components/providers/end-of-speech/silence-based';
import { ConfigureLivekitEOS } from '@/app/components/providers/end-of-speech/livekit-eos';
import { ConfigurePipecatSmartTurnEOS } from '@/app/components/providers/end-of-speech/pipecat-smart-turn';
import { SetMetadata } from '@/utils/metadata';
import { Metadata } from '@rapidaai/react';
import { FC } from 'react';

// Default configs per provider. When switching providers, these are applied
// on top of the existing microphone.* params so defaults are persisted to DB.
const EOS_DEFAULTS: Record<string, Record<string, string>> = {
  silence_based_eos: {
    'microphone.eos.timeout': '700',
  },
  livekit_eos: {
    'microphone.eos.timeout': '500',
    'microphone.eos.threshold': '0.0289',
    'microphone.eos.quick_timeout': '250',
    'microphone.eos.silence_timeout': '3000',
    'microphone.eos.model': 'en',
  },
  pipecat_smart_turn_eos: {
    'microphone.eos.timeout': '500',
    'microphone.eos.threshold': '0.5',
    'microphone.eos.quick_timeout': '250',
    'microphone.eos.silence_timeout': '2000',
  },
};

export const GetDefaultEOSConfig = (
  provider: string,
  current: Metadata[],
): Metadata[] => {
  const defaults = EOS_DEFAULTS[provider] || {};

  // Keep all non-EOS params
  const nonEos = current.filter(
    m => !m.getKey().startsWith('microphone.eos.'),
  );

  // Build EOS params: use existing value if present, otherwise default
  const eosParams: Metadata[] = [];

  // Always set the provider
  const providerMeta = new Metadata();
  providerMeta.setKey('microphone.eos.provider');
  providerMeta.setValue(provider);
  eosParams.push(providerMeta);

  // Set each default, preserving existing values
  for (const [key, defaultValue] of Object.entries(defaults)) {
    const meta = SetMetadata(current, key, defaultValue);
    if (meta) eosParams.push(meta);
  }

  return [...nonEos, ...eosParams];
};

export const EndOfSpeechConfigComponent: FC<ProviderComponentProps> = ({
  provider,
  parameters,
  onChangeParameter,
}) => {
  switch (provider) {
    case 'silence_based_eos':
      return (
        <ConfigureSilenceBasedEOS
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'livekit_eos':
      return (
        <ConfigureLivekitEOS
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'pipecat_smart_turn_eos':
      return (
        <ConfigurePipecatSmartTurnEOS
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    default:
      return null;
  }
};
