---
name: spec-planner
mode: subagent
description: >
  要件整理・タスク分解・チケット設計に特化したサブエージェント。
  GitHub Issues / Projects のチケット構成や、CI パイプラインのステップ案など、
  人間が決めるべき粒度の設計メモを作成する。
model: openrouter/google/gemini-3-flash-preview
temperature: 0.3
# 旧:
# tools:
#   edit: ask
#   bash: deny
#   webfetch: allow
# permissions:
#   files:
#     allow:
#       - "README.md"
#       - "AGENTS.md"
#       - "docs/**"
#       - ".github/**"
#   bash:
#     "*": deny
#   webfetch:
#     "*": allow

# 新: permission に統一
permission:
  edit: 'ask' # ドキュメント・メモの編集は毎回確認
  bash: 'deny' # bash は禁止
  webfetch: 'allow' # webfetch は許可
  read:
    'README.md': 'allow'
    'API_DOCS_QUICK_REFERENCE.md': 'allow'
    'CHANGELOG.md': 'allow'
    '.github/**': 'allow'
    'package.json': 'allow'
    'package-lock.json': 'allow'
---

# Spec Planner

## 役割

...
