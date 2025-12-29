# Phase A: 開発環境構築フェーズ - 詳細開発工程

**フェーズ目的**: 本番環境への移行準備として、開発環境で全機能を完成させ、品質保証体制を確立する

**開始条件**: セキュリティ基盤完成（JWT認証、RBAC、XSS対策実装済み）
**完了条件**: テストカバレッジ70%以上、全機能実装、CI/CD稼働
**想定期間**: 4-6週間
**現在の完成度**: 約65%

---

## A-1: テスト環境構築（Week 1-2）

### A-1-1: テストフレームワーク選定・導入

**工数**: 2日

**実施内容**:
1. Jestインストールと設定
   ```bash
   npm install --save-dev jest supertest @types/jest
   ```

2. jest.config.js作成
   ```javascript
   module.exports = {
     testEnvironment: 'node',
     coverageDirectory: 'coverage',
     collectCoverageFrom: [
       'backend/**/*.js',
       '!backend/node_modules/**'
     ],
     coverageThreshold: {
       global: {
         branches: 70,
         functions: 70,
         lines: 70,
         statements: 70
       }
     }
   };
   ```

3. package.json更新
   ```json
   "scripts": {
     "test": "jest --coverage",
     "test:watch": "jest --watch",
     "test:unit": "jest --testPathPattern=unit",
     "test:integration": "jest --testPathPattern=integration"
   }
   ```

**成果物**:
- `jest.config.js`
- 更新された`package.json`
- `/backend/__tests__/`ディレクトリ構造

---

### A-1-2: ユニットテストの実装

**工数**: 5日

**実施内容**:

#### 認証ミドルウェアのテスト
**ファイル**: `backend/__tests__/unit/middleware/auth.test.js`

```javascript
const { authenticateJWT, authorize } = require('../../../middleware/auth');
const jwt = require('jsonwebtoken');

describe('Authentication Middleware', () => {
  describe('authenticateJWT', () => {
    it('有効なトークンで認証成功', () => {
      // テストコード
    });

    it('無効なトークンで401エラー', () => {
      // テストコード
    });

    it('トークンなしで401エラー', () => {
      // テストコード
    });
  });

  describe('authorize', () => {
    it('管理者ロールでアクセス許可', () => {
      // テストコード
    });

    it('権限不足で403エラー', () => {
      // テストコード
    });
  });
});
```

#### バリデーションのテスト
**ファイル**: `backend/__tests__/unit/middleware/validation.test.js`

テスト項目:
- 空値チェック
- 長さ制限チェック
- 型チェック
- ホワイトリスト検証

#### データベース層のテスト
**ファイル**: `backend/__tests__/unit/db.test.js`

テスト項目:
- テーブル作成
- シードデータ挿入
- CRUD操作

**目標カバレッジ**: 70%以上

**成果物**:
- 30個以上のユニットテストケース
- カバレッジレポート

---

### A-1-3: 統合テストの実装

**工数**: 4日

**実施内容**:

#### APIエンドポイント統合テスト
**ファイル**: `backend/__tests__/integration/api.test.js`

```javascript
const request = require('supertest');
const app = require('../../server');

describe('API Integration Tests', () => {
  let authToken;

  beforeAll(async () => {
    // テストユーザーでログイン
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ username: 'admin', password: 'admin123' });
    authToken = res.body.token;
  });

  describe('GET /api/v1/incidents', () => {
    it('認証なしで401エラー', async () => {
      const res = await request(app).get('/api/v1/incidents');
      expect(res.statusCode).toEqual(401);
    });

    it('認証ありでインシデント一覧取得', async () => {
      const res = await request(app)
        .get('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`);
      expect(res.statusCode).toEqual(200);
      expect(Array.isArray(res.body)).toBe(true);
    });
  });

  describe('POST /api/v1/incidents', () => {
    it('有効なデータでインシデント作成', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test Incident',
          priority: 'High',
          description: 'Test description'
        });
      expect(res.statusCode).toEqual(201);
      expect(res.body).toHaveProperty('id');
    });

    it('無効なデータで400エラー', async () => {
      const res = await request(app)
        .post('/api/v1/incidents')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ title: '' }); // 空タイトル
      expect(res.statusCode).toEqual(400);
    });
  });
});
```

**テスト対象エンドポイント**:
- 全認証エンドポイント（login, register, me）
- インシデント管理（CRUD）
- 変更管理（CRUD）
- 資産管理（Read）
- ダッシュボード（KPI）

**成果物**:
- 50個以上の統合テストケース
- APIテストカバレッジレポート

---

### A-1-4: E2Eテストの実装

**工数**: 3日

**実施内容**:

#### Playwrightセットアップ
```bash
npm install --save-dev @playwright/test
npx playwright install
```

#### E2Eテストシナリオ
**ファイル**: `e2e/login.spec.js`

```javascript
const { test, expect } = require('@playwright/test');

test.describe('Login Flow', () => {
  test('ログイン成功シナリオ', async ({ page }) => {
    await page.goto('http://localhost:5050/index.html');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'admin123');
    await page.click('button[type="submit"]');

    // ログイン後のダッシュボード表示確認
    await expect(page.locator('#section-title')).toContainText('ダッシュボード');
  });

  test('ログイン失敗シナリオ', async ({ page }) => {
    await page.goto('http://localhost:5050/index.html');
    await page.fill('#username', 'admin');
    await page.fill('#password', 'wrongpassword');
    await page.click('button[type="submit"]');

    // エラーメッセージ表示確認
    await expect(page.locator('#login-error')).toBeVisible();
  });
});
```

**テストシナリオ**:
- ログイン/ログアウトフロー
- インシデント作成フロー
- RFC申請・承認フロー
- ナビゲーション操作
- レスポンシブ表示

**成果物**:
- 15個のE2Eテストシナリオ
- スクリーンショット証跡

---

## A-2: コード品質向上（Week 2-3）

### A-2-1: ESLint導入

**工数**: 1日

**実施内容**:
```bash
npm install --save-dev eslint eslint-config-airbnb-base eslint-plugin-import
npx eslint --init
```

**.eslintrc.json**:
```json
{
  "env": {
    "node": true,
    "es2021": true,
    "jest": true
  },
  "extends": "airbnb-base",
  "parserOptions": {
    "ecmaVersion": 12
  },
  "rules": {
    "no-console": "warn",
    "no-unused-vars": "error",
    "consistent-return": "error",
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

**Lintチェック対象**:
- `backend/**/*.js`
- `app.js`
- テストファイル

**成果物**:
- `.eslintrc.json`
- Lint修正済みコード

---

### A-2-2: Prettier導入

**工数**: 半日

**実施内容**:
```bash
npm install --save-dev prettier eslint-config-prettier
```

**.prettierrc**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false
}
```

**package.json追加**:
```json
"scripts": {
  "format": "prettier --write \"backend/**/*.js\" \"*.js\"",
  "lint": "eslint backend/**/*.js *.js",
  "lint:fix": "eslint backend/**/*.js *.js --fix"
}
```

**成果物**:
- `.prettierrc`
- フォーマット済みコード

---

### A-2-3: TypeScript移行検討

**工数**: 2日（調査・部分移行）

**実施内容**:
1. TypeScript導入可否検討
2. 型定義ファイル作成（.d.ts）
3. 重要モジュールの段階的移行

**成果物**:
- TypeScript移行計画書
- 型定義ファイル（オプション）

---

## A-3: 機能完成度向上（Week 3-4）

### A-3-1: モーダルダイアログ実装

**工数**: 3日

**実施内容**:

#### インシデント詳細モーダル
**機能**:
- インシデント詳細表示
- インライン編集
- ステータス更新
- 履歴表示

**ファイル**: `app.js` - `showIncidentDetailModal()`関数

```javascript
function showIncidentDetailModal(incident) {
  const modal = document.getElementById('modal-container');
  const modalBody = document.getElementById('modal-body');

  clearElement(modalBody);

  // タイトル表示（XSS安全）
  const titleInput = createEl('input', {
    type: 'text',
    className: 'form-control',
    value: incident.title
  });
  modalBody.appendChild(createEl('label', { textContent: 'タイトル' }));
  modalBody.appendChild(titleInput);

  // 優先度選択
  // ... 以下省略

  modal.style.display = 'flex';
}
```

#### RFC作成・承認モーダル
**機能**:
- RFC作成フォーム
- 資産選択
- 影響度評価
- 承認ワークフロー

**成果物**:
- インシデント詳細モーダル
- インシデント作成モーダル
- RFC作成モーダル
- RFC承認モーダル

---

### A-3-2: フォームバリデーション強化

**工数**: 2日

**実施内容**:
- リアルタイムバリデーション
- エラーメッセージ表示
- 必須項目ハイライト
- 送信前チェック

**成果物**:
- `formValidator.js` ユーティリティ
- バリデーション済みフォーム

---

### A-3-3: エラーハンドリング・ユーザーフィードバック

**工数**: 2日

**実施内容**:

#### トースト通知システム
```javascript
function showToast(message, type = 'info') {
  const toast = createEl('div', {
    className: `toast toast-${type}`,
    textContent: message
  });
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
```

#### ローディングスピナー
```javascript
function showLoading() {
  const spinner = createEl('div', { className: 'loading-spinner' });
  document.body.appendChild(spinner);
}
```

**成果物**:
- トースト通知システム
- ローディングインジケーター
- エラーバウンダリ

---

### A-3-4: データテーブル機能強化

**工数**: 3日

**実施内容**:
- ページネーション
- ソート機能
- フィルタリング
- 検索機能
- CSV/Excelエクスポート

**成果物**:
- `dataTable.js` コンポーネント
- ページネーション実装

---

## A-4: ドキュメント整備（Week 4）

### A-4-1: OpenAPI仕様書生成

**工数**: 3日

**実施内容**:
```bash
npm install swagger-jsdoc swagger-ui-express
```

**backend/swagger.js**:
```javascript
const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'ITSM-Sec Nexus API',
      version: '1.0.0',
      description: 'ISO 20000 & NIST CSF 2.0統合管理API',
    },
    servers: [
      { url: 'http://localhost:5000/api/v1' },
      { url: 'http://192.168.0.187:5000/api/v1' }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: ['./backend/*.js', './backend/**/*.js'],
};

const specs = swaggerJsdoc(options);
module.exports = specs;
```

**JSDocコメント追加**:
```javascript
/**
 * @swagger
 * /incidents:
 *   get:
 *     summary: インシデント一覧取得
 *     tags: [Incidents]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: インシデント一覧
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Incident'
 *       401:
 *         description: 認証エラー
 */
```

**アクセスURL**: `http://localhost:5000/api-docs`

**成果物**:
- OpenAPI 3.0仕様書
- Swagger UIドキュメント
- 全エンドポイントのJSDoc

---

### A-4-2: 開発者ガイド作成

**工数**: 2日

**ファイル**: `Docs/04_実装（Implementation）/開発者ガイド.md`

**内容**:
1. プロジェクト構造説明
2. コーディング規約
3. Git ワークフロー
4. テスト作成ガイドライン
5. デバッグ方法
6. トラブルシューティング

**成果物**:
- 開発者ガイド（50ページ相当）

---

### A-4-3: テスト計画書作成

**工数**: 1日

**ファイル**: `Docs/05_テスト・検証（Testing-and-Validation）/テスト計画書.md`

**内容**:
- テスト戦略
- テスト種別（ユニット、統合、E2E）
- テストケース一覧
- カバレッジ目標
- テスト環境

**成果物**:
- テスト計画書
- テストケースマトリクス

---

## A-5: CI/CD基盤構築（Week 4-5）

### A-5-1: GitHub Actions設定

**工数**: 2日

**ファイル**: `.github/workflows/ci.yml`

```yaml
name: CI Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm ci

      - name: Run linter
        run: npm run lint

      - name: Run tests
        run: npm test

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Run Snyk security scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

      - name: Run npm audit
        run: npm audit --audit-level=moderate
```

**成果物**:
- CI/CDパイプライン
- 自動テスト実行
- セキュリティスキャン自動化

---

### A-5-2: プレコミットフック設定

**工数**: 半日

```bash
npm install --save-dev husky lint-staged
npx husky install
```

**.husky/pre-commit**:
```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

npm run lint
npm test
```

**package.json**:
```json
"lint-staged": {
  "*.js": [
    "eslint --fix",
    "prettier --write",
    "git add"
  ]
}
```

**成果物**:
- Git フック設定
- 自動Lint・テスト

---

## A-6: 追加機能実装（Week 5-6）

### A-6-1: ダッシュボードグラフ機能

**工数**: 3日

**ライブラリ**: Chart.js

```bash
npm install chart.js
```

**実装グラフ**:
- インシデント推移（折れ線グラフ）
- 優先度別分布（円グラフ）
- SLA達成率推移（棒グラフ）
- CSF進捗（レーダーチャート）

**成果物**:
- 4種類のグラフ実装
- リアルタイム更新機能

---

### A-6-2: 検索・フィルタ機能

**工数**: 2日

**機能**:
- 全文検索（インシデント、RFC）
- 高度なフィルタ（日付範囲、ステータス、優先度）
- ソート機能
- 保存済みフィルタ

**成果物**:
- 検索バー実装
- フィルタパネル

---

### A-6-3: エクスポート機能

**工数**: 2日

**機能**:
- CSV/Excelエクスポート
- PDFレポート生成
- データバックアップ

**ライブラリ**:
```bash
npm install xlsx jspdf
```

**成果物**:
- エクスポート機能実装

---

## A-7: パフォーマンス最適化（Week 6）

### A-7-1: データベースインデックス最適化

**工数**: 1日

**実施内容**:
```sql
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incidents_created_at ON incidents(created_at);
CREATE INDEX idx_incidents_priority ON incidents(priority);
CREATE INDEX idx_changes_status ON changes(status);
CREATE INDEX idx_assets_type ON assets(type);
```

**成果物**:
- インデックス追加済みDB
- クエリパフォーマンスレポート

---

### A-7-2: APIレスポンスキャッシング

**工数**: 2日

**ライブラリ**:
```bash
npm install node-cache
```

**実装**:
```javascript
const NodeCache = require('node-cache');
const cache = new NodeCache({ stdTTL: 300 }); // 5分キャッシュ

app.get('/api/v1/dashboard/kpi', authenticateJWT, (req, res) => {
  const cacheKey = 'dashboard_kpi';
  const cachedData = cache.get(cacheKey);

  if (cachedData) {
    return res.json(cachedData);
  }

  // データ取得処理
  // ...
  cache.set(cacheKey, data);
  res.json(data);
});
```

**成果物**:
- キャッシュ機構実装
- レスポンス時間短縮

---

### A-7-3: フロントエンド最適化

**工数**: 1日

**実施内容**:
- 遅延ロード（Lazy Loading）
- デバウンス/スロットル
- 仮想スクロール
- コード分割

**成果物**:
- 最適化されたフロントエンド

---

## A-8: セキュリティ追加対策（Week 6）

### A-8-1: レート制限実装

**工数**: 1日

```bash
npm install express-rate-limit
```

```javascript
const rateLimit = require('express-rate-limit');

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分
  max: 5, // 5回まで
  message: { error: 'ログイン試行回数が多すぎます。15分後に再試行してください' }
});

app.post('/api/v1/auth/login', loginLimiter, ...);

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 100
});

app.use('/api/v1/', apiLimiter);
```

**成果物**:
- レート制限実装
- DoS攻撃対策

---

### A-8-2: 監査ログ実装

**工数**: 2日

**テーブル追加**:
```sql
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT,
  resource_type TEXT,
  resource_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
```

**ミドルウェア**:
```javascript
const auditLog = (action, resourceType) => {
  return (req, res, next) => {
    const originalSend = res.send;
    res.send = function(data) {
      if (res.statusCode < 400) {
        db.run(
          "INSERT INTO audit_logs (user_id, action, resource_type, resource_id, ip_address) VALUES (?, ?, ?, ?, ?)",
          [req.user.id, action, resourceType, req.params.id, req.ip]
        );
      }
      originalSend.call(this, data);
    };
    next();
  };
};
```

**成果物**:
- 監査ログテーブル
- 全操作のログ記録

---

## A-9: 最終統合・デバッグ（Week 6）

### A-9-1: 統合デバッグ

**工数**: 3日

**実施内容**:
- バグ修正
- パフォーマンスチューニング
- ユーザビリティ改善
- ブラウザ互換性確認（Chrome, Firefox, Safari, Edge）

**成果物**:
- バグ修正リスト
- パフォーマンスレポート

---

### A-9-2: リグレッションテスト

**工数**: 2日

**実施内容**:
- 全機能の動作確認
- セキュリティ再検証
- パフォーマンステスト

**成果物**:
- テストレポート
- 品質保証書

---

## Phase A チェックリスト

### テスト
- [ ] ユニットテスト30個以上
- [ ] 統合テスト50個以上
- [ ] E2Eテスト15個以上
- [ ] テストカバレッジ70%以上
- [ ] 全テスト合格

### コード品質
- [ ] ESLint設定完了
- [ ] Prettier設定完了
- [ ] コードレビュー完了
- [ ] Lintエラーゼロ

### 機能完成
- [ ] モーダルダイアログ実装
- [ ] フォームバリデーション完全実装
- [ ] エラーハンドリング強化
- [ ] 検索・フィルタ機能
- [ ] エクスポート機能

### ドキュメント
- [ ] OpenAPI仕様書
- [ ] 開発者ガイド
- [ ] テスト計画書
- [ ] API使用例

### CI/CD
- [ ] GitHub Actions設定
- [ ] 自動テスト実行
- [ ] セキュリティスキャン
- [ ] プレコミットフック

### セキュリティ
- [ ] レート制限実装
- [ ] 監査ログ実装
- [ ] セキュリティスキャン合格

### パフォーマンス
- [ ] データベースインデックス最適化
- [ ] APIキャッシング実装
- [ ] フロントエンド最適化
- [ ] レスポンス時間 < 200ms

---

## Phase A 完了判定基準

| カテゴリ | 基準 | 現状 | 目標 |
|---------|------|------|------|
| **テストカバレッジ** | 70%以上 | 0% | 70% |
| **バグ密度** | 10個/KLOC以下 | 未計測 | 達成 |
| **セキュリティスコア** | 8/10以上 | 8/10 | ✅ 達成 |
| **パフォーマンス** | <200ms | 未計測 | 達成 |
| **ドキュメント完成度** | 90%以上 | 60% | 90% |
| **コード品質** | A評価 | B評価 | A評価 |

---

## 工数サマリー

| フェーズ | 工数（日） | 工数（時間） |
|---------|----------|------------|
| A-1: テスト環境構築 | 14日 | 112時間 |
| A-2: コード品質向上 | 3.5日 | 28時間 |
| A-3: 機能完成度向上 | 12日 | 96時間 |
| A-4: ドキュメント整備 | 6日 | 48時間 |
| A-5: CI/CD基盤構築 | 2.5日 | 20時間 |
| A-6: 追加機能実装 | 7日 | 56時間 |
| A-7: パフォーマンス最適化 | 4日 | 32時間 |
| A-8: セキュリティ追加対策 | 3日 | 24時間 |
| A-9: 最終統合・デバッグ | 5日 | 40時間 |
| **合計** | **57日** | **456時間** |

**1人での作業想定**: 約3ヶ月
**2人での作業想定**: 約1.5ヶ月

---

## リスク管理

| リスク | 確率 | 影響 | 対策 |
|--------|------|------|------|
| テスト作成遅延 | 中 | 高 | 早期着手、優先度設定 |
| パフォーマンス問題 | 低 | 中 | 早期ベンチマーク実施 |
| セキュリティ脆弱性発見 | 中 | 高 | 定期スキャン、ペネトレーションテスト |
| スコープクリープ | 高 | 中 | 機能凍結ルール適用 |

---

**Phase A完了後の状態**: 本番環境移行準備完了、全機能テスト済み、ドキュメント完備

---
### 更新メモ (2025-12-29)
- 監査ダッシュボード/コンプライアンス管理のUI詳細を反映
- 脆弱性管理の編集・削除を有効化
- ドキュメント参照先をDocs/に統一（docs/フォルダ削除）

