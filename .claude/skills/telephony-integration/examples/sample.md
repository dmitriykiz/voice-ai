# Sample Output: Telephony Integration

## Request classification

- Change type: new provider
- Target provider: `acme_tel`
- Media transport: WebSocket
- Call direction: inbound + outbound

## Inputs and defaults

- Explicit user constraints: provider expects mulaw 8k media
- Assumptions used: keep existing context route pattern
- Baseline provider selected: `twilio`

## Planned edit scope (strict)

- Provider implementation folder: `api/assistant-api/internal/channel/telephony/internal/acme_tel/`
- Factory file edits: `api/assistant-api/internal/channel/telephony/telephony.go`
- Route/dispatcher file edits: none required
- UI provider/component files: telephony provider entry + `ui/src/app/components/providers/telephony/acme-tel/`
- Explicitly out of scope: STT/TTS/EOS/VAD internals

## Runtime contract mapping

- ReceiveCall payload mapping: caller number and channel UUID parsed from webhook
- InboundCall response mapping: provider XML/JSON handshake with context stream URL
- Streamer Recv/Send behavior: decode inbound media, resample outbound audio to provider codec
- Status callback event mapping: map provider statuses to `StatusInfo.Event`
- Disconnect/cleanup behavior: close socket and emit user disconnection

## Audio compatibility mapping

- Provider ingress codec/rate: mulaw 8k mono
- Provider egress codec/rate: mulaw 8k mono
- Internal format conversion path: base telephony resampler to/from LINEAR16 16k

## Test plan and evidence

- Telephony provider tests: pass
- Dispatcher/adapter integration tests: pass
- UI provider tests: pass
- Validation script command: `./.claude/skills/telephony-integration/scripts/validate.sh --check-diff --provider acme_tel`

## Result summary

- Final behavior change: provider supports full inbound/outbound stream lifecycle with clean teardown
- Risk notes and rollback: switch telephony provider value to previous provider
