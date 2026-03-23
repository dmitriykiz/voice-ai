# Sample Output: End Of Speech Integration

## Request classification

- Change type: new provider
- Target provider: `acme_eos`
- EOS signal mode: audio-model
- Latency vs accuracy priority: lower latency with bounded false-finalization risk

## Inputs and defaults

- Explicit user constraints: use existing 16kHz internal audio, no model hosting change
- Assumptions used: fallback timeout retained from current defaults
- Why this baseline provider was selected: closest lifecycle to `pipecat_smart_turn_eos`

## Planned edit scope (strict)

- Provider implementation folder: `api/assistant-api/internal/end_of_speech/internal/acme_eos/`
- Factory file edits: `api/assistant-api/internal/end_of_speech/end_of_speech.go`
- Contract files: no interface change; packet usage unchanged
- UI config/component files: `ui/src/providers/acme_eos/eos.json`, `ui/src/providers/config-loader.ts`
- Explicitly out of scope: `api/assistant-api/internal/vad/internal/*`

## Packet contract mapping

- Consumed packets: `UserAudioPacket`, `SpeechToTextPacket`, `InterruptionPacket`
- Interim output behavior: emits `InterimEndOfSpeechPacket` after final STT merge
- Finalization trigger behavior: model score >= threshold uses quick timeout else silence timeout
- Duplicate-finalization guard strategy: generation counter + fired flag

## EOS options mapping

- `microphone.eos.provider`: `acme_eos`
- `microphone.eos.timeout`: fallback timer for interim/reset paths
- `microphone.eos.threshold`: model turn-end probability cutoff
- `microphone.eos.quick_timeout`: buffer when model predicts turn-end
- `microphone.eos.silence_timeout`: buffer when model predicts user still speaking

## Test plan and evidence

- EOS unit tests: pass (`go test ./api/assistant-api/internal/end_of_speech/...`)
- Adapter/dispatcher integration tests: pass
- UI config-loader tests: pass
- Validation script command: `./.claude/skills/end-of-speech-integration/scripts/validate.sh --check-diff --provider acme_eos`

## Result summary

- Final behavior change: lower median turn-finalization latency while preserving one-final-packet-per-turn
- Risk notes and rollback: rollback by switching `microphone.eos.provider` back to previous provider
