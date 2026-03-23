# Telemetry Deep Checklist

1. Enumerate existing metric keys consumed by dashboards/audit.
2. Add only required new keys; avoid renaming existing keys.
3. Emit terminal status on all success/failure/cancel paths.
4. Ensure latency metrics are emitted once per operation.
5. Keep high-cardinality fields and sensitive data out of metrics.
6. Add tests for metric presence and status transitions.
7. Validate external audit parsing still works.
