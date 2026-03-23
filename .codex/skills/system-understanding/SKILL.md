---
name: system-understanding
description: Build a code-grounded implementation plan before coding. Use to trace packet flow, factory boundaries, provider config loading, and exact file-level scope for requested integrations.
---

# System Understanding Skill

## Mission

Produce an implementation plan from real factory/packet/config paths before writing feature code.

## Scope

Planning and analysis only.
Do not implement production changes in this skill.

## Discovery sequence

1. Identify factory lane:
- telephony: `api/assistant-api/internal/channel/telephony/telephony.go`
- stt/tts: `api/assistant-api/internal/transformer/transformer.go`
- vad: `api/assistant-api/internal/vad/vad.go`
- eos: `api/assistant-api/internal/end_of_speech/end_of_speech.go`
- llm: `api/integration-api/internal/caller/caller.go`

2. Trace packet flow:
- `api/assistant-api/internal/adapters/internal/dispatch.go`

3. Verify UI config loading:
- `ui/src/providers/provider.development.json`
- `ui/src/providers/provider.production.json`
- `ui/src/providers/config-loader.ts`

4. Produce exact edit boundaries:
- provider folder
- factory file
- optional contract files
- tests to update

## Output requirements

- inferred integration type and defaults
- chosen transport/signal strategy
- exact in-scope file list and explicit out-of-scope files
- test + validation command plan
- risk + rollback path

## Validation commands

- `rg -n "GetTelephony|GetSpeechToTextTransformer|GetTextToSpeechTransformer|GetEndOfSpeech|GetVAD" api`
- `rg -n "GetLargeLanguageCaller|GetEmbeddingCaller|GetRerankingCaller|GetVerifier" api/integration-api`
- `rg -n "OnPacket\(|dispatch\(" api/assistant-api/internal/adapters/internal/dispatch.go`

## References

- `references/checklist.md`
- `references/system-map.md`
- `examples/sample.md`
