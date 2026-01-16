# ITSM-Sec Nexus - 環境別セットアップガイド

## 🎯 環境分離アーキテクチャ

開発環境と本番環境を完全に分離したSystemdサービス構成です。

| 環境 | プロトコル | ポート | サービス名 | 環境変数ファイル |
|------|-----------|--------|-----------|----------------|
| **開発環境** | HTTP | 8080 | `itsm-sec-nexus-dev` | `.env.development` |
| **本番環境** | HTTPS | 6443 | `itsm-sec-nexus-prod` | `.env.production` |

---

## 🚀 クイックスタート

### ステップ1: 既存サービスを停止してデプロイ

```bash
cd /mnt/LinuxHDD/ITSM-System
sudo ./deploy-services.sh
```

### ステップ2: 両方の環境を起動

```bash
sudo ./manage-env.sh both start
```

### ステップ3: アクセス

- **開発環境**: `http://192.168.0.187:8080` → タイトル: `[開発] ITSM-Sec Nexus`
- **本番環境**: `https://192.168.0.187:6443` → タイトル: `[本番] ITSM-Sec Nexus`

---

## 📝 サービス管理

### 基本コマンド

```bash
# 開発環境のみ起動
sudo ./manage-env.sh dev start

# 本番環境のみ起動
sudo ./manage-env.sh prod start

# 両方起動
sudo ./manage-env.sh both start

# 開発環境を停止
sudo ./manage-env.sh dev stop

# 本番環境を再起動
sudo ./manage-env.sh prod restart

# 開発環境の状態を確認
./manage-env.sh dev status

# 本番環境のログを表示
./manage-env.sh prod logs
```

### 自動起動の管理

```bash
# 開発環境の自動起動を有効化
sudo ./manage-env.sh dev enable

# 本番環境の自動起動を有効化
sudo ./manage-env.sh prod enable

# 両方の自動起動を有効化
sudo ./manage-env.sh both enable
```

---

## 🌐 アクセスURL

### 開発環境（HTTP）

```
http://192.168.0.187:8080
```

または

```
http://localhost:8080
```

**特徴**:
- ✅ HTTPSの証明書警告なし
- ✅ HSTSポリシーの影響なし
- ✅ デバッグしやすい
- ✅ ブラウザタブ: `[開発] ITSM-Sec Nexus | ISO 20000 & NIST CSF 2.0`

### 本番環境（HTTPS）

```
https://192.168.0.187:6443
```

または

```
https://localhost:6443
```

**特徴**:
- ✅ 暗号化された通信
- ✅ セキュアなCookie送信
- ✅ HSTSポリシーによる保護
- ✅ ブラウザタブ: `[本番] ITSM-Sec Nexus | ISO 20000 & NIST CSF 2.0`

---

## 🔧 個別のSystemctlコマンド

### 開発環境

```bash
# 起動
sudo systemctl start itsm-sec-nexus-dev

# 停止
sudo systemctl stop itsm-sec-nexus-dev

# 再起動
sudo systemctl restart itsm-sec-nexus-dev

# 状態確認
sudo systemctl status itsm-sec-nexus-dev

# ログ表示
sudo journalctl -u itsm-sec-nexus-dev -f

# 自動起動を有効化
sudo systemctl enable itsm-sec-nexus-dev
```

### 本番環境

```bash
# 起動
sudo systemctl start itsm-sec-nexus-prod

# 停止
sudo systemctl stop itsm-sec-nexus-prod

# 再起動
sudo systemctl restart itsm-sec-nexus-prod

# 状態確認
sudo systemctl status itsm-sec-nexus-prod

# ログ表示
sudo journalctl -u itsm-sec-nexus-prod -f

# 自動起動を有効化
sudo systemctl enable itsm-sec-nexus-prod
```

---

## 📊 ログファイル

各環境のログは別々のファイルに保存されます：

| 環境 | ログファイル |
|------|-------------|
| 開発環境 | `backend-dev.log` |
| 本番環境 | `backend-prod.log` |

```bash
# 開発環境のログを確認
tail -f backend-dev.log

# 本番環境のログを確認
tail -f backend-prod.log
```

---

## 🔄 環境の切り替え

開発と本番を簡単に切り替えられます：

```bash
# 開発環境のみ使用
sudo ./manage-env.sh prod stop
sudo ./manage-env.sh dev start

# 本番環境のみ使用
sudo ./manage-env.sh dev stop
sudo ./manage-env.sh prod start

# 両方同時に使用
sudo ./manage-env.sh both start
```

---

## 💡 使用シナリオ

### シナリオ1: 開発作業

```bash
# 開発環境のみ起動
sudo ./manage-env.sh dev start

# アクセス
http://192.168.0.187:8080

# ログをリアルタイム監視
./manage-env.sh dev logs
```

### シナリオ2: 本番運用

```bash
# 本番環境のみ起動
sudo ./manage-env.sh prod start

# アクセス
https://192.168.0.187:6443

# 状態を定期確認
./manage-env.sh prod status
```

### シナリオ3: 並行テスト

```bash
# 両方を起動
sudo ./manage-env.sh both start

# 開発環境で新機能をテスト
# http://192.168.0.187:8080

# 本番環境で現在の状態を確認
# https://192.168.0.187:6443
```

---

## 🎯 環境別の設定差異

| 設定項目 | 開発環境 | 本番環境 |
|---------|---------|---------|
| プロトコル | HTTP | HTTPS |
| ポート | 8080 | 6443 |
| NODE_ENV | development | production |
| LOG_LEVEL | debug | info |
| HSTS | 無効 | 有効 |
| サンプルデータ | 有効 | 無効 |
| レート制限 | 緩い(1000req/min) | 厳しい(100req/min) |

---

## ✅ デフォルトログイン情報

両方の環境で同じログイン情報を使用：

- **ユーザー名**: `admin`
- **パスワード**: `admin123`

**⚠️ セキュリティ**: 本番環境では必ずパスワードを変更してください！

---

## 🛠️ トラブルシューティング

### サービスが起動しない

```bash
# エラーログを確認
sudo journalctl -u itsm-sec-nexus-dev -n 50
sudo journalctl -u itsm-sec-nexus-prod -n 50

# ログファイルを確認
tail -50 backend-dev.log
tail -50 backend-prod.log
```

### ポート競合

```bash
# ポート使用状況を確認
sudo netstat -tlnp | grep -E ":(8080|6443)"

# プロセスを停止
sudo ./manage-env.sh both stop
```

---

## 📚 関連ドキュメント

- **環境別セットアップ**: このファイル
- **Systemdサービス詳細**: `SYSTEMD_SERVICE.md`
- **クイックスタート**: `QUICKSTART_SYSTEMD.md`
- **アクセス情報**: `ACCESS_INFO.md`

---

**ITSM-Sec Nexus Team**
