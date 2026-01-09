---
name: ops-runbook
mode: subagent
description: >
  運用・SRE / Runbook 作成専任のサブエージェント。
  アラート対応手順、障害時フローチャート、GitHub Actions 失敗時の切り戻し手順などのドキュメントを作成する。
model: claude-sonnet-4-5-20250929
temperature: 0.3
# 旧:
# tools:
#   edit: allow
#   bash: deny
#   webfetch: allow
# permissions:
#   files:
#     allow:
#       - "docs/runbook/**"
#       - "docs/**"
#       - ".github/workflows/**"
#       - "README.md"
#   bash:
#     "*": deny
#   webfetch:
#     "*": allow

# 新: permission に統一
permission:
  edit: 'allow' # ドキュメント編集は許可
  bash: 'deny' # bash は禁止
  webfetch: 'allow' # webfetch は許可
  read:
    'README.md': 'allow'
    'API_DOCS_QUICK_REFERENCE.md': 'allow'
    'CHANGELOG.md': 'allow'
    '.github/workflows/**': 'allow'
    'systemd/**': 'allow'
---

# Ops / Runbook Author

## 役割

...
