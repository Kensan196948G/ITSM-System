# reviews/ - レビュー結果

## 担当SubAgent: code-reviewer, test-reviewer

### 責務

#### code-reviewer
- 仕様・設計・運用要件準拠チェック
- 例外処理・ログ・権限・将来耐性チェック
- 機械判定可能なゲート結果出力

#### test-reviewer
- テスト網羅性レビュー
- 重要機能・異常系抜け漏れ検出

### 成果物
- `YYYYMMDD_feature_xxx.json` - コードレビュー結果
- `YYYYMMDD_test_review.json` - テストレビュー結果

### ゲート出力フォーマット
```json
{
  "result": "PASS | FAIL | PASS_WITH_WARNINGS",
  "summary": "総評",
  "blocking_issues": [],
  "warnings": [],
  "recommended_fixes": []
}
```

### 判定ルール
- `blocking_issues > 0` → FAIL
- `blocking_issues = 0 & warnings > 0` → PASS_WITH_WARNINGS
- `blocking_issues = 0 & warnings = 0` → PASS

### レビューチェックリスト
- [ ] 仕様準拠（入出力が仕様どおりか）
- [ ] 例外処理（try/catch、エラー時の動作）
- [ ] ログ・証跡（成功/失敗ログ、操作者記録）
- [ ] 権限・SoD（権限チェック、管理系操作制限）
- [ ] 将来変更耐性（ハードコード排除、設定外出し）
