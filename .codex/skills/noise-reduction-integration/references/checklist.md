# Noise Reduction Integration Checklist

1. Implement provider in `api/assistant-api/internal/denoiser/internal/<provider>/`.
2. Register provider in `api/assistant-api/internal/denoiser/denoiser.go`.
3. Preserve `DenoisedAudioPacket` ordering and cadence.
4. Ensure fallback behavior on errors (`NoiseReduced=false`).
5. Map `microphone.denoising.provider` consistently.
6. Update `ui/src/providers/<provider>/noise.json`.
7. Keep VAD/EOS internals untouched.
8. Add unit tests and run strict validator with `--provider`.
