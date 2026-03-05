import { FC, HTMLAttributes } from 'react';
import { BaseCard, CardDescription, CardTitle } from '@/app/components/base/cards';
import { cn } from '@/utils';
import { CardOptionMenu } from '@/app/components/menu';
import { AssistantTool } from '@rapidaai/react';
import { BUILDIN_TOOLS } from '@/llm-tools';

interface ToolCardProps extends HTMLAttributes<HTMLDivElement> {
  tool: AssistantTool;
  options?: { option: any; onActionClick: () => void }[];
  iconClass?: string;
  titleClass?: string;
  isConnected?: boolean;
}

export const SelectToolCard: FC<ToolCardProps> = ({
  tool,
  options,
  className,
}) => {
  const hasProtobufMethods = typeof tool.getExecutionmethod === 'function';
  const executionMethod = hasProtobufMethods ? tool.getExecutionmethod() : '';
  const isMCP = executionMethod === 'mcp';

  const toolName = hasProtobufMethods ? tool.getName?.() : (tool as any).name;
  const toolDescription = hasProtobufMethods
    ? tool.getDescription?.()
    : (tool as any).description;

  const toolMeta = BUILDIN_TOOLS.find(x => x.code === executionMethod);

  return (
    <BaseCard className={cn('flex flex-col', className)}>
      {/* Body */}
      <div className="p-4 flex-1 flex flex-col gap-3">
        {/* Header row: icon container + options menu */}
        <header className="flex items-start justify-between">
          <div className="w-9 h-9 flex items-center justify-center bg-gray-100 dark:bg-gray-800/60 shrink-0">
            {toolMeta?.icon ? (
              <img
                alt={toolMeta.name}
                src={toolMeta.icon}
                className="w-5 h-5 object-contain"
              />
            ) : (
              <span className="text-xs font-semibold text-gray-400 uppercase">
                {(toolName ?? '?').charAt(0)}
              </span>
            )}
          </div>
          {options && (
            <CardOptionMenu options={options} classNames="h-8 w-8 p-1" />
          )}
        </header>

        {/* Name + description */}
        <div className="flex-1 flex flex-col gap-1 min-w-0">
          <CardTitle className="line-clamp-1 text-sm font-semibold">
            {toolName}
          </CardTitle>
          <CardDescription className="line-clamp-2 text-xs leading-relaxed">
            {toolDescription}
          </CardDescription>
        </div>
      </div>

      {/* Footer: execution type tag */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-gray-100 dark:border-gray-800">
        {toolMeta && (
          <span className="inline-flex items-center h-5 px-2 text-[11px] font-medium tracking-wide bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
            {toolMeta.name}
          </span>
        )}
        {isMCP && (
          <span className="inline-flex items-center h-5 px-2 text-[11px] font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
            MCP
          </span>
        )}
        {!toolMeta && !isMCP && (
          <span className="inline-flex items-center h-5 px-2 text-[11px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-500 capitalize">
            {executionMethod.replace(/_/g, ' ')}
          </span>
        )}
      </div>
    </BaseCard>
  );
};
