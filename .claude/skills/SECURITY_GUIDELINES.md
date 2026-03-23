# Claude Skills Security Guidelines

These rules apply to all files under `.claude/skills/`.

## 1) No secrets in skill assets

Never include real credentials in:
- `SKILL.md`
- `template.md`
- `examples/`
- `scripts/`

Disallowed values include API keys, bearer tokens, passwords, private certs, and account tokens.

## 2) No adversarial or deceptive instructions

Do not add content that instructs agents to:
- bypass policy/safety controls
- hide behavior from users
- exfiltrate or retain sensitive data
- run risky destructive operations without explicit intent

## 3) Keep scope narrow and auditable

Skill scope must remain provider/factory oriented.

Prefer explicit path allow-lists over broad wildcards.
Keep EOS and VAD implementation boundaries separated.

## 4) Validation and review requirements

For each skill update:

1. run `scripts/validate.sh`
2. run `scripts/validate.sh --check-diff --provider <provider>` where applicable
3. confirm no secrets in markdown/examples
4. confirm out-of-scope boundaries are still enforced

## 5) Public release checks

Before public distribution:
- ensure examples are synthetic
- ensure default prompts do not imply hidden actions
- ensure telemetry guidance excludes sensitive content
- ensure validators fail on scope violations

## 6) Secret leak response

If a secret appears in skills:

1. rotate/revoke immediately
2. remove from files and history per repository process
3. add/update guard patterns in validators
4. note remediation in PR
