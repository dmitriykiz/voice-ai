import { FC, useState, useCallback } from 'react';
import { ArrowRight, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/utils';
import { FormLabel } from '@/app/components/form-label';
import { FieldSet } from '@/app/components/form/fieldset';
import { Input } from '@/app/components/form/input';
import { Select } from '@/app/components/form/select';
import { Textarea } from '@/app/components/form/textarea';
import { CodeEditor } from '@/app/components/form/editor/code-editor';
import { InputGroup } from '@/app/components/input-group';
import { DocNoticeBlock } from '@/app/components/container/message/notice-block/doc-notice-block';
import {
  IBlueBorderButton,
  IRedBorderButton,
} from '@/app/components/form/button';
import {
  ToolDefinition,
  ParameterType,
  KeyValueParameter,
  PARAMETER_TYPE_OPTIONS,
  ASSISTANT_KEY_OPTIONS,
  CONVERSATION_KEY_OPTIONS,
  TOOL_KEY_OPTIONS,
} from './types';
import { parseJsonParameters, stringifyParameters } from './hooks';

// ============================================================================
// Documentation Notice Block
// ============================================================================

interface DocumentationNoticeProps {
  title?: string;
  documentationUrl: string;
}

export const DocumentationNotice: FC<DocumentationNoticeProps> = ({
  title = 'Know more about knowledge tool definition that can be supported by rapida',
  documentationUrl,
}) => (
  <div className="-mx-6 -mt-6">
    <DocNoticeBlock docUrl={documentationUrl}>{title}</DocNoticeBlock>
  </div>
);

// ============================================================================
// Tool Definition Form
// ============================================================================

interface ToolDefinitionFormProps {
  toolDefinition: ToolDefinition;
  onChangeToolDefinition: (value: ToolDefinition) => void;
  inputClass?: string;
  documentationUrl?: string;
  documentationTitle?: string;
}

export const ToolDefinitionForm: FC<ToolDefinitionFormProps> = ({
  toolDefinition,
  onChangeToolDefinition,
  inputClass,
  documentationUrl = 'https://doc.rapida.ai/assistants/overview',
  documentationTitle,
}) => {
  const handleChange = <K extends keyof ToolDefinition>(
    field: K,
    value: ToolDefinition[K],
  ) => {
    onChangeToolDefinition({ ...toolDefinition, [field]: value });
  };

  return (
    <InputGroup title="Tool Definition">
      <DocumentationNotice
        title={documentationTitle}
        documentationUrl={documentationUrl}
      />
      <div className={cn('mt-4 flex flex-col gap-8 max-w-6xl')}>
        <FieldSet className="relative w-full">
          <FormLabel>Name</FormLabel>
          <Input
            value={toolDefinition.name}
            onChange={e => handleChange('name', e.target.value)}
            placeholder="Enter tool name"
            className={cn('bg-light-background', inputClass)}
          />
        </FieldSet>

        <FieldSet className="relative w-full">
          <FormLabel>Description</FormLabel>
          <Textarea
            value={toolDefinition.description}
            onChange={e => handleChange('description', e.target.value)}
            className={cn('bg-light-background', inputClass)}
            placeholder="A tool description or definition of when this tool will get triggered."
            rows={2}
          />
        </FieldSet>

        <FieldSet className="relative w-full">
          <FormLabel>Parameters</FormLabel>
          <CodeEditor
            placeholder="Provide a tool parameters that will be passed to llm"
            value={toolDefinition.parameters}
            onChange={value => handleChange('parameters', value)}
            className={cn(
              'min-h-40 max-h-dvh bg-light-background dark:bg-gray-950',
              inputClass,
            )}
          />
        </FieldSet>
      </div>
    </InputGroup>
  );
};

// ============================================================================
// Type Key Selector
// ============================================================================

interface TypeKeySelectorProps {
  type: ParameterType;
  value: string;
  onChange: (newValue: string) => void;
  inputClass?: string;
}

export const TypeKeySelector: FC<TypeKeySelectorProps> = ({
  type,
  value,
  onChange,
  inputClass,
}) => {
  const selectClassName = cn('bg-light-background border-none', inputClass);

  switch (type) {
    case 'assistant':
      return (
        <Select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={selectClassName}
          options={[...ASSISTANT_KEY_OPTIONS]}
        />
      );
    case 'conversation':
      return (
        <Select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={selectClassName}
          options={[...CONVERSATION_KEY_OPTIONS]}
        />
      );
    case 'tool':
      return (
        <Select
          value={value}
          onChange={e => onChange(e.target.value)}
          className={selectClassName}
          options={[...TOOL_KEY_OPTIONS]}
        />
      );
    default:
      return (
        <Input
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Key"
          className={cn('bg-light-background w-full border-none', inputClass)}
        />
      );
  }
};

// ============================================================================
// Parameter Row
// ============================================================================

interface ParameterRowProps {
  type: ParameterType;
  paramKey: string;
  value: string;
  inputClass?: string;
  typeOptions: Array<{ name: string; value: string }>;
  onTypeChange: (type: string) => void;
  onKeyChange: (key: string) => void;
  onValueChange: (value: string) => void;
  onRemove: () => void;
}

export const ParameterRow: FC<ParameterRowProps> = ({
  type,
  paramKey,
  value,
  inputClass,
  typeOptions,
  onTypeChange,
  onKeyChange,
  onValueChange,
  onRemove,
}) => (
  <div className="grid grid-cols-2 border-b border-gray-300 dark:border-gray-700">
    <div className="flex col-span-1 items-center">
      <Select
        value={type}
        onChange={e => onTypeChange(e.target.value)}
        className={cn('bg-light-background border-none', inputClass)}
        options={typeOptions}
      />
      <TypeKeySelector
        type={type}
        inputClass={inputClass}
        value={paramKey}
        onChange={onKeyChange}
      />
      <div
        className={cn(
          'bg-light-background dark:bg-gray-950 h-full flex items-center justify-center',
          inputClass,
        )}
      >
        <ArrowRight strokeWidth={1.5} className="w-4 h-4" />
      </div>
    </div>
    <div className="col-span-1 flex">
      <Input
        value={value}
        onChange={e => onValueChange(e.target.value)}
        placeholder="Value"
        className={cn('bg-light-background w-full border-none', inputClass)}
      />
      <IRedBorderButton
        className="border-none outline-hidden h-10"
        onClick={onRemove}
        type="button"
      >
        <Trash2 className="w-4 h-4" strokeWidth={1.5} />
      </IRedBorderButton>
    </div>
  </div>
);

// ============================================================================
// Parameter Editor
// ============================================================================

interface ParameterEditorProps {
  /** JSON-serialised key-value map, e.g. '{"assistant.name":"Alice"}' */
  value: string;
  onChange: (value: string) => void;
  /** Overrides the default full PARAMETER_TYPE_OPTIONS list */
  typeOptions?: Array<{ name: string; value: string }>;
  /** Type prefix used for newly-added rows (default: 'assistant') */
  defaultNewType?: string;
  inputClass?: string;
}

export const ParameterEditor: FC<ParameterEditorProps> = ({
  value,
  onChange,
  typeOptions = [...PARAMETER_TYPE_OPTIONS],
  defaultNewType = 'assistant',
  inputClass,
}) => {
  const [params, setParams] = useState<KeyValueParameter[]>(() =>
    parseJsonParameters(value),
  );

  const commit = useCallback(
    (next: KeyValueParameter[]) => {
      setParams(next);
      onChange(stringifyParameters(next));
    },
    [onChange],
  );

  const handleTypeChange = useCallback(
    (index: number, newType: string) => {
      const next = [...params];
      next[index] = { key: `${newType}.`, value: '' };
      commit(next);
    },
    [params, commit],
  );

  const handleKeyChange = useCallback(
    (index: number, newKey: string) => {
      const next = [...params];
      const [type] = params[index].key.split('.');
      next[index] = { ...params[index], key: `${type}.${newKey}` };
      commit(next);
    },
    [params, commit],
  );

  const handleValueChange = useCallback(
    (index: number, newValue: string) => {
      const next = [...params];
      next[index] = { ...params[index], value: newValue };
      commit(next);
    },
    [params, commit],
  );

  const handleRemove = useCallback(
    (index: number) => {
      commit(params.filter((_, i) => i !== index));
    },
    [params, commit],
  );

  const handleAdd = useCallback(() => {
    commit([...params, { key: `${defaultNewType}.`, value: '' }]);
  }, [params, commit, defaultNewType]);

  return (
    <FieldSet>
      <FormLabel>Parameters ({params.length})</FormLabel>
      <div className="text-sm grid w-full">
        {params.map(({ key, value: val }, index) => {
          const [type, paramKey] = key.split('.');
          return (
            <ParameterRow
              key={index}
              type={type as ParameterType}
              paramKey={paramKey}
              value={val}
              inputClass={inputClass}
              typeOptions={typeOptions}
              onTypeChange={newType => handleTypeChange(index, newType)}
              onKeyChange={newKey => handleKeyChange(index, newKey)}
              onValueChange={newValue => handleValueChange(index, newValue)}
              onRemove={() => handleRemove(index)}
            />
          );
        })}
      </div>
      <IBlueBorderButton
        onClick={handleAdd}
        className="justify-between space-x-8"
      >
        <span>Add parameter</span>
        <Plus className="h-4 w-4 ml-1.5" />
      </IBlueBorderButton>
    </FieldSet>
  );
};
