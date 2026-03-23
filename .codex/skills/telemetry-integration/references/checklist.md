# Telemetry Integration Checklist

1. Confirm target metric/event contract before changes.
2. Update shared metric builder only when necessary.
3. Add provider instrumentation at success and failure boundaries.
4. Keep external audit mapping compatible.
5. Avoid sensitive content in metrics.
6. Add test assertions for required metric keys.
7. Verify cancellation/timeout paths also emit terminal status.
8. Run strict validator with `--provider`.
