# HTTPS設計書

## 1. 設計概要

### 1.1 目的

ITSM-Systemを本番環境でHTTPS対応させ、セキュアな通信を実現する。

### 1.2 設計方針

- **自己署名証明書**: 内部環境・開発環境向け（192.168.0.187対応）
- **非Docker環境**: ネイティブNode.js環境での動作
- **開発環境保持**: 既存のHTTP環境は削除せず、HTTPS環境を追加
- **セキュリティ強化**: TLS 1.2/1.3のみ、強力な暗号スイート、セキュリティヘッダー

### 1.3 システム構成図

```
┌─────────────────────────────────────────────────────────────┐
│                     Client Browser                          │
│              https://192.168.0.187:5050                     │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS (TLS 1.2/1.3)
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Frontend HTTPS Server (Port 5050)                │
│         scripts/frontend-https-server.js                    │
│  - Static file serving (HTML/CSS/JS)                       │
│  - Security headers (HSTS, CSP, X-Frame-Options)           │
│  - Self-signed SSL certificate                             │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTPS API Calls
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            Backend HTTPS Server (Port 5443)                 │
│              backend/server.js + server-https.js            │
│  - Express.js + HTTPS module                               │
│  - JWT Authentication + RBAC                               │
│  - Rate Limiting                                           │
│  - Prometheus Metrics                                      │
│  - Self-signed SSL certificate                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│              SQLite Database                                │
│          backend/itsm_nexus.db                             │
└─────────────────────────────────────────────────────────────┘

Optional: HTTP to HTTPS Redirect
┌─────────────────────────────────────────────────────────────┐
│     HTTP Redirect Server (Port 5000 → 5443)               │
│     HTTP Redirect Server (Port 8080 → 5050)               │
│  - 301 Permanent Redirect to HTTPS                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. SSL証明書設計

### 2.1 証明書仕様

| 項目 | 仕様 |
|------|------|
| 証明書タイプ | 自己署名（Self-Signed） |
| アルゴリズム | RSA 2048-bit |
| 署名アルゴリズム | SHA-256 |
| 有効期限 | 365日（1年） |
| SAN対応 | IP Address（192.168.0.187, 127.0.0.1）, DNS（localhost） |
| ファイル配置 | `ssl/server.crt`, `ssl/server.key` |

### 2.2 証明書生成コマンド

```bash
./scripts/generate-ssl-cert.sh 192.168.0.187
```

生成される構成要素：

1. **秘密鍵（server.key）** - 2048-bit RSA
2. **CSR（server.csr）** - 証明書署名要求
3. **証明書（server.crt）** - 自己署名証明書
4. **OpenSSL設定（openssl.cnf）** - SAN設定を含む

### 2.3 SAN（Subject Alternative Name）設定

```ini
[alt_names]
IP.1 = 192.168.0.187
IP.2 = 127.0.0.1
DNS.1 = localhost
DNS.2 = itsm-system.local
```

これにより、以下のアクセスが可能：

- `https://192.168.0.187:5050/`（ネットワークアクセス）
- `https://localhost:5050/`（ローカルアクセス）
- `https://127.0.0.1:5050/`（ローカルアクセス）

---

## 3. TLS/SSL設定

### 3.1 TLSバージョン

- **最小バージョン**: TLS 1.2
- **最大バージョン**: TLS 1.3
- **無効化**: SSL 2.0, SSL 3.0, TLS 1.0, TLS 1.1

```javascript
{
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3'
}
```

### 3.2 暗号スイート（Cipher Suites）

Perfect Forward Secrecy（PFS）対応の暗号スイートのみ使用：

#### TLS 1.3暗号スイート（優先度高）

1. `TLS_AES_256_GCM_SHA384` - AES-256-GCM（最強）
2. `TLS_CHACHA20_POLY1305_SHA256` - ChaCha20-Poly1305（モバイル向け高速）
3. `TLS_AES_128_GCM_SHA256` - AES-128-GCM（標準）

#### TLS 1.2暗号スイート（後方互換性）

4. `ECDHE-ECDSA-AES256-GCM-SHA384` - 楕円曲線DH + AES-256
5. `ECDHE-RSA-AES256-GCM-SHA384` - 楕円曲線DH + RSA + AES-256
6. `ECDHE-ECDSA-CHACHA20-POLY1305` - 楕円曲線DH + ChaCha20
7. `ECDHE-RSA-CHACHA20-POLY1305` - 楕円曲線DH + RSA + ChaCha20
8. `ECDHE-ECDSA-AES128-GCM-SHA256` - 楕円曲線DH + AES-128
9. `ECDHE-RSA-AES128-GCM-SHA256` - 楕円曲線DH + RSA + AES-128

#### 後方互換用（非推奨）

10. `DHE-RSA-AES256-GCM-SHA384` - DHE + AES-256
11. `DHE-RSA-AES128-GCM-SHA256` - DHE + AES-128

### 3.3 暗号スイート選択理由

| 暗号スイート | 特徴 | 用途 |
|-------------|------|------|
| AES-256-GCM | 最高レベルのセキュリティ | 機密性の高いデータ |
| ChaCha20-Poly1305 | ソフトウェア実装で高速 | モバイルデバイス |
| AES-128-GCM | セキュリティと速度のバランス | 一般的な通信 |
| ECDHE/DHE | Perfect Forward Secrecy | 将来的な秘密鍵漏洩対策 |

### 3.4 セキュリティパラメータ

```javascript
{
  honorCipherOrder: true,      // サーバー側の暗号スイート優先
  sessionTimeout: 300,          // セッションタイムアウト（5分）
  ecdhCurve: 'auto'            // 楕円曲線の自動選択
}
```

---

## 4. セキュリティヘッダー設計

### 4.1 HSTS（HTTP Strict Transport Security）

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

- **max-age**: 31536000秒（1年間）
- **includeSubDomains**: サブドメインにも適用
- **preload**: HSTSプリロードリスト登録可能

### 4.2 CSP（Content Security Policy）

```http
Content-Security-Policy:
  default-src 'self';
  script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net;
  img-src 'self' data: https:;
  font-src 'self' https://cdn.jsdelivr.net;
  connect-src 'self' https://192.168.0.187:5443 https://localhost:5443;
  frame-ancestors 'none';
  base-uri 'self';
  form-action 'self'
```

### 4.3 その他のセキュリティヘッダー

| ヘッダー | 値 | 目的 |
|---------|-----|------|
| X-Content-Type-Options | nosniff | MIMEタイプスニッフィング防止 |
| X-Frame-Options | DENY | クリックジャッキング防止 |
| X-XSS-Protection | 1; mode=block | XSS攻撃防止 |
| Referrer-Policy | strict-origin-when-cross-origin | リファラー情報制御 |
| Permissions-Policy | geolocation=(), microphone=(), camera=() | 権限制御 |
| Cross-Origin-Embedder-Policy | require-corp | クロスオリジン埋め込み制御 |
| Cross-Origin-Opener-Policy | same-origin | クロスオリジンウィンドウ制御 |
| Cross-Origin-Resource-Policy | same-origin | クロスオリジンリソース制御 |

---

## 5. アーキテクチャ設計

### 5.1 バックエンドHTTPSサーバー

#### ファイル構成

```
backend/
├── server.js              # メインサーバー（HTTPSモジュールを統合）
├── server-https.js        # HTTPSサーバー起動モジュール
├── db.js                  # データベース接続
├── middleware/
│   ├── auth.js           # JWT認証
│   ├── validation.js     # 入力検証
│   ├── rateLimiter.js    # レート制限
│   ├── csp.js            # セキュリティヘッダー
│   └── metrics.js        # Prometheusメトリクス
└── routes/
    └── health.js         # ヘルスチェック
```

#### server-https.jsの役割

```javascript
const { startHttpsServer } = require('./server-https');

// Expressアプリケーション初期化後
const { httpsServer, httpServer } = startHttpsServer(app);
```

機能：

1. SSL証明書の読み込み
2. HTTPSサーバーの起動
3. HTTPからHTTPSへのリダイレクトサーバー起動
4. グレースフルシャットダウン処理

### 5.2 フロントエンドHTTPSサーバー

#### ファイル: `scripts/frontend-https-server.js`

機能：

1. 静的ファイル配信（HTML/CSS/JS/画像/フォント）
2. MIMEタイプ自動判定
3. セキュリティヘッダー送信
4. パストラバーサル対策
5. エラーページ（404/403/500）
6. HTTPからHTTPSへのリダイレクト

#### MIMEタイプマッピング

```javascript
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  // ... (全20種類以上)
};
```

### 5.3 HTTPリダイレクトサーバー

```javascript
http.createServer((req, res) => {
  const hostname = req.headers.host.split(':')[0];
  const httpsUrl = `https://${hostname}:${httpsPort}${req.url}`;

  res.writeHead(301, {
    Location: httpsUrl,
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
  });
  res.end();
});
```

---

## 6. systemd統合

### 6.1 サービスファイル設計

#### Backend: `itsm-system-https.service`

重要な設定：

```ini
[Service]
EnvironmentFile=/mnt/LinuxHDD/ITSM-System/.env
ExecStartPre=/usr/bin/test -f /mnt/LinuxHDD/ITSM-System/ssl/server.crt
ExecStart=/usr/bin/node backend/server.js
Environment="ENABLE_HTTPS=true"
ReadWritePaths=/mnt/LinuxHDD/ITSM-System/backend
ReadWritePaths=/mnt/LinuxHDD/ITSM-System/ssl
```

#### Frontend: `itsm-frontend-https.service`

重要な設定：

```ini
[Service]
EnvironmentFile=/mnt/LinuxHDD/ITSM-System/.env
ExecStart=/usr/bin/node scripts/frontend-https-server.js
ReadOnlyPaths=/mnt/LinuxHDD/ITSM-System
ReadWritePaths=/mnt/LinuxHDD/ITSM-System/ssl
```

### 6.2 セキュリティ強化設定

| 設定 | 値 | 効果 |
|------|-----|------|
| NoNewPrivileges | true | 権限昇格防止 |
| PrivateTmp | true | /tmpディレクトリの隔離 |
| ProtectSystem | strict | システムディレクトリ保護 |
| ProtectHome | true | ホームディレクトリ保護 |
| ProtectKernelTunables | true | カーネルパラメータ保護 |
| RestrictNamespaces | true | 名前空間制限 |

### 6.3 リソース制限

```ini
LimitNOFILE=65536          # 最大ファイルディスクリプタ数
LimitNPROC=4096            # 最大プロセス数
MemoryMax=2G               # 最大メモリ使用量
CPUQuota=200%              # CPU使用率制限
```

---

## 7. 環境変数設計

### 7.1 .env.https.example構成

#### カテゴリ別設定

1. **Server Configuration** - ポート番号、ホスト設定
2. **HTTPS Configuration** - SSL証明書パス、TLS設定
3. **JWT Configuration** - 認証トークン設定
4. **CORS Configuration** - クロスオリジン許可設定
5. **Rate Limiting** - レート制限設定
6. **Security Headers** - セキュリティヘッダー設定
7. **Monitoring & Metrics** - 監視設定

### 7.2 主要な環境変数

```bash
# HTTPS有効化
ENABLE_HTTPS=true

# HTTPSポート
HTTPS_PORT=5443

# SSL証明書
SSL_CERT_PATH=./ssl/server.crt
SSL_KEY_PATH=./ssl/server.key

# HTTPリダイレクト
HTTP_REDIRECT_TO_HTTPS=true

# TLS設定
TLS_MIN_VERSION=TLSv1.2
TLS_MAX_VERSION=TLSv1.3

# CORS（HTTPSアクセス許可）
CORS_ORIGIN=https://192.168.0.187:5050,https://localhost:5050
```

---

## 8. セキュリティ評価

### 8.1 セキュリティスコア（予測）

- **SSL Labs評価**: A-〜A（自己署名証明書のため最高評価は不可）
- **TLS設定**: A+（TLS 1.2/1.3のみ、強力な暗号スイート）
- **セキュリティヘッダー**: A+（全ヘッダー対応）

### 8.2 対策済みの脆弱性

| 脆弱性 | 対策 |
|--------|------|
| SSL 3.0 POODLE | SSL 3.0無効化 |
| TLS 1.0/1.1脆弱性 | TLS 1.2/1.3のみ許可 |
| BEAST攻撃 | TLS 1.1以降で対策済み |
| CRIME攻撃 | TLS圧縮無効化 |
| Heartbleed | OpenSSL最新版使用 |
| クリックジャッキング | X-Frame-Options: DENY |
| XSS | CSP + X-XSS-Protection |
| MIMEスニッフィング | X-Content-Type-Options: nosniff |

### 8.3 残存リスク

| リスク | レベル | 緩和策 |
|--------|--------|--------|
| 自己署名証明書 | 中 | ブラウザ警告が表示される → Let's Encrypt移行を推奨 |
| 証明書期限切れ | 中 | 365日後に手動更新が必要 → 監視設定 |
| 秘密鍵漏洩 | 高 | 権限600、.gitignore追加、バックアップ暗号化 |

---

## 9. パフォーマンス設計

### 9.1 TLSハンドシェイク最適化

- **セッション再利用**: 300秒（5分）
- **OCSP Stapling**: 未実装（将来対応）
- **HTTP/2**: 未対応（将来対応可能）

### 9.2 予想されるパフォーマンス影響

| 項目 | HTTP | HTTPS | オーバーヘッド |
|------|------|-------|--------------|
| 初回接続 | 10ms | 50-100ms | +40-90ms（TLSハンドシェイク） |
| 再接続 | 10ms | 20-30ms | +10-20ms（セッション再利用） |
| データ転送 | 100% | 95-98% | 暗号化/復号化コスト |

### 9.3 最適化推奨事項

1. **HTTP/2対応** - Node.js 10以降サポート
2. **OCSP Stapling** - 証明書検証の高速化
3. **Session Tickets** - セッション再利用の効率化

---

## 10. 運用設計

### 10.1 証明書ライフサイクル

```
┌─────────────┐
│ 証明書生成  │ ./scripts/generate-ssl-cert.sh
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ デプロイ    │ sudo systemctl start itsm-system-https
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 監視        │ 有効期限チェック（365日後）
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ 更新        │ 有効期限30日前に再生成
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ ローテーション│ sudo systemctl restart itsm-system-https
└─────────────┘
```

### 10.2 監視項目

1. **証明書有効期限** - 30日前にアラート
2. **TLS接続エラー** - 証明書不一致、期限切れ
3. **暗号スイート使用状況** - 弱い暗号の使用検出
4. **HTTPS接続数** - 異常なトラフィック検出

### 10.3 ログ確認

```bash
# サービスログ
sudo journalctl -u itsm-system-https -f
sudo journalctl -u itsm-frontend-https -f

# 証明書情報
openssl x509 -in ssl/server.crt -text -noout

# 接続テスト
openssl s_client -connect 192.168.0.187:5443 -tls1_3
```

---

## 11. 移行計画（Let's Encrypt）

### 11.1 本番環境への移行手順

将来的に公開環境へ移行する場合、Let's Encryptを使用：

```bash
# 1. Certbotインストール
sudo apt-get install certbot

# 2. 証明書取得
sudo certbot certonly --standalone -d your-domain.com

# 3. .env更新
SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem

# 4. 自動更新設定
sudo crontab -e
0 3 1 * * certbot renew --quiet --post-hook "systemctl restart itsm-system-https"
```

### 11.2 移行時の注意点

- ドメイン名が必要（IPアドレスでは取得不可）
- ポート80/443が必要（スタンドアロンモード）
- 90日ごとに自動更新設定が必要

---

## 12. テスト計画

### 12.1 機能テスト

- [ ] SSL証明書生成スクリプトの動作確認
- [ ] HTTPSサーバー起動確認（Backend/Frontend）
- [ ] HTTP→HTTPSリダイレクト動作確認
- [ ] ブラウザアクセステスト
- [ ] APIエンドポイント動作確認

### 12.2 セキュリティテスト

- [ ] TLS 1.0/1.1接続拒否確認
- [ ] 暗号スイート設定確認
- [ ] セキュリティヘッダー送信確認
- [ ] パストラバーサル対策確認
- [ ] HSTS動作確認

### 12.3 パフォーマンステスト

- [ ] 同時接続数テスト
- [ ] レスポンスタイム測定
- [ ] メモリ使用量確認
- [ ] CPU使用率確認

### 12.4 テストコマンド

```bash
# TLS接続テスト
openssl s_client -connect 192.168.0.187:5443 -tls1_3

# セキュリティヘッダー確認
curl -I -k https://192.168.0.187:5443/api/v1/health

# 暗号スイート確認
nmap --script ssl-enum-ciphers -p 5443 192.168.0.187

# HTTPSリダイレクト確認
curl -I http://192.168.0.187:5000/
```

---

## まとめ

本設計書に基づいてHTTPS環境を構築することで、以下を実現します：

### 達成されるセキュリティ目標

1. **通信の暗号化** - TLS 1.2/1.3による強力な暗号化
2. **認証** - SSL証明書による通信相手の認証
3. **完全性** - データ改ざん防止
4. **セキュリティヘッダー** - XSS、クリックジャッキング等の対策
5. **Perfect Forward Secrecy** - 将来的な秘密鍵漏洩への耐性

### 運用のポイント

1. **証明書管理** - 有効期限の監視と更新
2. **ログ監視** - エラーの早期検出
3. **定期的なセキュリティ監査** - 脆弱性スキャン
4. **Let's Encryptへの移行** - 公開環境では必須

本設計に基づき、安全で信頼性の高いHTTPS環境を実現できます。
