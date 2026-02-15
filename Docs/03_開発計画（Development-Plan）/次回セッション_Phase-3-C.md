# 次回セッション: Phase 3-C（エンタープライズ機能拡張）

**作成日**: 2026-02-14
**前回完了**: Phase 3-A & 3-B（テスト・品質向上）

---

## 前回セッション完了内容（要約）

- ✅ Phase 3-A: 緊急セキュリティ・バグ修正（5タスク、41分）
- ✅ Phase 3-B: テスト・品質向上（4タスク、3時間）
- ✅ テストカバレッジ: Branches 60.25%達成
- ✅ ESLint警告: 0件（100%削減）
- ✅ 運用ドキュメント: 3,225行作成
- ✅ 解決したIssue: 9件（P0: 1件、P1: 7件、P3: 1件）

---

## Phase 3-C タスク一覧

### 目標
エンタープライズ機能の追加と運用性の強化

### 主要タスク（5件）

#### 1. P1-4: 2要素認証（2FA）実装（Issue #39）

**優先度**: P1（High）
**想定工数**: 3-4日（Agent Teams活用で1日）

**実施内容**:
- TOTP（Time-based OTP）実装（speakeasy + qrcode使用）
- バックエンドAPI実装
  - POST /api/v1/auth/2fa/setup（2FA設定開始、QRコード生成）
  - POST /api/v1/auth/2fa/verify（2FA検証）
  - POST /api/v1/auth/2fa/disable（2FA無効化）
- フロントエンド実装
  - 2FA設定画面（QRコード表示、バックアップコード発行）
  - ログイン時の2FAコード入力画面
- データベーススキーマ
  - users テーブルに two_factor_enabled, two_factor_secret 追加
- テスト追加
  - ユニットテスト（2FA検証ロジック）
  - 統合テスト（API動作確認）
  - E2Eテスト（ユーザーフロー）

**完了基準**:
- [ ] 全ユーザーが2FA有効化可能
- [ ] ログイン時の2FAコード検証が正常動作
- [ ] バックアップコード発行・検証機能
- [ ] 全テストPASS

**担当Agent推奨**: sec-auditor（セキュリティ専門家）+ code-implementer

---

#### 2. P1-10: バックアップリストア機能実装（Issue #37）

**優先度**: P1（High）
**想定工数**: 2-3日（Agent Teams活用で半日〜1日）

**実施内容**:
- リストアAPI実装
  - POST /api/v1/backups/:id/restore（バックアップから復元）
  - バックアップファイルの検証（SHA-256チェック）
  - 復元前のDB自動バックアップ
  - 復元後の整合性チェック
- フロントエンド実装
  - バックアップ管理画面にリストアボタン追加
  - 復元確認ダイアログ（警告メッセージ付き）
  - 復元進捗表示
- テスト追加
  - ユニットテスト（リストアロジック）
  - 統合テスト（API動作確認、エラーケース）
  - E2Eテスト（UI操作）

**完了基準**:
- [ ] バックアップからのリストアが正常動作
- [ ] 復元前の自動バックアップ作成
- [ ] 復元後の整合性チェック実施
- [ ] 全テストPASS

**担当Agent推奨**: code-implementer + test-designer

---

#### 3. P2-17: バックアップ失敗時メール通知（Issue #41）

**優先度**: P2（Medium）
**想定工数**: 0.5日（Agent Teams活用で1-2時間）

**実施内容**:
- cron失敗時のメール通知設定
- Slackフック追加（オプション）
- 通知テンプレート作成
- テスト追加

**完了基準**:
- [ ] バックアップジョブ失敗時にメール送信
- [ ] 通知内容: エラー詳細、推奨対応、ログへのリンク

**担当Agent推奨**: ops-runbook

---

#### 4. P2-18: バックアップファイル解凍テスト実装（Issue #42）

**優先度**: P2（Medium）
**想定工数**: 0.5日（Agent Teams活用で1-2時間）

**実施内容**:
- 週次で自動解凍テスト実行
- 検証ログ記録
- テスト失敗時のアラート

**完了基準**:
- [ ] 週次cronでバックアップ解凍テスト実行
- [ ] 検証ログ記録
- [ ] テスト失敗時にアラート

**担当Agent推奨**: test-designer

---

#### 5. P2-19: SQLite整合性チェック実装（Issue #43）

**優先度**: P2（Medium）
**想定工数**: 0.5日（Agent Teams活用で1-2時間）

**実施内容**:
- 週次cronで `PRAGMA integrity_check` 実行
- 異常時アラート
- ログ記録

**完了基準**:
- [ ] 週次cronでSQLite整合性チェック実行
- [ ] 異常時にアラート送信
- [ ] ログ記録

**担当Agent推奨**: code-implementer

---

## Agent Teams 推奨構成（Phase 3-C）

### チーム名
`enterprise-features-sprint`

### メンバー（4名）

| Agent | 役割 | 担当タスク |
|-------|------|-----------|
| **sec-auditor** | セキュリティ監査 | Task #1: 2FA実装 |
| **code-implementer** | 実装担当 | Task #2: バックアップリストア実装 |
| **test-designer** | テスト設計 | Task #4: バックアップ解凍テスト |
| **ops-runbook** | 運用手順書 | Task #3: バックアップ失敗通知、Task #5: SQLite整合性チェック |

### 想定所要時間
- **最速**: 2-3時間（並列実行）
- **通常**: 4-5時間（2FA実装が時間かかる場合）

---

## 次回セッション開始時の手順

1. **前回レポート確認**
   - `Docs/Phase-3-A-B-Completion-Report.md` を確認
   - Phase 3-A & 3-Bの成果を把握

2. **Phase 3-C開始**
   - TeamCreate で `enterprise-features-sprint` チーム作成
   - TaskCreate で5タスク作成
   - 4名のAgent起動
   - タスク割り当て・並列実行

3. **完了後**
   - 統合レビュー
   - テスト実行
   - 統合コミット作成
   - PR #44 更新

---

## 参考リンク

- **完了レポート**: [Docs/Phase-3-A-B-Completion-Report.md](../Phase-3-A-B-Completion-Report.md)
- **PR #44**: https://github.com/Kensan196948G/ITSM-System/pull/44
- **CLAUDE.md**: 開発ルール・Agent Teamsポリシー
- **Issue一覧**: https://github.com/Kensan196948G/ITSM-System/issues

---

**次回セッション準備完了！**
