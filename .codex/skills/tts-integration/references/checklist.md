# TTS Integration Checklist

1. Implement provider TTS package under `api/assistant-api/internal/transformer/<provider>/`.
2. Register provider in `api/assistant-api/internal/transformer/transformer.go`.
3. Verify delta/done/interruption lifecycle behavior.
4. Emit `tts_latency_ms` on first audio only.
5. Ensure `TextToSpeechEndPacket` order after final audio.
6. Wire provider JSON (`tts.json`, voices/models/languages) and UI component.
7. Add provider and integration tests.
8. Run strict validator with `--provider`.
