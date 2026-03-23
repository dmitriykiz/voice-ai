# EOS Provider Deep Checklist

1. Choose baseline behavior (`silence_based`, `pipecat`, or `livekit`) by signal mode.
2. Confirm which packets drive EOS timers and interim/final transitions.
3. Ensure one final EOS packet per utterance using dedup guard.
4. Validate `microphone.eos.*` option mapping.
5. Add provider config file `ui/src/providers/<provider>/eos.json`.
6. Keep all VAD provider internals unchanged.
7. Cover timeout, interruption, and duplicate-finalization tests.
