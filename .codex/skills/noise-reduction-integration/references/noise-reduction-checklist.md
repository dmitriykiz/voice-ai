# Noise Reduction Provider Deep Checklist

1. Validate input assumptions (sample rate/channels/encoding).
2. Emit one `DenoisedAudioPacket` per input chunk.
3. Preserve context IDs and packet sequencing.
4. Preserve chunk cadence expected by downstream VAD/STT/EOS.
5. Ensure fallback to original audio on processing failure.
6. Ensure resource cleanup on `Close` and context cancel.
7. Keep telephony transport internals and VAD/EOS internals unchanged.
8. Add edge-case tests for empty/bad audio and provider fallback.
