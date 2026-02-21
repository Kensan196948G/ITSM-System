# ITSM-Sec Nexus 今後の開発予定

最終更新: 2026-02-22

## テストカバレッジ現状（2026-02-22 最新実測）

| 指標 | 現在値 | 目標 | 状態 |
|------|--------|------|------|
| Statements | **~81.5%** | 70% | ✅ 達成 |
| Branches | **~72.6%** | 70% | ✅ **達成！** |
| Functions | **82.58%** | 70% | ✅ 達成 |
| Lines | **80.61%** | 70% | ✅ 達成 |

テスト数: **2,054 pass** / 57 skip / 78 suites (2026-02-22 計測 - autoFixService追加後推計）

**全4指標で70%目標を達成！**

**主な改善内容（最新セッション）:**
- `securityAlerts.js`: 未カバー3関数（checkUnauthorizedChange/checkSecurityIncident/checkVulnerabilitySlaBreac）に11テスト追加
- `fixActions.js`: env var分岐（SLACK/TEAMS/EMAIL）+ switch case（service_restart/alert_admin）に10テスト追加
- `notificationService.js`: null入力・env var分岐・webhookチャネル型・JSONパース・at_riskタイプ等に28テスト追加
- `webhooks.js`: Branches 0% → **80.76%** 達成（52テスト追加）
- `autoFixService.js`: Stmt 46% → **94.48%**, Branch 31% → **91.39%** 達成（74テスト追加）
- `schedulerService.js`: Stmt 23.75% → **96.25%**, Branch 20.29% → **85.64%**, Func 68.08% → **97.87%** 達成（35テスト追加 - cronコールバック全網羅）
- `pdfReportService.js`: Stmt 9.19% → **99.63%**, Branch 4.76% → **84.12%**, Lines 9.5% → **100%** 達成（31テスト追加 - Knex thenable mock + writeStream error テスト）

---

## 開発フェーズ別タスク

### Phase 4: テスト・品質向上（進行中 - 82%完了）

#### 🔴 高優先度（緊急）

| タスク | 工数 | 担当 | ステータス | 備考 |
|-------|------|------|----------|------|
| Branchカバレッジ向上（65% → 70%） | 2-3週間 | - | ✅ **完了** | 70.19% 達成 |
| serviceNowService.js テスト追加 | 4時間 | - | ⏳ 保留 | 現在6.1% → 外部API Mockが必要 |
| webhooks.js テスト追加 | 6時間 | - | ✅ 完了 | 84.47% Branches 80.76% 達成 |
| pdfReportService.js テスト追加 | 4時間 | - | ✅ 完了 | 99.63% Stmt / 84.12% Branch / 100% Lines 達成 |
| schedulerService.js テスト追加 | 6時間 | - | ✅ 完了 | 96.25% Stmt / 85.64% Branch / 97.87% Func 達成 |

**カバレッジ優先対応ファイル（Branch 0%）:**

| ファイル | Stmt% | Branch% | 優先度 |
|---------|-------|---------|--------|
| `serviceNowService.js` | 6.1% | 0% | 🔴 P1 |
| `webhooks.js` | 84.47% | 80.76% | ✅ 完了 |
| `pdfReportService.js` | 99.63% | 84.12% | ✅ 完了 |
| `schedulerService.js` | 96.25% | 85.64% | ✅ 完了 |
| `autoFixService.js` | 94.48% | 91.39% | ✅ 完了 |
| `microsoftGraphService.js` | 33.33% | 100% | 🟡 P2 |

#### 🟡 中優先度（1-4週間以内）

| タスク | 工数 | 担当 | ステータス | 備考 |
|-------|------|------|----------|------|
| バックアップ失敗時のメール通知 | 4時間 | - | ⏳ 保留 | Issue #41 |
| パスワードリセットのカバレッジ向上 | 2時間 | - | ⏳ 保留 | 65% → 85%+ |
| 監査ログの充実化 | 4時間 | - | ⏳ 保留 | リセット要求段階のログ追加 |
| 57スキップテストの修復 | 4時間 | - | ⏳ 保留 | スキップ理由調査・再有効化 |

### Phase 4-Security: P0 セキュリティ Issues（最優先）

> ⚠️ 以下の GitHub Issues はセキュリティリスクがあり、早急な対応が必要です。

| Issue | タイトル | リスク | ステータス |
|-------|---------|--------|----------|
| #9 | APIキー漏洩 - Git履歴削除・ローテーション | 🔴 Critical | Open |
| #10 | JWT認証 localStorage → HttpOnly Cookie移行 | 🔴 High | Open |
| #11 | Jest globalSetup.js欠損 → カバレッジ測定誤差 | 🟡 Medium | Open |
| #12 | auto-repair.yml が main に直接Push（ガバナンス違反） | 🔴 High | Open |

### Phase 5: パフォーマンス最適化（部分完了 - 70%）

#### 🟡 中優先度（1ヶ月以内）

| タスク | 工数 | 担当 | ステータス | 備考 |
|-------|------|------|----------|------|
| SQLiteスケーラビリティ評価 | 16時間 | - | ⏳ 保留 | PostgreSQL移行計画策定 |
| N+1クエリ問題の解析・修正 | 8時間 | - | ⏳ 保留 | 一部APIで非効率なクエリ |

### Phase 6: 運用改善（未着手 - 30%）

#### 🟡 中優先度（1ヶ月以内）

| タスク | 工数 | 担当 | ステータス | 備考 |
|-------|------|------|----------|------|
| SLA/SLO定義とダッシュボード作成 | 8時間 | - | ⏳ 保留 | Issue #24 |
| 監視ダッシュボード改善 | 6時間 | - | ⏳ 保留 | リアルタイム監視機能強化 |

### Phase 7: ドキュメント整備（進行中 - 70%）

#### 🟢 低優先度（適宜実施）

| タスク | 工数 | 担当 | ステータス | 備考 |
|-------|------|------|----------|------|
| APIドキュメント自動生成 | 6時間 | - | ⏳ 保留 | Swagger/OpenAPI仕様 |
| 運用マニュアル整備 | 8時間 | - | ⏳ 保留 | 障害対応手順、トラブルシューティング |
| ドキュメントフォルダ統合 | 4時間 | - | 🔄 進行中 | docs/ + Docs/ 統合方針決定待ち |

### Phase 8: デプロイ・リリース（部分完了 - 50%）

#### 🟡 中優先度（検討）

| タスク | 工数 | 担当 | ステータス | 備考 |
|-------|------|------|----------|------|
| 本番環境構成管理 | 16時間 | - | ⏳ 保留 | Kubernetes/Docker構成標準化 |
| ロールバック手順文書化 | 4時間 | - | ⏳ 保留 | デプロイ失敗時の復旧手順 |

---

## 完了したタスク

### ✅ Phase 1-3: コア・エンタープライズ機能（完了 - 100%）

- [x] 2要素認証（2FA）実装 - AES-256-GCM暗号化 + 40+テスト (84.13%)
- [x] パスワードリセット機能 - 10/10テスト PASS
- [x] バックアップリストア機能 - 98%実装、リストア6ステップフロー完全
- [x] Microsoft 365 統合 - m365.js 統合テスト追加
- [x] integrations.js 統合テスト追加（Branches 62.68%）
- [x] Dashboard KPI CSFテストのスキップ解除

### ✅ Phase 4: テスト品質向上（部分完了 - 82%）

- [x] Statement カバレッジ 70% 目標達成（53% → 73.31%）
- [x] Function カバレッジ 70% 目標達成（58% → 78.47%）
- [x] Line カバレッジ 70% 目標達成（53% → 74.02%）
- [x] ルートフォルダ整理（2026-02-21）
  - `${HOME}/` 削除（シェル展開エラーで生成）
  - `.claude.md` 削除（旧セッションメタデータ）
  - `.mcp.json.backup.*` 削除
  - `tech-debt-summary.md` → `docs/` に移動

---

## 優先順位の判断基準

| 優先度 | 期限 | 判断基準 |
|--------|------|---------|
| 🔴 高 | 1-2週間 | セキュリティ脆弱性、重大なバグ、テスト目標達成 |
| 🟡 中 | 1-4週間 | 重要機能の改善、運用効率化 |
| 🟢 低 | 適宜 | ドキュメント、軽微な改善 |

---

## 次のアクション

### 今週（2026-02-21 ～ 2026-02-28）

1. **P0 セキュリティ Issue 対応**
   - Issue #12: auto-repair.yml の main 直接Push を PR-based flow に変更
   - Issue #10: JWT localStorage → HttpOnly Cookie 移行計画策定
   - Issue #9: APIキーローテーションと Git 履歴精査

2. **Branchカバレッジ向上（63% → 70%）**
   - `webhooks.js` 統合テスト追加（外部WebhookイベントのMock）
   - `schedulerService.js` テスト追加（node-cronのMock）
   - `serviceNowService.js` テスト追加（外部API Mock）

3. **PR #44 整理・マージ判断**
   - 現在のブランチ `feature/phase1-2-comprehensive-improvements` の最終確認

### 来週以降（2026-03-01 ～）

1. **pdfReportService.js テスト追加**（PDFKit Mock）
2. **SLA/SLO ダッシュボード実装**（Issue #24）
3. **PostgreSQL 移行計画策定**（Issue #23）

---

## 関連ドキュメント

- [CLAUDE.md](../CLAUDE.md) - 開発ルール
- [README.md](../README.md) - プロジェクト概要
- [Docs/](../Docs/) - 技術ドキュメント
- [tech-debt-summary.md](./tech-debt-summary.md) - 技術的負債サマリー

---

**最終更新: 2026-02-21 by Claude Sonnet 4.6**
