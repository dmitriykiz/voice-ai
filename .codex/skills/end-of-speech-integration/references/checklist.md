# EOS Integration Checklist

1. Confirm target EOS provider folder under `api/assistant-api/internal/end_of_speech/internal/<provider>/`.
2. Register provider in `api/assistant-api/internal/end_of_speech/end_of_speech.go`.
3. Verify packet flow uses EOS-required packets and emits one final EOS packet per utterance.
4. Update provider config in `ui/src/providers/<provider>/eos.json`.
5. Keep VAD internals untouched.
6. Add/refresh provider and adapter tests.
7. Run strict validator with `--provider`.
