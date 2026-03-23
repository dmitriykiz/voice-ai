# Telephony Integration Checklist

1. Implement provider folder under `api/assistant-api/internal/channel/telephony/internal/<provider>/`.
2. Register provider in `api/assistant-api/internal/channel/telephony/telephony.go`.
3. Confirm `ReceiveCall`, `InboundCall`, `OutboundCall`, and `StatusCallback` behavior.
4. Validate streamer `Recv/Send` media lifecycle and disconnect handling.
5. Verify codec/resampling compatibility with internal LINEAR16 16k path.
6. Update UI provider registries and telephony component.
7. Add telephony and adapter tests.
8. Run strict validator with `--provider`.
