# VAD Integration Checklist

1. Implement provider in `api/assistant-api/internal/vad/internal/<provider>/`.
2. Register provider in `api/assistant-api/internal/vad/vad.go`.
3. Verify onset interruption and speech heartbeat semantics.
4. Map `microphone.vad.*` option keys consistently.
5. Update `ui/src/providers/<provider>/vad.json`.
6. Keep EOS internals untouched.
7. Add unit and benchmark tests.
8. Run strict validator with `--provider`.
