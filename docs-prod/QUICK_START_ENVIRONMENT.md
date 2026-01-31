# クイックスタート: 環境分離の使い方

## 🚀 最速で始める

### 1分で理解する環境切り替え

```bash
# 現在の環境を確認
./scripts/switch-env.sh status

# 開発環境で作業開始
./scripts/switch-env.sh dev
sudo systemctl start itsm-sec-nexus-dev

# 本番環境で運用開始
./scripts/switch-env.sh prod
sudo systemctl start itsm-sec-nexus-prod
```

---

## 📊 環境の違い（一目で分かる）

| 項目 | 開発環境 | 本番環境 |
|------|----------|----------|
| **URL** | https://192.168.0.187:5443 | https://192.168.0.187:6443 |
| **データベース** | itsm_nexus_dev.db | itsm_nexus_prod.db |
| **サンプルデータ** | あり | なし |
| **ログレベル** | 詳細 (debug) | 標準 (info) |
| **誤操作防止** | なし | 確認プロンプトあり |

---

## 🔧 よくあるシナリオ

### シナリオ1: 開発環境でテストしたい

```bash
# 1. 開発環境に切り替え
./scripts/switch-env.sh dev

# 2. サービス起動
sudo systemctl start itsm-sec-nexus-dev

# 3. ブラウザでアクセス
# → https://192.168.0.187:5443

# 4. テスト完了後、停止
sudo systemctl stop itsm-sec-nexus-dev
```

### シナリオ2: 本番環境にデプロイしたい

```bash
# 1. 開発環境でテスト完了を確認
./scripts/switch-env.sh status

# 2. 本番環境に切り替え（確認プロンプトあり）
./scripts/switch-env.sh prod
# → "yes"と入力

# 3. 本番サービス起動
sudo systemctl start itsm-sec-nexus-prod

# 4. 動作確認
curl -k https://192.168.0.187:6443/api/v1/health
```

### シナリオ3: 開発と本番を同時に動かしたい

```bash
# 両方のサービスを起動
sudo systemctl start itsm-sec-nexus-dev
sudo systemctl start itsm-sec-nexus-prod

# 状態確認
./scripts/switch-env.sh status

# 開発環境: https://192.168.0.187:5443
# 本番環境: https://192.168.0.187:6443
```

---

## ⚠️ よくあるミス（これを避けよう）

### ❌ NG例1: 環境を確認せずに作業

```bash
# 今どっちの環境？→ 確認せずに作業するとデータ破損の可能性
npm run dev:backend
```

### ✅ OK例1: 必ず環境を確認

```bash
# まず確認
./scripts/switch-env.sh status

# 開発環境に明示的に切り替え
./scripts/switch-env.sh dev

# 起動
npm run dev:backend
```

### ❌ NG例2: サービス実行中に環境切り替え

```bash
# サービスが動いている状態で切り替え → DB競合の危険
./scripts/switch-env.sh prod
```

### ✅ OK例2: 停止してから切り替え

```bash
# まず停止
sudo systemctl stop itsm-sec-nexus-dev

# それから切り替え
./scripts/switch-env.sh prod

# 起動
sudo systemctl start itsm-sec-nexus-prod
```

---

## 🛡️ 安全確認

環境切り替え前に、これを実行すると安心:

```bash
# 環境の状態を表示
./scripts/env-guard.sh --show-info

# デプロイ前の総合チェック
./scripts/env-guard.sh --check
```

---

## 🔍 トラブルシューティング（即効解決）

### 問題: ポートが使用中

```bash
# エラー: listen EADDRINUSE :::5443

# 解決:
sudo systemctl stop itsm-sec-nexus-dev
sudo systemctl stop itsm-sec-nexus-prod
```

### 問題: データベースが見つからない

```bash
# エラー: ENOENT: no such file 'itsm_nexus_dev.db'

# 解決: 環境を切り替えると自動作成される
./scripts/switch-env.sh dev
```

### 問題: 本番環境設定ファイルがない

```bash
# エラー: 本番環境設定ファイルが見つかりません

# 解決:
cp config/env/.env.production.example config/env/.env.production
# ファイルを編集して本番用のJWT_SECRETを設定
nano config/env/.env.production
```

---

## 📋 毎日の運用チェックリスト

### 開発作業開始時

- [ ] `./scripts/switch-env.sh status` で環境確認
- [ ] 開発環境になっていることを確認
- [ ] `sudo systemctl start itsm-sec-nexus-dev`

### 本番デプロイ時

- [ ] 開発環境でテスト完了
- [ ] `./scripts/env-guard.sh --check` でチェック
- [ ] `./scripts/switch-env.sh prod` で切り替え
- [ ] `sudo systemctl start itsm-sec-nexus-prod`
- [ ] 動作確認

### 作業終了時

- [ ] 不要なサービスを停止
- [ ] バックアップ確認（本番環境）

---

## 💡 プロのTips

### Tip1: エイリアスを設定

`.bashrc`に追加:

```bash
alias itsm-dev='./scripts/switch-env.sh dev'
alias itsm-prod='./scripts/switch-env.sh prod'
alias itsm-status='./scripts/switch-env.sh status'
```

### Tip2: 環境を常に表示

bashプロンプトに追加:

```bash
export PS1="\[\033[1;32m\]\u@\h\[\033[0m\]:\[\033[1;34m\]\w\[\033[0m\] [\$(./scripts/env-guard.sh --is-production && echo 'PROD' || echo 'DEV')] $ "
```

### Tip3: 自動バックアップ設定

cronで定期バックアップ:

```bash
crontab -e

# 毎日深夜2時にバックアップ
0 2 * * * cd /path/to/ITSM-System && npm run backup
```

---

## 📞 サポート

問題が解決しない場合:

1. [詳細ガイド](./ENVIRONMENT_SEPARATION.md) を参照
2. [検証レポート](./ENVIRONMENT_SEPARATION_VERIFICATION.md) で既知の問題を確認
3. GitHubのIssueを作成

---

**最終更新**: 2026-01-31
**対象バージョン**: ITSM-Sec Nexus v1.0
