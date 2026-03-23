# TTS Provider Deep Checklist

1. Pick transport baseline (WS, SSE, SDK callback, HTTP flush).
2. Verify delta aggregation and done-triggered flush/close behavior.
3. Verify interruption clears pending buffers and stream state.
4. Emit first-audio `tts_latency_ms` once.
5. Emit `TextToSpeechEndPacket` after last audio chunk.
6. Confirm output format compatibility with downstream telephony/resampler.
7. Add provider-level and transformer-level tests.
