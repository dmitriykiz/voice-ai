import React, { useState, useEffect } from 'react';
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
import { useCurrentCredential } from '@/hooks/use-credential';
import { Modal, ModalHeader, ModalBody } from '@/app/components/carbon/modal';
import { Pagination } from '@/app/components/carbon/pagination';
import {
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  TableExpandedRow,
  TableToolbar,
  TableToolbarContent,
  TableToolbarSearch,
  Tag,
  DismissibleTag,
  Loading,
  CodeSnippet,
} from '@carbon/react';
import { TableToolbarFilter } from '@/app/components/carbon/table-toolbar-filter';
import { ChevronRight } from '@carbon/icons-react';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConversationTelemetryDialogProps extends ModalProps {
  assistantId: string;
  criterias?: Criteria[];
}

interface Chip {
  field: string;
  value: string | number;
  id: string;
}

type TelemetryRow =
  | { kind: 'event'; ts: Date; key: string; record: TelemetryEvent }
  | { kind: 'metric'; ts: Date; key: string; record: TelemetryMetric };

// ─── Color map ───────────────────────────────────────────────────────────────

const EVENT_TAG_TYPE: Record<string, string> = {
  session: 'gray',
  sip: 'warm-gray',
  telephony: 'teal',
  webrtc: 'cool-gray',
  stt: 'green',
  llm: 'blue',
  tts: 'purple',
  vad: 'warm-gray',
  eos: 'cyan',
  denoise: 'warm-gray',
  recording: 'purple',
  audio: 'cool-gray',
  tool: 'magenta',
  behavior: 'red',
  knowledge: 'teal',
  metric: 'high-contrast',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatDateTime(d: Date): string {
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  return (
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
    `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`
  );
}

function eventToJson(event: TelemetryEvent): object {
  const data = Object.fromEntries(
    event.getDataMap().toArray() as [string, string][],
  );
  return {
    name: event.getName(),
    messageId: event.getMessageid(),
    conversationId: event.getAssistantconversationid(),
    data,
  };
}

function metricToJson(metric: TelemetryMetric): object {
  return {
    scope: metric.getScope(),
    contextId: metric.getContextid(),
    conversationId: metric.getAssistantconversationid(),
    metrics: metric
      .getMetricsList()
      .map(m => ({ name: m.getName(), value: m.getValue() })),
  };
}

// ─── Main dialog ─────────────────────────────────────────────────────────────

export function ConversationTelemetryDialog(
  props: ConversationTelemetryDialogProps,
) {
  const { token, authId, projectId } = useCurrentCredential();
  const [chips, setChips] = useState<Chip[]>([]);
  const [rows, setRows] = useState<TelemetryRow[]>([]);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalItem, setTotalItem] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [criteriaReady, setCriteriaReady] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  useEffect(() => {
    const initialChips = (props.criterias || []).map((criteria, index) => ({
      field: criteria.getKey(),
      value: criteria.getValue(),
      id: `${Date.now()}-${index}`,
    }));
    setRows([]);
    setExpandedRows(new Set());
    setTotalItem(0);
    setPage(1);
    setChips(initialChips);
    setCriteriaReady(true);
  }, [props.criterias]);

  useEffect(() => {
    if (!criteriaReady) return;
    let active = true;
    setIsLoading(true);
    setRows([]);
    setExpandedRows(new Set());

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
    )
      .then(response => {
        if (!active) return;
        setTotalItem(response.getPaginated()?.getTotalitem() ?? 0);
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
        merged.sort((a, b) => a.ts.getTime() - b.ts.getTime());
        setRows(merged);
      })
      .catch(() => {
        if (!active) return;
        setRows([]);
        setTotalItem(0);
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [
    token,
    authId,
    projectId,
    props.assistantId,
    JSON.stringify(chips),
    pageSize,
    page,
    criteriaReady,
  ]);

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const removeChip = (chipId: string) => {
    setChips(prev => prev.filter(c => c.id !== chipId));
  };

  const EVENT_TYPES = [
    'session',
    'sip',
    'telephony',
    'webrtc',
    'stt',
    'llm',
    'tts',
    'vad',
    'eos',
    'denoise',
    'recording',
    'audio',
    'tool',
    'behavior',
    'knowledge',
    'metric',
  ];

  const toggleFilter = (type: string) => {
    setActiveFilters(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  };

  const getRowData = (row: TelemetryRow) => {
    if (row.kind === 'event') {
      const nameKey = row.record.getName().split('.')[0];
      return {
        typeLabel: row.record.getName(),
        tagType: EVENT_TAG_TYPE[nameKey] ?? 'gray',
        json: eventToJson(row.record),
      };
    }
    return {
      typeLabel: `metric·${row.record.getScope()}`,
      tagType: 'high-contrast',
      json: metricToJson(row.record),
    };
  };

  const filteredRows = rows.filter(row => {
    const { typeLabel, json } = getRowData(row);
    const matchesSearch = searchText
      ? typeLabel.toLowerCase().includes(searchText.toLowerCase()) ||
        JSON.stringify(json).toLowerCase().includes(searchText.toLowerCase())
      : true;
    const matchesFilter =
      activeFilters.size === 0
        ? true
        : activeFilters.has(
            row.kind === 'event'
              ? row.record.getName().split('.')[0]
              : 'metric',
          );
    return matchesSearch && matchesFilter;
  });

  return (
    <Modal
      open={props.modalOpen}
      onClose={() => props.setModalOpen(false)}
      size="lg"
      preventCloseOnClickOutside
      containerClassName="!h-[90vh] !w-[90vw] !max-h-[90vh] !max-w-[90vw]"
    >
      <ModalHeader
        label="Observability"
        title="Telemetry Events"
        onClose={() => props.setModalOpen(false)}
      />
      <ModalBody className="!p-0 !overflow-hidden !flex !flex-col">
        {/* Toolbar */}
        <TableToolbar>
          <TableToolbarContent>
            <TableToolbarSearch
              placeholder="Search telemetry..."
              onChange={(e: any) => setSearchText(e.target?.value || '')}
            />
            <TableToolbarFilter
              filters={EVENT_TYPES.map(t => ({
                id: t,
                label: t.charAt(0).toUpperCase() + t.slice(1),
              }))}
              activeFilters={activeFilters}
              onApplyFilter={setActiveFilters}
              onResetFilter={() => setActiveFilters(new Set())}
            />
          </TableToolbarContent>
        </TableToolbar>

        {/* Active filter + criteria chips */}
        {(chips.length > 0 || activeFilters.size > 0) && (
          <div className="flex flex-wrap gap-1.5 px-4 py-2 border-b border-gray-200 dark:border-gray-800">
            {chips.map(chip => (
              <DismissibleTag
                key={chip.id}
                type="blue"
                text={`${chip.field}: ${chip.value}`}
                onClose={() => removeChip(chip.id)}
              />
            ))}
            {Array.from(activeFilters).map(f => (
              <DismissibleTag
                key={f}
                type="cyan"
                text={f}
                onClose={() => toggleFilter(f)}
              />
            ))}
          </div>
        )}

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-16">
              <Loading withOverlay={false} small />
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="flex items-center justify-center py-16 text-gray-400 dark:text-gray-500 text-sm">
              No telemetry events found
            </div>
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableHeader className="!w-8" />
                  <TableHeader className="!w-[180px]">Time</TableHeader>
                  <TableHeader className="!w-[120px]">Type</TableHeader>
                  <TableHeader>Preview</TableHeader>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredRows.map(row => {
                  const { typeLabel, tagType, json } = getRowData(row);
                  const isExpanded = expandedRows.has(row.key);
                  return (
                    <React.Fragment key={row.key}>
                      <TableRow
                        className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        onClick={() => toggleRow(row.key)}
                      >
                        <TableCell className="!w-8 !px-2">
                          <ChevronRight
                            size={16}
                            className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
                          />
                        </TableCell>
                        <TableCell className="!font-mono !text-xs tabular-nums whitespace-nowrap">
                          {formatDateTime(row.ts)}
                        </TableCell>
                        <TableCell className="!w-[120px]">
                          <Tag size="sm" type={tagType as any}>
                            {typeLabel}
                          </Tag>
                        </TableCell>
                        <TableCell className="!text-xs !text-gray-500 dark:!text-gray-400 truncate max-w-[300px]">
                          {JSON.stringify(json)}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableExpandedRow colSpan={5}>
                          <CodeSnippet
                            type="multi"
                            feedback="Copied!"
                            className="!max-w-full"
                          >
                            {JSON.stringify(json, null, 2)}
                          </CodeSnippet>
                        </TableExpandedRow>
                      )}
                    </React.Fragment>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        {/* Pagination */}
        {filteredRows.length > 0 && (
          <Pagination
            totalItems={totalItem}
            page={page}
            pageSize={pageSize}
            pageSizes={[25, 50, 100]}
            onChange={({ page: p, pageSize: ps }) => {
              if (ps !== pageSize) setPageSize(ps);
              else setPage(p);
            }}
          />
        )}
      </ModalBody>
    </Modal>
  );
}
