# System Understanding Checklist

1. Identify feature lane via the factory file.
2. Trace packet flow in `dispatch.go` for touched packet types.
3. Confirm UI provider config loading path and key names.
4. List exact in-scope files (provider folder + factory + optional contracts).
5. List explicit out-of-scope files.
6. Define validation commands and rollback plan.
