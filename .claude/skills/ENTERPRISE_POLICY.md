# Enterprise Skill Governance

This document defines the governance baseline for all project Claude skills under `.claude/skills/`.

Security baseline details live in `.claude/skills/SECURITY_GUIDELINES.md`.

## Risk Tiers

- High risk: skills that trigger shell execution, network access, MCP tools, or broad multi-service edits.
- Medium risk: skills that modify multiple files within one runtime lane (for example provider + factory + UI config).
- Low risk: read-only discovery/planning workflows.

## Mandatory Review Checklist

1. Review all files in the skill directory before adoption or update.
2. Verify no hardcoded credentials, API keys, tokens, or passwords.
3. Verify no adversarial instructions (hide actions, bypass safety, exfiltrate data).
4. Verify file scope is explicit (provider folder + factory + contract files only).
5. Validate scripts in sandbox before production use.
6. Require at least one realistic example and one validation command.

## Scope Lock Requirements

- Every integration skill must define strict in-scope and out-of-scope paths.
- `scripts/validate.sh --check-diff` must fail on edits outside allowed scope.
- For provider integrations, validator must require `--provider <provider>`.
- EOS and VAD skills must maintain implementation separation.

## Prohibited Content

- Instructions to ignore safety or policy constraints.
- Instructions to conceal behavior from users.
- Embedded secrets in markdown, scripts, templates, or examples.

## Change Control

- Treat skill updates as code changes requiring PR review.
- Re-run per-skill validation scripts after every edit.
- Re-review risk tier when adding scripts, network calls, or external tool references.
