# ITSM-Sec Nexus - 次期開発ステップ計画書

**作成日**: 2026-03-02  
**バージョン**: v1.1.0 時点  
**ステータス**: システムリリース準備フェーズ完了 → 次期フェーズ移行

---

## 現状サマリー（v1.1.0 完了時点）

### 達成済み指標

| 指標 | 値 | 判定 |
|------|-----|------|
| テストカバレッジ（Statements） | 92.12% | ✅ 目標70%超達成 |
| テストカバレッジ（Branches） | 84.09% | ✅ 目標80%超達成 |
| テストカバレッジ（Functions） | 96.07% | ✅ 目標70%超達成 |
| テストカバレッジ（Lines） | 92.97% | ✅ 目標70%超達成 |
| Lintエラー | 0件 | ✅ |
| セキュリティ脆弱性（高・中） | 0件 | ✅ |
| CI Pipeline | 全通過 | ✅ |
| CD Pipeline | 正常稼働 | ✅ |
| E2Eテスト | 143/150+ passed | ⚠️ 一部flaky（既知問題） |

### 本セッションで完了したステップ

| ステップ | 内容 | PR | Issue |
|---------|------|----|-------|
| ステップ1 | 本番デプロイメント自動化 | #78 | - |
| ステップ2 | SLA/SLOメトリクスAPI実装 | #78 | #24 ✅ |
| ステップ3 | E2Eテストシャーディング（3並列化） | #78 | #22 ✅ |
| ステップ4 | フロントエンドES Modules化 | #80 | #21 ✅ |
| ステップ5 | PostgreSQL移行計画書策定 | #81 | #23 ✅ |

---

## 次期開発ステップ（優先度順）

### ステップ A: E2E Flaky テスト完全修正（優先度: 高）

**目的**: CI安定性の確保とテスト信頼性向上  
**対象ファイル**: `e2e/05-user-management.spec.ts`, `e2e/06-security-dashboard.spec.ts`, `e2e/07-other-modules.spec.ts`

**課題内容**:
- `05-user-management.spec.ts` のCRUD操作4件がシャード2/3で失敗
- `.nav-item[data-view="${viewName}"]` クリックのタイミング問題（レース条件）
- 現在は `retries: 2` で回避しているが根本解決が必要

**実装方針**:
```typescript
// 改善例: waitForSelector + stable check を追加
await page.waitForSelector('.nav-item[data-view="users"]', { state: 'visible' });
await page.waitForLoadState('networkidle');
await page.click('.nav-item[data-view="users"]');
```

**完了条件**:
- E2Eテスト 150/150 passed（retries不要）
- シャード1/2/3 全てで安定通過

---

### ステップ B: PostgreSQL本番環境移行実装（優先度: 高）

**目的**: スケーラビリティ確保（同時接続50ユーザー以上対応）  
**参照**: `Docs/postgresql-migration-plan.md`

**実装フェーズ**:

#### フェーズ1: knexfile.js 本番設定追加（1日）
```javascript
// knexfile.js に production 設定を追加
production: {
  client: 'postgresql',
  connection: {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  },
  pool: { min: 2, max: 10 }
}
```

#### フェーズ2: マイグレーション互換性確認（2-3日）
- SQLite固有構文（`AUTOINCREMENT`→`SERIAL`等）の修正
- `knex migrate:latest` での全マイグレーション通過確認

#### フェーズ3: テスト環境PostgreSQL対応（2-3日）
- `docker-compose.test.yml` でPostgreSQLコンテナ起動
- CI環境でのPostgreSQLテスト追加

#### フェーズ4: 本番切り替え（1日）
- データ移行スクリプト実行（`scripts/migrate-sqlite-to-pg.js`）
- ヘルスチェック確認後、DNSカットオーバー

**完了条件**:
- `NODE_ENV=production` でPostgreSQL接続成功
- 全統合テストがPostgreSQL環境で通過

---

### ステップ C: 監視・アラート強化（優先度: 中）

**目的**: 本番環境の可観測性向上

**実装内容**:

#### C-1: Prometheusメトリクス対応
```bash
npm install prom-client
```
- `GET /api/v1/metrics` エンドポイント追加（Prometheusスクレイピング対応）
- HTTPリクエスト数、レスポンスタイム、エラー率をメトリクス化

#### C-2: アラート通知チャネル拡張
- バックアップ失敗時メール通知実装（Issue #41）
- Slack Webhook対応（webhook URL をSecrets管理）

#### C-3: ダッシュボード可視化
- Grafanaダッシュボード設定ファイル（`monitoring/grafana/`）
- SLO達成率のリアルタイム表示

**完了条件**:
- `/api/v1/metrics` がPrometheusフォーマットで応答
- バックアップ失敗時にメール送信確認
- Grafanaダッシュボードでメトリクス表示

---

### ステップ D: フロントエンド本格ES Modules移行（優先度: 中）

**目的**: フロントエンドコードの保守性・テスト可能性向上  
**現状**: `main.js` でエントリポイントのみESM対応（後方互換ラッパー）

**実装内容**:

#### D-1: コンポーネント分割
```
frontend/
├── modules/
│   ├── incidents/      # インシデント管理モジュール
│   ├── assets/         # 資産管理モジュール
│   ├── changes/        # 変更管理モジュール
│   └── security/       # セキュリティダッシュボード
```

#### D-2: app.jsのモジュール化
- `frontend/app.js`（3000行超）をモジュールに分割
- ルーティングロジックを `frontend/core/router.js` に分離

#### D-3: フロントエンドテスト導入
- Vitest または Jest + jsdomでユニットテスト追加
- `frontend/__tests__/` ディレクトリ作成

**完了条件**:
- `app.js` が500行以下に削減
- フロントエンドテストカバレッジ 50%以上

---

### ステップ E: 本番リリース v1.2.0 準備（優先度: 高）

**目的**: v1.1.0の成果をもとに安定版リリース

**実施内容**:

#### E-1: リリースノート作成
- `CHANGELOG.md` の v1.2.0 セクション追加
- ステップA〜Dの成果を記載

#### E-2: セキュリティ最終確認
```bash
npm audit --production
npx semgrep --config auto backend/
```
- 依存関係の脆弱性0件確認
- OWASP Top 10 チェックリスト確認

#### E-3: 負荷テスト実施
```bash
npx autocannon -c 50 -d 30 https://localhost:5443/api/v1/health
```
- 同時50接続での応答時間 < 200ms 確認
- メモリリーク0件確認

#### E-4: デプロイ手順書更新
- `Docs/deployment-guide.md` 作成
- `deploy.yml` シークレット設定手順

#### E-5: GitHub Releasesタグ付け
- `v1.2.0` タグ作成とRelease Notes自動生成確認

**完了条件**:
- GitHubのv1.2.0 Releaseが自動作成される
- 本番デプロイ後のスモークテスト全通過

---

## フェーズロードマップ（v1.2.0 → v2.0.0）

```
現在 (v1.1.0)
    │
    ├── ステップA: E2E安定化 ──────────────── 1週間
    ├── ステップB: PostgreSQL移行 ──────────── 2週間
    ├── ステップC: 監視強化 ────────────────── 1週間
    │
    └── v1.2.0 リリース (ステップE) ─────── 1ヶ月後
         │
         ├── ステップD: フロントエンド本格ESM ─ 3週間
         ├── 新機能開発 (ユーザー要望対応)
         └── v2.0.0 リリース ────────────────── 3ヶ月後
```

---

## 残存オープンIssue

| Issue | タイトル | 推奨ステップ |
|-------|---------|------------|
| #1 | 自動エラー検知・修復ループ | インフラ運用（常時稼働） |

> **Note**: Issue #21, #22, #23, #24 は本セッションで全てクローズ済み。  
> Issue #1 は自動修復ワークフロー用の永続Issueのため、クローズ対象外。

---

## 技術的負債（次期対応推奨）

| 項目 | 場所 | 優先度 |
|------|------|--------|
| `app.js` 巨大化（3000行超） | `frontend/app.js` | 中 |
| E2Eテストのflaky問題 | `e2e/05-user-management.spec.ts` | 高 |
| SQLiteのWrite Lock問題（高負荷時） | `backend/database/` | 中（PostgreSQL移行で解消） |
| フロントエンドユニットテスト未整備 | `frontend/` | 低 |

---

*このドキュメントは次期開発フェーズの指針として活用してください。*  
*各ステップの実装開始時は CLAUDE.md の往復開発ループモードに従って進めてください。*
