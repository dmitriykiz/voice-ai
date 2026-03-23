# Codex Skills Setup

This repository keeps Codex skills at `.codex/skills/`.

Canonical source is also tracked at `skills/` for easy review in git.

## Install in this repository

Sync tracked skills into `.codex/skills/`:

```bash
mkdir -p .codex/skills
rsync -a skills/ .codex/skills/
```

Validate visibility:

```bash
find .codex/skills -maxdepth 2 -type d | sort
```

## Install globally (optional)

Install for all repos on this machine:

```bash
mkdir -p ~/.codex/skills/voice-ai
rsync -a skills/ ~/.codex/skills/voice-ai/
```

## Validate a skill

```bash
./.codex/skills/<skill>/scripts/validate.sh
./.codex/skills/<skill>/scripts/validate.sh --check-diff --provider <provider>
```

For integration skills (`stt`, `tts`, `telephony`, `llm`, `telemetry`, `vad`, `end-of-speech`), include `--provider` in strict mode.

## References

- `.codex/skills/README.md`
- `skills/README.md`
- `skills/SECURITY_GUIDELINES.md`
