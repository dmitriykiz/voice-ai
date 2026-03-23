# Telephony Provider Deep Checklist

1. Add provider in `GetTelephony` and `Telephony.NewStreamer` paths.
2. Implement provider webhook handlers and status callback mapping.
3. Verify inbound call context creation and path routing.
4. Verify outbound call initiation and provider auth mapping.
5. Verify media decode/encode frame handling and buffering.
6. Confirm codec/resampling conversions at stream boundaries.
7. Validate disconnect, interruption, and end-conversation handling.
8. Add provider and adapter integration tests.
