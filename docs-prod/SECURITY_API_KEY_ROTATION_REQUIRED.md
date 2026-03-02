# 🚨 緊急セキュリティ警告：APIキーローテーション必須

**日付**: 2026-01-09
**重大度**: 🔴 **Critical**
**対応期限**: 即座（24時間以内）

---

## 📋 概要

`.mcp.json`ファイルに**本番APIキーが平文で保存**されており、Gitリポジトリに含まれている可能性があります。以下のAPIキーを即座にローテーション（無効化+再発行）してください。

---

## 🔑 漏洩した可能性のあるAPIキー

### 1. Brave Search API
- **キー**: `***REDACTED***`
- **アクション**: [Brave Search Dashboard](https://brave.com/search/api/)で即座に無効化
- **再発行**: 新しいキーを発行し、環境変数に設定

### 2. Context7 API
- **キー**: `***REDACTED***`
- **アクション**: Context7管理画面で即座に無効化
- **再発行**: 新しいキーを発行し、環境変数に設定

### 3. GitHub Personal Access Token
- **キー**: `your_github_token_here`（プレースホルダー）
- **アクション**: 実際のトークンが設定されていた場合、即座に無効化
- **再発行**: [GitHub Settings > Developer settings > Personal access tokens](https://github.com/settings/tokens)

---

## ✅ ローテーション手順

### ステップ1: 古いキーの無効化（即座）

```bash
# 1. Brave Search API
# https://brave.com/search/api/ にアクセス
# → API Keys → ***REDACTED*** を Revoke

# 2. Context7 API
# Context7ダッシュボードにアクセス
# → API Keys → ***REDACTED*** を Delete

# 3. GitHub PAT
# https://github.com/settings/tokens
# → 該当トークンを Delete
```

### ステップ2: 新しいキーの発行

```bash
# 各サービスで新しいAPIキーを発行
# ⚠️ 新しいキーはGitに絶対にコミットしない！
```

### ステップ3: 環境変数への設定

```bash
# .env.local ファイルを作成（Gitignore済み）
cat > .env.local <<'EOF'
BRAVE_API_KEY=<新しいBrave APIキー>
CONTEXT7_API_KEY=<新しいContext7 APIキー>
GITHUB_PERSONAL_ACCESS_TOKEN=<新しいGitHub PAT>
EOF

# パーミッション設定
chmod 600 .env.local
```

### ステップ4: .mcp.jsonの削除とテンプレート化

```bash
# 既存の.mcp.jsonをバックアップ（ローカルのみ）
mv .mcp.json .mcp.json.backup

# テンプレートファイル作成
cat > .mcp.json.template <<'EOF'
{
  "brave-search": {
    "env": {
      "BRAVE_API_KEY": "${BRAVE_API_KEY}"
    }
  },
  "context7": {
    "env": {
      "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}"
    }
  },
  "github": {
    "env": {
      "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_PERSONAL_ACCESS_TOKEN}"
    }
  }
}
EOF
```

### ステップ5: Git履歴からの削除（重要！）

```bash
# Git履歴から.mcp.jsonを完全削除
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .mcp.json" \
  --prune-empty --tag-name-filter cat -- --all

# または BFG Repo-Cleaner を使用（推奨）
# https://rtyley.github.io/bfg-repo-cleaner/
# bfg --delete-files .mcp.json

# 強制プッシュ（⚠️ チーム全員に事前通知！）
git push origin --force --all
git push origin --force --tags
```

---

## 🔍 漏洩確認方法

### GitHub検索
```bash
# GitHubで公開リポジトリを検索
# https://github.com/search?q=***REDACTED***&type=code
# https://github.com/search?q=***REDACTED***&type=code
```

### ローカルGit履歴検索
```bash
# すべてのコミットで.mcp.jsonが含まれているか確認
git log --all --full-history -- .mcp.json

# 特定のキーが含まれているか確認
git grep -i "***REDACTED***" $(git rev-list --all)
```

---

## 📊 影響範囲評価

| サービス | 影響 | リスク | 対応優先度 |
|---------|------|--------|----------|
| Brave Search | 検索APIの不正利用 | 🟡 中 | P0 |
| Context7 | ドキュメント検索の不正利用 | 🟡 中 | P0 |
| GitHub | コード読み取り・書き込み | 🔴 高 | P0 |

---

## 🛡️ 今後の予防策

### 1. 環境変数の徹底使用
```bash
# .env.local（Gitignore済み）に集約
BRAVE_API_KEY=...
CONTEXT7_API_KEY=...
GITHUB_PERSONAL_ACCESS_TOKEN=...
```

### 2. pre-commitフックでの検出
```bash
# .git/hooks/pre-commit
#!/bin/bash
if git diff --cached --name-only | grep -q "\.mcp\.json$"; then
  echo "❌ Error: .mcp.json should not be committed!"
  exit 1
fi
```

### 3. Secret Scanningツール導入
```bash
# gitleaks インストール
# https://github.com/gitleaks/gitleaks
brew install gitleaks

# スキャン実行
gitleaks detect --source . --verbose
```

### 4. GitHub Secrets使用（CI/CD）
```yaml
# .github/workflows/ci.yml
env:
  BRAVE_API_KEY: ${{ secrets.BRAVE_API_KEY }}
  CONTEXT7_API_KEY: ${{ secrets.CONTEXT7_API_KEY }}
```

---

## 📞 連絡先

- **セキュリティチーム**: security@example.com
- **緊急連絡**: +81-XX-XXXX-XXXX
- **インシデント報告**: [Security Incident Form](#)

---

## ✅ 完了チェックリスト

- [ ] Brave Search APIキー無効化完了
- [ ] Context7 APIキー無効化完了
- [ ] GitHub PAT無効化完了（該当する場合）
- [ ] 新しいAPIキー発行完了
- [ ] 環境変数設定完了（.env.local）
- [ ] .mcp.jsonをGit履歴から削除完了
- [ ] 強制プッシュ完了（チームへ通知済み）
- [ ] 漏洩確認（GitHub検索）完了
- [ ] インシデントレポート作成完了

---

**このドキュメントは完了後も保管してください。** 🔒
