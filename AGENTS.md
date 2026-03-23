# AGENTS.md

## Scope

Repository-wide operating rules for Codex sessions.

## Subagent delegation flow

1. Plan first:
- Define changed files, provider scope, and test scope.
- Keep implementation/test write sets explicit.

2. Delegate implementation:
- Use execution-focused worker(s) for code changes.
- Keep ownership disjoint by file/module.

3. Delegate tests:
- UI changes in `ui/src/**` must include UI unit tests using existing local patterns.
- Backend changes in `api/**`, `pkg/**`, or `cmd/**` must include corresponding `*_test.go` updates in the same package.

4. Verification:
- Run targeted backend tests for changed packages.
- Run UI provider tests when UI provider/config changes.
- Run skill strict validator for integration changes with `--check-diff --provider <provider>`.

## UI testing rules

- Reuse nearby `.test.tsx` / `.spec.tsx` / `__tests__` conventions.
- Include at least:
  - happy-path assertion
  - regression/edge assertion tied to the change
- For provider/config updates, add parity checks against `config-loader` and provider runtime parity test patterns.

## Backend testing rules

- Reuse existing package-level test style and helpers.
- Include at least:
  - success path
  - fallback/error path
  - factory/selection behavior where provider wiring changes
- If the target package already has benchmarks, add/update benchmark coverage for hot-path changes.

## Backend integration boundaries

- STT and TTS:
  - Primary scope: `api/assistant-api/internal/transformer/<provider>/` and `api/assistant-api/internal/transformer/transformer.go`
- VAD:
  - Primary scope: `api/assistant-api/internal/vad/internal/<provider>/` and `api/assistant-api/internal/vad/vad.go`
- End-of-speech:
  - Primary scope: `api/assistant-api/internal/end_of_speech/internal/<provider>/` and `api/assistant-api/internal/end_of_speech/end_of_speech.go`
- Noise reduction:
  - Primary scope: `api/assistant-api/internal/denoiser/internal/<provider>/` and `api/assistant-api/internal/denoiser/denoiser.go`
- Telephony:
  - Primary scope: `api/assistant-api/internal/channel/telephony/internal/<provider>/` and telephony factory files
- LLM:
  - Primary scope: `api/integration-api/internal/caller/<provider>/` and caller factory files

If work needs files outside the selected integration boundary, pause and ask before proceeding.

## Safety and boundaries

- Do not edit out-of-scope modules for the selected integration skill.
- Do not revert unrelated local changes.
- Keep edits minimal and behavior-focused.
