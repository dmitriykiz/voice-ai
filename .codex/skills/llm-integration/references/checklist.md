# LLM Integration Checklist

1. Implement provider caller package in `api/integration-api/internal/caller/<provider>/`.
2. Register provider in `api/integration-api/internal/caller/caller.go`.
3. Validate unified route behavior in `api/integration-api/api/unified_provider.go`.
4. Keep `TIME_TAKEN` and `STATUS` metric semantics stable.
5. Ensure verify credential returns explicit success/failure.
6. Update provider text model metadata if required.
7. Add caller and route tests.
8. Run strict validator with `--provider`.
