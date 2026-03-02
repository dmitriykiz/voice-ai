import React, { FC, memo, useEffect, useMemo, useRef, useState } from 'react';
import {
  VoiceAgent as VI,
  ConnectionConfig,
  AgentConfig,
  AgentCallback,
  Assistant,
  Variable,
} from '@rapidaai/react';
import { MessagingAction } from '@/app/pages/preview-agent/voice-agent/actions';
import { ConversationMessages } from '@/app/pages/preview-agent/voice-agent/text/conversations';
import { cn } from '@/utils';
import { QuickSuggestion } from '@/app/pages/preview-agent/voice-agent/text/suggestions';
import {
  JsonTextarea,
  NumberTextarea,
  ParagraphTextarea,
  TextTextarea,
  UrlTextarea,
} from '@/app/components/form/textarea';
import { InputVarForm } from '@/app/pages/endpoint/view/try-playground/experiment-prompt/components/input-var-form';
import { InputVarType } from '@/models/common';
import { InputGroup } from '@/app/components/input-group';
import { ChevronLeft, ExternalLink, Info } from 'lucide-react';
import { useRapidaStore } from '@/hooks';
import { PageTitleBlock } from '@/app/components/blocks/page-title-block';
import { PageHeaderBlock } from '@/app/components/blocks/page-header-block';
import { PageLoader } from '@/app/components/loader/page-loader';
import { YellowNoticeBlock } from '@/app/components/container/message/notice-block';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type EventEntry = {
  type:
    | 'directive'
    | 'configuration'
    | 'userMessage'
    | 'assistantMessage'
    | 'interrupt'
    | 'pipelineEvent'
    | 'metric';
  ts: Date;
  payload: any;
};

type MsgTab = 'messages' | 'events';

// ---------------------------------------------------------------------------
// Conversation event row
// ---------------------------------------------------------------------------

const EVENT_COLORS: Record<string, string> = {
  session: 'text-gray-500 dark:text-gray-400',
  stt: 'text-green-600 dark:text-green-400',
  llm: 'text-blue-600 dark:text-blue-400',
  tts: 'text-violet-600 dark:text-violet-400',
  vad: 'text-yellow-600 dark:text-yellow-400',
  eos: 'text-cyan-600 dark:text-cyan-400',
  denoise: 'text-orange-600 dark:text-orange-400',
  audio: 'text-slate-600 dark:text-slate-400',
  tool: 'text-pink-600 dark:text-pink-400',
  behavior: 'text-rose-600 dark:text-rose-400',
  knowledge: 'text-teal-600 dark:text-teal-400',
};

const ConversationEventRow: FC<{ entry: EventEntry }> = ({ entry }) => {
  const [expanded, setExpanded] = useState(false);
  const ts = entry.ts.toISOString().slice(11, 23);
  const toggle = () => setExpanded(p => !p);

  if (entry.type === 'pipelineEvent') {
    const { name, dataMap, id, time } = entry.payload as {
      name: string;
      dataMap: Array<[string, string]>;
      id?: string;
      time?: unknown;
    };
    const data = Object.fromEntries(dataMap ?? []);
    const color = EVENT_COLORS[name] ?? 'text-gray-500 dark:text-gray-400';
    const jsonPayload = { id, time, ...data };

    return (
      <>
        <tr
          className="hover:bg-gray-100 dark:hover:bg-gray-800/60 cursor-pointer select-text"
          onClick={toggle}
        >
          <td className="pl-3 pr-2 py-[3px] whitespace-nowrap tabular-nums text-gray-400 dark:text-gray-500">
            {ts}
          </td>
          <td
            className={cn(
              'px-2 py-[3px] whitespace-nowrap font-semibold',
              color,
            )}
          >
            {name}
          </td>
          <td
            colSpan={2}
            className="px-2 pr-3 py-[3px] text-gray-600 dark:text-gray-300 max-w-0 overflow-hidden truncate"
          >
            {JSON.stringify(jsonPayload)}
          </td>
        </tr>
        {expanded && (
          <tr className="bg-gray-50 dark:bg-gray-800/40">
            <td />
            <td colSpan={3} className="pl-2 pr-3 pt-1 pb-2">
              <pre className="whitespace-pre-wrap break-all text-gray-700 dark:text-gray-200 text-sm/6">
                {JSON.stringify(jsonPayload, null, 2)}
              </pre>
            </td>
          </tr>
        )}
      </>
    );
  }

  // Non-pipeline events — time | role | json
  const label =
    entry.type === 'userMessage'
      ? 'user'
      : entry.type === 'assistantMessage'
        ? 'assistant'
        : entry.type === 'configuration'
          ? 'session'
          : entry.type === 'interrupt'
            ? 'interrupt'
            : entry.type === 'metric'
              ? 'metric'
              : entry.type;

  const labelColor =
    entry.type === 'userMessage'
      ? 'text-emerald-600 dark:text-emerald-400'
      : entry.type === 'assistantMessage'
        ? 'text-indigo-600 dark:text-indigo-400'
        : entry.type === 'interrupt'
          ? 'text-orange-600 dark:text-orange-400'
          : entry.type === 'configuration'
            ? 'text-sky-600 dark:text-sky-400'
            : entry.type === 'metric'
              ? 'text-lime-600 dark:text-lime-400'
              : 'text-red-600 dark:text-red-400';

  return (
    <>
      <tr
        className="hover:bg-gray-100 dark:hover:bg-gray-800/60 cursor-pointer select-text"
        onClick={toggle}
      >
        <td className="pl-3 pr-2 py-[3px] whitespace-nowrap tabular-nums text-gray-400 dark:text-gray-500">
          {ts}
        </td>
        <td
          className={cn(
            'px-2 py-[3px] whitespace-nowrap font-semibold',
            labelColor,
          )}
        >
          {label}
        </td>
        <td
          colSpan={2}
          className="px-2 pr-3 py-[3px] text-gray-600 dark:text-gray-300 max-w-0 overflow-hidden truncate"
        >
          {JSON.stringify(entry.payload)}
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-800/40">
          <td />
          <td colSpan={3} className="pl-2 pr-3 pt-1 pb-2">
            <pre className="whitespace-pre-wrap break-all text-gray-700 dark:text-gray-200 text-sm/6">
              {JSON.stringify(entry.payload, null, 2)}
            </pre>
          </td>
        </tr>
      )}
    </>
  );
};

// ---------------------------------------------------------------------------
// Main layout
// ---------------------------------------------------------------------------

export const VoiceAgent: FC<{
  debug: boolean;
  connectConfig: ConnectionConfig;
  agentConfig: AgentConfig;
  agentCallback?: AgentCallback;
}> = ({ debug, connectConfig, agentConfig, agentCallback }) => {
  const voiceAgentContextValue = React.useMemo(
    () => new VI(connectConfig, agentConfig, agentCallback),
    [connectConfig, agentConfig, agentCallback],
  );

  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [events, setEvents] = useState<EventEntry[]>([]);
  const [variables, setVariables] = useState<Variable[]>([]);
  const [msgTab, setMsgTab] = useState<MsgTab>('messages');
  const callbackRegistered = useRef(false);
  const eventsBottomRef = useRef<HTMLDivElement>(null);

  const { loading, showLoader, hideLoader } = useRapidaStore();

  // Fetch assistant info
  useEffect(() => {
    showLoader('block');
    new VI(connectConfig, agentConfig, agentCallback)
      .getAssistant()
      .then(ex => {
        hideLoader();
        if (ex.getSuccess()) setAssistant(ex.getData()!);
      })
      .catch(() => hideLoader());
  }, []);

  // Load variables from assistant
  useEffect(() => {
    if (!assistant) return;
    const pmtVar = assistant
      .getAssistantprovidermodel()
      ?.getTemplate()
      ?.getPromptvariablesList();
    if (pmtVar) {
      pmtVar.forEach(v => {
        if (v.getDefaultvalue())
          voiceAgentContextValue.agentConfiguration.addArgument(
            v.getName(),
            v.getDefaultvalue(),
          );
      });
      setVariables(pmtVar);
    }
  }, [assistant]);

  // Register callbacks once
  useEffect(() => {
    if (callbackRegistered.current) return;
    callbackRegistered.current = true;
    voiceAgentContextValue.registerCallback({
      onDirective: arg =>
        setEvents(p => [
          ...p,
          { type: 'directive', ts: new Date(), payload: arg },
        ]),
      onConfiguration: args =>
        setEvents(p => [
          ...p,
          { type: 'configuration', ts: new Date(), payload: args },
        ]),
      onUserMessage: args =>
        setEvents(p => [
          ...p,
          { type: 'userMessage', ts: new Date(), payload: args },
        ]),
      onAssistantMessage: args => {
        if (args?.messageText)
          setEvents(p => [
            ...p,
            { type: 'assistantMessage', ts: new Date(), payload: args },
          ]);
      },
      onInterrupt: args =>
        setEvents(p => [
          ...p,
          { type: 'interrupt', ts: new Date(), payload: args },
        ]),
      onConversationEvent: event =>
        setEvents(p => [
          ...p,
          { type: 'pipelineEvent', ts: new Date(), payload: event },
        ]),
      onMetric: metric =>
        setEvents(p => [
          ...p,
          { type: 'metric', ts: new Date(), payload: metric },
        ]),
    });
  }, [voiceAgentContextValue]);

  // Auto-scroll events tab when new events arrive
  useEffect(() => {
    if (msgTab === 'events') {
      setTimeout(
        () => eventsBottomRef.current?.scrollIntoView({ behavior: 'smooth' }),
        50,
      );
    }
  }, [events.length, msgTab]);

  if (loading) return <PageLoader />;

  const voiceWarning = debug
    ? !assistant?.getDebuggerdeployment()?.hasInputaudio()
    : !assistant?.getApideployment()?.hasInputaudio();

  const enableVoiceHref = debug
    ? `/deployment/assistant/${agentConfig.id}/deployment/debugger`
    : `/deployment/assistant/${assistant?.getId()}/manage/deployment/debugger`;

  return (
    <div className="h-dvh flex p-8 text-sm/6 w-full gap-3 md:gap-6">
      {/* ── Left: messaging ─────────────────────────────────────────── */}
      <div className="flex flex-col overflow-hidden h-full w-2/3 border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-950">
        {/* Header */}
        <div className="shrink-0">
          {debug && (
            <PageHeaderBlock className="border-b pl-3">
              <a
                href={`/deployment/assistant/${agentConfig.id}/overview`}
                className="flex items-center hover:text-red-600 hover:cursor-pointer"
              >
                <ChevronLeft className="w-5 h-5 mr-1" strokeWidth={1.5} />
                <PageTitleBlock className="text-sm/6">
                  Back to Assistant
                </PageTitleBlock>
              </a>
            </PageHeaderBlock>
          )}
          {voiceWarning && (
            <YellowNoticeBlock className="flex items-center justify-between gap-3">
              <Info className="shrink-0 w-4 h-4" />
              <div className="text-sm font-medium">
                Voice functionality is currently disabled. Please enable it to
                enjoy a voice experience with your assistant.
              </div>
              <a
                target="_blank"
                href={enableVoiceHref}
                className="h-7 flex items-center font-medium hover:underline ml-auto text-yellow-600"
                rel="noreferrer"
              >
                Enable voice
                <ExternalLink
                  className="shrink-0 w-4 h-4 ml-1.5"
                  strokeWidth={1.5}
                />
              </a>
            </YellowNoticeBlock>
          )}
          {/* Tab bar */}
          <div className="flex items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
            {(['messages', 'events'] as MsgTab[]).map(t => (
              <button
                key={t}
                type="button"
                onClick={() => setMsgTab(t)}
                className={cn(
                  'px-4 py-2.5 text-sm/6 font-medium border-b-2 transition-colors',
                  msgTab === t
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
                )}
              >
                {t === 'events' && events.length > 0
                  ? `events (${events.length})`
                  : t}
              </button>
            ))}
          </div>
        </div>

        {/* Messages tab */}
        {msgTab === 'messages' &&
          (() => {
            const hasMessages = events.some(
              e => e.type === 'userMessage' || e.type === 'assistantMessage',
            );
            return hasMessages ? (
              <div className="flex flex-col grow min-h-0 overflow-y-auto px-4 py-4">
                <ConversationMessages vag={voiceAgentContextValue} />
              </div>
            ) : (
              <AssistantPlaceholder assistant={assistant} />
            );
          })()}

        {/* Events tab — structured conversation event rows */}
        {msgTab === 'events' && (
          <div className="flex-1 min-h-0 overflow-y-auto py-1">
            {events.length === 0 ? (
              <div className="flex items-center justify-center h-full text-gray-400 dark:text-gray-500 text-sm/6 font-mono">
                No events yet…
              </div>
            ) : (
              <table className="w-full table-fixed font-mono text-sm/6 border-collapse">
                <colgroup>
                  <col className="w-[9rem]" />
                  <col className="w-[6rem]" />
                  <col className="w-[10rem]" />
                  <col />
                </colgroup>
                <tbody>
                  {events.map((entry, i) => (
                    <ConversationEventRow key={i} entry={entry} />
                  ))}
                </tbody>
              </table>
            )}
            <div ref={eventsBottomRef} />
          </div>
        )}

        {/* Messaging action — always visible */}
        <MessagingAction
          assistant={assistant}
          placeholder="How can I help you?"
          className=" border-t"
          voiceAgent={voiceAgentContextValue}
        />
      </div>

      {/* ── Right: assistant + metrics ──────────────────────────────── */}
      <div className="shrink-0 flex flex-col overflow-hidden border border-gray-200 dark:border-gray-700 w-1/3 rounded bg-white dark:bg-gray-950">
        <VoiceAgentDebugger
          debug={debug}
          voiceAgent={voiceAgentContextValue}
          assistant={assistant}
          variables={variables}
          events={events}
          onChangeArgument={(k, v) =>
            voiceAgentContextValue.agentConfiguration.addArgument(k, v)
          }
        />
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Right panel: tabs — arguments | configuration | metrics
// ---------------------------------------------------------------------------

type RightTab = 'arguments' | 'configuration' | 'metrics';

export const VoiceAgentDebugger: FC<{
  debug: boolean;
  voiceAgent: VI;
  assistant: Assistant | null;
  variables: Variable[];
  events: EventEntry[];
  onChangeArgument: (k: string, v: string) => void;
}> = memo(
  ({ debug, voiceAgent, assistant, variables, events, onChangeArgument }) => {
    const [tab, setTab] = useState<RightTab>('configuration');
    const metrics = useMemo(() => computeMetrics(events), [events]);

    const deployment = assistant
      ? (debug
          ? assistant.getDebuggerdeployment()
          : assistant.getApideployment()) ?? null
      : null;
    const stt = deployment?.getInputaudio() ?? null;
    const tts = deployment?.getOutputaudio() ?? null;
    const model = assistant?.getAssistantprovidermodel() ?? null;

    return (
      <div className="flex flex-col h-full overflow-hidden text-sm">
        {/* Tab bar */}
        <div className="shrink-0 flex items-center border-b border-gray-200 dark:border-gray-700">
          {(['configuration', 'arguments', 'metrics'] as RightTab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={cn(
                'px-3 py-2.5 text-sm/6 font-medium border-b-2 transition-colors',
                tab === t
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200',
              )}
            >
              {t}
            </button>
          ))}
        </div>

        {/* ── arguments tab ── */}
        {tab === 'arguments' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            {variables.length > 0 ? (
              <div className="[&_label]:!text-sm [&_label]:!leading-6 [&_label]:!py-2 [&_label]:!px-3 [&_textarea]:!text-sm [&_textarea]:!leading-6">
                {variables.map((x, idx) => (
                  <InputVarForm key={idx} var={x}>
                    {x.getType() === InputVarType.textInput && (
                      <TextTextarea
                        readOnly={voiceAgent.isConnected}
                        id={x.getName()}
                        defaultValue={x.getDefaultvalue()}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          onChangeArgument(x.getName(), e.target.value)
                        }
                      />
                    )}
                    {x.getType() === InputVarType.paragraph && (
                      <ParagraphTextarea
                        id={x.getName()}
                        readOnly={voiceAgent.isConnected}
                        defaultValue={x.getDefaultvalue()}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          onChangeArgument(x.getName(), e.target.value)
                        }
                      />
                    )}
                    {x.getType() === InputVarType.number && (
                      <NumberTextarea
                        readOnly={voiceAgent.isConnected}
                        id={x.getName()}
                        defaultValue={x.getDefaultvalue()}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          onChangeArgument(x.getName(), e.target.value)
                        }
                      />
                    )}
                    {x.getType() === InputVarType.json && (
                      <JsonTextarea
                        readOnly={voiceAgent.isConnected}
                        id={x.getName()}
                        defaultValue={x.getDefaultvalue()}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          onChangeArgument(x.getName(), e.target.value)
                        }
                      />
                    )}
                    {x.getType() === InputVarType.url && (
                      <UrlTextarea
                        readOnly={voiceAgent.isConnected}
                        id={x.getName()}
                        defaultValue={x.getDefaultvalue()}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                          onChangeArgument(x.getName(), e.target.value)
                        }
                      />
                    )}
                  </InputVarForm>
                ))}
              </div>
            ) : (
              <p className="p-4 text-sm/6 text-gray-400 dark:text-gray-500">
                No arguments defined.
              </p>
            )}
          </div>
        )}

        {/* ── configuration tab ── */}
        {tab === 'configuration' && (
          <div className="flex-1 min-h-0 overflow-y-auto">
            {assistant ? (
              <>
                <ConfigBlock title="assistant">
                  <InfoRow label="name" value={assistant.getName()} />
                  <InfoRow
                    label="executor"
                    value={
                      assistant.hasAssistantprovideragentkit()
                        ? 'agentkit'
                        : assistant.hasAssistantproviderwebsocket()
                          ? 'websocket'
                          : 'model'
                    }
                  />
                  {assistant.getDescription() && (
                    <InfoRow
                      label="description"
                      value={assistant.getDescription()}
                    />
                  )}
                </ConfigBlock>

                {stt && (
                  <ConfigBlock title="stt">
                    <InfoRow label="provider" value={stt.getAudioprovider()} />
                    {stt.getAudiooptionsList().map(m => (
                      <InfoRow
                        key={m.getKey()}
                        label={m.getKey()}
                        value={m.getValue()}
                      />
                    ))}
                  </ConfigBlock>
                )}

                {tts && (
                  <ConfigBlock title="tts">
                    <InfoRow label="provider" value={tts.getAudioprovider()} />
                    {tts.getAudiooptionsList().map(m => (
                      <InfoRow
                        key={m.getKey()}
                        label={m.getKey()}
                        value={m.getValue()}
                      />
                    ))}
                  </ConfigBlock>
                )}

                {model && (
                  <ConfigBlock title="llm">
                    <InfoRow
                      label="provider"
                      value={model.getModelprovidername()}
                    />
                    {model.getAssistantmodeloptionsList().map(m => (
                      <InfoRow
                        key={m.getKey()}
                        label={m.getKey()}
                        value={m.getValue()}
                      />
                    ))}
                  </ConfigBlock>
                )}
              </>
            ) : (
              <p className="p-4 text-sm/6 text-gray-400 dark:text-gray-500">
                Loading…
              </p>
            )}
          </div>
        )}

        {/* ── metrics tab ── */}
        {tab === 'metrics' && (
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {Object.keys(metrics).length === 0 ? (
              <p className="text-sm/6 text-gray-400 dark:text-gray-500">
                No metrics yet.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                {Object.entries(metrics).map(([k, v]) => (
                  <MetricCard key={k} label={k} value={String(v)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    );
  },
);

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Empty-state placeholder — developer console style
// ---------------------------------------------------------------------------

const AssistantPlaceholder: FC<{
  assistant: Assistant | null;
}> = ({ assistant }) => (
  <div className="flex flex-col flex-1 min-h-0 items-start justify-end gap-1 px-2 pb-6 select-none">
    <span className="text-2xl font-semibold text-gray-800 dark:text-gray-100 italic">
      Hello,
    </span>
    <span className="text-lg text-gray-400 dark:text-gray-500 font-semibold italic">
      How can I help you today?
    </span>
  </div>
);

export const ConfigBlock: FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="border-b border-gray-200 dark:border-gray-700">
    <div className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
      {title}
    </div>
    <div className="px-4 pb-3 space-y-2">{children}</div>
  </div>
);

export const InfoRow: FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="flex justify-between gap-4 text-sm/6">
    <span className="text-gray-500 dark:text-gray-400 lowercase tracking-wide shrink-0">
      {label}
    </span>
    <span className="text-gray-900 dark:text-gray-100 font-medium text-right truncate">
      {value}
    </span>
  </div>
);

export const MetricCard: FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div className="flex flex-col gap-0.5">
    <span className="text-xs uppercase tracking-wide text-gray-400 dark:text-gray-500 truncate">
      {label.replace(/_/g, ' ')}
    </span>
    <span className="text-sm font-semibold text-gray-900 dark:text-gray-100 tabular-nums">
      {value}
    </span>
  </div>
);

// ---------------------------------------------------------------------------
// Metrics computation
// ---------------------------------------------------------------------------

function computeMetrics(events: EventEntry[]): Record<string, string | number> {
  const m: Record<string, string | number> = {
    messages_sent: events.filter(
      e => e.type === 'userMessage' && e.payload?.completed,
    ).length,
    messages_received: events.filter(e => e.type === 'assistantMessage').length,
    pipeline_events: events.filter(e => e.type === 'pipelineEvent').length,
  };

  // Walk in reverse to get the latest value for each key.
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];

    // Server-emitted ConversationMetric packets (stt_latency_ms, llm_ttft_ms, etc.)
    if (e.type === 'metric') {
      const list: Array<{ name: string; value: string }> =
        e.payload?.metricsList ?? [];
      for (const { name, value } of list) {
        if (name && !(name in m)) m[name] = value;
      }
      continue;
    }

    // Pipeline events — extract well-known fields
    if (e.type !== 'pipelineEvent') continue;
    const { name, dataMap } = e.payload as {
      name: string;
      dataMap: Array<[string, string]>;
    };
    const data = Object.fromEntries(dataMap ?? []);
    const type = data['type'];

    if (
      name === 'llm' &&
      type === 'provider_metrics' &&
      !('llm_input_tokens' in m)
    ) {
      if (data['input_tokens']) m['llm_input_tokens'] = data['input_tokens'];
      if (data['output_tokens']) m['llm_output_tokens'] = data['output_tokens'];
    }
    if (name === 'stt' && type === 'completed' && !('stt_words' in m)) {
      if (data['word_count']) m['stt_words'] = data['word_count'];
    }
    if (name === 'tts' && type === 'completed' && !('tts_audio_kb' in m)) {
      if (data['audio_bytes'])
        m['tts_audio_kb'] =
          `${Math.round(Number(data['audio_bytes']) / 1024)} KB`;
    }
  }

  return m;
}
