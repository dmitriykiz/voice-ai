# Sample Output: VAD Integration

## Request classification

- Change type: new provider
- Target provider: `acme_vad`
- Detector stack: ONNX runtime
- False-positive tolerance: medium

## Inputs and defaults

- Explicit user constraints: keep existing interruption semantics
- Assumptions used: 16kHz LINEAR16 mono input from pipeline
- Baseline provider selected: `silero_vad`

## Planned edit scope (strict)

- Provider implementation folder: `api/assistant-api/internal/vad/internal/acme_vad/`
- Factory file edits: `api/assistant-api/internal/vad/vad.go`
- Contract/packet files: no interface changes
- UI config files: `ui/src/providers/acme_vad/vad.json`
- Explicitly out of scope: `api/assistant-api/internal/end_of_speech/internal/*`

## Detection contract mapping

- Input audio assumptions: 10ms frames in internal 16kHz mono
- Speech onset interruption logic: emit `InterruptionPacket{Source:"vad"}` once per onset
- Speech heartbeat logic: emit `VadSpeechActivityPacket` while active speech continues
- Silence frame logic: use `min_silence_frame` before clearing active state
- Cleanup/lifecycle behavior: release detector/session on `Close()` and context done

## VAD options mapping

- `microphone.vad.provider`: `acme_vad`
- `microphone.vad.threshold`: detector probability threshold
- `microphone.vad.min_speech_frame`: required speech confirmation frames
- `microphone.vad.min_silence_frame`: required silence confirmation frames

## Test plan and evidence

- Unit tests: pass
- Benchmarks: pass
- UI provider tests: pass
- Validation script command: `./.claude/skills/vad-integration/scripts/validate.sh --check-diff --provider acme_vad`

## Result summary

- Final behavior change: cleaner speech onset detection with fewer duplicate interruptions
- Risk notes and rollback: rollback by switching `microphone.vad.provider` to previous value
