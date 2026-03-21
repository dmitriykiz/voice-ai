import { Metadata } from '@rapidaai/react';
import { loadProviderConfig, loadProviderData, ParameterConfig } from '@/providers/config-loader';

type TextModelOption = {
  id: string;
  name: string;
};

const getMetadataValue = (parameters: Metadata[], key: string): string => {
  return parameters.find(param => param.getKey() === key)?.getValue() ?? '';
};

const upsertMetadata = (
  parameters: Metadata[],
  key: string,
  value: string,
): Metadata[] => {
  const next = [...parameters];
  const param = new Metadata();
  param.setKey(key);
  param.setValue(value);
  const idx = next.findIndex(item => item.getKey() === key);
  if (idx >= 0) {
    next[idx] = param;
  } else {
    next.push(param);
  }
  return next;
};

const lastSegment = (value: string): string => {
  const parts = value.split('/');
  return parts[parts.length - 1];
};

const getTextModelParameter = (provider: string): ParameterConfig | null => {
  const config = loadProviderConfig(provider);
  if (!config?.text) return null;
  return (
    config.text.parameters.find(
      param =>
        param.key === 'model.id' &&
        param.type === 'dropdown' &&
        Boolean(param.data),
    ) ?? null
  );
};

const listProviderModels = (
  provider: string,
  modelParam: ParameterConfig,
): TextModelOption[] => {
  if (!modelParam.data) return [];

  const data = loadProviderData(provider, modelParam.data);
  const valueField = modelParam.valueField || 'id';
  const nameField = modelParam.linkedField?.sourceField || 'name';

  return data
    .map((item: any) => ({
      id: item?.[valueField],
      name: item?.[nameField] ?? item?.[valueField],
    }))
    .filter(model => Boolean(model.id) && Boolean(model.name));
};

const findByToken = (
  catalog: TextModelOption[],
  token?: string,
): TextModelOption | undefined => {
  if (!token) return undefined;
  const target = token.trim();
  if (!target) return undefined;

  return (
    catalog.find(model => model.id === target) ||
    catalog.find(model => model.name === target) ||
    catalog.find(model => lastSegment(model.id) === target) ||
    catalog.find(model => lastSegment(model.name) === target)
  );
};

export const NormalizeTextProviderModelSelection = (
  provider: string,
  parameters: Metadata[],
): Metadata[] => {
  if (!parameters || parameters.length === 0) return parameters;

  const modelParam = getTextModelParameter(provider);
  if (!modelParam) return parameters;

  const modelId = getMetadataValue(parameters, 'model.id').trim();
  const modelName = getMetadataValue(parameters, 'model.name').trim();
  if (!modelId && !modelName) return parameters;

  const catalog = listProviderModels(provider, modelParam);
  if (catalog.length === 0) return parameters;

  const fromName = findByToken(catalog, modelName);
  const fromId = findByToken(catalog, modelId);
  const resolved = fromName ?? fromId;

  if (resolved) {
    let normalized = upsertMetadata(parameters, 'model.id', resolved.id);
    normalized = upsertMetadata(normalized, 'model.name', resolved.name);
    return normalized;
  }

  if (modelParam.customValue) {
    const customId = modelId || modelName;
    const customName = modelName || modelId;
    const isConsistentCustom =
      customId &&
      customName &&
      (customId === customName || !modelId || !modelName);

    if (isConsistentCustom) {
      let normalized = upsertMetadata(parameters, 'model.id', customId);
      normalized = upsertMetadata(normalized, 'model.name', customName);
      return normalized;
    }
  }

  const fallback = catalog[0];
  let normalized = upsertMetadata(parameters, 'model.id', fallback.id);
  normalized = upsertMetadata(normalized, 'model.name', fallback.name);
  return normalized;
};

