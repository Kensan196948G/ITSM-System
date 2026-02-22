# Claude Code CI修理工プロンプト

## 目的

このドキュメントは、GitHub Actions 自動修復ループにおける
**Claude Code の役割と制約**を定義する補足ドキュメントです。

メインの指示書は `.github/auto-repair/repair.md` を参照してください。

---

## プロンプトテンプレート

### 基本プロンプト（ビルドエラー修復用）

```
You are a CI repair agent for the ITSM-Sec Nexus project.

## Your Role
- You are a **test failure fixer**, not a designer or architect
- Your ONLY job is to make failing tests pass
- You must follow CLAUDE.md and repair.md strictly

## Rules (CRITICAL)
1. **Minimal changes only** - Fix ONLY what's broken
2. **No new features** - Never add functionality
3. **No refactoring** - Don't "improve" unrelated code
4. **No test skipping** - Never disable or skip tests
5. **Keep diff small** - Prefer 1-5 line changes

## Build Log (Error)
${BUILD_LOG_CONTENT}

## Task
1. Analyze the error above
2. Find the root cause in the source code
3. Apply the MINIMAL fix to make tests pass
4. Do NOT explain - just fix the code

If you cannot fix it safely, do nothing.
```

---

## Claude Code CLI オプション

### 推奨設定

```bash
claude \
  --print \                           # 非対話モード
  --dangerously-skip-permissions \    # 確認プロンプトをスキップ
  --allowedTools "Read,Edit,Glob,Grep" \  # ツール制限
  --model sonnet                      # コスト最適化
```

### オプション説明

| オプション | 説明 | 推奨値 |
|-----------|------|--------|
| `--print` | 非対話モード（CI用） | 必須 |
| `--dangerously-skip-permissions` | 確認なしで実行 | CI環境で必須 |
| `--allowedTools` | 使用可能なツールを制限 | `Read,Edit,Glob,Grep` |
| `--model` | 使用モデル | `sonnet`（コスト重視）または`opus`（精度重視） |
| `--timeout` | タイムアウト（秒） | 300（5分） |

---

## エラー種類別プロンプト

### 1. テスト失敗

```
Test failure detected:
- File: ${TEST_FILE}
- Test: ${TEST_NAME}
- Expected: ${EXPECTED}
- Received: ${RECEIVED}

Fix the source code (not the test) to make this pass.
```

### 2. ESLint エラー

```
ESLint error detected:
- Rule: ${RULE_NAME}
- File: ${FILE_PATH}
- Line: ${LINE_NUMBER}

Apply the minimal fix. Do not reformat unrelated code.
```

### 3. TypeScript エラー

```
TypeScript error detected:
- Error: ${ERROR_MESSAGE}
- File: ${FILE_PATH}
- Line: ${LINE_NUMBER}

Fix the type error with minimal changes.
```

---

## 安全制約

### 絶対禁止事項

1. **テストの無効化**
   - `test.skip()`, `it.skip()`, `describe.skip()` の追加禁止
   - `// @ts-ignore`, `// eslint-disable` の濫用禁止

2. **依存関係の変更**
   - `package.json` への新規依存追加禁止
   - 既存依存のバージョン変更禁止

3. **設定ファイルの変更**
   - `.env*` ファイルの変更禁止
   - `*.config.js` の変更禁止（例外: 明確なバグ修正のみ）

4. **仕様変更**
   - `README.md` の変更禁止
   - APIエンドポイントの追加・削除禁止

### 変更可能範囲

| 対象 | 許可 | 条件 |
|------|------|------|
| `backend/**/*.js` | ✅ | テスト失敗に直接関係する場合のみ |
| `frontend/**/*.js` | ✅ | テスト失敗に直接関係する場合のみ |
| `backend/__tests__/**` | ⚠️ | テストの期待値修正のみ（ロジック変更禁止） |
| `*.json` | ❌ | 設定変更禁止 |
| `*.md` | ❌ | ドキュメント変更禁止 |
| `*.yml` | ❌ | CI設定変更禁止 |

---

## 証跡ログ

### 保存すべき情報

```bash
# 修復セッションの証跡
ci_logs/
├── build_${TIMESTAMP}.log      # ビルドログ
├── diff_${TIMESTAMP}.patch     # 適用した差分
├── claude_${TIMESTAMP}.log     # Claude Code出力
└── summary_${TIMESTAMP}.json   # 修復サマリー
```

### サマリーJSON形式

```json
{
  "timestamp": "2026-01-26T12:00:00Z",
  "attempt": 3,
  "error_type": "test_failure",
  "files_changed": ["backend/routes/incidents.js"],
  "diff_lines": 5,
  "result": "success|failure|skipped",
  "duration_seconds": 45
}
```

---

## トラブルシューティング

### よくある問題

1. **Claude Code がタイムアウトする**
   - `--timeout` を増やす
   - プロンプトを簡潔にする

2. **同じエラーが繰り返される**
   - `guard_changes.sh` が停止させる
   - 人間による対応が必要

3. **差分が大きすぎる**
   - プロンプトで「1-5行の変更」を強調
   - `--allowedTools` で Write を除外

---

## 参考リンク

- [Claude Code ドキュメント](https://docs.anthropic.com/claude-code)
- [repair.md](.github/auto-repair/repair.md) - メイン指示書
- [CLAUDE.md](CLAUDE.md) - プロジェクトルール
- [state.json スキーマ](Docs/state.json-schema-v1.0.md)
