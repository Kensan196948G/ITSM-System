#!/usr/bin/env python3
"""
ヘルスチェック実行スクリプト
GitHub Actions ワークフローから呼び出されます
"""
import sys
import json

sys.path.insert(0, ".")

try:
    from health_monitor import HealthMonitor

    monitor = HealthMonitor()
    result = monitor.run_all_checks()
    print(json.dumps(result, indent=2, ensure_ascii=False))

except Exception as e:
    print(json.dumps({"overall_status": "unknown", "error": str(e)}))
    sys.exit(1)
