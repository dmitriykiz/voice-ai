# Skills Quickstart

This repository ships two skill systems:

- Claude skills: `.claude/skills/`
- Codex skills: `skills/`

Use the skill set that matches your agent runtime.

## Start here

- Claude: `.claude/skills/README.md`
- Codex: `skills/README.md`
- Security rules:
  - `.claude/skills/SECURITY_GUIDELINES.md`
  - `skills/SECURITY_GUIDELINES.md`

## Local setup skill

If you need local environment setup instructions (Docker and non-Docker), use:

- Claude: `.claude/skills/local-setup-and-run/`
- Codex: `skills/local-setup-and-run/`

## Validation

Claude:

```bash
./.claude/skills/<skill>/scripts/validate.sh
```

Codex:

```bash
./skills/<skill>/scripts/validate.sh
```

For integration skills that touch providers, use strict mode with provider lock:

```bash
./.claude/skills/<skill>/scripts/validate.sh --check-diff --provider <provider>
./skills/<skill>/scripts/validate.sh --check-diff --provider <provider>
```
