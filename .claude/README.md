# Claude Skills Setup

This repository includes Claude skills in `.claude/skills/`.

## Install in this repository

Already installed. Validate visibility with:

```bash
find .claude/skills -maxdepth 2 -type d | sort
```

## Install in another repository

Copy this folder into the target repo:

```bash
mkdir -p /path/to/target-repo/.claude/skills
rsync -a /path/to/voice-ai/.claude/skills/ /path/to/target-repo/.claude/skills/
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

For integration skills (`stt`, `tts`, `telephony`, `llm`, `telemetry`, `vad`, `end-of-speech`), include `--provider` in strict mode.

## References

- `.claude/skills/README.md`
- `.claude/skills/ENTERPRISE_POLICY.md`
- `.claude/skills/SECURITY_GUIDELINES.md`
