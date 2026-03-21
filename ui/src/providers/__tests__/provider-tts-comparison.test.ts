/**
 * Per-provider comparison tests for TTS.
 *
 * Each test verifies that config-driven defaults + validation produce
 * the same structural output (keys, default values, valid/invalid decisions)
 * as the original hand-written constant.ts functions.
 */
import { Metadata } from '@rapidaai/react';
import { loadProviderConfig } from '../config-loader';
import { getDefaultsFromConfig, validateFromConfig } from '../config-defaults';

function createMetadata(key: string, value: string): Metadata {
  const m = new Metadata();
  m.setKey(key);
  m.setValue(value);
  return m;
}

function findMeta(arr: Metadata[], key: string): string | undefined {
  return arr.find(m => m.getKey() === key)?.getValue();
}

const cred = () => createMetadata('rapida.credential_id', 'test-cred');

describe('Groq TTS — config vs original', () => {
  const config = loadProviderConfig('groq')!;

  it('config has tts section', () => {
    expect(config.tts).toBeDefined();
  });

  it('produces defaults with no pre-set values (no defaults in original)', () => {
    const result = getDefaultsFromConfig(config, 'tts', [], 'groq');
    // Original: no defaults for model or voice
    // Config-driven: no defaults set in tts.json either
    // Only keys present should be from the parameters (with undefined values if no defaults)
    const keys = result.map(m => m.getKey());
    expect(keys).not.toContain('speak.language'); // groq TTS has no language param
  });

  it('preserves speaker.* params', () => {
    const existing = [createMetadata('speaker.rate', '1.2')];
    const result = getDefaultsFromConfig(config, 'tts', existing, 'groq');
    expect(findMeta(result, 'speaker.rate')).toBe('1.2');
  });

  it('validates: missing credential returns error', () => {
    const result = validateFromConfig(config, 'tts', 'groq', []);
    expect(result).toBeDefined();
    expect(result).toContain('credential');
  });

  it('validates: voice.id accepts any value (strict:false)', () => {
    const opts = [
      cred(),
      createMetadata('speak.model', 'playai-tts'),
      createMetadata('speak.voice.id', 'any-custom-voice-id'),
    ];
    expect(validateFromConfig(config, 'tts', 'groq', opts)).toBeUndefined();
  });

  it('validates: invalid model returns error', () => {
    const opts = [
      cred(),
      createMetadata('speak.model', 'nonexistent-model'),
      createMetadata('speak.voice.id', 'some-voice'),
    ];
    expect(validateFromConfig(config, 'tts', 'groq', opts)).toBe(
      'Please select valid model for text to speech.',
    );
  });

  it('validates: empty voice.id returns error', () => {
    const opts = [
      cred(),
      createMetadata('speak.model', 'playai-tts'),
      // no voice.id
    ];
    expect(validateFromConfig(config, 'tts', 'groq', opts)).toBe(
      'Please select a valid voice ID for text to speech.',
    );
  });
});

describe('Speechmatics TTS — config vs original', () => {
  const config = loadProviderConfig('speechmatics')!;

  it('config has tts section', () => {
    expect(config.tts).toBeDefined();
  });

  it('validates: valid options returns undefined', () => {
    const opts = [
      cred(),
      createMetadata('speak.voice.id', 'some-voice'),
      createMetadata('speak.language', 'en'),
    ];
    expect(validateFromConfig(config, 'tts', 'speechmatics', opts)).toBeUndefined();
  });

  it('validates: voice.id accepts any value (strict:false)', () => {
    const opts = [
      cred(),
      createMetadata('speak.voice.id', 'custom-voice-xyz'),
      createMetadata('speak.language', 'en'),
    ];
    expect(validateFromConfig(config, 'tts', 'speechmatics', opts)).toBeUndefined();
  });

  it('validates: invalid language returns error', () => {
    const opts = [
      cred(),
      createMetadata('speak.voice.id', 'some-voice'),
      createMetadata('speak.language', 'invalid-lang'),
    ];
    expect(validateFromConfig(config, 'tts', 'speechmatics', opts)).toBe(
      'Please select valid language for text to speech.',
    );
  });
});

describe('Nvidia TTS — config vs original', () => {
  const config = loadProviderConfig('nvidia')!;

  it('config has tts section', () => {
    expect(config.tts).toBeDefined();
  });

  it('validates: valid options returns undefined', () => {
    const opts = [
      cred(),
      createMetadata('speak.voice.id', 'some-voice'),
      createMetadata('speak.language', 'en-US'),
    ];
    expect(validateFromConfig(config, 'tts', 'nvidia', opts)).toBeUndefined();
  });

  it('validates: voice.id accepts any value (strict:false)', () => {
    const opts = [
      cred(),
      createMetadata('speak.voice.id', 'custom-voice'),
      createMetadata('speak.language', 'en-US'),
    ];
    expect(validateFromConfig(config, 'tts', 'nvidia', opts)).toBeUndefined();
  });
});

describe('AWS TTS — config vs original', () => {
  const config = loadProviderConfig('aws')!;

  it('config has tts section', () => {
    expect(config.tts).toBeDefined();
  });

  it('produces defaults with expected keys', () => {
    const result = getDefaultsFromConfig(config, 'tts', [], 'aws');
    const keys = result.map(m => m.getKey()).sort();
    // AWS TTS has no defaults in legacy path either
    expect(keys).toEqual([]);
  });

  it('validates: valid options returns undefined', () => {
    const opts = [
      cred(),
      createMetadata('speak.model', 'standard'),
      createMetadata('speak.voice.id', 'some-voice'),
      createMetadata('speak.language', 'en-US'),
    ];
    expect(validateFromConfig(config, 'tts', 'aws', opts)).toBeUndefined();
  });

  it('validates: voice.id accepts any value (strict:false)', () => {
    const opts = [
      cred(),
      createMetadata('speak.model', 'standard'),
      createMetadata('speak.voice.id', 'custom-voice'),
      createMetadata('speak.language', 'en-US'),
    ];
    expect(validateFromConfig(config, 'tts', 'aws', opts)).toBeUndefined();
  });

  it('validates: invalid model returns error', () => {
    const opts = [
      cred(),
      createMetadata('speak.model', 'nonexistent'),
      createMetadata('speak.voice.id', 'some-voice'),
      createMetadata('speak.language', 'en-US'),
    ];
    expect(validateFromConfig(config, 'tts', 'aws', opts)).toBe(
      'Please select valid model for text to speech.',
    );
  });

  it('validates: invalid language returns error', () => {
    const opts = [
      cred(),
      createMetadata('speak.model', 'standard'),
      createMetadata('speak.voice.id', 'some-voice'),
      createMetadata('speak.language', 'invalid'),
    ];
    expect(validateFromConfig(config, 'tts', 'aws', opts)).toBe(
      'Please select valid language for text to speech.',
    );
  });
});

describe('OpenAI TTS — config vs original', () => {
  const config = loadProviderConfig('openai')!;

  it('config has tts section', () => {
    expect(config.tts).toBeDefined();
  });

  it('produces the same default values as original', () => {
    const result = getDefaultsFromConfig(config, 'tts', [], 'openai');
    expect(findMeta(result, 'speak.model')).toBe('gpt-4o-mini-tts');
    expect(findMeta(result, 'speak.voice.id')).toBe('alloy');
    expect(findMeta(result, 'speak.language')).toBe('en');
  });

  it('preserves existing valid values', () => {
    const existing = [
      cred(),
      createMetadata('speak.model', 'tts-1'),
      createMetadata('speak.voice.id', 'echo'),
      createMetadata('speak.language', 'fr'),
    ];
    const result = getDefaultsFromConfig(config, 'tts', existing, 'openai');
    expect(findMeta(result, 'speak.model')).toBe('tts-1');
    expect(findMeta(result, 'speak.voice.id')).toBe('echo');
    expect(findMeta(result, 'speak.language')).toBe('fr');
  });

  it('validates: valid options returns undefined', () => {
    const opts = [
      cred(),
      createMetadata('speak.model', 'gpt-4o-mini-tts'),
      createMetadata('speak.voice.id', 'alloy'),
      createMetadata('speak.language', 'en'),
    ];
    expect(validateFromConfig(config, 'tts', 'openai', opts)).toBeUndefined();
  });

  it('validates: invalid model returns error', () => {
    const opts = [
      cred(),
      createMetadata('speak.model', 'nonexistent'),
      createMetadata('speak.voice.id', 'alloy'),
      createMetadata('speak.language', 'en'),
    ];
    expect(validateFromConfig(config, 'tts', 'openai', opts)).toBe(
      'Please select valid model for text to speech.',
    );
  });

  it('validates: invalid voice returns error', () => {
    const opts = [
      cred(),
      createMetadata('speak.model', 'tts-1'),
      createMetadata('speak.voice.id', 'nonexistent-voice'),
      createMetadata('speak.language', 'en'),
    ];
    expect(validateFromConfig(config, 'tts', 'openai', opts)).toBe(
      'Please select valid voice for text to speech.',
    );
  });

  it('validates: invalid language returns error', () => {
    const opts = [
      cred(),
      createMetadata('speak.model', 'tts-1'),
      createMetadata('speak.voice.id', 'alloy'),
      createMetadata('speak.language', 'invalid'),
    ];
    expect(validateFromConfig(config, 'tts', 'openai', opts)).toBe(
      'Please select valid language option for text to speech.',
    );
  });

  it('preserves speaker.* params', () => {
    const existing = [createMetadata('speaker.speed', '1.5')];
    const result = getDefaultsFromConfig(config, 'tts', existing, 'openai');
    expect(findMeta(result, 'speaker.speed')).toBe('1.5');
  });
});
