import { Metadata } from '@rapidaai/react';
import { loadProviderConfig } from '@/providers/config-loader';
import { getDefaultsFromConfig } from '@/providers/config-defaults';
import { ProviderComponentProps } from '@/app/components/providers';
import { ConfigRenderer } from '@/app/components/providers/config-renderer';
import { FC } from 'react';

const updateProviderOnly = (
  current: Metadata[],
  provider: string,
): Metadata[] => {
  const updated = current.map(param => {
    if (param.getKey() === 'microphone.denoising.provider') {
      const metadata = new Metadata();
      metadata.setKey('microphone.denoising.provider');
      metadata.setValue(provider);
      return metadata;
    }
    return param;
  });

  if (!updated.some(param => param.getKey() === 'microphone.denoising.provider')) {
    const metadata = new Metadata();
    metadata.setKey('microphone.denoising.provider');
    metadata.setValue(provider);
    updated.push(metadata);
  }

  return updated;
};

export const GetDefaultNoiseCancellationConfig = (
  provider: string,
  current: Metadata[],
): Metadata[] => {
  const config = loadProviderConfig(provider);
  if (!config?.noise) return current;
  const defaults = getDefaultsFromConfig(config, 'noise', current, provider, {
    includeCredential: false,
    replacePrefix: 'microphone.denoising.',
  });
  return updateProviderOnly(defaults, provider);
};

export const NoiseCancellationConfigComponent: FC<ProviderComponentProps> = ({
  provider,
  parameters,
  onChangeParameter,
}) => {
  const config = loadProviderConfig(provider);
  if (!config?.noise || config.noise.parameters.length === 0) return null;

  return (
    <ConfigRenderer
      provider={provider}
      category="noise"
      config={config.noise}
      parameters={parameters}
      onParameterChange={onChangeParameter}
    />
  );
};
