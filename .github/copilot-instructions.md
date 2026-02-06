# Repository Instructions for GitHub Copilot

このファイルは GitHub Copilot Agent がこのリポジトリで作業する際のルールを定義します。

---

## 📋 プロジェクト情報

### 基本情報
- **プロジェクト名**: ITSM-Sec Nexus
- **目的**: ITサービス管理（ITSM）とセキュリティ管理を統合したWebアプリケーション
- **準拠規格**: NIST Cybersecurity Framework (CSF) 2.0

### 技術スタック
- **言語**: JavaScript (Node.js)
- **バックエンド**: Express.js
- **データベース**: SQLite (better-sqlite3)
- **フロントエンド**: Vanilla JavaScript (SPA)
- **認証**: JWT + Refresh Token
- **API**: RESTful API (v1 - `/api/v1/` プレフィックス必須)
- **テストフレームワーク**: Jest (ユニット・統合), Playwright (E2E)

---

## 🛠️ 開発コマンド

### テスト実行
```bash
# ユニットテスト
npm run test:unit

# 統合テスト
npm run test:integration

# E2Eテスト（Playwright）
npm run test:e2e:chromium

# API E2Eテスト
npm run test:api:e2e

# 全テスト + カバレッジ
npm run test:coverage

# CI用テスト（すべて実行）
npm test
```

### Lint・フォーマット
```bash
# ESLint実行
npm run lint

# ESLint自動修正
npm run lint:fix

# Prettierフォーマット
npm run format

# Prettierチェックのみ
npm run format:check
```

### データベースマイグレーション
```bash
# 最新マイグレーション適用
npm run migrate:latest

# マイグレーションロールバック
npm run migrate:rollback
```

### サーバー起動
```bash
# 開発環境（HTTPS, ポート5443）
npm run dev

# 本番環境（HTTPS, ポート6443）
npm start
```

---

## 📂 ディレクトリ構成と作業範囲

### ✅ 触れてよいディレクトリ・ファイル

| パス | 用途 | 注意事項 |
|------|------|----------|
| `backend/routes/` | APIルート定義 | RESTful設計を維持 |
| `backend/services/` | ビジネスロジック | DB操作はここに集約 |
| `backend/middleware/` | ミドルウェア | 認証・ログ・バリデーション |
| `backend/migrations/` | DBマイグレーション | knex形式、ロールバック可能に |
| `backend/__tests__/` | テストコード | カバレッジ70%以上維持 |
| `frontend/` | フロントエンド | Vanilla JS、jQuery不使用 |
| `frontend/app.js` | SPAメインロジック | 既存構造を維持 |
| `Docs/` | ドキュメント | 技術仕様追記のみ |

### ❌ 触れてはいけないファイル（変更禁止）

| パス | 理由 |
|------|------|
| `README.md` | プロジェクト仕様書（変更禁止） |
| `CLAUDE.md` | ClaudeCode用ルール定義 |
| `.github/workflows/*.yml` | CI/CD設定（手動更新のみ） |
| `package.json` の scripts | 既存コマンドを維持 |
| `knexfile.js` | DB接続設定（本番環境影響） |
| `.env` | 環境変数（Gitにコミットしない） |

---

## 🎯 コーディング規約

### JavaScript スタイル
- **命名規則**:
  - 変数・関数: `camelCase`
  - クラス: `PascalCase`
  - 定数: `UPPER_SNAKE_CASE`
  - ファイル名: `kebab-case.js`
- **ESLint**: `.eslintrc.json` に従う
- **Prettier**: `.prettierrc` に従う
- **コメント**: 複雑なロジックには日本語コメント推奨

### API設計ルール
- **エンドポイント**: `/api/v1/[resource]` 形式
- **HTTPメソッド**:
  - `GET`: 取得
  - `POST`: 作成
  - `PUT`: 更新（全体）
  - `PATCH`: 更新（部分）
  - `DELETE`: 削除
- **レスポンス形式**: JSON
  - 成功: `{ data: {...}, message: "..." }`
  - エラー: `{ error: "ERROR_CODE", message: "..." }`
- **ステータスコード**:
  - 200 OK, 201 Created, 204 No Content
  - 400 Bad Request, 401 Unauthorized, 403 Forbidden, 404 Not Found
  - 500 Internal Server Error

### データベース操作
- **必須**: プリペアドステートメント使用（SQLインジェクション防止）
- **推奨**: トランザクション利用（複数テーブル更新時）
- **禁止**: 生SQL文字列結合

```javascript
// ✅ Good
const user = await db('users').where({ id: userId }).first();

// ❌ Bad
const user = await db.raw(`SELECT * FROM users WHERE id = ${userId}`);
```

---

## 🔒 セキュリティ要件

### 必須対策
1. **入力検証**: すべてのユーザー入力をバリデーション
   - Express Validator 使用
   - 型チェック、長さ制限、正規表現検証
2. **出力エスケープ**: XSS防止
   - フロントエンドで `textContent` 使用（`innerHTML` 禁止）
3. **認証**: JWT トークン検証
   - `/api/v1/auth/*` 以外は認証必須
   - トークン有効期限: 1時間
   - Refresh Token: 7日間
4. **CSRF対策**: トークン検証
5. **レート制限**: express-rate-limit 使用
6. **HTTPS**: 本番環境では必須（ポート6443）

### 禁止事項
- ❌ シークレット情報のハードコード
- ❌ console.log() での機密情報出力
- ❌ `eval()` 使用
- ❌ `require()` での動的モジュール読み込み（ユーザー入力由来）

---

## 🧪 テストルール

### 必須要件
- **カバレッジ目標**: 70%以上（現在: 55%程度）
- **テスト種別**:
  - ユニットテスト: 関数・メソッド単位
  - 統合テスト: API エンドポイント単位
  - E2Eテスト: ユーザーシナリオ単位

### テストコード記述規約
```javascript
describe('モジュール名', () => {
  beforeEach(() => {
    // セットアップ
  });

  afterEach(() => {
    // クリーンアップ
  });

  it('should [期待動作]', async () => {
    // Arrange（準備）
    const input = { ... };

    // Act（実行）
    const result = await targetFunction(input);

    // Assert（検証）
    expect(result).toEqual({ ... });
  });
});
```

### テストDBの扱い
- テスト用DB: `./backend/test_itsm.db`
- 各テスト前にマイグレーション実行
- テスト後にDB削除（クリーンアップ）

---

## 📝 コミットメッセージ規約

### Conventional Commits 形式必須

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Type一覧
- `feat`: 新機能追加
- `fix`: バグ修正
- `test`: テスト追加・修正
- `refactor`: リファクタリング
- `docs`: ドキュメント更新
- `style`: コードスタイル修正（動作影響なし）
- `perf`: パフォーマンス改善
- `chore`: ビルド・補助ツール変更

### 例
```
feat(auth): JWT refresh token 機能を追加

- リフレッシュトークンの生成・検証機能を実装
- /api/v1/auth/refresh エンドポイント追加
- トークン有効期限を7日間に設定

Closes #123
```

---

## 🚀 PR作成時のチェックリスト

PRを作成する前に、以下を確認してください：

- [ ] `npm run lint` が成功する
- [ ] `npm run format:check` が成功する
- [ ] `npm test` がすべて成功する（ローカル）
- [ ] 新機能には対応するテストを追加した
- [ ] テストカバレッジが70%以上を維持している
- [ ] README.md の仕様に反する変更がない
- [ ] コミットメッセージが Conventional Commits 形式
- [ ] 機密情報（API Key, パスワード等）がコミットされていない

---

## 🔄 CI/CD との連携

### GitHub Actions ワークフロー
- **ci.yml**: PR時の品質チェック（Lint, Test, E2E, Security）
- **security.yml**: セキュリティスキャン（npm audit, CodeQL, Secret scan）
- **cd.yml**: main マージ時の自動リリース
- **auto-error-fix-continuous.yml**: 5分間隔の自動エラー修復

### ブランチ保護設定
- **main ブランチ**:
  - PR必須
  - レビュー1名以上必須
  - CI合格必須（「CI 完了チェック」ステータス）
  - 会話解決必須
  - force push 禁止

---

## 📌 その他の注意事項

### パフォーマンス考慮
- N+1クエリ防止（JOIN または `whereIn` 使用）
- 大量データ取得時はページネーション必須
- 重い処理は非同期化

### エラーハンドリング
```javascript
try {
  // 処理
} catch (error) {
  console.error('エラー詳細:', error);
  res.status(500).json({
    error: 'INTERNAL_ERROR',
    message: 'サーバーエラーが発生しました'
  });
}
```

### ログ出力
- 本番環境: `winston` ロガー使用
- ログレベル: `error`, `warn`, `info`, `debug`
- 機密情報をログに出力しない

---

**最終更新**: 2026-02-07
**作成者**: 開発チーム
