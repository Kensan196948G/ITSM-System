# CI/CD パイプライン ガイド

## 概要

ITSM-Sec Nexusプロジェクトは、GitHub Actionsを使用した包括的なCI/CDパイプラインを実装しています。このガイドでは、各ワークフローの詳細と使用方法について説明します。

## 目次

1. [CI パイプライン](#ci-パイプライン)
2. [CD パイプライン](#cd-パイプライン)
3. [セキュリティスキャン](#セキュリティスキャン)
4. [Huskyフック](#huskyフック)
5. [トラブルシューティング](#トラブルシューティング)

---

## CI パイプライン

### 概要

継続的インテグレーション（CI）パイプラインは、コード品質を保証し、すべてのテストが成功することを確認します。

### トリガー条件

- `main`、`develop`、`feature/*` ブランチへのプッシュ
- `main`、`develop` ブランチへのプルリクエスト

### 実行されるジョブ

#### 1. Lintチェック

```yaml
実行内容:
- ESLint による JavaScript コード品質チェック
- Prettier によるコードフォーマットチェック

実行時間: 約 3-5 分
```

#### 2. テスト（マトリックス戦略）

```yaml
実行内容:
- Node.js 18.x, 20.x での並列テスト実行
- 単体テスト
- 統合テスト
- コードカバレッジ測定
- Codecov へのレポートアップロード

実行時間: 約 10-15 分
```

#### 3. E2Eテスト（Playwright）

```yaml
実行内容:
- Playwright による E2E テスト実行
- Chromium ブラウザでのテスト
- テスト結果のアーティファクト保存

実行時間: 約 15-20 分
```

#### 4. API E2Eテスト

```yaml
実行内容:
- Jest によるAPIエンドポイントテスト
- SuperTest を使用した統合テスト

実行時間: 約 5-10 分
```

#### 5. ビルド検証

```yaml
実行内容:
- 本番用依存関係のみでビルド検証
- データベースマイグレーション確認

実行時間: 約 3-5 分
```

### ステータスバッジ

プロジェクトのREADMEに表示される CI ステータスバッジ:

```markdown
[![CI Pipeline](https://github.com/USER/ITSM-System/workflows/CI%20Pipeline/badge.svg)](https://github.com/USER/ITSM-System/actions/workflows/ci.yml)
```

### 環境変数

```bash
JWT_SECRET=test-secret-key-for-ci-pipeline-only-do-not-use-in-production
NODE_ENV=test
DATABASE_PATH=./backend/test_itsm.db
```

---

## CD パイプライン

### 概要

継続的デリバリー（CD）パイプラインは、`main` ブランチへのマージ時に自動的にリリースを作成します。

### トリガー条件

- `main` ブランチへのプッシュ
- 手動トリガー（workflow_dispatch）

### 実行されるジョブ

#### 1. ビルド & テスト検証

```yaml
実行内容:
- 全依存関係のインストール
- Lint & フォーマットチェック
- テスト実行
- 本番用ビルド検証

実行時間: 約 10-15 分
```

#### 2. バージョン管理とタグ作成

```yaml
実行内容:
- セマンティックバージョニングの自動判定
  - major: BREAKING CHANGE, feat!, fix! を含むコミット
  - minor: feat: を含むコミット
  - patch: その他のコミット
- package.json のバージョン更新
- Git タグの作成
- 変更履歴の生成

実行時間: 約 2-3 分
```

#### 3. GitHub Release 作成

```yaml
実行内容:
- リリースノートの自動生成
- GitHub Release の作成
- 変更履歴の添付

実行時間: 約 1-2 分
```

### 手動リリース

手動でリリースを作成する場合:

1. GitHub の Actions タブに移動
2. "CD Pipeline" ワークフローを選択
3. "Run workflow" をクリック
4. バージョンアップの種類を選択:
   - `major`: メジャーバージョンアップ (1.0.0 → 2.0.0)
   - `minor`: マイナーバージョンアップ (1.0.0 → 1.1.0)
   - `patch`: パッチバージョンアップ (1.0.0 → 1.0.1)

### コミットメッセージ規約

自動バージョン判定のためのコミットメッセージ規約:

```bash
# メジャーバージョンアップ
BREAKING CHANGE: 互換性のない API 変更
feat!: 破壊的変更を含む新機能
fix!: 破壊的変更を含む修正

# マイナーバージョンアップ
feat: 新機能追加
feat(auth): 2FA機能の追加

# パッチバージョンアップ
fix: バグ修正
docs: ドキュメント更新
chore: 雑務（依存関係更新など）
```

---

## セキュリティスキャン

### 概要

セキュリティスキャンワークフローは、依存関係の脆弱性とコードのセキュリティ問題を検出します。

### トリガー条件

- `main`、`develop` ブランチへのプッシュ
- `main` ブランチへのプルリクエスト
- 定期実行: 毎週月曜日 9:00 (JST)
- 手動トリガー

### 実行されるジョブ

#### 1. npm audit - 依存関係脆弱性スキャン

```yaml
実行内容:
- 本番依存関係の脆弱性スキャン
- 開発依存関係を含む全体スキャン
- 脆弱性レポート生成（JSON形式）

実行時間: 約 3-5 分
```

#### 2. CodeQL - コード品質・セキュリティ分析

```yaml
実行内容:
- JavaScript コードの静的解析
- セキュリティ脆弱性の検出
- コード品質問題の検出

実行時間: 約 10-15 分
```

#### 3. 依存関係の更新チェック

```yaml
実行内容:
- 更新可能な依存関係の一覧表示
- セキュリティアップデートの確認

実行時間: 約 2-3 分
```

#### 4. Secret パターンスキャン

```yaml
実行内容:
- API キー、パスワード等のパターン検出
- .env ファイルのコミット確認
- プライベートキーの検出

実行時間: 約 2-3 分
```

### 脆弱性対応フロー

1. **検出**: セキュリティスキャンで脆弱性を検出
2. **評価**: 影響範囲とリスクレベルを評価
3. **修正**: 依存関係の更新または代替実装
4. **検証**: 再度スキャンを実行して確認

---

## Huskyフック

### pre-commit フック

コミット前に自動実行されます。

```bash
実行内容:
- lint-staged: 変更されたファイルのみ Lint & Format
- 単体テスト: 高速な単体テストのみ実行

実行時間: 約 10-30 秒（変更ファイル数による）
```

### pre-push フック

プッシュ前に自動実行されます。

```bash
実行内容:
- ESLint チェック
- Prettier フォーマットチェック
- 単体テスト実行
- 統合テスト実行
- データベースマイグレーション検証

実行時間: 約 2-5 分
```

### フックのスキップ方法

緊急時にフックをスキップする場合（推奨されません）:

```bash
# コミットフックをスキップ
git commit --no-verify -m "緊急修正"

# プッシュフックをスキップ
git push --no-verify
```

---

## トラブルシューティング

### よくある問題と解決方法

#### 1. CI パイプラインが失敗する

**問題**: Lintエラー

```bash
解決方法:
npm run lint
npm run lint:fix  # 自動修正
```

**問題**: テスト失敗

```bash
解決方法:
npm run test:unit     # 単体テストのみ実行
npm run test:integration  # 統合テストのみ実行
npm test -- --verbose  # 詳細ログで実行
```

**問題**: E2Eテスト失敗

```bash
解決方法:
# ローカルでE2Eテストを実行
npm run test:e2e:headed  # ブラウザ表示モード
npm run test:e2e:debug   # デバッグモード
```

#### 2. pre-commit フックが遅い

```bash
解決方法:
# 単体テストをスキップする設定を追加（package.jsonのscriptsに追加）
"test:unit:fast": "jest --testPathPattern=unit --onlyChanged"
```

`.husky/pre-commit` を編集:

```bash
npm run test:unit:fast -- --passWithNoTests
```

#### 3. CodeCov トークンエラー

```bash
解決方法:
1. CodeCov にサインアップ: https://codecov.io/
2. リポジトリを登録
3. GitHub Secrets に CODECOV_TOKEN を追加
   - Settings → Secrets → Actions → New repository secret
```

#### 4. wait-on パッケージエラー

```bash
解決方法:
npm install --save-dev wait-on
```

#### 5. マイグレーションエラー

```bash
解決方法:
# ローカルでマイグレーション確認
npm run migrate:status
npm run migrate:latest
npm run migrate:rollback  # 必要に応じて
```

---

## ベストプラクティス

### 1. コミット前の確認

```bash
# ローカルで事前に確認
npm run lint
npm run format:check
npm run test:unit
npm run migrate:latest
```

### 2. プルリクエストの作成

```bash
1. feature ブランチで開発
2. ローカルでテスト実行
3. プッシュ（pre-push フックで検証）
4. プルリクエスト作成
5. CI パイプラインの結果確認
6. レビュー後に main にマージ
```

### 3. リリース管理

```bash
1. main ブランチへマージ
2. CD パイプラインが自動実行
3. バージョンタグとリリースが自動作成
4. リリースノートを確認
```

### 4. セキュリティ対策

```bash
1. 定期的な依存関係の更新
2. セキュリティスキャン結果の確認
3. 脆弱性の即座な対応
4. .env ファイルをコミットしない
5. シークレットをコードに含めない
```

---

## 参考リンク

- [GitHub Actions ドキュメント](https://docs.github.com/ja/actions)
- [Jest ドキュメント](https://jestjs.io/)
- [Playwright ドキュメント](https://playwright.dev/)
- [ESLint ドキュメント](https://eslint.org/)
- [Husky ドキュメント](https://typicode.github.io/husky/)
- [CodeQL ドキュメント](https://codeql.github.com/docs/)
- [Codecov ドキュメント](https://docs.codecov.com/)

---

## 更新履歴

| 日付 | バージョン | 変更内容 |
|------|----------|---------|
| 2026-01-07 | 1.0.0 | 初版作成 |
