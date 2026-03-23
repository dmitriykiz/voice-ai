# LLM Provider Deep Checklist

1. Implement required interfaces (chat/stream/verify, optional embedding/reranking).
2. Register provider in all relevant caller factory methods.
3. Validate unified provider request/response path.
4. Preserve metric semantics (`TIME_TAKEN`, `STATUS`, request ID).
5. Cover auth failures, rate limits, malformed payloads, and stream termination.
6. Ensure UI model metadata and provider registry are aligned.
7. Add tests for success and failure paths.
