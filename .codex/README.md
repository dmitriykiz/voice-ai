# Codex Skills Setup

This repository keeps Codex skills at `.codex/skills/`.

## Quick start (this repo)

Prerequisites:
- `python3`
- `go`
- `yarn` (for UI-related checks)

Validate local setup:

```bash
find .codex/skills -maxdepth 2 -type d | sort
python3 .codex/orchestrator/scripts/hook-run.py --stage pre-implementation --input .codex/orchestrator/examples/pre-input.json --output /tmp/hook-out.json
python3 .codex/hooks/validate_changed_tests.py </dev/null
```

## Install in another repository

Copy the full `.codex` folder (skills + hooks + agents + orchestrator):

```bash
mkdir -p /path/to/other-repo/.codex
rsync -a /path/to/voice-ai/.codex/ /path/to/other-repo/.codex/
```

## Install globally (optional)

Install only skills globally for all repos on this machine:

```bash
mkdir -p ~/.codex/skills/voice-ai
rsync -a .codex/skills/ ~/.codex/skills/voice-ai/
```

## Validate a skill

```bash
./.codex/skills/<skill>/scripts/validate.sh
./.codex/skills/<skill>/scripts/validate.sh --check-diff --provider <provider>
```

For integration skills (`stt`, `tts`, `telephony`, `llm`, `telemetry`, `vad`, `end-of-speech`, `noise-reduction`), include `--provider` in strict mode.

## Orchestrator Hooks

Starter hook contracts and runner are available at `.codex/orchestrator/`:

```bash
python3 .codex/orchestrator/scripts/hook-run.py --stage pre-implementation --input .codex/orchestrator/examples/pre-input.json --output /tmp/hook-out.json
```

Parity assets for subagent/hook workflow are available in:

- `.codex/agents/`
- `.codex/hooks/`

Codex-standard repo guidance is defined in root `AGENTS.md`.
Custom project subagent profiles are defined in `.codex/agents/*.md`.

## References

- `.codex/skills/README.md`
- `.codex/skills/SECURITY_GUIDELINES.md`
