# pnpm完全移行ガイド

## 現状
- ✅ GitHub Actions: pnpm/npm両対応（自動検知）
- 📦 ローカル環境: npm使用中

## pnpm移行手順

### 1. pnpmインストール

```bash
# corepack経由（Node.js 16.13+）
sudo corepack enable
pnpm --version

# または npm経由
npm install -g pnpm
```

### 2. 既存の依存関係削除

```bash
# node_modulesとpackage-lock.json削除
rm -rf node_modules package-lock.json
```

### 3. pnpmで依存関係インストール

```bash
# pnpm-lock.yaml生成
pnpm install

# テスト実行確認
pnpm test
pnpm run lint
pnpm run format:check
```

### 4. .gitignore更新

```.gitignore
# 既存
node_modules/
package-lock.json  # 削除可能

# pnpm用
pnpm-lock.yaml  # コミット対象
.pnpm-store/  # 除外
```

### 5. コミット

```bash
git add package.json pnpm-lock.yaml
git rm package-lock.json
git commit -m "feat: npm → pnpm完全移行"
git push origin main
```

## メリット

- 📦 ディスク使用量削減（共有ストレージ）
- ⚡ インストール高速化（最大2-3倍）
- 🔒 厳格な依存関係管理
- 🎯 monorepo対応強化

## 注意事項

- GitHub Actionsは既にpnpm対応済み（自動切替）
- ローカル環境でpnpmインストール後、自動的にpnpm使用
- CI/CD動作に影響なし

---
### 更新メモ (2025-12-29)
- 監査ダッシュボード/コンプライアンス管理のUI詳細を反映
- 脆弱性管理の編集・削除を有効化
- ドキュメント参照先をDocs/に統一（docs/フォルダ削除）

