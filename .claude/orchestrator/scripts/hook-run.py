#!/usr/bin/env python3
import argparse
import json
import sys
from pathlib import Path


def err(code: str, message: str, **extra):
    out = {"code": code, "message": message}
    out.update(extra)
    return out


def _is_in_allowed(path: str, allowed_paths: list[str]) -> bool:
    for p in allowed_paths:
        if p.endswith("/"):
            if path.startswith(p):
                return True
        elif path == p:
            return True
    return False


def _is_in_blocked(path: str, blocked_paths: list[str]) -> bool:
    for p in blocked_paths:
        if p.endswith("/"):
            if path.startswith(p):
                return True
        elif path == p:
            return True
    return False


def _required_provider_config_path(data: dict, plan: dict) -> str:
    provider = str((data.get("task") or {}).get("provider", "")).strip()
    if not provider:
        return ""

    explicit = str(plan.get("required_provider_config", "")).strip()
    if explicit:
        return explicit.replace("{provider}", provider)

    skill = str((data.get("task") or {}).get("skill", "")).strip()
    mapping = {
        "noise-reduction-integration": "ui/src/providers/{provider}/noise.json",
        "vad-integration": "ui/src/providers/{provider}/vad.json",
        "end-of-speech-integration": "ui/src/providers/{provider}/eos.json",
        "stt-integration": "ui/src/providers/{provider}/stt.json",
        "tts-integration": "ui/src/providers/{provider}/tts.json",
    }
    pattern = mapping.get(skill, "")
    if not pattern:
        return ""
    return pattern.format(provider=provider)


def _base_envelope_checks(data: dict) -> list[dict]:
    errors = []
    if not isinstance(data.get("task"), dict):
        errors.append(err("MISSING_TASK", "task is required"))
        return errors
    task = data["task"]
    for k in ("id", "type", "skill"):
        if not str(task.get(k, "")).strip():
            errors.append(err("MISSING_FIELD", f"task.{k} is required"))

    if str(task.get("type", "")).strip() == "integration" and not str(task.get("provider", "")).strip():
        errors.append(err("MISSING_PROVIDER", "task.provider is required for integration tasks"))
    return errors


def run_pre_implementation(data: dict) -> dict:
    errors = _base_envelope_checks(data)
    warnings = []
    checks = {
        "plan_presence": "fail",
        "scope_declared": "fail",
        "tests_declared": "fail",
        "commands_declared": "fail",
    }

    plan = data.get("task_plan")
    if not isinstance(plan, dict):
        errors.append(err("MISSING_PLAN", "task_plan is required"))
        return {"status": "fail", "errors": errors, "warnings": warnings, "checks": checks}

    checks["plan_presence"] = "pass"

    allowed = plan.get("allowed_paths") or []
    out_scope = plan.get("out_of_scope_paths") or []
    req_tests = plan.get("required_tests") or []
    req_cmds = plan.get("required_commands") or []

    if allowed and out_scope:
        checks["scope_declared"] = "pass"
    else:
        errors.append(err("MISSING_SCOPE", "allowed_paths and out_of_scope_paths are required"))

    if req_tests:
        checks["tests_declared"] = "pass"
    else:
        errors.append(err("MISSING_TESTS", "required_tests must not be empty"))

    if req_cmds:
        checks["commands_declared"] = "pass"
    else:
        errors.append(err("MISSING_COMMANDS", "required_commands must not be empty"))

    has_strict_validator = any("--check-diff" in c and "--provider" in c for c in req_cmds)
    if not has_strict_validator and data.get("task", {}).get("type") == "integration":
        warnings.append(err("MISSING_STRICT_VALIDATOR", "No strict validator command with --check-diff --provider"))

    status = "pass" if not errors else "fail"
    return {
        "status": status,
        "errors": errors,
        "warnings": warnings,
        "checks": checks,
        "normalized_plan": {
            "allowed_paths": allowed,
            "out_of_scope_paths": out_scope,
            "required_tests": req_tests,
            "required_commands": req_cmds,
        },
    }


def run_post_implementation(data: dict) -> dict:
    errors = _base_envelope_checks(data)
    checks = {
        "scope_guard": "fail",
        "required_test_presence": "fail",
        "provider_file_presence": "fail",
    }

    plan = data.get("task_plan") or {}
    impl = data.get("implementation")
    if not isinstance(impl, dict):
        errors.append(err("MISSING_IMPLEMENTATION", "implementation is required"))
        return {"status": "fail", "errors": errors, "checks": checks}

    changed_files = impl.get("changed_files") or []
    tests_covered = set(impl.get("tests_covered") or [])
    allowed = plan.get("allowed_paths") or []
    blocked = plan.get("out_of_scope_paths") or []
    required_tests = set(plan.get("required_tests") or [])

    if not changed_files:
        errors.append(err("NO_CHANGED_FILES", "implementation.changed_files must not be empty"))

    out_of_scope = []
    blocked_hits = []
    for f in changed_files:
        if blocked and _is_in_blocked(f, blocked):
            blocked_hits.append(f)
            continue
        if allowed and not _is_in_allowed(f, allowed):
            out_of_scope.append(f)

    if not out_of_scope and not blocked_hits:
        checks["scope_guard"] = "pass"
    else:
        for f in blocked_hits:
            errors.append(err("BLOCKED_PATH_CHANGED", "Changed file is explicitly out of scope", file=f))
        for f in out_of_scope:
            errors.append(err("OUT_OF_SCOPE_FILE", "Changed file is outside allowed scope", file=f))

    missing_tests = sorted(list(required_tests - tests_covered))
    if not missing_tests:
        checks["required_test_presence"] = "pass"
    else:
        errors.append(err("MISSING_TEST_CATEGORIES", "Required test categories missing", missing=missing_tests))

    expected_provider_config = _required_provider_config_path(data, plan)
    if expected_provider_config:
        if any(f == expected_provider_config for f in changed_files):
            checks["provider_file_presence"] = "pass"
        else:
            errors.append(
                err(
                    "MISSING_PROVIDER_CONFIG",
                    "Expected provider config file was not changed",
                    expected=expected_provider_config,
                )
            )
    else:
        checks["provider_file_presence"] = "pass"

    return {"status": "pass" if not errors else "fail", "errors": errors, "checks": checks}


def run_post_verification(data: dict) -> dict:
    errors = _base_envelope_checks(data)
    issues = []

    plan = data.get("task_plan") or {}
    verification = data.get("verification")
    if not isinstance(verification, dict):
        errors.append(err("MISSING_VERIFICATION", "verification is required"))
        return {
            "status": "fail",
            "final_decision": "block",
            "issues": errors,
            "reroute_payload": {},
        }

    commands = verification.get("commands") or []
    coverage = verification.get("coverage") or {}
    required_tests = set(plan.get("required_tests") or [])
    passed_categories = set(coverage.get("required_categories_passed") or [])

    failed_cmds = [c for c in commands if int(c.get("exit_code", 1)) != 0]
    for c in failed_cmds:
        issues.append(err("TEST_FAIL", "Verification command failed", command=c.get("cmd", "")))

    if coverage.get("unit_tests_present") is False:
        issues.append(err("UNIT_TESTS_MISSING", "coverage.unit_tests_present is false"))

    missing_cats = sorted(list(required_tests - passed_categories))
    if missing_cats:
        issues.append(err("REQUIRED_CATEGORIES_FAILED", "Missing required test categories", missing=missing_cats))

    if errors:
        issues = errors + issues

    if issues:
        return {
            "status": "fail",
            "final_decision": "reroute_to_implementer",
            "issues": issues,
            "reroute_payload": {
                "target_agent": "implementer",
                "fix_only": True,
                "todo": [i.get("message", "") for i in issues],
            },
        }

    return {
        "status": "pass",
        "final_decision": "ready",
        "issues": [],
        "reroute_payload": {},
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run orchestrator stage hooks.")
    parser.add_argument(
        "--stage",
        required=True,
        choices=["pre-implementation", "post-implementation", "post-verification"],
    )
    parser.add_argument("--input", required=True, help="Path to JSON input envelope")
    parser.add_argument("--output", required=True, help="Path to JSON output")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    try:
        input_path = Path(args.input)
        data = json.loads(input_path.read_text(encoding="utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(f"Invalid input JSON: {exc}", file=sys.stderr)
        return 2

    try:
        if args.stage == "pre-implementation":
            result = run_pre_implementation(data)
        elif args.stage == "post-implementation":
            result = run_post_implementation(data)
        else:
            result = run_post_verification(data)

        output_path = Path(args.output)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
        return 0
    except Exception as exc:  # noqa: BLE001
        print(f"Hook execution error: {exc}", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
