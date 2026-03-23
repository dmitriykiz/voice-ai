#!/usr/bin/env python3
import json
import sys


def main() -> int:
    _ = sys.stdin.read()
    msg = {
        "hook": "PostToolUse",
        "advice": "If UI or backend code was changed, update corresponding unit tests and run skill validator in strict mode.",
    }
    print(json.dumps(msg))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
