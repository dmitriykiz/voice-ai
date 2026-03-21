import { Metadata, VaultCredential } from '@rapidaai/react';
import { Dropdown } from '@/app/components/dropdown';
import { ProviderComponentProps } from '@/app/components/providers';
import { loadProviderConfig } from '@/providers/config-loader';
import { getDefaultsFromConfig, validateFromConfig } from '@/providers/config-defaults';
import { ConfigRenderer } from '@/app/components/providers/config-renderer';
import { cn } from '@/utils';
import { FC, useCallback, useMemo } from 'react';
import { FieldSet } from '@/app/components/form/fieldset';
import { FormLabel } from '@/app/components/form-label';
import { CredentialDropdown } from '@/app/components/dropdown/credential-dropdown';
import { TEXT_PROVIDERS } from '@/providers';
import { NormalizeTextProviderModelSelection } from './model-normalization';

/**
 *
 * @param provider
 * @param parameters
 * @returns
 */
export const GetDefaultTextProviderConfigIfInvalid = (
  provider: string,
  parameters: Metadata[],
): Metadata[] => {
  const config = loadProviderConfig(provider);
  if (!config?.text) return parameters;

  const normalizedParameters = NormalizeTextProviderModelSelection(
    provider,
    parameters,
  );

  return getDefaultsFromConfig(config, 'text', normalizedParameters, provider);
};

/**
 *
 * @param provider
 * @param parameters
 * @returns
 */
export const ValidateTextProviderDefaultOptions = (
  provider: string,
  parameters: Metadata[],
  providerCredentialIds?: string[],
): string | undefined => {
  const config = loadProviderConfig(provider);
  if (!config?.text) return 'Please select a valid model and provider.';
  const normalizedParameters = NormalizeTextProviderModelSelection(
    provider,
    parameters,
  );
  const validationError = validateFromConfig(
    config,
    'text',
    provider,
    normalizedParameters,
  );
  if (validationError) return validationError;

  if (!providerCredentialIds) return undefined;

  const credentialID = normalizedParameters.find(
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

/**
 *
 * @param param0
 * @returns
 */
const TextProviderConfigComponent: FC<ProviderComponentProps> = ({
  provider,
  parameters,
  onChangeParameter,
}) => {
  const config = loadProviderConfig(provider);
  if (!config?.text) return null;

  return (
    <ConfigRenderer
      provider={provider}
      category="text"
      config={config.text}
      parameters={parameters}
      onParameterChange={onChangeParameter}
    />
  );
};

/**
 *
 * @param param0
 * @returns
 */
export const TextProvider: React.FC<ProviderComponentProps> = props => {
  const { provider, parameters, onChangeProvider, onChangeParameter } = props;
  const textProviders = useMemo(
    () => TEXT_PROVIDERS.filter(p => Boolean(loadProviderConfig(p.code)?.text)),
    [],
  );

  const getParamValue = useCallback(
    (key: string) => {
      return parameters?.find(p => p.getKey() === key)?.getValue() ?? '';
    },
    [parameters],
  );

  const updateParameter = (key: string, value: string) => {
    const updatedParams = [...(parameters || [])];
    const existingIndex = updatedParams.findIndex(p => p.getKey() === key);
    const newParam = new Metadata();
    newParam.setKey(key);
    newParam.setValue(value);
    if (existingIndex >= 0) {
      updatedParams[existingIndex] = newParam;
    } else {
      updatedParams.push(newParam);
    }
    onChangeParameter(updatedParams);
  };

  return (
    <>
      <FieldSet>
        <FormLabel>Provider Model</FormLabel>
        <div
          className={cn(
            'outline-solid outline-[1.5px] outline-transparent outline-offset-[-1.5px]',
            'focus-within:outline-primary focus-within:border-primary',
            'border-b border-gray-300 dark:border-gray-700',
            'transition-colors duration-100',
            'flex relative',
            'bg-light-background dark:bg-gray-950',
            'divide-x divide-gray-300 dark:divide-gray-700',
          )}
        >
          <div className="w-44 relative">
            <Dropdown
              className="max-w-full focus-within:border-none! outline-none! border-none! outline-hidden"
              currentValue={textProviders.find(x => x.code === provider)}
              setValue={v => {
                onChangeProvider(v.code);
              }}
              allValue={textProviders}
              placeholder="Select provider"
              option={c => {
                return (
                  <span className="inline-flex items-center gap-2 sm:gap-2.5 max-w-full text-sm font-medium">
                    <img
                      alt=""
                      loading="lazy"
                      width={16}
                      height={16}
                      className="sm:h-4 sm:w-4 w-4 h-4 align-middle block shrink-0"
                      src={c.image}
                    />
                    <span className="truncate capitalize">{c.name}</span>
                  </span>
                );
              }}
              label={c => {
                return (
                  <span className="inline-flex items-center gap-2 sm:gap-2.5 max-w-full text-sm font-medium">
                    <img
                      alt=""
                      loading="lazy"
                      width={16}
                      height={16}
                      className="sm:h-4 sm:w-4 w-4 h-4 align-middle block shrink-0"
                      src={c.image}
                    />
                    <span className="truncate capitalize">{c.name}</span>
                  </span>
                );
              }}
            />
          </div>
          {/*  */}
          <TextProviderConfigComponent {...props} />
        </div>
      </FieldSet>
      {provider && (
        <CredentialDropdown
          onChangeCredential={(c: VaultCredential) => {
            updateParameter('rapida.credential_id', c.getId());
          }}
          provider={provider}
          currentCredential={getParamValue('rapida.credential_id')}
        />
      )}
    </>
  );
};
