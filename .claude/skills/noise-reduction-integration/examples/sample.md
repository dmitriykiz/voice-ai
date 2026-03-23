# Sample Output: Noise Reduction Integration

## Request classification

- Change type: new provider
- Target provider: `acme_denoise`
- Runtime type: native library
- Quality tradeoff target: stronger suppression, minimal speech artifacts

## Inputs and defaults

- Explicit user constraints: keep packet ordering and low-latency behavior
- Assumptions used: 16k LINEAR16 mono internal pipeline
- Baseline provider selected: `rn_noise`

## Planned edit scope (strict)

- Provider implementation folder: `api/assistant-api/internal/denoiser/internal/acme_denoise/`
- Factory file edits: `api/assistant-api/internal/denoiser/denoiser.go`
- Contract/packet files: unchanged
- UI metadata files: `ui/src/providers/acme_denoise/noise.json`
- Explicitly out of scope: VAD/EOS internals, telephony internals, STT/TTS internals

## Denoiser packet contract

- Input handling: each `DenoiseAudioPacket` chunk is processed once
- Output handling: emits `DenoisedAudioPacket` with matching context ID
- Ordering/cadence guarantees: output chunk order and cadence preserved
- Error fallback behavior: emits original audio with `NoiseReduced=false`
- Cleanup/lifecycle behavior: provider resources released on `Close` and context cancel

## Option and metadata mapping

- Provider option key: `microphone.denoising.provider`
- Provider JSON files updated: `noise.json`
- Default/fallback provider behavior: unknown provider falls back to `rn_noise`

## Test plan and evidence

- Denoiser unit tests: pass
- Factory/fallback tests: pass
- UI provider tests: pass
- Validation script command: `./.claude/skills/noise-reduction-integration/scripts/validate.sh --check-diff --provider acme_denoise`

## Result summary

- Final behavior change: denoised audio path added with stable packet semantics
- Risk notes and rollback: switch provider back to prior denoiser option
