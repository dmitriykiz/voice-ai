import { Metadata } from '@rapidaai/react';
import { SetMetadata } from '@/utils/metadata';
import {
  ParameterConfig,
  ProviderConfigCategory,
  ProviderConfig,
  loadProviderData,
  resolveCategoryParameters,
} from './config-loader';

interface GetDefaultsFromConfigOptions {
  includeCredential?: boolean;
  replacePrefix?: string;
}

export function getDefaultsFromConfig(
  config: ProviderConfig,
  category: ProviderConfigCategory,
  currentMetadata: Metadata[],
  provider: string,
  options: GetDefaultsFromConfigOptions = {},
): Metadata[] {
  const catConfig = config[category];
  if (!catConfig) return currentMetadata;
  const resolvedParameters = resolveCategoryParameters(
    provider,
    category,
    catConfig,
    currentMetadata,
  );

  const mtds: Metadata[] = [];
  const includeCredential = options.includeCredential !== false;
  const replacePrefix = options.replacePrefix;
  const keysToKeep: string[] = includeCredential ? ['rapida.credential_id'] : [];

  const addMetadata = (
    key: string,
    defaultValue?: string,
    validationFn?: (value: string) => boolean,
  ) => {
    const metadata = SetMetadata(currentMetadata, key, defaultValue, validationFn);
    if (metadata) mtds.push(metadata);
  };

  if (includeCredential) {
    addMetadata('rapida.credential_id');
  }

  for (const param of resolvedParameters) {
    keysToKeep.push(param.key);
    if (param.linkedField) {
      keysToKeep.push(param.linkedField.key);
    }

    const validationFn = buildValidationFn(param, provider, category);
    addMetadata(param.key, param.default, validationFn);

    if (param.linkedField) {
      const data = param.data ? loadProviderData(provider, param.data) : [];
      const existingValue = currentMetadata.find(m => m.getKey() === param.key)?.getValue();
      const existingLinkedValue = currentMetadata.find(
        m => m.getKey() === param.linkedField!.key,
      )?.getValue();
      const valueToUse = existingValue || param.default;
      if (existingLinkedValue) {
        addMetadata(param.linkedField.key, existingLinkedValue);
      } else if (valueToUse && data.length > 0 && param.valueField) {
        const matched = data.find((item: any) => item[param.valueField!] === valueToUse);
        if (matched) {
          addMetadata(param.linkedField.key, matched[param.linkedField.sourceField]);
        }
      } else if (valueToUse && param.customValue) {
        addMetadata(param.linkedField.key, valueToUse);
      }
    }
  }

  const preservePrefix = catConfig.preservePrefix;
  const preservedMetadata = replacePrefix
    ? currentMetadata.filter(m => !m.getKey().startsWith(replacePrefix))
    : currentMetadata.filter(
        m => preservePrefix && m.getKey().startsWith(preservePrefix),
      );

  if (replacePrefix) {
    return [
      ...preservedMetadata,
      ...mtds.filter(m => keysToKeep.includes(m.getKey())),
    ];
  }

  return [
    ...mtds.filter(m => keysToKeep.includes(m.getKey())),
    ...preservedMetadata,
  ];
}

export function validateFromConfig(
  config: ProviderConfig,
  category: ProviderConfigCategory,
  provider: string,
  options: Metadata[],
): string | undefined {
  const catConfig = config[category];
  if (!catConfig) return undefined;
  const resolvedParameters = resolveCategoryParameters(
    provider,
    category,
    catConfig,
    options,
  );

  const credentialID = options.find(
    opt => opt.getKey() === 'rapida.credential_id',
  );
  if (
    !credentialID ||
    !credentialID.getValue() ||
    credentialID.getValue().length === 0
  ) {
    return `Please provide a valid ${provider} credential.`;
  }

  for (const param of resolvedParameters) {
    const isRequired = param.required !== false;
    const option = options.find(opt => opt.getKey() === param.key);
    const value = option?.getValue() ?? '';

    if (!isRequired && !value) continue;

    if (isRequired && !value) {
      return (
        param.errorMessage ??
        `Please provide a valid value for ${param.label.toLowerCase()}.`
      );
    }

    const error = validateParamValue(param, value, provider);
    if (error) return error;
  }

  return undefined;
}

function buildValidationFn(
  param: ParameterConfig,
  provider: string,
  category: ProviderConfigCategory,
): ((value: string) => boolean) | undefined {
  if (category !== 'text') {
    if (param.strict === false) return undefined;
    if (param.type === 'dropdown' && param.data && param.valueField) {
      const data = loadProviderData(provider, param.data);
      const field = param.valueField;
      return (value: string) => data.some((item: any) => item[field] === value);
    }
    return undefined;
  }

  return (value: string) => {
    if (!value) {
      return param.required === false;
    }
    return validateParamValue(param, value, provider) === undefined;
  };
}

function validateParamValue(
  param: ParameterConfig,
  value: string,
  provider: string,
): string | undefined {
  const defaultError =
    param.errorMessage ??
    `Please provide a valid value for ${param.label.toLowerCase()}.`;

  switch (param.type) {
    case 'dropdown': {
      if (param.strict === false) return undefined;
      if (param.data && param.valueField) {
        const data = loadProviderData(provider, param.data);
        if (!data.some((item: any) => item[param.valueField!] === value)) {
          return defaultError;
        }
      }
      return undefined;
    }
    case 'slider':
    case 'number': {
      const num = parseFloat(value);
      if (isNaN(num)) return defaultError;
      if (param.min !== undefined && num < param.min) return defaultError;
      if (param.max !== undefined && num > param.max) return defaultError;
      return undefined;
    }
    case 'json': {
      if (!value) return undefined;
      try {
        JSON.parse(value);
        return undefined;
      } catch {
        return defaultError;
      }
    }
    case 'select': {
      if (param.choices && param.choices.length > 0) {
        if (!param.choices.some(c => c.value === value)) {
          return defaultError;
        }
      }
      return undefined;
    }
    default:
      return undefined;
  }
}
