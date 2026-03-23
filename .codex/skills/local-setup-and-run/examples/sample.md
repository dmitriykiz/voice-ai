# Sample Output: Local Setup And Run

## Recommended path: Docker

- `make setup-local && make build-all`
- `make up-all`
- verify with `docker compose ps`

## Knowledge mode (optional)

- `make up-all-with-knowledge`

## Non-docker path

- dependencies: `make deps` (or `make deps-knowledge`)
- run APIs: `make run-web`, `make run-assistant`, `make run-endpoint`, `make run-integration`
- run UI: `make run-ui`

## Health checks

- UI: `http://localhost:3000`
- Web API: `http://localhost:9001`
- Assistant API: `http://localhost:9007`
- Endpoint API: `http://localhost:9005`
- Integration API: `http://localhost:9004`
- Document API: `http://localhost:9010` (knowledge mode)

## Troubleshooting

- Ports in use: `lsof -i :<port>`
- Service failures: `make logs-all`, `docker compose ps`
