# 🔐 APIキーローテーション手順書

## ⚠️ 緊急対応が必要なシークレット

以下のAPIキーがGit履歴に残存しており、**即座に無効化とローテーション**が必要です。

| シークレット | 現在の値（漏洩済み） | 対応状況 |
|-------------|---------------------|---------|
| Brave Search API Key | `***REDACTED_BRAVE_KEY***` | ⛔ 即座に無効化必要 |
| Context7 API Key | `***REDACTED_CONTEXT7_KEY***` | ⛔ 即座に無効化必要 |

---

## 📋 ステップ1: APIキーの無効化（即時実行）

### 1.1 Brave Search API

1. [Brave Search API Dashboard](https://api.search.brave.com/) にログイン
2. 「API Keys」セクションで `***REDACTED_BRAVE_KEY***` を**Revoke（無効化）**
3. 新しいAPIキーを生成
4. 新しいキーを安全な場所（1Password、Bitwarden、GitHub Secrets等）に保存

### 1.2 Context7 API

1. [Context7 Dashboard](https://context7.com/) にログイン
2. 「Settings」→「API Keys」で `***REDACTED_CONTEXT7_KEY***` を**Delete**
3. 新しいAPIキーを生成
4. 新しいキーを安全な場所に保存

---

## 📋 ステップ2: 新しいキーの設定

### 環境変数での設定（推奨）

```bash
# .env ファイルに追加（.gitignoreに含まれていることを確認）
BRAVE_SEARCH_API_KEY=新しいキー
CONTEXT7_API_KEY=新しいキー
```

### GitHub Secretsでの設定（CI/CD用）

```bash
# GitHub CLI を使用
gh secret set BRAVE_SEARCH_API_KEY --body "新しいキー"
gh secret set CONTEXT7_API_KEY --body "新しいキー"
```

---

## 📋 ステップ3: Git履歴からのシークレット削除

### 方法A: BFG Repo-Cleaner（推奨）

```bash
# 1. BFG をダウンロード
# https://rtyley.github.io/bfg-repo-cleaner/

# 2. リポジトリのミラークローン
git clone --mirror https://github.com/Kensan196948G/ITSM-System.git

# 3. 削除対象ファイルのリスト作成
echo ".mcp.json" > files-to-remove.txt

# 4. BFG 実行
java -jar bfg.jar --delete-files .mcp.json ITSM-System.git

# 5. リポジトリのクリーンアップ
cd ITSM-System.git
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# 6. Force push（⚠️ チームメンバーに事前通知必要）
git push --force
```

### 方法B: git filter-branch（小規模リポジトリ向け）

```bash
# ⚠️ 時間がかかる場合があります
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .mcp.json" \
  --prune-empty --tag-name-filter cat -- --all

# クリーンアップ
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push
git push origin --force --all
git push origin --force --tags
```

---

## 📋 ステップ4: チームメンバーへの通知

履歴書き換え後、全チームメンバーに以下を依頼：

```bash
# ローカルリポジトリを再取得
cd /path/to/local/repo
git fetch origin
git reset --hard origin/main
```

---

## ✅ 完了チェックリスト

- [ ] Brave Search APIキーを無効化
- [ ] Context7 APIキーを無効化
- [ ] 新しいBrave Search APIキーを生成
- [ ] 新しいContext7 APIキーを生成
- [ ] 新しいキーを環境変数/.envに設定
- [ ] 新しいキーをGitHub Secretsに設定
- [ ] BFGまたはgit filter-branchでGit履歴を削除
- [ ] force pushを実行
- [ ] チームメンバーにリポジトリ再取得を依頼
- [ ] GitHub Issue #9をクローズ

---

## 🔍 確認コマンド

```bash
# Git履歴にシークレットが残っていないか確認
git log -p --all -S "BRAVE_KEY_REDACTED" | head -20
git log -p --all -S "ctx7sk-REDACTED" | head -20

# 両方とも出力がなければOK
```

---

**作成日**: 2026-01-17
**担当**: セキュリティチーム
**GitHub Issue**: #9
