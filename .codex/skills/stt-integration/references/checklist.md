# STT Integration Checklist

1. Implement provider STT package under `api/assistant-api/internal/transformer/<provider>/`.
2. Register provider in `api/assistant-api/internal/transformer/transformer.go`.
3. Validate interim/final transcript packet ordering and context IDs.
4. Emit `stt_latency_ms` once per utterance.
5. Wire metadata JSON (`stt.json`, model/language files) in `ui/src/providers/<provider>/`.
6. Update provider UI component under `ui/src/app/components/providers/speech-to-text/`.
7. Add provider and integration tests.
8. Run strict validator with `--provider`.
