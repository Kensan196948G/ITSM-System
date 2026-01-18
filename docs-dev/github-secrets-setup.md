# GitHub Secrets設定手順書

## 概要

このドキュメントでは、GitHub ActionsワークフローでJWT_SECRETを安全に使用するための設定手順を説明します。

## 目的

- ハードコードされた機密情報をワークフローファイルから削除
- GitHub Secretsを使用してJWT_SECRETを安全に管理
- CI/CDパイプラインのセキュリティを向上

## 設定手順

### 1. GitHub Secretsの作成

1. GitHubリポジトリページにアクセス
2. `Settings` タブをクリック
3. 左サイドバーから `Secrets and variables` > `Actions` を選択
4. `New repository secret` ボタンをクリック
5. 以下のSecretを作成:

   **Name**: `JWT_SECRET_TEST`

   **Value**: 安全なランダム文字列（最低32文字推奨）

   例: `openssl rand -base64 32` で生成

### 2. Secretの生成方法

#### Linuxシステム（推奨）

```bash
# openssl を使用してランダムな32バイトの文字列を生成
openssl rand -base64 32
```

#### Node.js を使用

```javascript
// Node.js REPL で実行
require('crypto').randomBytes(32).toString('base64')
```

#### オンラインツール（非推奨 - テスト環境のみ）

- https://www.random.org/strings/ などを使用
- 本番環境では使用しないこと

### 3. 推奨されるSecret値

```bash
# 例（実際には独自の値を生成してください）
# 以下はサンプルであり、実際に使用しないでください
JWT_SECRET_TEST=dGVzdC1zZWNyZXQta2V5LWZvci1jaS1waXBlbGluZS1vbmx5
```

### 4. 設定確認

Secretが正しく設定されたか確認します:

1. GitHub Actions > 任意のワークフロー実行を選択
2. ログに `JWT_SECRET` が `***` でマスクされていることを確認
3. エラーが発生しないことを確認

## ワークフローでの使用

### 修正済みファイル

以下のワークフローファイルで `JWT_SECRET` が GitHub Secrets から読み込まれるように修正されました:

1. `.github/workflows/ci.yml`
2. `.github/workflows/cd.yml`
3. `.github/workflows/auto-repair.yml`

### 使用例

```yaml
env:
  JWT_SECRET: ${{ secrets.JWT_SECRET_TEST }}
```

## セキュリティベストプラクティス

### ✅ 推奨事項

- 最低32文字以上のランダムな文字列を使用
- 定期的にSecretをローテーション（3〜6ヶ月ごと）
- 本番環境とテスト環境で異なるSecretを使用
- Secretをコミット履歴に含めない

### ❌ 禁止事項

- Secretをコードにハードコード
- Secretをログに出力
- Secretを第三者と共有
- 弱いパスワードや推測可能な文字列を使用

## トラブルシューティング

### エラー: "JWT_SECRET is undefined"

**原因**: GitHub Secretが設定されていない、または名前が間違っている

**解決方法**:
1. リポジトリの Settings > Secrets を確認
2. Secret名が `JWT_SECRET_TEST` であることを確認
3. Secretに値が設定されていることを確認

### エラー: "invalid signature"

**原因**: JWT_SECRETが変更された、またはSecret値が間違っている

**解決方法**:
1. Secretの値を再確認
2. 必要に応じてSecretを再生成
3. テストを再実行

## Issue対応状況

### Issue #20: GitHub Secrets活用

- ✅ ci.yml: JWT_SECRET を GitHub Secrets に移行
- ✅ cd.yml: JWT_SECRET を GitHub Secrets に移行
- ✅ auto-repair.yml: JWT_SECRET を GitHub Secrets に移行
- ⚠️ GitHub Secretsの手動設定が必要（このドキュメント参照）

## 関連リンク

- [GitHub Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Best Practices for Managing Secrets](https://docs.github.com/en/actions/security-guides/security-hardening-for-github-actions)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

## 次のステップ

1. ✅ このドキュメントを読む
2. ⬜ GitHub Secretsを設定する
3. ⬜ CIパイプラインが正常に動作することを確認する
4. ⬜ 本番環境用の別のSecretを設定する（`JWT_SECRET_PROD`）
