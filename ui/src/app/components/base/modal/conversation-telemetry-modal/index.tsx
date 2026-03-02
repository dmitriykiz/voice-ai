import React, { useRef, useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import {
  AssistantDefinition,
  ConnectionConfig,
  Criteria,
  GetAllAssistantTelemetry,
  GetAllAssistantTelemetryRequest,
  Paginate,
  TelemetryEvent,
  TelemetryMetric,
} from '@rapidaai/react';
import { ModalProps } from '@/app/components/base/modal';
import { connectionConfig } from '@/configs';
import { BottomModal } from '@/app/components/base/modal/bottom-side-modal';
import { ModalBody } from '@/app/components/base/modal/modal-body';
import { BluredWrapper } from '@/app/components/wrapper/blured-wrapper';
import { PaginationButtonBlock } from '@/app/components/blocks/pagination-button-block';
import { IButton } from '@/app/components/form/button';
import { useCurrentCredential } from '@/hooks/use-credential';
import { cn } from '@/utils';
import { TablePagination } from '@/app/components/base/tables/table-pagination';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConversationTelemetryDialogProps extends ModalProps {
  assistantId: string;
  criterias?: Criteria[];
}

interface Chip {
  field: string;
  value: string | number;
  id: string;
}

interface SearchField {
  id: string;
  label: string;
  type: 'string' | 'number' | 'select';
  placeholder?: string;
  options?: string[];
}

interface SentrySearchProps {
  className?: string;
  updateChips: (chips: Chip[]) => void;
  existingChips: Chip[];
}

type TelemetryRow =
  | { kind: 'event'; ts: Date; key: string; record: TelemetryEvent }
  | { kind: 'metric'; ts: Date; key: string; record: TelemetryMetric };

// ---------------------------------------------------------------------------
// Color maps
// ---------------------------------------------------------------------------

const EVENT_COLORS: Record<string, string> = {
  session:   'text-gray-500 dark:text-gray-400',
  stt:       'text-green-600 dark:text-green-400',
  llm:       'text-blue-600 dark:text-blue-400',
  tts:       'text-violet-600 dark:text-violet-400',
  vad:       'text-yellow-600 dark:text-yellow-400',
  eos:       'text-cyan-600 dark:text-cyan-400',
  denoise:   'text-orange-600 dark:text-orange-400',
  audio:     'text-slate-600 dark:text-slate-400',
  tool:      'text-pink-600 dark:text-pink-400',
  behavior:  'text-rose-600 dark:text-rose-400',
  knowledge: 'text-teal-600 dark:text-teal-400',
  metric:    'text-indigo-600 dark:text-indigo-400',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`
  );
}

function eventToJson(event: TelemetryEvent): object {
  const data = Object.fromEntries(event.getDataMap().toArray() as [string, string][]);
  return {
    name:           event.getName(),
    messageId:      event.getMessageid(),
    conversationId: event.getAssistantconversationid(),
    data,
  };
}

function metricToJson(metric: TelemetryMetric): object {
  return {
    scope:          metric.getScope(),
    contextId:      metric.getContextid(),
    conversationId: metric.getAssistantconversationid(),
    metrics:        metric.getMetricsList().map(m => ({ name: m.getName(), value: m.getValue() })),
  };
}

// ---------------------------------------------------------------------------
// TelemetryRow
// ---------------------------------------------------------------------------

function TelemetryRowItem({
  row,
  isExpanded,
  onToggle,
}: {
  row: TelemetryRow;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const dt = formatDateTime(row.ts);

  let typeLabel: string;
  let typeColor: string;
  let json: object;

  if (row.kind === 'event') {
    const nameKey = row.record.getName().split('.')[0];
    typeLabel = row.record.getName();
    typeColor = EVENT_COLORS[nameKey] ?? 'text-gray-500 dark:text-gray-400';
    json = eventToJson(row.record);
  } else {
    typeLabel = `metric·${row.record.getScope()}`;
    typeColor = EVENT_COLORS['metric'];
    json = metricToJson(row.record);
  }

  const jsonPreview = JSON.stringify(json);
  const jsonFull    = JSON.stringify(json, null, 2);

  return (
    <>
      <tr
        className="hover:bg-gray-100 dark:hover:bg-gray-800/60 cursor-pointer border-b border-gray-100 dark:border-gray-800/60"
        onClick={onToggle}
      >
        {/* date + time */}
        <td className="pl-3 pr-2 py-1.5 whitespace-nowrap tabular-nums text-gray-400 dark:text-gray-500 text-xs">
          {dt}
        </td>
        {/* event type */}
        <td className={cn('px-2 py-1.5 whitespace-nowrap font-semibold text-xs', typeColor)}>
          {typeLabel}
        </td>
        {/* json preview */}
        <td className="px-2 pr-3 py-1.5 text-gray-500 dark:text-gray-400 text-xs max-w-0 overflow-hidden truncate">
          {jsonPreview}
        </td>
      </tr>

      {isExpanded && (
        <tr className="bg-gray-50 dark:bg-gray-800/40">
          <td className="pl-3 pr-2 py-2 align-top whitespace-nowrap tabular-nums text-gray-400 dark:text-gray-500 text-xs">
            {dt}
          </td>
          <td className={cn('px-2 py-2 align-top whitespace-nowrap font-semibold text-xs', typeColor)}>
            {typeLabel}
          </td>
          <td className="px-2 pr-3 py-2">
            <pre className="text-xs text-gray-700 dark:text-gray-200 whitespace-pre-wrap break-all leading-5">
              {jsonFull}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function ConversationTelemetryDialog(
  props: ConversationTelemetryDialogProps,
) {
  const { token, authId, projectId } = useCurrentCredential();
  const [chips, setChips] = useState<Chip[]>([]);
  const [rows, setRows] = useState<TelemetryRow[]>([]);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItem, setTotalItem] = useState(0);

  useEffect(() => {
    const initialChips = (props.criterias || []).map((criteria, index) => ({
      field: criteria.getKey(),
      value: criteria.getValue(),
      id: `${Date.now()}-${index}`,
    }));
    setChips(initialChips);
  }, [props.criterias]);

  useEffect(() => {
    const request = new GetAllAssistantTelemetryRequest();
    const paginate = new Paginate();
    paginate.setPage(page);
    paginate.setPagesize(pageSize);
    request.setPaginate(paginate);

    const assistantDef = new AssistantDefinition();
    assistantDef.setAssistantid(props.assistantId);
    request.setAssistant(assistantDef);

    const criteriaList = chips.map(chip => {
      const criteria = new Criteria();
      criteria.setKey(chip.field);
      criteria.setValue(String(chip.value));
      criteria.setLogic('match');
      return criteria;
    });
    request.setCriteriasList(criteriaList);

    GetAllAssistantTelemetry(
      connectionConfig,
      request,
      ConnectionConfig.WithDebugger({
        authorization: token,
        userId: authId,
        projectId: projectId,
      }),
    ).then(response => {
      if (response.getPaginated()?.getTotalitem()) {
        setTotalItem(response.getPaginated()?.getTotalitem()!);
      }

      const merged: TelemetryRow[] = [];
      response.getDataList().forEach((r, i) => {
        const e = r.getEvent();
        const m = r.getMetric();
        if (e) {
          const ts = e.getTime()?.toDate() ?? new Date(0);
          merged.push({ kind: 'event', ts, key: `e-${i}`, record: e });
        } else if (m) {
          const ts = m.getTime()?.toDate() ?? new Date(0);
          merged.push({ kind: 'metric', ts, key: `m-${i}`, record: m });
        }
      });

      // sort chronologically (oldest first)
      merged.sort((a, b) => a.ts.getTime() - b.ts.getTime());
      setRows(merged);
      setExpandedKey(null);
    });
  }, [token, authId, projectId, props.assistantId, JSON.stringify(chips), pageSize, page]);

  const toggleRow = (key: string) => {
    setExpandedKey(prev => (prev === key ? null : key));
  };

  return (
    <BottomModal
      modalOpen={props.modalOpen}
      setModalOpen={props.setModalOpen}
      className="w-full flex-1 h-[75vh]"
    >
      <ModalBody className="px-0 flex-1 space-y-0 flex flex-col">
        {/* Sticky header */}
        <div className="sticky top-2 z-10">
          <BluredWrapper className="border-t">
            <div className="flex flex-1">
              <SentrySearch
                className="bg-light-background"
                updateChips={setChips}
                existingChips={chips}
              />
            </div>
            <PaginationButtonBlock>
              <TablePagination
                currentPage={page}
                onChangeCurrentPage={setPage}
                totalItem={totalItem}
                pageSize={pageSize}
                onChangePageSize={setPageSize}
              />
              <IButton onClick={() => props.setModalOpen(false)}>
                <X strokeWidth={1.5} className="h-4 w-4" />
              </IButton>
            </PaginationButtonBlock>
          </BluredWrapper>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 min-h-0 overflow-y-auto py-1">
          {rows.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm/6 font-mono">
              No telemetry yet…
            </div>
          ) : (
            <table className="w-full table-fixed font-mono text-sm border-collapse">
              <colgroup>
                <col className="w-[15rem]" />  {/* date + time */}
                <col className="w-[12rem]" />  {/* event type */}
                <col />                        {/* json — fills rest */}
              </colgroup>
              <tbody>
                {rows.map(row => (
                  <TelemetryRowItem
                    key={row.key}
                    row={row}
                    isExpanded={expandedKey === row.key}
                    onToggle={() => toggleRow(row.key)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </ModalBody>
    </BottomModal>
  );
}

// ---------------------------------------------------------------------------
// SentrySearch
// ---------------------------------------------------------------------------

export function SentrySearch({
  className,
  updateChips,
  existingChips,
}: SentrySearchProps) {
  const [showFieldDropdown, setShowFieldDropdown] = useState<boolean>(false);
  const [showValueInput, setShowValueInput] = useState<boolean>(false);
  const [selectedField, setSelectedField] = useState<SearchField | null>(null);
  const [inputValue, setInputValue] = useState<string>('');
  const [chips, setChips] = useState<Chip[]>([]);
  const [showStageDropdown, setShowStageDropdown] = useState<boolean>(false);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const stageDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setChips(existingChips);
  }, [existingChips]);

  const searchFields: SearchField[] = [
    {
      id: 'conversationId',
      label: 'Conversation ID',
      type: 'number',
      placeholder: 'Enter ID…',
    },
    {
      id: 'name',
      label: 'Event Name',
      type: 'string',
      placeholder: 'session, stt, llm…',
    },
    {
      id: 'scope',
      label: 'Metric Scope',
      type: 'select',
      options: ['conversation', 'message'],
    },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowFieldDropdown(false);
      }
      if (stageDropdownRef.current && !stageDropdownRef.current.contains(event.target as Node)) {
        setShowStageDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (showValueInput && inputRef.current) inputRef.current.focus();
  }, [showValueInput]);

  const handleFieldSelect = (field: SearchField) => {
    setSelectedField(field);
    setShowFieldDropdown(false);
    if (field.type === 'select') {
      setShowStageDropdown(true);
    } else {
      setShowValueInput(true);
    }
    setInputValue('');
  };

  const handleValueSubmit = (value: string = inputValue) => {
    if (selectedField && value.trim()) {
      const newChip = { field: selectedField.id, value: value.trim(), id: `${Date.now()}` };
      const newChips = [...chips, newChip];
      setChips(newChips);
      updateChips(newChips);
      setSelectedField(null);
      setShowValueInput(false);
      setInputValue('');
    }
  };

  const handleStageSelect = (stage: string) => {
    handleValueSubmit(stage);
    setShowStageDropdown(false);
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleValueSubmit();
    } else if (e.key === 'Escape') {
      setShowValueInput(false);
      setSelectedField(null);
      setInputValue('');
    }
  };

  const removeChip = (chipId: string) => {
    const filtered = chips.filter(c => c.id !== chipId);
    setChips(filtered);
    updateChips(filtered);
  };

  return (
    <div className="relative w-full flex-1">
      <div
        onClick={() => !showValueInput && setShowFieldDropdown(true)}
        className={cn(
          'form-input min-h-10',
          'dark:placeholder-gray-600 placeholder-gray-400',
          'dark:text-gray-300 text-gray-600',
          'flex items-center',
          'outline-solid outline-[1.5px] outline-transparent',
          'focus-within:outline-blue-600 focus:outline-blue-600 outline-offset-[-1.5px]',
          'border-b border-gray-300 dark:border-gray-700',
          'dark:focus:border-blue-600 focus:border-blue-600',
          'transition-all duration-200 ease-in-out',
          'bg-light-background dark:bg-gray-950',
        )}
      >
        <Search className="w-4 h-4 text-gray-400 ml-3 shrink-0" />
        <div className="flex-1 flex flex-wrap items-center gap-2 py-2 px-2">
          {chips.map(chip => (
            <div
              key={chip.id}
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] text-sm border dark:border-gray-900 bg-blue-600/10"
              onClick={e => e.stopPropagation()}
            >
              <span className="font-medium opacity-90 text-blue-600">{chip.field}:</span>
              <span className="text-blue-600">{chip.value}</span>
              <button
                onClick={() => removeChip(chip.id)}
                className="hover:bg-red-600 rounded-[2px] p-0.5 hover:text-white cursor-pointer"
              >
                <X className="w-3 h-3" strokeWidth={1.5} />
              </button>
            </div>
          ))}

          {showValueInput && selectedField && (
            <div
              className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[2px] text-sm border"
              onClick={e => e.stopPropagation()}
            >
              <span className="font-medium opacity-90">{selectedField.label}:</span>
              <input
                ref={inputRef}
                type={selectedField.type === 'number' ? 'number' : 'text'}
                value={inputValue}
                onChange={e => setInputValue(e.target.value)}
                onKeyDown={handleKeyPress}
                onBlur={() => {
                  if (inputValue.trim()) handleValueSubmit();
                  else { setShowValueInput(false); setSelectedField(null); }
                }}
                placeholder={selectedField.placeholder}
                className="bg-transparent outline-hidden w-48"
              />
            </div>
          )}

          {!showValueInput && chips.length === 0 && (
            <span className="text-sm opacity-60">Click to add filters…</span>
          )}
        </div>
      </div>

      {showFieldDropdown && (
        <div
          ref={dropdownRef}
          className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-950 border divide-y dark:divide-gray-900 rounded-[2px] shadow-lg z-999"
        >
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-900">
            <span className="text-xs font-medium text-gray-500">SELECT FIELD</span>
          </div>
          {searchFields.map(field => (
            <button
              key={field.id}
              onClick={() => handleFieldSelect(field)}
              className="w-full text-left px-4 py-2.5 text-sm transition-colors flex items-center justify-between group"
            >
              <span className="font-medium group-hover:text-blue-700">{field.label}</span>
              <span className="text-xs group-hover:text-blue-500">
                {field.type === 'select' ? 'select' : field.type}
              </span>
            </button>
          ))}
        </div>
      )}

      {showStageDropdown && selectedField?.type === 'select' && (
        <div
          ref={stageDropdownRef}
          className="absolute left-0 right-0 mt-2 bg-white dark:bg-gray-950 border divide-y dark:divide-gray-900 rounded-[2px] shadow-lg z-999"
        >
          <div className="px-3 py-2 bg-gray-100 dark:bg-gray-900">
            <span className="text-xs font-medium">SELECT VALUE</span>
          </div>
          {(selectedField.options || []).map(option => (
            <button
              key={option}
              onClick={() => handleStageSelect(option)}
              className="w-full text-left px-4 py-2.5 text-sm hover:text-blue-700 transition-colors"
            >
              {option}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
