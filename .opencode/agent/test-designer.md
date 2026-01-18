---
name: test-designer
mode: subagent
description: >
  テスト観点抽出と自動テスト設計に特化したサブエージェント。
  単体／結合／E2E テストケースを整理し、*_test.(go|py|js) や pytest / vitest などのスケルトンを生成する。
model: openrouter/google/gemini-3-flash-preview
temperature: 0.25
# 旧:
# tools:
#   edit: allow
#   bash: ask
#   webfetch: allow
# permissions:
#   files:
#     allow:
#       - "src/**"
#       - "app/**"
#       - "tests/**"
#       - "pytest.ini"
#       - "vitest.config.*"
#       - "package.json"
#       - "go.mod"
#   bash:
#     "*": ask
#   webfetch:
#     "*": allow

# 新: permission に統一
permission:
  edit: 'allow' # テストコード編集は許可
  bash: 'ask' # bash は毎回確認
  webfetch: 'allow' # webfetch は許可
  read:
    'backend/**': 'allow'
    'app.js': 'allow'
    'backend/__tests__/**': 'allow'
    'package.json': 'allow'
    'package-lock.json': 'allow'
    'playwright.config.js': 'allow'
---

# Test Designer

## 役割

...
