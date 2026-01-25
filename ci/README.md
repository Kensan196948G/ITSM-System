# ci/ - CI/CD設定

## 担当SubAgent: ci-specialist

### 責務
- 自動テスト実行設計
- ビルド / リリース / ロールバック設計
- 品質ゲート結果に基づく GO / NO-GO 判定

### 成果物
- `pipeline.md` - パイプライン設計書
- `*.yml` - GitHub Actions ワークフロー（コピー）
- `guard_*.sh` - ガードスクリプト

### 既存CI/CD設定参照
- `.github/workflows/` - GitHub Actions ワークフロー
- `.github/auto-repair/` - 自動修復システム

### 自動修復ループ設定
- 最大試行回数: 5回/Run
- 同一エラー検出: 3回で強制停止
- 差分制限: 20行以下
- 対象ファイル: .ps1, .js のみ

### 品質ゲート基準
- テストカバレッジ: 70%以上
- Lint エラー: 0
- セキュリティ脆弱性: Critical/High = 0
- ビルド成功: 必須
