# HTTPS実装サマリー

## 成果物一覧

本HTTPS設定の設計により、以下のファイルが作成されました。

### 1. ドキュメント（3ファイル）

| ファイル | 説明 | 用途 |
|---------|------|------|
| `docs/HTTPS_SETUP.md` | 完全なセットアップガイド | 詳細な手順・トラブルシューティング |
| `docs/HTTPS_DESIGN.md` | 設計書・アーキテクチャ | 技術仕様・セキュリティ評価 |
| `docs/HTTPS_QUICKSTART.md` | クイックスタートガイド | 5分で完了する最速セットアップ |

### 2. スクリプト（3ファイル）

| ファイル | 説明 | 実行方法 |
|---------|------|---------|
| `scripts/generate-ssl-cert.sh` | SSL証明書生成スクリプト | `./scripts/generate-ssl-cert.sh 192.168.0.187` |
| `scripts/frontend-https-server.js` | フロントエンドHTTPSサーバー | `node scripts/frontend-https-server.js` |
| `scripts/setup-https.sh` | ワンライナーセットアップ | `./scripts/setup-https.sh 192.168.0.187` |

### 3. サーバー設定（1ファイル）

| ファイル | 説明 | 用途 |
|---------|------|------|
| `backend/server-https.js` | バックエンドHTTPSモジュール | `backend/server.js`から呼び出し |

### 4. systemdサービス（2ファイル）

| ファイル | 説明 | インストール先 |
|---------|------|---------------|
| `systemd/itsm-system-https.service` | バックエンドHTTPSサービス | `/etc/systemd/system/` |
| `systemd/itsm-frontend-https.service` | フロントエンドHTTPSサービス | `/etc/systemd/system/` |

### 5. 環境変数サンプル（1ファイル）

| ファイル | 説明 | 使用方法 |
|---------|------|---------|
| `.env.https.example` | HTTPS環境変数テンプレート | `cp .env.https.example .env` |

### 6. .gitignore更新

SSL証明書をバージョン管理から除外：

```gitignore
ssl/
*.crt
*.key
*.csr
*.pem
```

---

## ファイル構成ツリー

```
ITSM-System/
├── docs/
│   ├── HTTPS_SETUP.md              # 完全セットアップガイド
│   ├── HTTPS_DESIGN.md             # 設計書
│   └── HTTPS_QUICKSTART.md         # クイックスタート
│
├── scripts/
│   ├── generate-ssl-cert.sh        # SSL証明書生成
│   ├── frontend-https-server.js    # フロントエンドHTTPSサーバー
│   └── setup-https.sh              # ワンライナーセットアップ
│
├── backend/
│   └── server-https.js             # HTTPSサーバーモジュール
│
├── systemd/
│   ├── itsm-system-https.service   # バックエンドサービス
│   └── itsm-frontend-https.service # フロントエンドサービス
│
├── .env.https.example              # 環境変数テンプレート
├── .gitignore                      # SSL証明書除外設定追加
│
└── ssl/                            # 証明書格納（.gitignore対象）
    ├── server.crt                  # SSL証明書（生成後）
    ├── server.key                  # 秘密鍵（生成後）
    ├── server.csr                  # CSR（生成後）
    └── openssl.cnf                 # OpenSSL設定（生成後）
```

---

## セットアップフロー

### クイックスタート（推奨）

```bash
# ワンライナーでHTTPS環境を構築
./scripts/setup-https.sh 192.168.0.187
```

このスクリプトは以下を自動実行：

1. ✅ 前提条件チェック（Node.js, OpenSSL）
2. ✅ SSL証明書生成（`ssl/server.crt`, `ssl/server.key`）
3. ✅ 環境変数設定（`.env`作成・更新）
4. ✅ `.gitignore`更新
5. ✅ 依存関係インストール
6. ✅ systemdサービスインストール
7. ✅ ファイアウォール設定

### 手動セットアップ

```bash
# 1. SSL証明書生成
./scripts/generate-ssl-cert.sh 192.168.0.187

# 2. 環境変数設定
cp .env.https.example .env
nano .env  # ENABLE_HTTPS=true を確認

# 3. systemdサービスインストール
sudo cp systemd/itsm-system-https.service /etc/systemd/system/
sudo cp systemd/itsm-frontend-https.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now itsm-system-https itsm-frontend-https

# 4. 動作確認
curl -k https://192.168.0.187:5443/api/v1/health
```

---

## 主要な機能

### 1. SSL証明書生成

`scripts/generate-ssl-cert.sh`の特徴：

- ✅ **SAN対応**: IPアドレス（192.168.0.187）を証明書に含める
- ✅ **複数IPサポート**: 127.0.0.1, localhost も含む
- ✅ **RSA 2048-bit**: 業界標準の鍵長
- ✅ **SHA-256署名**: 安全なハッシュアルゴリズム
- ✅ **365日有効**: 1年間の有効期限
- ✅ **バックアップ機能**: 既存証明書を自動バックアップ

### 2. バックエンドHTTPSサーバー

`backend/server-https.js`の特徴：

- ✅ **TLS 1.2/1.3のみ**: 古いプロトコル無効化
- ✅ **強力な暗号スイート**: Perfect Forward Secrecy対応
- ✅ **HTTPリダイレクト**: HTTP→HTTPS自動転送
- ✅ **グレースフルシャットダウン**: SIGTERM/SIGINT対応
- ✅ **エラーハンドリング**: 証明書エラー・ポート競合検出

### 3. フロントエンドHTTPSサーバー

`scripts/frontend-https-server.js`の特徴：

- ✅ **静的ファイル配信**: HTML/CSS/JS/画像/フォント
- ✅ **MIMEタイプ自動判定**: 20種類以上のファイル形式対応
- ✅ **セキュリティヘッダー**: HSTS, CSP, X-Frame-Options等
- ✅ **パストラバーサル対策**: ../../../etc/passwd 等を拒否
- ✅ **エラーページ**: 404/403/500の美しいエラーページ

### 4. systemdサービス

`systemd/*-https.service`の特徴：

- ✅ **自動起動**: システムブート時に自動起動
- ✅ **自動再起動**: クラッシュ時に自動復旧
- ✅ **リソース制限**: メモリ2GB, CPU 200%制限
- ✅ **セキュリティ強化**: NoNewPrivileges, ProtectSystem等
- ✅ **起動前チェック**: SSL証明書の存在確認

---

## セキュリティ仕様

### TLS設定

| 項目 | 設定値 | 理由 |
|------|--------|------|
| TLS最小バージョン | TLSv1.2 | NIST推奨、PCI DSS準拠 |
| TLS最大バージョン | TLSv1.3 | 最新プロトコル |
| 暗号スイート | ECDHE, AES-GCM, ChaCha20 | Perfect Forward Secrecy |
| 鍵交換 | ECDHE, DHE | 前方秘匿性 |
| 暗号化 | AES-128/256-GCM | 認証付き暗号化 |
| ハッシュ | SHA-256/384 | 安全なハッシュ |

### セキュリティヘッダー

| ヘッダー | 設定値 | 効果 |
|---------|--------|------|
| Strict-Transport-Security | max-age=31536000; includeSubDomains | HTTPS強制（1年） |
| X-Content-Type-Options | nosniff | MIMEスニッフィング防止 |
| X-Frame-Options | DENY | クリックジャッキング防止 |
| X-XSS-Protection | 1; mode=block | XSS攻撃防止 |
| Content-Security-Policy | default-src 'self'; ... | XSS/インジェクション防止 |
| Referrer-Policy | strict-origin-when-cross-origin | リファラー制御 |

---

## 運用ガイド

### 日常運用

```bash
# サービス状態確認
sudo systemctl status itsm-system-https

# ログ確認（リアルタイム）
sudo journalctl -u itsm-system-https -f

# 証明書有効期限確認
openssl x509 -in ssl/server.crt -noout -dates
```

### 証明書更新（365日後）

```bash
# 1. 新しい証明書を生成
./scripts/generate-ssl-cert.sh 192.168.0.187

# 2. サービス再起動
sudo systemctl restart itsm-system-https itsm-frontend-https

# 3. 動作確認
curl -k https://192.168.0.187:5443/api/v1/health
```

### トラブルシューティング

```bash
# ポート競合確認
sudo lsof -i :5443

# 証明書権限確認
ls -la ssl/

# 環境変数確認
cat .env | grep HTTPS

# サービスログ確認
sudo journalctl -u itsm-system-https --no-pager -n 50
```

---

## テスト方法

### 機能テスト

```bash
# 1. HTTPSアクセステスト
curl -k https://192.168.0.187:5443/api/v1/health

# 2. HTTPリダイレクトテスト
curl -I http://192.168.0.187:5000/
# → 301 Moved Permanently

# 3. フロントエンドアクセステスト
curl -k https://192.168.0.187:5050/
```

### セキュリティテスト

```bash
# 1. TLS 1.3接続テスト
openssl s_client -connect 192.168.0.187:5443 -tls1_3

# 2. TLS 1.1接続拒否テスト（エラーになるべき）
openssl s_client -connect 192.168.0.187:5443 -tls1_1

# 3. セキュリティヘッダー確認
curl -I -k https://192.168.0.187:5443/api/v1/health | grep -E "Strict-Transport|X-Frame|X-Content"

# 4. 暗号スイート確認
nmap --script ssl-enum-ciphers -p 5443 192.168.0.187
```

---

## パフォーマンス

### 予想されるオーバーヘッド

| シナリオ | HTTP | HTTPS | 増加率 |
|---------|------|-------|--------|
| 初回接続 | 10ms | 50-100ms | +40-90ms |
| 再接続（セッション再利用） | 10ms | 20-30ms | +10-20ms |
| データ転送 | 100% | 95-98% | -2-5% |

### 最適化推奨事項

- HTTP/2対応（将来的な実装）
- OCSP Stapling（証明書検証高速化）
- Session Tickets（セッション再利用効率化）
- CDN導入（静的ファイル配信高速化）

---

## 移行計画（Let's Encrypt）

公開環境へ移行する際は、Let's Encryptを使用：

```bash
# 1. Certbotインストール
sudo apt-get install certbot

# 2. 証明書取得（ドメイン名が必要）
sudo certbot certonly --standalone -d your-domain.com

# 3. .env更新
SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem

# 4. 自動更新設定
sudo crontab -e
# 毎月1日午前3時に更新
0 3 1 * * certbot renew --quiet --post-hook "systemctl restart itsm-system-https"
```

---

## チェックリスト

### デプロイ前（必須）

- [ ] SSL証明書を生成した
- [ ] 秘密鍵の権限を600に設定した
- [ ] `.env`で`ENABLE_HTTPS=true`を設定した
- [ ] `JWT_SECRET`をランダムな値に変更した
- [ ] CORS設定にHTTPSのURLを追加した
- [ ] `ssl/`を`.gitignore`に追加した

### デプロイ後（推奨）

- [ ] ブラウザでHTTPSアクセスできることを確認
- [ ] セキュリティヘッダーが送信されていることを確認
- [ ] TLS 1.2/1.3で接続できることを確認
- [ ] HTTPからHTTPSへのリダイレクトを確認
- [ ] デフォルトのadminパスワードを変更
- [ ] ファイアウォールでポート5443/5050を許可

### 運用開始後（継続的）

- [ ] 証明書有効期限監視設定（30日前アラート）
- [ ] ログ監視設定
- [ ] セキュリティスキャン実施
- [ ] バックアップ設定（証明書含む）

---

## まとめ

### 達成された目標

✅ **ローカルIPアドレス対応** - 192.168.0.187でHTTPS通信可能
✅ **自己署名SSL証明書** - 内部環境向けに即座に利用可能
✅ **非Docker環境** - ネイティブNode.js環境で動作
✅ **既存環境保持** - HTTP環境を削除せず、HTTPS環境を追加
✅ **セキュリティ強化** - TLS 1.2/1.3、強力な暗号スイート、セキュリティヘッダー
✅ **運用自動化** - systemdサービス化、自動起動・再起動

### ドキュメント構成

1. **HTTPS_QUICKSTART.md** - 初めてのセットアップに最適（5分で完了）
2. **HTTPS_SETUP.md** - 詳細な手順・トラブルシューティング・Let's Encrypt移行
3. **HTTPS_DESIGN.md** - 技術仕様・アーキテクチャ・セキュリティ評価

### 次のステップ

1. `./scripts/setup-https.sh`でHTTPS環境を構築
2. ブラウザで`https://192.168.0.187:5050/`にアクセス
3. 証明書警告を承認（または信頼済みストアに追加）
4. ログイン・動作確認
5. 本番環境ではLet's Encryptへ移行を検討

---

## サポート・参照

- 📖 **README.md** - プロジェクト概要
- 📖 **HTTPS_QUICKSTART.md** - 最速セットアップ
- 📖 **HTTPS_SETUP.md** - 完全セットアップガイド
- 📖 **HTTPS_DESIGN.md** - 設計詳細

---

**本設計により、安全で信頼性の高いHTTPS環境を実現できます。**
