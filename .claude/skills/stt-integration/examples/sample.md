# Sample Output: STT Integration

## Request classification

- Change type: new provider
- Target provider: `acme_stt`
- Ingestion transport: WebSocket callback
- Interim transcript requirement: required

## Inputs and defaults

- Explicit user constraints: support `en-US` and `hi-IN`, keep interruption behavior
- Assumptions used: reconnect on transport drop, final transcript always emitted
- Baseline provider selected: `deepgram`

## Planned edit scope (strict)

- Provider implementation folder: `api/assistant-api/internal/transformer/acme_stt/`
- Factory file edits: `api/assistant-api/internal/transformer/transformer.go`
- Contract/packet files: unchanged
- UI metadata + component files: provider `stt.json`, `speech-to-text-models.json`, `languages.json`, component under `speech-to-text/acme-stt/`
- Explicitly out of scope: telephony/EOS/VAD internals

## Transcript packet contract

- Input handling: streams each `UserAudioPacket` frame to provider connection
- Interim transcript behavior: emits `SpeechToTextPacket{Interim:true}`
- Final transcript behavior: emits `SpeechToTextPacket{Interim:false}` with stable context ID
- Interruption packet behavior: emits `InterruptionPacket{Source:"word"}` on speech onset markers
- Latency metric behavior: emits one `stt_latency_ms` per utterance

## Option and metadata mapping

- Model option keys: `listen.model`
- Language option keys: `listen.language`
- Provider JSON files updated: `stt.json`, `speech-to-text-models.json`, `languages.json`

## Test plan and evidence

- Provider tests: pass
- Transformer integration tests: pass
- UI provider tests: pass
- Validation script command: `./.claude/skills/stt-integration/scripts/validate.sh --check-diff --provider acme_stt`

## Result summary

- Final behavior change: low-latency interim/final transcript flow with stable packet semantics
- Risk notes and rollback: switch STT provider to previous value
