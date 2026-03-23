# Sample Output: Local Setup And Run

## Environment choice

- Recommended path: Docker
- Why: repository Makefile and compose files provide first-class startup flow.

## Prerequisites

- Docker workflow prerequisites: Docker Engine + Compose plugin, 16GB RAM.
- Non-docker workflow prerequisites: Go toolchain, Yarn, PostgreSQL, Redis, optional OpenSearch/document-api.

## Docker workflow

- Setup/build: `make setup-local && make build-all`
- Run: `make up-all`
- Knowledge mode: `make up-all-with-knowledge`
- Stop: `make down-all`

## Non-docker workflow

- Dependencies: `make deps` (or `make deps-knowledge`)
- APIs: `make run-web`, `make run-assistant`, `make run-endpoint`, `make run-integration`
- UI: `make run-ui`

## Health checks

- UI `http://localhost:3000`
- Web API `http://localhost:9001`
- Assistant API `http://localhost:9007`
- Endpoint API `http://localhost:9005`
- Integration API `http://localhost:9004`
- Document API `http://localhost:9010` (knowledge mode)

## Troubleshooting

- Port conflict: identify with `lsof -i :<port>` and stop conflicting process.
- Service crash: inspect `make logs-all` and `docker compose ps`.

## Verification evidence

- Commands executed: `make help`, `make up-all`, `docker compose ps`
- Output summary: services reachable on expected ports.
