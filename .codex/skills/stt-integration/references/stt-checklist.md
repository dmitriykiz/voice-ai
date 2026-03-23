# STT Provider Deep Checklist

1. Pick transport baseline (WS, SDK callback, or HTTP chunking).
2. Confirm reconnect/retry behavior for connection drops.
3. Emit interim and final transcripts with stable context IDs.
4. Emit `InterruptionPacket{Source:"word"}` when provider supports onset cues.
5. Emit `stt_latency_ms` once per utterance.
6. Map UI option keys to provider request payload fields.
7. Add provider-level and transformer-level tests.
