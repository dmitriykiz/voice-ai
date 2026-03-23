# Sample Output: TTS Integration

## Request classification

- Change type: new provider
- Target provider: `acme_tts`
- Output transport: SSE/chunked HTTP
- Interruption handling requirement: clear pending synthesis on interruption

## Inputs and defaults

- Explicit user constraints: support provider voices and 16k output path
- Assumptions used: flush on `LLMResponseDonePacket`
- Baseline provider selected: `minimax`

## Planned edit scope (strict)

- Provider implementation folder: `api/assistant-api/internal/transformer/acme_tts/`
- Factory file edits: `api/assistant-api/internal/transformer/transformer.go`
- Contract/packet files: unchanged
- UI metadata + component files: provider `tts.json`, `voices.json`, `text-to-speech-models.json`, component under `text-to-speech/acme-tts/`
- Explicitly out of scope: telephony/EOS/VAD internals

## Synthesis packet contract

- Delta handling behavior: append deltas to provider buffer/stream
- Done/flush behavior: execute one provider flush request when done packet arrives
- Interruption behavior: reset internal buffer and emit `tts interrupted` event
- First-audio latency metric behavior: emit one `tts_latency_ms` when first audio chunk is sent
- End-of-stream packet behavior: emit `TextToSpeechEndPacket` after final chunk

## Audio compatibility mapping

- Provider output format: PCM 16k mono
- Required normalization/resampling: none for assistant core path
- Telephony compatibility assumptions: telephony layer will resample as required

## Option and metadata mapping

- Voice keys: `speak.voice.id`
- Model keys: `speak.model`
- Provider JSON files updated: `tts.json`, `voices.json`, `text-to-speech-models.json`, `languages.json`

## Test plan and evidence

- Provider tests: pass
- Transformer integration tests: pass
- UI provider tests: pass
- Validation script command: `./.claude/skills/tts-integration/scripts/validate.sh --check-diff --provider acme_tts`

## Result summary

- Final behavior change: deterministic flush/end behavior with one latency metric per utterance
- Risk notes and rollback: revert provider selection in config
