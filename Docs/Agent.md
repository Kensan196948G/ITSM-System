# Agent.md

## Agentの役割
- 実装・修正・反復作業はCodexに委譲する
- ClaudeCodeは方針のみ決定

## ClaudeCodeへの依頼条件
- 設計判断が必要なとき
- 方針が2案以上で迷うとき
- 全体整合性チェック時

## Codexへの引き渡し形式
- 目的
- 制約
- 完成条件
- NG事項

## ルート構成の要点
- `app.js` + `style.css`: フロントエンドSPA（各機能のレンダリング、モーダル、CSV出力、ページネーション）
- `backend/`: APIサーバー本体（`server.js` / `db.js` / `migrations` / `routes` / `middleware`）
- `backend/__tests__/`: unit / integration / e2e テスト群（Jest）
- `Docs/`: 要件/設計/計画/実装/テスト/運用の各レポート類
- `scripts/` / `systemd/` / `cron.d/` / `logrotate.d/`: デプロイ・運用向けスクリプトと設定
- `.github/workflows/`: `ci.yml` / `auto-repair.yml` / `deploy.yml.disabled`

## 開発状況（コードベース準拠）
- APIは主要機能のCRUDが実装済み（インシデント、変更、問題、リリース、サービス要求、SLA、ナレッジ、キャパシティ、脆弱性）
- セキュリティ/運用系の実装あり（2FA、Rate Limit、CSP/HSTS、ヘルスチェック、Prometheusメトリクス）
- フロントはテーブル操作（ページネーション/CSV出力）と削除・編集系UIまで実装されている形跡
- テスト基盤は整備済み（`jest.config.js` + `backend/__tests__/`）
- デプロイ系はsystemd/backup/restore/https関連が一通り存在

## ドキュメント整合性メモ（更新済み）
- 最新実測（テスト/カバレッジ/CI/CD方針）を主要ドキュメントへ反映
- Playwright UIスモーク実測結果を記録
- 数値不一致は解消済み（テスト数/カバレッジ基準はcoverage-final.json準拠）

## 次の開発ステップ（提案）
1. カバレッジ50%達成に向けたテスト拡充（server.js / db.js / userActivity / export / 2fa）
2. UIスモーク拡張（他テーブルのCRUD、検索/フィルタ）
3. 運用前エラーハンドリング整備（認証/登録/エクスポートのUI表示）
4. Phase C候補の優先順位付け（通知連携・高度検索・レポート強化など）
