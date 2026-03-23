# Sample Output: Telemetry Integration

## Request classification

- Change type: new metric + event consistency update
- Target provider: `acme_llm`
- Target surface: integration-api + assistant-api provider path
- Backward compatibility requirement: keep existing keys unchanged

## Inputs and defaults

- Explicit user constraints: include first-token latency and preserve `STATUS`
- Assumptions used: existing external audit parser remains unchanged
- Baseline instrumentation path: `MetricBuilder` + provider onMetrics hook

## Planned edit scope (strict)

- Metric builder / shared files: `api/integration-api/internal/caller/metrics/metrics_builder.go`
- Provider-specific files: `api/integration-api/internal/caller/acme_llm/llm.go`, `api/assistant-api/internal/transformer/acme_tts/tts.go`
- Audit mapping files: `api/integration-api/internal/entity/external_audit.go`
- Explicitly out of scope: unrelated provider folders

## Metric contract mapping

- Metric keys added/updated: added `first_token_latency_ms`, retained `TIME_TAKEN`, `STATUS`
- Emission point for success: on completed stream / synthesis completion
- Emission point for failure: all early-return and error branches
- Cardinality and privacy controls: no raw prompt/audio payload in metric values

## Validation and compatibility

- Existing dashboards/consumers impacted: none (additive key only)
- Migration/compatibility actions: dashboard optional update for new key
- Test coverage updated: metric builder tests + provider tests
- Validation script command: `./.claude/skills/telemetry-integration/scripts/validate.sh --check-diff --provider acme_llm`

## Result summary

- Final behavior change: consistent success/failure telemetry with additive latency metric
- Risk notes and rollback: drop new key emission while preserving existing keys
