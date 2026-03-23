---
name: vad-integration
description: Add or modify VAD providers and tuning in assistant-api with strict separation from EOS internals. Use for speech activity detection engines, provider registration, and VAD config wiring.
---

# VAD Integration Skill

## Mission

Implement VAD providers that generate stable interruption/speech-activity signals with low false positives.

## Hard boundaries

In scope:
- `api/assistant-api/internal/vad/internal/<provider>/...`
- `api/assistant-api/internal/vad/vad.go`
- VAD contract compatibility in `api/assistant-api/internal/type/vad.go` and packet usage as needed
- VAD config in `ui/src/providers/<provider>/vad.json`

Out of scope:
- `api/assistant-api/internal/end_of_speech/internal/...`
- EOS provider selection/factory behavior
- telephony/STT/TTS implementation logic

## Inputs expected from user

1. Detector type: ONNX, native library, or external SDK.
2. Input format assumptions (sample rate/channels).
3. Target tradeoff: faster interrupt vs fewer false triggers.

If user does not answer:
- Assume 16kHz LINEAR16 mono platform internal input.
- Keep existing defaults for threshold/speech/silence frame windows.

## Packet contract

Input:
- `UserAudioPacket` via dispatcher VAD path

Required outputs:
- `InterruptionPacket{Source:"vad"}` on speech onset
- `VadSpeechActivityPacket` heartbeat while speech continues
- optional `ConversationEventPacket{Name:"vad"}` for diagnostics

## Implementation workflow

1. Pick nearest baseline (`silero_vad`, `ten_vad`, `firered_vad`).
2. Create provider package in `internal/<provider>/`.
3. Register provider in `vad.go` switch.
4. Ensure lifecycle safety (`Close`, context cancellation, resource cleanup).
5. Add/update UI config and provider docs.
6. Add unit + benchmark tests for threshold/frame edge-cases.

## Done criteria

- Provider selectable by `microphone.vad.provider`.
- No edits under EOS provider internals.
- Interruption and heartbeat semantics proven in tests.

## Validation commands

- `go test ./api/assistant-api/internal/vad/...`
- `go test -bench=. ./api/assistant-api/internal/vad/internal/<provider>/...`
- `cd ui && yarn test providers`
- `./.claude/skills/vad-integration/scripts/validate.sh --check-diff --provider <provider>`
