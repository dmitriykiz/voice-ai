# Claude Skills Setup

This repository includes Claude skills in `.claude/skills/`.

## Quick start (this repo)

Prerequisites:
- `python3`
- `go`
- `yarn` (for UI-related checks)

Validate local setup:

```bash
find .claude/skills -maxdepth 2 -type d | sort
python3 .claude/orchestrator/scripts/hook-run.py --stage pre-implementation --input .claude/orchestrator/examples/pre-input.json --output /tmp/hook-out.json
python3 .claude/hooks/validate_changed_tests.py </dev/null
```

## Install in this repository

```bash
find .claude/skills -maxdepth 2 -type d | sort
```

## Install in another repository

Copy the full `.claude` folder so hooks and subagents are included:

```bash
mkdir -p /path/to/target-repo/.claude
rsync -a /path/to/voice-ai/.claude/ /path/to/target-repo/.claude/
```

## Required skill structure

Each skill should contain:

- `SKILL.md`
- `template.md`
- `examples/sample.md`
- `scripts/validate.sh`

## Validate a skill

```bash
./.claude/skills/<skill>/scripts/validate.sh
./.claude/skills/<skill>/scripts/validate.sh --check-diff --provider <provider>
```

For integration skills (`stt`, `tts`, `telephony`, `llm`, `telemetry`, `vad`, `end-of-speech`, `noise-reduction`), include `--provider` in strict mode.

## Orchestrator Hooks

Starter hook contracts and runner are available at `.claude/orchestrator/`:

```bash
python3 .claude/orchestrator/scripts/hook-run.py --stage pre-implementation --input .claude/orchestrator/examples/pre-input.json --output /tmp/hook-out.json
```

Standard Claude automation config is now committed in:

- `.claude/settings.json` (hooks)
- `.claude/hooks/` (hook commands)
- `.claude/agents/` (subagents for UI/backend implementation and tests)

## References

- `.claude/skills/README.md`
- `.claude/skills/ENTERPRISE_POLICY.md`
- `.claude/skills/SECURITY_GUIDELINES.md`
