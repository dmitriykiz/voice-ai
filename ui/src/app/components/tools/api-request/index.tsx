import { FC } from 'react';
import { cn } from '@/utils';
import { FormLabel } from '@/app/components/form-label';
import { FieldSet } from '@/app/components/form/fieldset';
import { Select } from '@/app/components/form/select';
import { Input } from '@/app/components/form/input';
import { InputGroup } from '@/app/components/input-group';
import { APiStringHeader } from '@/app/components/external-api/api-header';
import {
  ConfigureToolProps,
  ToolDefinitionForm,
  ParameterEditor,
  useParameterManager,
  HTTP_METHOD_OPTIONS,
} from '../common';

// ============================================================================
// Main Component
// ============================================================================

export const ConfigureAPIRequest: FC<ConfigureToolProps> = ({
  toolDefinition,
  onChangeToolDefinition,
  onParameterChange,
  parameters,
  inputClass,
}) => {
  const { getParamValue, updateParameter } = useParameterManager(
    parameters,
    onParameterChange,
  );

  return (
    <>
      <InputGroup title="Action Definition">
        <div className="flex flex-col gap-8 max-w-6xl">
          <div className="flex space-x-2">
            <FieldSet className="relative w-40">
              <FormLabel>Method</FormLabel>
              <Select
                value={getParamValue('tool.method')}
                onChange={e => updateParameter('tool.method', e.target.value)}
                className={cn('bg-light-background', inputClass)}
                options={HTTP_METHOD_OPTIONS}
              />
            </FieldSet>
            <FieldSet className="relative w-full">
              <FormLabel>Server URL</FormLabel>
              <Input
                value={getParamValue('tool.endpoint')}
                onChange={e => updateParameter('tool.endpoint', e.target.value)}
                placeholder="https://your-domain.com/api/v1/resource"
                className={cn('bg-light-background', inputClass)}
              />
            </FieldSet>
          </div>

          <FieldSet>
            <FormLabel>Headers</FormLabel>
            <APiStringHeader
              inputClass={inputClass}
              headerValue={getParamValue('tool.headers')}
              setHeaderValue={value => updateParameter('tool.headers', value)}
            />
          </FieldSet>

          <ParameterEditor
            value={getParamValue('tool.parameters')}
            onChange={value => updateParameter('tool.parameters', value)}
            inputClass={inputClass}
          />
        </div>
      </InputGroup>

      {toolDefinition && onChangeToolDefinition && (
        <ToolDefinitionForm
          toolDefinition={toolDefinition}
          onChangeToolDefinition={onChangeToolDefinition}
          inputClass={inputClass}
        />
      )}
    </>
  );
};
