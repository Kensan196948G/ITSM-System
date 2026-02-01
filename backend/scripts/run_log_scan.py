#!/usr/bin/env python3
"""
ログスキャン・自動修復実行スクリプト
GitHub Actions ワークフローから呼び出されます
"""
import sys
import json

sys.path.insert(0, ".")

try:
    from auto_fix_daemon import AutoFixDaemon

    daemon = AutoFixDaemon()
    log_paths = [
        "../logs/app.log",
        "../logs/auto_fix.log",
        "../logs/alerts.log"
    ]

    errors = daemon.scan_logs(log_paths)
    fixes = 0
    error_id = ""
    error_summary = ""

    for error in errors:
        if daemon.auto_fix_error(error):
            fixes += 1
        if not error_id:
            error_id = error.get("id", "")
            error_summary = error.get("name", "")

    result = {
        "errors_detected": len(errors),
        "fixes_attempted": fixes,
        "last_error_id": error_id,
        "last_error_summary": error_summary
    }
    print(json.dumps(result))

except Exception as e:
    print(json.dumps({"errors_detected": 0, "fixes_attempted": 0}))
    sys.exit(1)
