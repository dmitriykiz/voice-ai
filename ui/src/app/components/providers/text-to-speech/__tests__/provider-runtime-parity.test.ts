import { Metadata } from '@rapidaai/react';
import {
  GetDefaultTextToSpeechIfInvalid,
  ValidateTextToSpeechIfInvalid,
} from '../provider';
import { TEXT_TO_SPEECH_PROVIDER } from '@/providers';
import { loadProviderConfig, loadProviderData } from '@/providers/config-loader';

jest.mock('@/app/components/providers', () => ({}));
jest.mock('@/app/components/providers/config-renderer', () => ({
  ConfigRenderer: () => null,
}));
jest.mock('random-words', () => ({
  generate: () => ['test'],
}));

const createMetadata = (key: string, value: string): Metadata => {
  const m = new Metadata();
  m.setKey(key);
  m.setValue(value);
  return m;
};

const cloneMetadata = (source: Metadata[]): Metadata[] =>
  source.map(m => createMetadata(m.getKey(), m.getValue()));

const normalizeMetadata = (source: Metadata[]): string[] =>
  source
    .map(m => `${m.getKey()}=${m.getValue()}`)
    .sort((a, b) => a.localeCompare(b));

const withMetadataValue = (
  source: Metadata[],
  key: string,
  value: string,
): Metadata[] => {
  const cloned = cloneMetadata(source);
  const item = cloned.find(m => m.getKey() === key);
  if (item) {
    item.setValue(value);
    return cloned;
  }
  cloned.push(createMetadata(key, value));
  return cloned;
};

const getFirstDataValue = (
  provider: string,
  file: string,
  key: string,
): string => {
  const data = loadProviderData(provider, file);
  expect(data.length).toBeGreaterThan(0);
  const value = data[0]?.[key];
  expect(typeof value).toBe('string');
  return value;
};

describe('Text-to-speech provider runtime parity', () => {
  it('all active text-to-speech providers are config-driven', () => {
    expect(TEXT_TO_SPEECH_PROVIDER.length).toBeGreaterThan(0);
    for (const provider of TEXT_TO_SPEECH_PROVIDER) {
      expect(loadProviderConfig(provider.code)?.tts).toBeDefined();
    }
  });

  it.each(TEXT_TO_SPEECH_PROVIDER.map(p => p.code))(
    '%s config dropdown data files are available',
    provider => {
      const ttsConfig = loadProviderConfig(provider)?.tts;
      expect(ttsConfig).toBeDefined();
      const dropdownParams =
        ttsConfig?.parameters.filter(
          param => param.type === 'dropdown' && Boolean(param.data),
        ) ?? [];

      for (const param of dropdownParams) {
        const data = loadProviderData(provider, param.data!);
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
      }
    },
  );

  it('validates openai defaults when credential is valid for selected provider', () => {
    const defaults = GetDefaultTextToSpeechIfInvalid('openai', [
      createMetadata('rapida.credential_id', 'cred-openai'),
    ]);

    const err = ValidateTextToSpeechIfInvalid('openai', defaults, [
      'cred-openai',
    ]);
    expect(err).toBeUndefined();
  });

  it('validates openai voice against text-to-speech-voices catalog', () => {
    const defaults = GetDefaultTextToSpeechIfInvalid('openai', [
      createMetadata('rapida.credential_id', 'cred-openai'),
    ]);
    const invalidVoice = withMetadataValue(
      defaults,
      'speak.voice.id',
      'invalid-voice-id',
    );

    const err = ValidateTextToSpeechIfInvalid('openai', invalidVoice, [
      'cred-openai',
    ]);

    expect(err).toBe('Please select valid voice for text to speech.');
  });

  it('preserves non-strict aws voice ids while still validating model/language from config data', () => {
    const awsOptions = [
      createMetadata('rapida.credential_id', 'cred-aws'),
      createMetadata(
        'speak.model',
        getFirstDataValue('aws', 'text-to-speech-models.json', 'model_id'),
      ),
      createMetadata(
        'speak.language',
        getFirstDataValue('aws', 'languages.json', 'language_id'),
      ),
      createMetadata('speak.voice.id', 'custom-voice-id'),
    ];

    const err = ValidateTextToSpeechIfInvalid('aws', awsOptions, ['cred-aws']);

    expect(err).toBeUndefined();
  });

  it('enforces provider credential ownership for selected tts provider', () => {
    const defaults = GetDefaultTextToSpeechIfInvalid('openai', [
      createMetadata('rapida.credential_id', 'cred-from-other-provider'),
    ]);
    const err = ValidateTextToSpeechIfInvalid('openai', defaults, [
      'cred-openai-1',
      'cred-openai-2',
    ]);

    expect(err).toBe('Please select a valid openai credential.');
  });

  it('keeps legacy providers operational while enforcing credential ownership', () => {
    const defaults = GetDefaultTextToSpeechIfInvalid('google-speech-service', [
      createMetadata('rapida.credential_id', 'cred-google'),
      createMetadata('speak.voice.id', 'en-US-Standard-A'),
    ]);

    const err = ValidateTextToSpeechIfInvalid(
      'google-speech-service',
      defaults,
      ['cred-google'],
    );

    expect(err).toBeUndefined();
  });

  it('unknown provider remains no-op when no config and no legacy handler exists', () => {
    const seed = [createMetadata('custom.key', 'custom')];
    expect(
      normalizeMetadata(
        GetDefaultTextToSpeechIfInvalid('unknown-provider', cloneMetadata(seed)),
      ),
    ).toEqual(normalizeMetadata(seed));
    expect(ValidateTextToSpeechIfInvalid('unknown-provider', [])).toBeUndefined();
  });
});
