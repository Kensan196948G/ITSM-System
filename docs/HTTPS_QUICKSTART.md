# HTTPS クイックスタートガイド

## 最速セットアップ（5分で完了）

### 前提条件

- Node.js v20.x以上
- OpenSSL
- Ubuntu/Debian系Linux

### ワンライナーセットアップ

```bash
cd /mnt/LinuxHDD/ITSM-System
./scripts/setup-https.sh 192.168.0.187
```

このスクリプトが以下を自動実行します：

1. SSL証明書生成
2. 環境変数設定
3. 依存関係インストール
4. systemdサービスインストール
5. ファイアウォール設定

---

## 手動セットアップ（詳細制御）

### ステップ1: SSL証明書生成

```bash
./scripts/generate-ssl-cert.sh 192.168.0.187
```

生成されるファイル：
- `ssl/server.crt` - 証明書
- `ssl/server.key` - 秘密鍵

### ステップ2: 環境変数設定

```bash
cp .env.https.example .env
nano .env
```

最低限の設定：

```bash
ENABLE_HTTPS=true
HTTPS_PORT=5443
SYSTEM_IP=192.168.0.187
CORS_ORIGIN=https://192.168.0.187:5050,https://localhost:5050
```

### ステップ3: 依存関係インストール

```bash
npm install
```

### ステップ4: テスト起動

```bash
# ターミナル1: バックエンド
ENABLE_HTTPS=true node backend/server.js

# ターミナル2: フロントエンド
node scripts/frontend-https-server.js
```

### ステップ5: 動作確認

```bash
# ヘルスチェック
curl -k https://192.168.0.187:5443/api/v1/health

# ブラウザアクセス
https://192.168.0.187:5050/index.html
```

### ステップ6: systemdサービス化

```bash
# サービスファイルインストール
sudo cp systemd/itsm-system-https.service /etc/systemd/system/
sudo cp systemd/itsm-frontend-https.service /etc/systemd/system/

# systemdリロード
sudo systemctl daemon-reload

# 有効化・起動
sudo systemctl enable --now itsm-system-https
sudo systemctl enable --now itsm-frontend-https

# ステータス確認
sudo systemctl status itsm-system-https
sudo systemctl status itsm-frontend-https
```

---

## トラブルシューティング

### 証明書エラー

```bash
# 証明書が見つからない
ls -la ssl/
# → 証明書を再生成: ./scripts/generate-ssl-cert.sh

# 権限エラー
chmod 600 ssl/server.key
chmod 644 ssl/server.crt
```

### ポート競合

```bash
# ポート使用状況確認
sudo lsof -i :5443
sudo lsof -i :5050

# プロセス停止
sudo systemctl stop itsm-system-https
sudo systemctl stop itsm-frontend-https
```

### ブラウザ警告を消す

```bash
# Linux: 証明書を信頼済みストアに追加
sudo cp ssl/server.crt /usr/local/share/ca-certificates/itsm-system.crt
sudo update-ca-certificates

# Windows: server.crtをダブルクリックして「信頼されたルート証明機関」にインストール
```

### サービスが起動しない

```bash
# ログ確認
sudo journalctl -u itsm-system-https -f
sudo journalctl -u itsm-frontend-https -f

# 設定ファイル確認
cat /etc/systemd/system/itsm-system-https.service

# 環境変数確認
cat .env | grep HTTPS
```

---

## 主要なコマンド

### サービス管理

```bash
# 起動
sudo systemctl start itsm-system-https itsm-frontend-https

# 停止
sudo systemctl stop itsm-system-https itsm-frontend-https

# 再起動
sudo systemctl restart itsm-system-https itsm-frontend-https

# ステータス確認
sudo systemctl status itsm-system-https

# ログ確認
sudo journalctl -u itsm-system-https -f
```

### 証明書管理

```bash
# 証明書情報表示
openssl x509 -in ssl/server.crt -text -noout

# 有効期限確認
openssl x509 -in ssl/server.crt -noout -dates

# 証明書再生成
./scripts/generate-ssl-cert.sh 192.168.0.187
sudo systemctl restart itsm-system-https itsm-frontend-https
```

### セキュリティ検証

```bash
# TLS接続テスト
openssl s_client -connect 192.168.0.187:5443 -tls1_3

# セキュリティヘッダー確認
curl -I -k https://192.168.0.187:5443/api/v1/health

# 暗号スイート確認
nmap --script ssl-enum-ciphers -p 5443 192.168.0.187
```

---

## アクセスURL

### 本番環境（HTTPS）

- **フロントエンド**: https://192.168.0.187:5050/index.html
- **バックエンドAPI**: https://192.168.0.187:5443/api/v1/
- **Swagger UI**: https://192.168.0.187:5443/api-docs
- **メトリクス**: https://192.168.0.187:5443/metrics
- **ヘルスチェック**: https://192.168.0.187:5443/api/v1/health

### ローカルアクセス

- https://localhost:5050/index.html
- https://localhost:5443/api/v1/health

---

## 環境の切り替え

### HTTP環境（開発用）

```bash
# .envで無効化
ENABLE_HTTPS=false

# または既存のサービス使用
sudo systemctl start itsm-system
sudo systemctl start itsm-frontend
```

### HTTPS環境（本番用）

```bash
# .envで有効化
ENABLE_HTTPS=true

# HTTPSサービス起動
sudo systemctl start itsm-system-https
sudo systemctl start itsm-frontend-https
```

---

## セキュリティチェックリスト

本番デプロイ前に確認：

- [ ] SSL証明書を生成した（`ssl/server.crt`が存在）
- [ ] 秘密鍵の権限を600に設定した（`chmod 600 ssl/server.key`）
- [ ] `.env`で`ENABLE_HTTPS=true`を設定した
- [ ] `JWT_SECRET`をランダムな値に変更した
- [ ] CORS設定にHTTPSのURLを追加した
- [ ] デフォルトのadminパスワードを変更した
- [ ] ファイアウォールでポート5443/5050を許可した
- [ ] `ssl/`と`.env`を`.gitignore`に追加した
- [ ] ブラウザでHTTPSアクセスできることを確認した
- [ ] セキュリティヘッダーが送信されていることを確認した

---

## 次のステップ

### Let's Encryptへの移行（公開環境向け）

```bash
# 1. Certbotインストール
sudo apt-get install certbot

# 2. ドメイン名で証明書取得
sudo certbot certonly --standalone -d your-domain.com

# 3. .env更新
SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem

# 4. サービス再起動
sudo systemctl restart itsm-system-https
```

### 監視設定

- Prometheusメトリクス収集
- 証明書有効期限監視（30日前アラート）
- TLSエラー監視
- 異常なトラフィック検知

### パフォーマンス最適化

- HTTP/2対応
- OCSP Stapling
- Session Ticket
- Brotli/Gzip圧縮

---

## 参考資料

- 📖 [HTTPS_SETUP.md](./HTTPS_SETUP.md) - 完全なセットアップ手順
- 📖 [HTTPS_DESIGN.md](./HTTPS_DESIGN.md) - 設計詳細・アーキテクチャ
- 📖 [README.md](../README.md) - プロジェクト概要

---

## サポート

問題が発生した場合：

1. ログを確認: `sudo journalctl -u itsm-system-https -f`
2. 証明書を確認: `openssl x509 -in ssl/server.crt -text -noout`
3. 環境変数を確認: `cat .env | grep HTTPS`
4. ドキュメントを参照: `docs/HTTPS_SETUP.md`
