# Sample Output: LLM Integration

## Request classification

- Change type: new provider
- Target provider: `acme_llm`
- Required capabilities: chat, stream, verify, embedding
- Tool-calling requirement: pass-through unsupported, no tool parser changes

## Inputs and defaults

- Explicit user constraints: compatible with unified provider gRPC path
- Assumptions used: reranking not required
- Baseline provider selected: `openai`

## Planned edit scope (strict)

- Provider caller folder: `api/integration-api/internal/caller/acme_llm/`
- Factory/router file edits: `caller.go`, `unified_provider.go`
- Interface/client edits: none needed in `callers.go`, minor client routing update
- UI provider metadata files: `ui/src/providers/acme_llm/text-models.json`, provider registry json
- Explicitly out of scope: assistant-api audio pipeline

## Capability mapping

- Chat completion behavior: maps request params to provider chat endpoint
- Streaming behavior and event handling: token stream emits in-order deltas then completion
- Credential verification behavior: provider ping endpoint + auth error mapping
- Embedding behavior: implemented with `TIME_TAKEN` metric
- Reranking behavior: not implemented (provider unsupported)

## Metrics and audit mapping

- MetricBuilder usage path: `OnStart` -> provider metrics -> `OnSuccess`/`OnFailure`
- Success/failure metric semantics: `STATUS` always set on terminal path
- External audit compatibility notes: no breaking key changes

## Test plan and evidence

- Provider caller tests: pass
- Unified provider API tests: pass
- Client routing tests: pass
- Validation script command: `./.claude/skills/llm-integration/scripts/validate.sh --check-diff --provider acme_llm`

## Result summary

- Final behavior change: unified chat/stream/verify/embedding support for new provider
- Risk notes and rollback: remove provider from factory switch + registry
