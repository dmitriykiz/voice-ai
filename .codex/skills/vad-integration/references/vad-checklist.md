# VAD Provider Deep Checklist

1. Validate detector input assumptions (16kHz LINEAR16 mono).
2. Emit interruption on speech onset only.
3. Emit `VadSpeechActivityPacket` heartbeats while speaking.
4. Enforce `min_speech_frame` and `min_silence_frame` behavior.
5. Ensure detector/resource cleanup on `Close` and context cancel.
6. Keep EOS internals unchanged.
7. Add boundary tests and benchmark coverage.
