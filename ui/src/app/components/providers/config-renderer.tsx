import React, { useMemo, useState } from 'react';
import { Metadata } from '@rapidaai/react';
import { Dropdown } from '@/app/components/dropdown';
import { CustomValueDropdown } from '@/app/components/dropdown/custom-value-dropdown';
import { FormLabel } from '@/app/components/form-label';
import { FieldSet } from '@/app/components/form/fieldset';
import { Input } from '@/app/components/form/input';
import { Slider } from '@/app/components/form/slider';
import { Select } from '@/app/components/form/select';
import { Textarea } from '@/app/components/form/textarea';
import { InputHelper } from '@/app/components/input-helper';
import { Popover } from '@/app/components/popover';
import { IButton } from '@/app/components/form/button';
import { Bolt, X } from 'lucide-react';
import { cn } from '@/utils';
import {
  CategoryConfig,
  ParameterConfig,
  ProviderConfig,
  isModelSelectorParameter,
  loadProviderData,
  resolveCategoryParameters,
} from '@/providers/config-loader';
import { getDefaultsFromConfig } from '@/providers/config-defaults';

const renderOption = (c: { name: string }) => (
  <span className="inline-flex items-center gap-2 sm:gap-2.5 max-w-full text-sm font-medium">
    <span className="truncate capitalize">{c.name}</span>
  </span>
);

export const ConfigRenderer: React.FC<{
  provider: string;
  category: 'stt' | 'tts' | 'text' | 'vad' | 'eos' | 'noise';
  config: CategoryConfig;
  parameters: Metadata[] | null;
  onParameterChange: (parameters: Metadata[]) => void;
}> = ({ provider, category, config, parameters, onParameterChange }) => {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const effectiveParameters = useMemo(
    () =>
      resolveCategoryParameters(provider, category, config, parameters || []),
    [provider, category, config, parameters],
  );

  const getParamValue = (key: string) =>
    parameters?.find(p => p.getKey() === key)?.getValue() ?? '';

  const applyUpdates = (
    updates: { key: string; value: string }[],
    sourceParam?: ParameterConfig,
  ) => {
    const updatedParams = [...(parameters || [])];
    const currentModelValue =
      sourceParam && isModelSelectorParameter(sourceParam)
        ? getParamValue(sourceParam.key)
        : '';

    for (const { key, value } of updates) {
      const existingIndex = updatedParams.findIndex(p => p.getKey() === key);
      const newParam = new Metadata();
      newParam.setKey(key);
      newParam.setValue(value);
      if (existingIndex >= 0) {
        updatedParams[existingIndex] = newParam;
      } else {
        updatedParams.push(newParam);
      }
    }

    if (!sourceParam || !isModelSelectorParameter(sourceParam)) {
      onParameterChange(updatedParams);
      return;
    }
    const nextModelValue = updates.find(
      update => update.key === sourceParam.key,
    )?.value;
    if (nextModelValue === undefined || nextModelValue === currentModelValue) {
      onParameterChange(updatedParams);
      return;
    }

    const includeCredential = updatedParams.some(
      p => p.getKey() === 'rapida.credential_id',
    );
    const wrappedConfig = { [category]: config } as ProviderConfig;
    const hydrated = getDefaultsFromConfig(
      wrappedConfig,
      category,
      updatedParams,
      provider,
      { includeCredential },
    );
    onParameterChange(hydrated);
  };

  const updateParameter = (
    key: string,
    value: string,
    sourceParam?: ParameterConfig,
  ) => {
    applyUpdates([{ key, value }], sourceParam);
  };

  const updateMultipleParameters = (
    updates: { key: string; value: string }[],
    sourceParam?: ParameterConfig,
  ) => {
    applyUpdates(updates, sourceParam);
  };

  const isVisible = (param: ParameterConfig): boolean => {
    if (!param.showWhen) return true;
    const refValue = getParamValue(param.showWhen.key);
    return new RegExp(param.showWhen.pattern).test(refValue);
  };

  const visibleParameters = effectiveParameters.filter(isVisible);
  const regularParams = visibleParameters.filter(p => !p.advanced);
  const advancedParams = visibleParameters.filter(p => p.advanced);
  const hasAdvanced = advancedParams.length > 0;

  const renderField = (param: ParameterConfig) => {
    if (!isVisible(param)) return null;

    const colSpanClass = param.colSpan === 2 ? 'col-span-2' : 'col-span-1';

    switch (param.type) {
      case 'dropdown':
        return (
          <DropdownField
            key={param.key}
            param={param}
            provider={provider}
            value={getParamValue(param.key)}
            onChange={(value, selectedItem) => {
              if (param.linkedField && selectedItem) {
                updateMultipleParameters(
                  [
                    { key: param.key, value },
                    {
                      key: param.linkedField.key,
                      value: selectedItem[param.linkedField.sourceField] ?? '',
                    },
                  ],
                  param,
                );
              } else {
                updateParameter(param.key, value, param);
              }
            }}
            colSpanClass={colSpanClass}
          />
        );

      case 'slider':
        const sliderRawValue = getParamValue(param.key);
        const sliderParsedValue = Number.parseFloat(sliderRawValue);
        const sliderValue = Number.isNaN(sliderParsedValue)
          ? (param.min ?? 0)
          : sliderParsedValue;
        return (
          <FieldSet className={cn(colSpanClass, 'h-fit')} key={param.key}>
            <FormLabel>{param.label}</FormLabel>
            <div className="flex space-x-2 justify-center items-center">
              <Slider
                min={param.min ?? 0}
                max={param.max ?? 1}
                step={param.step ?? 0.1}
                value={sliderValue}
                onSlide={c => {
                  updateParameter(param.key, c.toString());
                }}
              />
              <Input
                type="number"
                min={param.min}
                max={param.max}
                step={param.step}
                value={getParamValue(param.key)}
                onChange={e => {
                  updateParameter(param.key, e.target.value);
                }}
                className="bg-light-background w-16"
              />
            </div>
            {param.helpText && (
              <InputHelper className="text-xs">{param.helpText}</InputHelper>
            )}
          </FieldSet>
        );

      case 'number':
        return (
          <FieldSet className={cn(colSpanClass, 'h-fit')} key={param.key}>
            <FormLabel>{param.label}</FormLabel>
            <Input
              type="number"
              min={param.min}
              max={param.max}
              step={param.step}
              value={getParamValue(param.key)}
              placeholder={param.placeholder}
              onChange={e => {
                updateParameter(param.key, e.target.value);
              }}
            />
            {param.helpText && (
              <InputHelper className="text-xs">{param.helpText}</InputHelper>
            )}
          </FieldSet>
        );

      case 'input':
        return (
          <FieldSet className={cn(colSpanClass, 'h-fit')} key={param.key}>
            <FormLabel>{param.label}</FormLabel>
            <Input
              type="text"
              value={getParamValue(param.key)}
              placeholder={param.placeholder}
              onChange={e => {
                updateParameter(param.key, e.target.value);
              }}
            />
            {param.helpText && (
              <InputHelper className="text-xs">{param.helpText}</InputHelper>
            )}
          </FieldSet>
        );

      case 'textarea':
        return (
          <FieldSet className={cn(colSpanClass)} key={param.key}>
            <FormLabel>{param.label}</FormLabel>
            <Textarea
              required={param.required !== false}
              value={getParamValue(param.key)}
              onChange={e => {
                updateParameter(param.key, e.target.value);
              }}
              rows={param.rows ?? 2}
              className="bg-light-background"
              placeholder={param.placeholder}
            />
            {param.helpText && <InputHelper>{param.helpText}</InputHelper>}
          </FieldSet>
        );

      case 'select':
        return (
          <FieldSet className={cn(colSpanClass, 'h-fit')} key={param.key}>
            <FormLabel>{param.label}</FormLabel>
            <Select
              onChange={e => updateParameter(param.key, e.target.value)}
              placeholder={`Select ${param.label.toLowerCase()}`}
              className="text-sm! h-9 pl-3"
              value={getParamValue(param.key)}
              options={(param.choices ?? []).map(c => ({
                name: c.label,
                value: c.value,
              }))}
            />
            {param.helpText && (
              <InputHelper className="text-xs">{param.helpText}</InputHelper>
            )}
          </FieldSet>
        );

      case 'json':
        return (
          <FieldSet className={cn(colSpanClass)} key={param.key}>
            <FormLabel>{param.label}</FormLabel>
            <Textarea
              placeholder="Enter as JSON"
              value={getParamValue(param.key) || '{}'}
              onChange={e => {
                updateParameter(param.key, e.target.value);
              }}
            />
            {param.helpText && (
              <InputHelper className="text-xs">{param.helpText}</InputHelper>
            )}
          </FieldSet>
        );

      default:
        return null;
    }
  };

  if (category === 'text' && hasAdvanced) {
    const mainParam = regularParams[0];
    return (
      <div className="flex-1 flex items-center divide-x">
        {mainParam?.type === 'dropdown' &&
          renderTextMainDropdown(
            mainParam,
            provider,
            getParamValue,
            updateMultipleParameters,
            updateParameter,
          )}
        <div>
          <IButton onClick={() => setAdvancedOpen(!advancedOpen)}>
            {advancedOpen ? (
              <X className={cn('w-4 h-4')} strokeWidth="1.5" />
            ) : (
              <Bolt className={cn('w-4 h-4')} strokeWidth="1.5" />
            )}
          </IButton>
          <Popover
            align="bottom-end"
            open={advancedOpen}
            setOpen={setAdvancedOpen}
            className="z-50 min-w-fit p-4 grid grid-cols-3 gap-6"
          >
            {advancedParams.map(renderField)}
          </Popover>
        </div>
      </div>
    );
  }

  return <>{effectiveParameters.map(renderField)}</>;
};

const DropdownField: React.FC<{
  param: ParameterConfig;
  provider: string;
  value: string;
  onChange: (value: string, selectedItem?: any) => void;
  colSpanClass: string;
}> = ({ param, provider, value, onChange, colSpanClass }) => {
  const data = param.data ? loadProviderData(provider, param.data) : [];
  const valueField = param.valueField || 'id';
  const nameField = param.linkedField?.sourceField || 'name';
  const currentValue = data.find((item: any) => item[valueField] === value);
  const fallbackCurrentValue =
    param.customValue && value
      ? {
          [valueField]: value,
          [nameField]: value,
          id: value,
          name: value,
        }
      : undefined;

  return (
    <FieldSet className={cn(colSpanClass, 'h-fit')} key={param.key}>
      <FormLabel>{param.label}</FormLabel>
      {param.customValue ? (
        <CustomValueDropdown
          customValue
          className="bg-light-background max-w-full dark:bg-gray-950"
          searchable={param.searchable}
          currentValue={currentValue || fallbackCurrentValue}
          setValue={(v: any) => {
            onChange(v[valueField], v);
          }}
          onAddCustomValue={vl => onChange(vl)}
          allValue={data}
          placeholder={`Select ${param.label.toLowerCase()}`}
          option={renderOption}
          label={renderOption}
        />
      ) : (
        <Dropdown
          className="bg-light-background max-w-full dark:bg-gray-950"
          searchable={param.searchable}
          currentValue={currentValue}
          setValue={(v: any) => {
            onChange(v[valueField], v);
          }}
          allValue={data}
          placeholder={`Select ${param.label.toLowerCase()}`}
          option={renderOption}
          label={renderOption}
        />
      )}
      {param.helpText && <InputHelper>{param.helpText}</InputHelper>}
    </FieldSet>
  );
};

function renderTextMainDropdown(
  param: ParameterConfig,
  provider: string,
  getParamValue: (key: string) => string,
  updateMultipleParameters: (
    updates: { key: string; value: string }[],
    sourceParam?: ParameterConfig,
  ) => void,
  updateParameter: (
    key: string,
    value: string,
    sourceParam?: ParameterConfig,
  ) => void,
) {
  const data = param.data ? loadProviderData(provider, param.data) : [];
  const valueField = param.valueField || 'id';
  const nameField = param.linkedField?.sourceField || 'name';
  const currentValue = getParamValue(param.key);
  const linkedValue = param.linkedField ? getParamValue(param.linkedField.key) : '';
  const fallbackCurrentValue =
    param.customValue && currentValue
      ? {
          [valueField]: currentValue,
          [nameField]: linkedValue || currentValue,
          id: currentValue,
          name: linkedValue || currentValue,
        }
      : undefined;

  if (param.customValue) {
    return (
      <CustomValueDropdown
        customValue
        className="max-w-full focus-within:border-none! focus-within:outline-hidden! border-none!"
        currentValue={
          data.find((x: any) => x[valueField] === currentValue) ||
          fallbackCurrentValue
        }
        setValue={(v: any) => {
          if (param.linkedField) {
            updateMultipleParameters(
              [
                { key: param.key, value: v[valueField] },
                {
                  key: param.linkedField.key,
                  value: v[param.linkedField.sourceField] ?? v[valueField],
                },
              ],
              param,
            );
          } else {
            updateParameter(param.key, v[valueField], param);
          }
        }}
        onAddCustomValue={vl => {
          if (param.linkedField) {
            updateMultipleParameters(
              [
                { key: param.key, value: vl },
                { key: param.linkedField.key, value: vl },
              ],
              param,
            );
          } else {
            updateParameter(param.key, vl, param);
          }
        }}
        allValue={data}
        placeholder="Select model"
        option={renderOption}
        label={renderOption}
      />
    );
  }

  return (
    <Dropdown
      className="max-w-full focus-within:border-none! focus-within:outline-hidden! border-none!"
      currentValue={data.find((x: any) => x[valueField] === currentValue)}
      setValue={(v: any) => {
        if (param.linkedField) {
          updateMultipleParameters(
            [
              { key: param.key, value: v[valueField] },
              {
                key: param.linkedField.key,
                value: v[param.linkedField.sourceField] ?? '',
              },
            ],
            param,
          );
        } else {
          updateParameter(param.key, v[valueField], param);
        }
      }}
      allValue={data}
      placeholder="Select model"
      option={renderOption}
      label={renderOption}
    />
  );
}
