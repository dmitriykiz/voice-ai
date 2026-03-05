import { Metadata } from '@rapidaai/react';
import { FC, useCallback, useMemo } from 'react';
import { Dropdown } from '@/app/components/dropdown';
import { FieldSet } from '@/app/components/form/fieldset';
import { FormLabel } from '@/app/components/form-label';
import { cn } from '@/utils';
import { CONFIG } from '@/configs';
import { ConfigureAPIRequest } from '@/app/components/tools/api-request';
import {
  GetAPIRequestDefaultOptions,
  ValidateAPIRequestDefaultOptions,
} from '@/app/components/tools/api-request/constant';
import { ConfigureEndOfConversation } from '@/app/components/tools/end-of-conversation';
import {
  GetEndOfConversationDefaultOptions,
  ValidateEndOfConversationDefaultOptions,
} from '@/app/components/tools/end-of-conversation/constant';
import { ConfigureEndpoint } from '@/app/components/tools/endpoint';
import {
  GetEndpointDefaultOptions,
  ValidateEndpointDefaultOptions,
} from '@/app/components/tools/endpoint/constant';
import { ConfigureKnowledgeRetrieval } from '@/app/components/tools/knowledge-retrieval';
import {
  GetKnowledgeRetrievalDefaultOptions,
  ValidateKnowledgeRetrievalDefaultOptions,
} from '@/app/components/tools/knowledge-retrieval/constant';
import { ConfigureMCP } from '@/app/components/tools/mcp';
import {
  GetMCPDefaultOptions,
  ValidateMCPDefaultOptions,
} from '@/app/components/tools/mcp/constant';
import {
  APIRequestToolDefintion,
  BUILDIN_TOOLS,
  EndOfConverstaionToolDefintion,
  EndpointToolDefintion,
  KnowledgeRetrievalToolDefintion,
} from '@/llm-tools';
import { ConfigureToolProps } from './common';

// ============================================================================
// Types
// ============================================================================

export type ToolCode =
  | 'knowledge_retrieval'
  | 'api_request'
  | 'endpoint'
  | 'end_of_conversation'
  | 'mcp';

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: string;
}

export interface BuildinToolConfig {
  code: string;
  parameters: Metadata[];
}

// ============================================================================
// Tool Registry - Single source of truth for tool configurations
// ============================================================================

/**
 * Configuration interface for each tool in the registry.
 * @property definition - Static tool definition (optional for runtime-resolved tools like MCP)
 * @property getDefaultOptions - Returns default metadata parameters for the tool
 * @property validateOptions - Validates tool configuration and returns error message if invalid
 * @property Component - React component for tool configuration UI
 */
interface ToolConfig {
  definition?: ToolDefinition;
  getDefaultOptions: (params: Metadata[]) => Metadata[];
  validateOptions: (params: Metadata[]) => string | undefined;
  Component: FC<ConfigureToolProps>;
}

const TOOL_REGISTRY: Record<ToolCode, ToolConfig> = {
  knowledge_retrieval: {
    definition: KnowledgeRetrievalToolDefintion,
    getDefaultOptions: GetKnowledgeRetrievalDefaultOptions,
    validateOptions: ValidateKnowledgeRetrievalDefaultOptions,
    Component: ConfigureKnowledgeRetrieval,
  },
  api_request: {
    definition: APIRequestToolDefintion,
    getDefaultOptions: GetAPIRequestDefaultOptions,
    validateOptions: ValidateAPIRequestDefaultOptions,
    Component: ConfigureAPIRequest,
  },
  endpoint: {
    definition: EndpointToolDefintion,
    getDefaultOptions: GetEndpointDefaultOptions,
    validateOptions: ValidateEndpointDefaultOptions,
    Component: ConfigureEndpoint,
  },
  end_of_conversation: {
    definition: EndOfConverstaionToolDefintion,
    getDefaultOptions: GetEndOfConversationDefaultOptions,
    validateOptions: ValidateEndOfConversationDefaultOptions,
    Component: ConfigureEndOfConversation,
  },
  mcp: {
    // MCP tools don't have a static definition - resolved dynamically at runtime
    definition: undefined,
    getDefaultOptions: GetMCPDefaultOptions,
    validateOptions: ValidateMCPDefaultOptions,
    Component: ConfigureMCP,
  },
};

const DEFAULT_TOOL_CODE: ToolCode = 'endpoint';

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Type guard to check if a string is a valid tool code
 */
const isValidToolCode = (code: string): code is ToolCode => {
  return code in TOOL_REGISTRY;
};

/**
 * Safely retrieves tool configuration with fallback to default
 */
const getToolConfig = (code: string): ToolConfig => {
  return isValidToolCode(code)
    ? TOOL_REGISTRY[code]
    : TOOL_REGISTRY[DEFAULT_TOOL_CODE];
};

/**
 * Returns the default tool definition for a given tool code.
 * If an existing definition has all required fields, it returns the existing one.
 * MCP tools return a placeholder definition as they are resolved at runtime.
 * This should only be called during initialization, not on every render.
 */
export const GetDefaultToolDefintion = (
  code: string,
  existing?: Partial<ToolDefinition>,
): ToolDefinition => {
  // For MCP, use existing or return placeholder
  if (code === 'mcp') {
    if (existing?.name && existing?.description && existing?.parameters) {
      return existing as ToolDefinition;
    }
    // Return placeholder for MCP - actual definition resolved at runtime
    return {
      name: 'mcp_tool',
      description: 'MCP server tool - resolved at runtime',
      parameters: JSON.stringify({ type: 'object', properties: {} }),
    };
  }

  const hasValidExisting =
    existing?.name && existing?.description && existing?.parameters;

  if (hasValidExisting) {
    return existing as ToolDefinition;
  }

  const config = getToolConfig(code);
  if (!config.definition) {
    throw new Error(`Tool definition not found for code: ${code}`);
  }

  return config.definition;
};

/**
 * Returns default tool config parameters, merging with existing if valid.
 */
export const GetDefaultToolConfigIfInvalid = (
  code: string,
  parameters: Metadata[],
): Metadata[] => {
  const config = getToolConfig(code);
  return config.getDefaultOptions(parameters);
};

/**
 * Validates tool parameters and returns an error message if invalid.
 * Returns undefined if validation passes.
 */
export const ValidateToolDefaultOptions = (
  code: string,
  parameters: Metadata[],
): string | undefined => {
  if (!isValidToolCode(code)) {
    return `Invalid tool code: ${code}`;
  }
  return TOOL_REGISTRY[code].validateOptions(parameters);
};

// ============================================================================
// Components
// ============================================================================

const ToolOptionRenderer: FC<{ icon: string; name: string }> = ({
  icon,
  name,
}) => (
  <span className="inline-flex items-center gap-2 sm:gap-2.5 max-w-full text-sm font-medium">
    <img
      alt=""
      loading="lazy"
      width={16}
      height={16}
      className="w-4 h-4 align-middle block shrink-0"
      src={icon}
    />
    <span className="truncate capitalize">{name}</span>
  </span>
);

const ConfigureBuildinTool: FC<{
  toolDefinition: ToolDefinition;
  onChangeToolDefinition?: (value: ToolDefinition) => void;
  config: BuildinToolConfig;
  onParameterChange: (params: Metadata[]) => void;
  inputClass?: string;
}> = ({
  config,
  inputClass,
  toolDefinition,
  onChangeToolDefinition,
  onParameterChange,
}) => {
  if (!isValidToolCode(config.code)) {
    return null;
  }

  const { Component } = TOOL_REGISTRY[config.code];

  return (
    <Component
      toolDefinition={toolDefinition}
      onChangeToolDefinition={onChangeToolDefinition}
      parameters={config.parameters}
      inputClass={inputClass}
      onParameterChange={onParameterChange}
    />
  );
};

export const BuildinTool: FC<{
  toolDefinition: ToolDefinition;
  onChangeToolDefinition: (value: ToolDefinition) => void;
  onChangeBuildinTool: (code: string) => void;
  onChangeConfig: (config: BuildinToolConfig) => void;
  inputClass?: string;
  config: BuildinToolConfig;
  showDefinitionForm?: boolean;
}> = ({
  toolDefinition,
  onChangeToolDefinition,
  onChangeBuildinTool,
  onChangeConfig,
  config,
  inputClass,
  showDefinitionForm = true,
}) => {
  const handleParameterChange = useCallback(
    (params: Metadata[]) => {
      onChangeConfig({ ...config, parameters: params });
    },
    [config, onChangeConfig],
  );

  const availableTools = useMemo(
    () =>
      CONFIG.workspace.features?.knowledge !== false
        ? BUILDIN_TOOLS
        : BUILDIN_TOOLS.filter(tool => tool.code !== 'knowledge_retrieval'),
    [],
  );

  const currentTool = useMemo(
    () => availableTools.find(tool => tool.code === config.code),
    [config.code, availableTools],
  );

  const renderOption = useCallback(
    (tool: { icon: string; name: string }) => (
      <ToolOptionRenderer icon={tool.icon} name={tool.name} />
    ),
    [],
  );

  return (
    <>
      <div className="p-6">
        <FieldSet>
          <FormLabel>Action</FormLabel>
          <Dropdown
            className={cn('bg-light-background dark:bg-gray-950', inputClass)}
            currentValue={currentTool}
            setValue={tool => onChangeBuildinTool(tool.code)}
            allValue={availableTools}
            placeholder="Select provider"
            option={renderOption}
            label={renderOption}
          />
        </FieldSet>
      </div>

      <ConfigureBuildinTool
        toolDefinition={toolDefinition}
        onChangeToolDefinition={
          showDefinitionForm ? onChangeToolDefinition : undefined
        }
        config={config}
        onParameterChange={handleParameterChange}
        inputClass={inputClass}
      />
    </>
  );
};
