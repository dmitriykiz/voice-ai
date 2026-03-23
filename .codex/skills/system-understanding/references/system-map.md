# System Map (Integration Focus)

## Factory boundaries

- Telephony: `api/assistant-api/internal/channel/telephony/telephony.go`
- STT/TTS: `api/assistant-api/internal/transformer/transformer.go`
- VAD: `api/assistant-api/internal/vad/vad.go`
- EOS: `api/assistant-api/internal/end_of_speech/end_of_speech.go`
- LLM callers: `api/integration-api/internal/caller/caller.go`

## Packet routing boundary

- Dispatcher: `api/assistant-api/internal/adapters/internal/dispatch.go`

## UI provider config boundaries

- Registries: `ui/src/providers/provider.development.json`, `ui/src/providers/provider.production.json`
- Loader: `ui/src/providers/config-loader.ts`
- Feature components: `ui/src/app/components/providers/`

## Typical voice runtime path

1. Telephony webhook/context setup
2. Streamer receives user audio
3. STT emits transcript packets
4. EOS/VAD govern interruption and turn-finalization
5. LLM caller returns deltas/done
6. TTS emits audio packets
7. Streamer sends output media and callbacks finalize status
