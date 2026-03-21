/**
 * Rapida – Open Source Voice AI Orchestration Platform
 * Copyright (C) 2023-2025 Prashant Srivastav <prashant@rapida.ai>
 * Licensed under a modified GPL-2.0. See the LICENSE file for details.
 */
import { Metadata } from '@rapidaai/react';
import { FC } from 'react';
import { loadProviderConfig } from '@/providers/config-loader';
import { getDefaultsFromConfig, validateFromConfig } from '@/providers/config-defaults';
import { ConfigRenderer } from '@/app/components/providers/config-renderer';
import {
  ConfigureAzureTextToSpeech,
  GetAzureDefaultOptions,
  ValidateAzureOptions,
} from '@/app/components/providers/text-to-speech/azure-speech-service';
import {
  ConfigureCartesiaTextToSpeech,
  GetCartesiaDefaultOptions,
  ValidateCartesiaOptions,
} from '@/app/components/providers/text-to-speech/cartesia';
import {
  ConfigureDeepgramTextToSpeech,
  GetDeepgramDefaultOptions,
} from '@/app/components/providers/text-to-speech/deepgram';
import { ValidateDeepgramOptions } from '@/app/components/providers/text-to-speech/deepgram/constant';
import {
  ConfigureElevanLabTextToSpeech,
  GetElevanLabDefaultOptions,
  ValidateElevanLabOptions,
} from '@/app/components/providers/text-to-speech/elevenlabs';
import {
  ConfigureGoogleTextToSpeech,
  GetGoogleDefaultOptions,
  ValidateGoogleOptions,
} from '@/app/components/providers/text-to-speech/google-speech-service';
import {
  ConfigureOpenAITextToSpeech,
  GetOpenAIDefaultOptions,
  ValidateOpenAIOptions,
} from '@/app/components/providers/text-to-speech/openai';
import {
  ConfigurePlayhtTextToSpeech,
  GetPlayHTDefaultOptions,
  ValidatePlayHTOptions,
} from '@/app/components/providers/text-to-speech/playht';
import { ProviderComponentProps } from '@/app/components/providers';
import {
  ConfigureRimeTextToSpeech,
  GetRimeDefaultOptions,
  ValidateRimeOptions,
} from '@/app/components/providers/text-to-speech/rime';
import {
  ConfigureSarvamTextToSpeech,
  GetSarvamDefaultOptions,
  ValidateSarvamOptions,
} from '@/app/components/providers/text-to-speech/sarvam';
import {
  ConfigureResembleAITextToSpeech,
  GetResembleAIDefaultOptions,
  ValidateResembleAIOptions,
} from '@/app/components/providers/text-to-speech/resembleai';
import {
  ConfigureNeuPhonicTextToSpeech,
  GetNeuPhonicDefaultOptions,
  ValidateNeuPhonicOptions,
} from '@/app/components/providers/text-to-speech/neuphonic';
import {
  ConfigureMiniMaxTextToSpeech,
  GetMiniMaxDefaultOptions,
  ValidateMiniMaxOptions,
} from '@/app/components/providers/text-to-speech/minimax';
import {
  ConfigureGroqTextToSpeech,
  GetGroqDefaultOptions,
  ValidateGroqOptions,
} from '@/app/components/providers/text-to-speech/groq';
import {
  ConfigureSpeechmaticsTextToSpeech,
  GetSpeechmaticsDefaultOptions,
  ValidateSpeechmaticsOptions,
} from '@/app/components/providers/text-to-speech/speechmatics';
import {
  ConfigureNvidiaTextToSpeech,
  GetNvidiaDefaultOptions,
  ValidateNvidiaOptions,
} from '@/app/components/providers/text-to-speech/nvidia';
import {
  ConfigureAWSTextToSpeech,
  GetAWSDefaultOptions,
  ValidateAWSOptions,
} from '@/app/components/providers/text-to-speech/aws';

/**
 *
 * @returns
 */
export const GetDefaultSpeakerConfig = (
  existing: Metadata[] = [],
): Metadata[] => {
  const defaultConfig = [
    {
      key: 'speaker.conjunction.boundaries',
      value: '',
    },
    {
      key: 'speaker.conjunction.break',
      value: '240',
    },
    {
      key: 'speaker.pronunciation.dictionaries',
      value: '',
    },
  ];

  const result = [...existing];
  defaultConfig.forEach(item => {
    if (!existing.some(e => e.getKey() === item.key)) {
      const metadata = new Metadata();
      metadata.setKey(item.key);
      metadata.setValue(item.value);
      result.push(metadata);
    }
  });
  return result;
};

export const GetDefaultTextToSpeechIfInvalid = (
  provider: string,
  parameters: Metadata[],
): Metadata[] => {
  const config = loadProviderConfig(provider);
  if (config?.tts) return getDefaultsFromConfig(config, 'tts', parameters, provider);
  switch (provider) {
    case 'google-speech-service':
      return GetGoogleDefaultOptions(parameters);
    case 'elevenlabs':
      return GetElevanLabDefaultOptions(parameters);
    case 'playht':
      return GetPlayHTDefaultOptions(parameters);
    case 'deepgram':
      return GetDeepgramDefaultOptions(parameters);
    case 'openai':
      return GetOpenAIDefaultOptions(parameters);
    case 'azure-speech-service':
      return GetAzureDefaultOptions(parameters);
    case 'cartesia':
      return GetCartesiaDefaultOptions(parameters);
    case 'sarvamai':
      return GetSarvamDefaultOptions(parameters);
    case 'rime':
      return GetRimeDefaultOptions(parameters);
    case 'resembleai':
      return GetResembleAIDefaultOptions(parameters);
    case 'neuphonic':
      return GetNeuPhonicDefaultOptions(parameters);
    case 'minimax':
      return GetMiniMaxDefaultOptions(parameters);
    case 'groq':
      return GetGroqDefaultOptions(parameters);
    case 'speechmatics':
      return GetSpeechmaticsDefaultOptions(parameters);
    case 'nvidia':
      return GetNvidiaDefaultOptions(parameters);
    case 'aws':
      return GetAWSDefaultOptions(parameters);
    default:
      return parameters;
  }
};

export const ValidateTextToSpeechIfInvalid = (
  provider: string,
  parameters: Metadata[],
  providerCredentialIds?: string[],
): string | undefined => {
  const config = loadProviderConfig(provider);
  let validationError: string | undefined;
  if (config?.tts) {
    validationError = validateFromConfig(config, 'tts', provider, parameters);
  } else {
    switch (provider) {
      case 'google-speech-service':
        validationError = ValidateGoogleOptions(parameters);
        break;
      case 'elevenlabs':
        validationError = ValidateElevanLabOptions(parameters);
        break;
      case 'playht':
        validationError = ValidatePlayHTOptions(parameters);
        break;
      case 'deepgram':
        validationError = ValidateDeepgramOptions(parameters);
        break;
      case 'openai':
        validationError = ValidateOpenAIOptions(parameters);
        break;
      case 'azure-speech-service':
        validationError = ValidateAzureOptions(parameters);
        break;
      case 'cartesia':
        validationError = ValidateCartesiaOptions(parameters);
        break;
      case 'sarvamai':
        validationError = ValidateSarvamOptions(parameters);
        break;
      case 'rime':
        validationError = ValidateRimeOptions(parameters);
        break;
      case 'resembleai':
        validationError = ValidateResembleAIOptions(parameters);
        break;
      case 'neuphonic':
        validationError = ValidateNeuPhonicOptions(parameters);
        break;
      case 'minimax':
        validationError = ValidateMiniMaxOptions(parameters);
        break;
      case 'groq':
        validationError = ValidateGroqOptions(parameters);
        break;
      case 'speechmatics':
        validationError = ValidateSpeechmaticsOptions(parameters);
        break;
      case 'nvidia':
        validationError = ValidateNvidiaOptions(parameters);
        break;
      case 'aws':
        validationError = ValidateAWSOptions(parameters);
        break;
      default:
        return undefined;
    }
  }

  if (validationError) return validationError;

  if (!providerCredentialIds) return undefined;

  const credentialID = parameters.find(
    opt => opt.getKey() === 'rapida.credential_id',
  )?.getValue();
  if (!credentialID) {
    return `Please provide a valid ${provider} credential.`;
  }
  if (!providerCredentialIds.includes(credentialID)) {
    return `Please select a valid ${provider} credential.`;
  }

  return undefined;
};

export const TextToSpeechConfigComponent: FC<ProviderComponentProps> = ({
  provider,
  parameters,
  onChangeParameter,
}) => {
  const config = loadProviderConfig(provider);
  if (config?.tts) {
    return (
      <ConfigRenderer
        provider={provider}
        category="tts"
        config={config.tts}
        parameters={parameters}
        onParameterChange={onChangeParameter}
      />
    );
  }
  switch (provider) {
    case 'google-speech-service':
      return (
        <ConfigureGoogleTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'elevenlabs':
      return (
        <ConfigureElevanLabTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'playht':
      return (
        <ConfigurePlayhtTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'deepgram':
      return (
        <ConfigureDeepgramTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'openai':
      return (
        <ConfigureOpenAITextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'azure-speech-service':
      return (
        <ConfigureAzureTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'cartesia':
      return (
        <ConfigureCartesiaTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'sarvamai':
      return (
        <ConfigureSarvamTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'rime':
      return (
        <ConfigureRimeTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'resembleai':
      return (
        <ConfigureResembleAITextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'neuphonic':
      return (
        <ConfigureNeuPhonicTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'minimax':
      return (
        <ConfigureMiniMaxTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'groq':
      return (
        <ConfigureGroqTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'speechmatics':
      return (
        <ConfigureSpeechmaticsTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'nvidia':
      return (
        <ConfigureNvidiaTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    case 'aws':
      return (
        <ConfigureAWSTextToSpeech
          parameters={parameters}
          onParameterChange={onChangeParameter}
        />
      );
    default:
      return null;
  }
};
