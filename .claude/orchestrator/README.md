# Orchestrator Hooks (Claude)

This folder provides a starter contract and runner for subagent hook gates across three stages:

1. `pre-implementation`
2. `post-implementation`
3. `post-verification`

## Layout

- `schemas/envelope.schema.json`: shared run envelope shape
- `schemas/pre-implementation-input.schema.json`
- `schemas/post-implementation-input.schema.json`
- `schemas/post-verification-input.schema.json`
- `scripts/hook-run.py`: stage runner
- `examples/*.json`: sample inputs

## CLI

```bash
python3 .claude/orchestrator/scripts/hook-run.py \
  --stage pre-implementation \
  --input .claude/orchestrator/examples/pre-input.json \
  --output /tmp/hook-out.json
```

Valid stages:

- `pre-implementation`
- `post-implementation`
- `post-verification`

Exit codes:

- `0`: hook executed (check `status` inside output json)
- `2`: invalid input arguments/json
- `3`: internal hook error

## Contract summary

- `pre-implementation` validates plan completeness and required test/command declarations.
- `post-implementation` enforces file scope guard and test-category presence.
- `post-verification` enforces command success and final decision routing.

## Notes

- This is intentionally conservative and can be extended with repo-specific checks.
- Path guard uses exact matches for file paths and prefix matches for paths ending in `/`.
