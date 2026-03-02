# 📋 GitHub Issues登録用テンプレート（P0〜P2課題 15件）

**作成日**: 2026-01-09
**分析基盤**: 全7つのSubAgent並列実行
**リポジトリ**: Kensan196948G/ITSM-System

---

## 🚀 一括登録手順

### 方法1: GitHub CLI使用（推奨・自動）

```bash
# P0課題（5件）
gh issue create --title "🔴 [P0-1] APIキーのローテーションとGit履歴からの完全削除" --body-file issues/p0-1.md --label "security,P0,critical"
gh issue create --title "🔴 [P0-2] JWT認証をLocalStorageからHttpOnly Cookieへ移行" --body-file issues/p0-2.md --label "security,P0,critical,authentication"
gh issue create --title "🔴 [P0-3] Jest globalSetup.js欠損によるテストカバレッジ測定不可を修復" --body-file issues/p0-3.md --label "testing,P0,critical,ci-cd"
gh issue create --title "🔴 [P0-4] auto-repair.ymlのmain直接プッシュをPRベースに変更" --body-file issues/p0-4.md --label "ci-cd,P0,critical,security"
gh issue create --title "✅ [P0-5] itsm-frontend.service 127.0.0.1バインド（完了）" --body-file issues/p0-5.md --label "security,P0,completed"

# P1課題（6件）
gh issue create --title "🟠 [P1-1] デフォルトパスワードのハードコードを修正" --body-file issues/p1-1.md --label "security,P1,high"
gh issue create --title "🟠 [P1-2] 開発ログからのシークレット除去" --body-file issues/p1-2.md --label "security,P1,high"
gh issue create --title "🟠 [P1-3] 構造化ロギング導入（Winston）" --body-file issues/p1-3.md --label "refactor,P1,high"
gh issue create --title "🟠 [P1-4] テストカバレッジ60%達成" --body-file issues/p1-4.md --label "testing,P1,high"
gh issue create --title "🟠 [P1-5] CI/CDロールバック手順作成" --body-file issues/p1-5.md --label "ci-cd,P1,high,documentation"
gh issue create --title "🟠 [P1-6] 緊急時対応Runbook 5件作成" --body-file issues/p1-6.md --label "operations,P1,high,documentation"

# P2課題（5件）
gh issue create --title "🟡 [P2-1] GitHub Actions Secrets活用" --body-file issues/p2-1.md --label "ci-cd,P2,medium,security"
gh issue create --title "🟡 [P2-2] フロントエンドES Modules化" --body-file issues/p2-2.md --label "refactor,P2,medium,frontend"
gh issue create --title "🟡 [P2-3] E2Eテストシャーディング実装" --body-file issues/p2-3.md --label "testing,P2,medium,performance"
gh issue create --title "🟡 [P2-4] PostgreSQL移行計画策定" --body-file issues/p2-4.md --label "database,P2,medium,architecture"
gh issue create --title "🟡 [P2-5] SLA/SLO定義とダッシュボード作成" --body-file issues/p2-5.md --label "operations,P2,medium,monitoring"
```

### 方法2: GitHub Web UI使用（手動）

1. https://github.com/Kensan196948G/ITSM-System/issues/new にアクセス
2. 以下の各Issueテンプレートをコピー＆ペースト
3. ラベルとマイルストーンを設定

---

# 🔴 P0課題（Critical - 即時対応必須）

## Issue #1: 🔴 [P0-1] APIキーのローテーションとGit履歴からの完全削除

**ラベル**: `security`, `P0`, `critical`
**マイルストーン**: v1.1.0
**推定工数**: 25分

### 概要

`.mcp.json`に本番APIキーが平文で保存されており、Gitリポジトリにコミットされていた可能性があります。

**Quick Win対応済み**:
- ✅ `.mcp.json`を`.gitignore`に追加（コミット e1e3030）
- ✅ セキュリティ警告ドキュメント作成（`SECURITY_API_KEY_ROTATION_REQUIRED.md`）

**残作業**:
- ❌ 漏洩した可能性のあるAPIキーの無効化
- ❌ 新しいAPIキーの発行と環境変数への設定
- ❌ Git履歴から`.mcp.json`の完全削除

### 🔑 漏洩した可能性のあるAPIキー

1. **Brave Search API**: `***REDACTED***`
2. **Context7 API**: `***REDACTED***`
3. **GitHub PAT**: `your_github_token_here`（プレースホルダー）

### ✅ 対応手順

#### ステップ1: 古いキーの無効化（即座）
```bash
# 各サービスの管理画面でAPIキーを Revoke/Delete
```

#### ステップ2: 新しいキーの発行と環境変数設定
```bash
cat > .env.local <<'EOF'
BRAVE_API_KEY=<新しいBrave APIキー>
CONTEXT7_API_KEY=<新しいContext7 APIキー>
GITHUB_PERSONAL_ACCESS_TOKEN=<新しいGitHub PAT>
EOF

chmod 600 .env.local
```

#### ステップ3: Git履歴からの完全削除
```bash
# BFG Repo-Cleaner を使用（推奨）
bfg --delete-files .mcp.json

# 強制プッシュ（⚠️ チーム全員に事前通知！）
git push origin --force --all
git push origin --force --tags
```

### 完了チェックリスト
- [ ] Brave Search APIキー無効化完了
- [ ] Context7 APIキー無効化完了
- [ ] GitHub PAT無効化完了（該当する場合）
- [ ] 新しいAPIキー発行完了
- [ ] 環境変数設定完了（.env.local）
- [ ] .mcp.jsonをGit履歴から削除完了
- [ ] 強制プッシュ完了（チームへ通知済み）
- [ ] 漏洩確認（GitHub検索）完了

**発見元**: 🔒 sec-auditor (Opus 4.5)

---

## Issue #2: 🔴 [P0-2] JWT認証をLocalStorageからHttpOnly Cookieへ移行

**ラベル**: `security`, `P0`, `critical`, `authentication`
**マイルストーン**: v1.1.0
**推定工数**: 3-5時間

### 概要

現在、JWTトークンが`localStorage`に保存されており、XSS攻撃に対して脆弱です。

**重要発見**: バックエンドでは**既にHttpOnly Cookie実装済み**であり、フロントエンド側の修正のみで対応可能。

### 現在の問題

```javascript
// frontend/app.js:927
localStorage.setItem(TOKEN_KEY, authToken);  // ← XSS脆弱性
```

### 既存実装（バックエンド）

```javascript
// backend/routes/auth/login.js:57-62
res.cookie('token', result.token, {
  httpOnly: true,  // ✅ 実装済み
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 24 * 60 * 60 * 1000
});
```

### 対応方針

#### 1. localStorage使用箇所の削除
```javascript
// 削除対象
localStorage.setItem(TOKEN_KEY, authToken);
localStorage.getItem(TOKEN_KEY);
localStorage.removeItem(TOKEN_KEY);
```

#### 2. API呼び出し時にCredentials追加
```javascript
fetch('/api/v1/...', {
  credentials: 'include',  // 必須！
  headers: { 'Content-Type': 'application/json' }
});
```

#### 3. CORS設定更新
```javascript
// backend/server.js
app.use(cors({
  origin: ['http://localhost:5050', 'https://your-domain.com'],
  credentials: true  // 必須！
}));
```

### 完了チェックリスト
- [ ] フロントエンドのlocalStorage使用箇所を削除
- [ ] すべてのfetch呼び出しに`credentials: 'include'`追加
- [ ] CORS設定に`credentials: true`追加
- [ ] 認証状態判定ロジックを変更
- [ ] 単体テスト追加/更新
- [ ] E2Eテスト追加/更新
- [ ] 手動テスト完了（ログイン/ログアウト/リロード）
- [ ] セキュリティテスト（XSS対策確認）

**発見元**: 🔒 sec-auditor, 🏗️ arch-reviewer, 📋 spec-planner

---

## Issue #3: 🔴 [P0-3] Jest globalSetup.js欠損によるテストカバレッジ測定不可を修復

**ラベル**: `testing`, `P0`, `critical`, `ci-cd`
**マイルストーン**: v1.1.0
**推定工数**: 1時間

### 概要

`jest.config.js`で参照されている`globalSetup.js`が存在せず、テストカバレッジ測定が失敗しています。

### エラー内容
```javascript
// jest.config.js:3
globalSetup: './backend/__tests__/globalSetup.js',  // ← ファイルが存在しない
```

### 影響
- ❌ `npm run test:coverage`が失敗
- ❌ CI/CDパイプラインのカバレッジ測定が動作していない
- ❌ 正確なテストカバレッジが把握できない

### 対応方針

```javascript
// backend/__tests__/globalSetup.js（新規作成）
module.exports = async () => {
  console.log('🧪 Global test setup started...');

  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-jwt-secret-for-testing-only';
  process.env.DATABASE_PATH = ':memory:';

  console.log('✅ Global test setup completed');
};
```

### 完了チェックリスト
- [ ] `globalSetup.js`作成完了
- [ ] `globalTeardown.js`作成完了（推奨）
- [ ] `npm run test:coverage`成功確認
- [ ] CI/CDパイプラインで緑化確認
- [ ] カバレッジレポートが正常に生成されることを確認

**発見元**: 📋 spec-planner, 🧪 test-designer

---

## Issue #4: 🔴 [P0-4] auto-repair.ymlのmain直接プッシュをPRベースに変更

**ラベル**: `ci-cd`, `P0`, `critical`, `security`
**マイルストーン**: v1.1.0
**推定工数**: 2時間

### 概要

`.github/workflows/auto-repair.yml`が自動修復後に`main`ブランチへ直接プッシュしており、誤ったコードが本番環境に混入するリスクがあります。

### 危険なコード
```yaml
- name: Push changes
  run: |
    git push origin main  # ← 危険！レビューなし
```

### リスク
- 🔴 自動修復が誤ったコードをmainに直接プッシュ
- 🔴 レビュープロセスをバイパス
- 🔴 保護ブランチ設定が無効化

### 対応方針

```yaml
# PRベースのフローに変更
- name: Create Pull Request
  uses: peter-evans/create-pull-request@v5
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    commit-message: "fix: auto-repair applied"
    branch: auto-repair/${{ github.run_id }}
    title: "🤖 Auto-Repair: ${{ github.event.head_commit.message }}"
    labels: auto-repair,bot
```

### 保護ブランチ設定（推奨）
```
GitHub Settings → Branches → main
✅ Require a pull request before merging
✅ Require approvals (1)
✅ Require status checks to pass
```

### 完了チェックリスト
- [ ] `create-pull-request`アクション導入
- [ ] 直接プッシュコードを削除
- [ ] 保護ブランチ設定（main）
- [ ] 手動トリガーでテスト実行
- [ ] PRが正常に作成されることを確認
- [ ] CI/CDが正常に動作することを確認

**発見元**: 🔒 sec-auditor, 🔧 ci-specialist

---

## Issue #5: ✅ [P0-5] itsm-frontend.service 127.0.0.1バインド（完了）

**ラベル**: `security`, `P0`, `completed`
**ステータス**: Closed
**実施時間**: 5分

### 完了報告

この課題は**Quick Win 3**として既に対応済みです。

### 変更内容
```diff
- ExecStart=/usr/bin/python3 -m http.server 5050 --bind 0.0.0.0
+ ExecStart=/usr/bin/python3 -m http.server 5050 --bind 127.0.0.1
```

### 効果
- ✅ 全ネットワークインターフェースからのアクセスを防止
- ✅ ローカルホストからのみアクセス可能
- ✅ ネットワーク攻撃面を大幅に削減

**コミット**: e1e3030
**発見元**: 🔒 sec-auditor, 📚 ops-runbook

---

# 🟠 P1課題（High - 1週間以内対応）

## Issue #6: 🟠 [P1-1] デフォルトパスワードのハードコードを修正

**ラベル**: `security`, `P1`, `high`
**マイルストーン**: v1.1.0
**推定工数**: 2-3時間

### 概要

データベースシードファイル（`backend/db.js`）に推測可能なデフォルトパスワードがハードコードされています。

### 問題のコード
```javascript
// backend/db.js:113-116
const adminHash = bcrypt.hashSync('admin123', 10);      // ← 推測可能
const managerHash = bcrypt.hashSync('manager123', 10);  // ← 推測可能
const analystHash = bcrypt.hashSync('analyst123', 10);  // ← 推測可能
const viewerHash = bcrypt.hashSync('viewer123', 10);    // ← 推測可能
```

### リスク
- 🔴 推測可能なデフォルトパスワード
- 🔴 初期セットアップ後の強制変更機能なし
- 🔴 攻撃者が簡単に管理者権限を取得可能

### 対応方針

#### 1. 初回ログイン時の強制パスワード変更
```javascript
// backend/middleware/forcePasswordChange.js（新規）
const forcePasswordChange = (req, res, next) => {
  if (req.user.password_must_change) {
    return res.status(403).json({
      error: 'パスワードの変更が必要です',
      redirect: '/change-password'
    });
  }
  next();
};
```

#### 2. ランダムパスワード生成
```javascript
const crypto = require('crypto');
const generateRandomPassword = () => {
  return crypto.randomBytes(16).toString('hex');
};

const adminPassword = generateRandomPassword();
console.log(`Admin password: ${adminPassword}`);  // 初回のみ表示
```

#### 3. 環境変数からパスワード読み込み
```bash
# .env
ADMIN_PASSWORD=<ランダムパスワード>
MANAGER_PASSWORD=<ランダムパスワード>
```

### 完了チェックリスト
- [ ] 強制パスワード変更機能実装
- [ ] ランダムパスワード生成機能実装
- [ ] 環境変数からパスワード読み込み
- [ ] パスワードポリシー強化（最小12文字、複雑性要件）
- [ ] 初回ログイン時の警告メッセージ表示
- [ ] セキュリティテスト完了

**発見元**: 🔒 sec-auditor

---

## Issue #7: 🟠 [P1-2] 開発ログからのシークレット除去

**ラベル**: `security`, `P1`, `high`
**マイルストーン**: v1.1.0
**推定工数**: 1-2時間

### 概要

開発環境でパスワードリセットトークンがログ出力されており、セキュリティリスクがあります。

### 問題のコード
```javascript
// backend/routes/auth/passwordReset.js:104-109
if (process.env.NODE_ENV === 'development') {
  console.log(`Reset token = ${tokenInfo.token}`);  // ← 機密情報漏洩
  console.log(`Reset URL: https://192.168.0.187:5050/reset-password?token=${tokenInfo.token}`);
}
```

### リスク
- 🟡 開発環境でもセキュリティリスク
- 🟡 ログファイルに機密情報が残る
- 🟡 誤って本番環境で有効化される可能性

### 対応方針

#### 1. トークンの部分マスキング
```javascript
// 変更前
console.log(`Reset token = ${tokenInfo.token}`);

// 変更後
console.log(`Reset token created: ${tokenInfo.token.substring(0, 8)}...`);
```

#### 2. デバッグモード専用フラグ導入
```javascript
if (process.env.DEBUG_TOKENS === 'true') {
  // 開発者が明示的に有効化した場合のみ
  console.log(`Reset token = ${tokenInfo.token}`);
}
```

### 完了チェックリスト
- [ ] トークンログ出力を部分マスキングに変更
- [ ] または完全削除
- [ ] 他のシークレットログ出力を確認
- [ ] セキュリティテスト完了

**発見元**: 🔒 sec-auditor, 💻 code-implementer

---

## Issue #8: 🟠 [P1-3] 構造化ロギング導入（Winston）

**ラベル**: `refactor`, `P1`, `high`
**マイルストーン**: v1.1.0
**推定工数**: 4-6時間

### 概要

現在`console.log`が603箇所で使用されており、構造化ロギングが未導入です。

### 問題
- ❌ ログレベル管理困難
- ❌ 機密情報漏洩リスク
- ❌ 本番環境での検索・分析困難

### 対応方針

#### 1. Winston導入
```bash
npm install winston
```

#### 2. Logger設定
```javascript
// backend/utils/logger.js（新規）
const winston = require('winston');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

module.exports = logger;
```

#### 3. console.*をloggerへ置換
```javascript
// 変更前
console.error('Database error:', err);

// 変更後
logger.error('Database operation failed', {
  operation: 'SELECT',
  table: 'assets',
  error: err.message,
  userId: req.user?.id
});
```

### 完了チェックリスト
- [ ] Winston導入・設定完了
- [ ] 全console.*をloggerへ置換（603箇所）
- [ ] ログレベル設定（dev: debug, prod: warn）
- [ ] ファイルローテーション設定
- [ ] 機密情報フィルタリング実装
- [ ] 監査ログとの統合

**発見元**: 🔒 sec-auditor, 💻 code-implementer

---

## Issue #9: 🟠 [P1-4] テストカバレッジ60%達成

**ラベル**: `testing`, `P1`, `high`
**マイルストーン**: v1.1.0
**推定工数**: 8-12時間

### 概要

現在カバレッジ30%（推定）。60%を目標にテスト拡充。

### カバレッジギャップ

#### Critical（優先度高）
1. **schedulerService.js** (25,212バイト) - テスト未実装
2. **pdfReportService.js** (24,284バイト) - テスト未実装
3. **serviceNowService.js** (18,172バイト) - テスト未実装
4. **webhooks.js** (17,012バイト) - テスト未実装

#### 推奨テストケース（Top 7）
1. スケジューラーサービステスト
2. PDFレポートサービステスト
3. Webhook統合テスト
4. マルチテナント機能テスト
5. RBAC詳細テスト
6. 統合エンドポイント単体テスト
7. レート制限とセキュリティミドルウェア

### 完了チェックリスト
- [ ] schedulerServiceテスト作成
- [ ] pdfReportServiceテスト作成
- [ ] webhooksテスト作成
- [ ] multiTenantServiceテスト作成
- [ ] カバレッジ60%達成確認
- [ ] CI/CDでカバレッジ自動測定

**発見元**: 📋 spec-planner, 🧪 test-designer

---

## Issue #10: 🟠 [P1-5] CI/CDロールバック手順作成

**ラベル**: `ci-cd`, `P1`, `high`, `documentation`
**マイルストーン**: v1.1.0
**推定工数**: 3時間

### 概要

現在のリリースプロセスは前進のみで、ロールバック手順が文書化されていません。

### 問題
- ❌ 問題のあるリリースの取り消し手順なし
- ❌ 以前のバージョンへの復元手順なし
- ❌ リリース失敗時のクリーンアップなし

### 対応方針

#### 1. ロールバックワークフロー作成
```yaml
# .github/workflows/rollback.yml（新規）
name: Rollback Release
on:
  workflow_dispatch:
    inputs:
      target_version:
        description: 'Rollback to version (e.g., 1.2.3)'
        required: true

jobs:
  rollback:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout target version
        run: git checkout tags/v${{ github.event.inputs.target_version }}

      - name: Deploy
        run: ./scripts/deploy.sh
```

#### 2. ロールバック手順ドキュメント
```markdown
# docs/ROLLBACK_PROCEDURES.md（新規）

## 緊急ロールバック手順

### 即座ロールバック（5分以内）
1. GitHub Actions → Rollback Release実行
2. target_version入力（例: 1.2.3）
3. 実行完了を確認

### 手動ロールバック
...
```

### 完了チェックリスト
- [ ] `rollback.yml`ワークフロー作成
- [ ] ロールバック手順ドキュメント作成
- [ ] データベースマイグレーションロールバック手順
- [ ] テスト実行（Dry-run）
- [ ] チームへの周知

**発見元**: 🔧 ci-specialist, 📚 ops-runbook

---

## Issue #11: 🟠 [P1-6] 緊急時対応Runbook 5件作成

**ラベル**: `operations`, `P1`, `high`, `documentation`
**マイルストーン**: v1.1.0
**推定工数**: 4-6時間

### 概要

緊急時対応手順（Runbook）が未整備です。

### 必要なRunbook（5件）

#### 1. サービス完全停止対応Runbook
- 検知方法（Prometheus, ヘルスチェック）
- 初動対応（systemctl, journalctl）
- 復旧手順

#### 2. データベース障害対応Runbook
- WALチェックポイント強制実行
- バックアップから復旧
- 緊急時VACUUM

#### 3. パフォーマンス劣化対応Runbook
- キャッシュクリア
- データベース最適化
- プロセス再起動

#### 4. セキュリティインシデント対応Runbook
- 攻撃元IP特定・ブロック
- 侵害アカウント無効化
- 証拠保全

#### 5. バックアップ失敗対応Runbook
- ディスク容量確認
- 手動バックアップ実行
- リモートバックアップ確認

### 完了チェックリスト
- [ ] Runbook #1作成（サービス停止）
- [ ] Runbook #2作成（DB障害）
- [ ] Runbook #3作成（パフォーマンス）
- [ ] Runbook #4作成（セキュリティ）
- [ ] Runbook #5作成（バックアップ）
- [ ] エスカレーションフロー策定
- [ ] 連絡先リスト整備

**発見元**: 📚 ops-runbook

---

# 🟡 P2課題（Medium - 1ヶ月以内対応）

## Issue #12: 🟡 [P2-1] GitHub Actions Secrets活用

**ラベル**: `ci-cd`, `P2`, `medium`, `security`
**マイルストーン**: v1.1.0
**推定工数**: 2時間

### 概要

CI/CDワークフローでJWT_SECRETが固定値でハードコードされています。

### 問題のコード
```yaml
# .github/workflows/ci.yml:20
JWT_SECRET: test-secret-key-for-ci-pipeline-only-do-not-use-in-production
```

### 対応方針
```yaml
# GitHub Secretsを使用
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET_TEST }}
```

### 完了チェックリスト
- [ ] GitHub Secretsに`JWT_SECRET_TEST`追加
- [ ] 全ワークフローでSecrets使用
- [ ] ハードコード削除確認

**発見元**: 🔒 sec-auditor, 🔧 ci-specialist

---

## Issue #13: 🟡 [P2-2] フロントエンドES Modules化

**ラベル**: `refactor`, `P2`, `medium`, `frontend`
**マイルストーン**: v1.2.0
**推定工数**: 12-16時間

### 概要

`app.js`が13,170行の巨大ファイルで、保守性が低下しています。

### 問題
- ❌ 13,170行のモノリシック構造
- ❌ 複数開発者のマージコンフリクト頻発
- ❌ ブラウザパフォーマンス劣化

### 対応方針
```
app.js (13,170行)
  ↓ リファクタリング
  - core/auth.js
  - core/api.js
  - modules/dashboard.js
  - modules/incidents.js
  - components/charts.js
  - utils/dom.js
```

**発見元**: 📋 spec-planner, 💻 code-implementer

---

## Issue #14: 🟡 [P2-3] E2Eテストシャーディング実装

**ラベル**: `testing`, `P2`, `medium`, `performance`
**マイルストーン**: v1.1.0
**推定工数**: 4時間

### 概要

Playwrightは`workers: 1`でシーケンシャル実行しており、実行時間が長いです。

### 対応方針
```yaml
strategy:
  matrix:
    shard: [1, 2, 3, 4]
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/4
```

**効果**: E2E実行時間 **最大75%削減** (30分→7.5分)

**発見元**: 🔧 ci-specialist, 🧪 test-designer

---

## Issue #15: 🟡 [P2-4] PostgreSQL移行計画策定

**ラベル**: `database`, `P2`, `medium`, `architecture`
**マイルストーン**: v1.2.0
**推定工数**: 16-24時間

### 概要

本番環境でSQLiteを使用しており、同時接続とスケーラビリティに制約があります。

### SQLite制約
- 同時書き込み: 10件/秒が上限
- 同時接続: 10接続程度
- 推定キャパシティ: 〜50ユーザー

### 移行戦略
1. Knex.js ORMで抽象化済み ✅
2. マイグレーションファイル管理済み ✅
3. PostgreSQL設定追加
4. データ移行（pg_dump/restore）
5. パフォーマンステスト

**推定ダウンタイム**: 1〜2時間

**発見元**: 📋 spec-planner, 🏗️ arch-reviewer

---

## Issue #16: 🟡 [P2-5] SLA/SLO定義とダッシュボード作成

**ラベル**: `operations`, `P2`, `medium`, `monitoring`
**マイルストーン**: v1.1.0
**推定工数**: 6-8時間

### 概要

SLA/SLO（サービスレベル目標）が未定義で、サービス品質目標が不明確です。

### 推奨SLI/SLO

| サービス | SLI | 目標値 |
|---------|-----|--------|
| API可用性 | Uptime % | 99.5% |
| 応答時間 | P95レスポンスタイム | < 500ms |
| エラー率 | 5xxエラー率 | < 1% |

### Grafanaダッシュボード
- 月次可用性SLA（ゲージ）
- エラーバジェット残量
- インシデント解決時間（ヒストグラム）

**発見元**: 📚 ops-runbook

---

# 📊 サマリー

## 優先度別課題数
- 🔴 **P0 (Critical)**: 5件（うち1件完了）
- 🟠 **P1 (High)**: 6件
- 🟡 **P2 (Medium)**: 5件
- **合計**: 16件（実作業15件）

## 推定総工数
- **P0**: 11.4時間
- **P1**: 23.5時間
- **P2**: 42時間
- **合計**: 約77時間（約2週間）

## マイルストーン
- **v1.1.0 (Security First)**: P0〜P1完了目標（4週間）
- **v1.2.0 (Quality Boost)**: P2完了目標（6週間）

---

**作成基盤**: 全7つのSubAgent並列実行
**分析時間**: 約40分
**ドキュメント作成**: 2026-01-09
