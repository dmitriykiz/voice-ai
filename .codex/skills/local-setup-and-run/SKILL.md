---
name: local-setup-and-run
description: Explain and validate local setup paths for this repository with Docker and without Docker. Use when developers need exact prerequisites, startup commands, health checks, and troubleshooting.
---

# Local Setup And Run Skill

## Mission

Provide accurate local setup/run instructions based on this repository's actual build and run scripts.

## Scope

In scope:
- local run documentation and runbook changes
- command mapping from `README.md`, `Makefile`, and compose files
- prerequisites and troubleshooting guidance

Out of scope:
- application feature implementation changes
- provider integration behavior changes unrelated to setup

## Source-of-truth files

- `README.md`
- `Makefile`
- `docker-compose.yml`
- `docker-compose.knowledge.yml`

## Required output

1. Docker path (recommended) with commands.
2. Docker knowledge mode path.
3. Non-Docker path with dependencies and `run-*` commands.
4. Health-check URLs and expected ports.
5. Troubleshooting section.

## Validation commands

- `make help`
- `make up-all`
- `make up-all-with-knowledge`
- `make deps`
- `docker compose ps`

## References

- `references/checklist.md`
- `examples/sample.md`
