# HTTPS設定ガイド

## 概要

本ガイドでは、ITSM-Systemを本番環境でHTTPS対応させるための完全な設定手順を説明します。

### 要件
- ローカルIPアドレス対応（192.168.0.187）
- 自己署名SSL証明書の使用
- Dockerは使用しない
- 既存の開発環境を保持

### セキュリティ機能
- TLS 1.2/1.3のみ許可
- 強力な暗号スイート設定
- HSTS（HTTP Strict Transport Security）
- セキュリティヘッダーの強化
- HTTP→HTTPSリダイレクト

---

## 1. SSL証明書の生成

### 1.1 自己署名証明書の作成

プロジェクトルートで以下のコマンドを実行します：

```bash
# IPアドレスを指定して証明書を生成（デフォルト: 192.168.0.187）
./scripts/generate-ssl-cert.sh

# 別のIPアドレスを使用する場合
./scripts/generate-ssl-cert.sh 192.168.0.100
```

このスクリプトは以下のファイルを`ssl/`ディレクトリに生成します：

- `server.crt` - SSL証明書（公開鍵）
- `server.key` - 秘密鍵（厳重に保管）
- `server.csr` - 証明書署名要求
- `openssl.cnf` - OpenSSL設定ファイル

### 1.2 証明書の確認

生成された証明書を確認します：

```bash
# 証明書の詳細表示
openssl x509 -in ssl/server.crt -text -noout

# SAN（Subject Alternative Name）の確認
openssl x509 -in ssl/server.crt -text -noout | grep -A3 "Subject Alternative Name"
```

出力例：
```
X509v3 Subject Alternative Name:
    IP Address:192.168.0.187, IP Address:127.0.0.1, DNS:localhost, DNS:itsm-system.local
```

### 1.3 セキュリティ設定

秘密鍵を保護します：

```bash
# 秘密鍵の権限を厳格化（所有者のみ読み取り可能）
chmod 600 ssl/server.key

# ssl/ディレクトリを.gitignoreに追加
echo "ssl/" >> .gitignore
```

---

## 2. 環境変数の設定

`.env`ファイルにHTTPS関連の設定を追加します：

```bash
# HTTPSサーバー設定
ENABLE_HTTPS=true
HTTPS_PORT=5443
SSL_CERT_PATH=./ssl/server.crt
SSL_KEY_PATH=./ssl/server.key

# HTTPからHTTPSへのリダイレクト
HTTP_REDIRECT_TO_HTTPS=true
HTTP_PORT=5000

# TLS設定
TLS_MIN_VERSION=TLSv1.2
TLS_MAX_VERSION=TLSv1.3

# フロントエンドHTTPSポート
FRONTEND_HTTPS_PORT=5050

# CORS設定（HTTPSアクセスを許可）
CORS_ORIGIN=https://192.168.0.187:5050,https://localhost:5050,http://localhost:3000
```

### 環境変数の説明

| 変数名 | 説明 | デフォルト値 |
|--------|------|-------------|
| `ENABLE_HTTPS` | HTTPSを有効化 | `false` |
| `HTTPS_PORT` | HTTPSポート番号 | `5443` |
| `SSL_CERT_PATH` | SSL証明書のパス | `./ssl/server.crt` |
| `SSL_KEY_PATH` | 秘密鍵のパス | `./ssl/server.key` |
| `HTTP_REDIRECT_TO_HTTPS` | HTTPからHTTPSへ自動リダイレクト | `false` |
| `TLS_MIN_VERSION` | 最小TLSバージョン | `TLSv1.2` |
| `TLS_MAX_VERSION` | 最大TLSバージョン | `TLSv1.3` |

---

## 3. バックエンドサーバーのHTTPS設定

### 3.1 サーバーコード修正

`backend/server.js`でHTTPSサーバーを起動するように修正します：

```javascript
const https = require('https');
const fs = require('fs');

// HTTPS設定
const enableHttps = process.env.ENABLE_HTTPS === 'true';
const httpsPort = process.env.HTTPS_PORT || 5443;
const httpPort = process.env.HTTP_PORT || 5000;

if (enableHttps) {
  // SSL証明書の読み込み
  const httpsOptions = {
    cert: fs.readFileSync(process.env.SSL_CERT_PATH || './ssl/server.crt'),
    key: fs.readFileSync(process.env.SSL_KEY_PATH || './ssl/server.key'),
    minVersion: process.env.TLS_MIN_VERSION || 'TLSv1.2',
    maxVersion: process.env.TLS_MAX_VERSION || 'TLSv1.3',
    ciphers: [
      'ECDHE-ECDSA-AES128-GCM-SHA256',
      'ECDHE-RSA-AES128-GCM-SHA256',
      'ECDHE-ECDSA-AES256-GCM-SHA384',
      'ECDHE-RSA-AES256-GCM-SHA384',
      'DHE-RSA-AES128-GCM-SHA256',
      'DHE-RSA-AES256-GCM-SHA384'
    ].join(':'),
    honorCipherOrder: true
  };

  // HTTPSサーバー起動
  const httpsServer = https.createServer(httpsOptions, app);
  httpsServer.listen(httpsPort, process.env.HOST || '0.0.0.0', () => {
    console.log(`HTTPS Server running on https://${process.env.SYSTEM_IP}:${httpsPort}`);
  });

  // HTTPからHTTPSへのリダイレクト
  if (process.env.HTTP_REDIRECT_TO_HTTPS === 'true') {
    const http = require('http');
    const redirectApp = express();

    redirectApp.use((req, res) => {
      const httpsUrl = `https://${req.hostname}:${httpsPort}${req.url}`;
      res.redirect(301, httpsUrl);
    });

    redirectApp.listen(httpPort, process.env.HOST || '0.0.0.0', () => {
      console.log(`HTTP Redirect Server running on port ${httpPort} -> HTTPS ${httpsPort}`);
    });
  }
} else {
  // 通常のHTTPサーバー
  app.listen(httpPort, process.env.HOST || '0.0.0.0', () => {
    console.log(`HTTP Server running on http://${process.env.SYSTEM_IP}:${httpPort}`);
  });
}
```

### 3.2 暗号スイートの説明

使用している暗号スイート：

- **ECDHE-ECDSA-AES128-GCM-SHA256** - 楕円曲線ディフィー・ヘルマン + AES-128-GCM
- **ECDHE-RSA-AES128-GCM-SHA256** - 楕円曲線DH + RSA + AES-128-GCM
- **ECDHE-ECDSA-AES256-GCM-SHA384** - 楕円曲線DH + AES-256-GCM
- **ECDHE-RSA-AES256-GCM-SHA384** - 楕円曲線DH + RSA + AES-256-GCM

すべて**Perfect Forward Secrecy（PFS）**対応の暗号スイートです。

---

## 4. フロントエンドHTTPSサーバー

### 4.1 Node.js HTTPSサーバースクリプト

`scripts/frontend-https-server.js`を作成します：

```javascript
#!/usr/bin/env node

const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

// 設定
const PORT = process.env.FRONTEND_HTTPS_PORT || 5050;
const HTTP_PORT = process.env.FRONTEND_HTTP_PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const CERT_PATH = process.env.SSL_CERT_PATH || './ssl/server.crt';
const KEY_PATH = process.env.SSL_KEY_PATH || './ssl/server.key';

// MIMEタイプのマッピング
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf'
};

// リクエストハンドラ
const requestHandler = (req, res) => {
  // セキュリティヘッダー
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  const parsedUrl = url.parse(req.url);
  let pathname = `.${parsedUrl.pathname}`;

  // ディレクトリの場合はindex.htmlを返す
  if (pathname === './') {
    pathname = './index.html';
  }

  const ext = path.parse(pathname).ext;
  const mimeType = mimeTypes[ext] || 'application/octet-stream';

  fs.readFile(pathname, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html');
      res.end('<h1>404 Not Found</h1>');
    } else {
      res.statusCode = 200;
      res.setHeader('Content-Type', mimeType);
      res.end(data);
    }
  });
};

// HTTPSサーバー起動
const httpsOptions = {
  cert: fs.readFileSync(CERT_PATH),
  key: fs.readFileSync(KEY_PATH),
  minVersion: 'TLSv1.2',
  maxVersion: 'TLSv1.3'
};

const httpsServer = https.createServer(httpsOptions, requestHandler);

httpsServer.listen(PORT, HOST, () => {
  console.log(`Frontend HTTPS Server running at https://${HOST}:${PORT}/`);
  console.log(`Access at: https://192.168.0.187:${PORT}/index.html`);
});

// HTTPからHTTPSへのリダイレクト（オプション）
if (process.env.HTTP_REDIRECT_TO_HTTPS === 'true') {
  const httpServer = http.createServer((req, res) => {
    const httpsUrl = `https://${req.headers.host.split(':')[0]}:${PORT}${req.url}`;
    res.writeHead(301, { Location: httpsUrl });
    res.end();
  });

  httpServer.listen(HTTP_PORT, HOST, () => {
    console.log(`Frontend HTTP Redirect Server running on port ${HTTP_PORT} -> HTTPS ${PORT}`);
  });
}
```

実行権限を付与：

```bash
chmod +x scripts/frontend-https-server.js
```

---

## 5. systemdサービス設定

### 5.1 バックエンドサービス（HTTPS対応版）

`systemd/itsm-system-https.service`：

```ini
[Unit]
Description=ITSM-System Backend (HTTPS)
Documentation=https://github.com/Kensan196948G/ITSM-System
After=network.target
Wants=itsm-frontend-https.service

[Service]
Type=simple
User=kensan
WorkingDirectory=/mnt/LinuxHDD/ITSM-System
EnvironmentFile=/mnt/LinuxHDD/ITSM-System/.env

# HTTPSサーバー起動
ExecStart=/usr/bin/node backend/server.js

# 自動再起動設定
Restart=always
RestartSec=10

# プロセス管理
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30

# リソース制限
LimitNOFILE=65536
LimitNPROC=4096

# セキュリティ設定
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/mnt/LinuxHDD/ITSM-System/backend
ReadWritePaths=/mnt/LinuxHDD/ITSM-System/ssl

# ログ設定
StandardOutput=journal
StandardError=journal
SyslogIdentifier=itsm-system-https

[Install]
WantedBy=multi-user.target
```

### 5.2 フロントエンドサービス（HTTPS対応版）

`systemd/itsm-frontend-https.service`：

```ini
[Unit]
Description=ITSM-System Frontend (HTTPS)
Documentation=https://github.com/Kensan196948G/ITSM-System
After=network.target itsm-system-https.service
Requires=itsm-system-https.service

[Service]
Type=simple
User=kensan
WorkingDirectory=/mnt/LinuxHDD/ITSM-System
EnvironmentFile=/mnt/LinuxHDD/ITSM-System/.env

# Node.js HTTPSサーバー起動
ExecStart=/usr/bin/node scripts/frontend-https-server.js

# 自動再起動設定
Restart=always
RestartSec=10

# プロセス管理
KillMode=mixed
KillSignal=SIGTERM
TimeoutStopSec=30

# セキュリティ設定
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/mnt/LinuxHDD/ITSM-System/ssl

# ログ設定
StandardOutput=journal
StandardError=journal
SyslogIdentifier=itsm-frontend-https

[Install]
WantedBy=multi-user.target
```

### 5.3 サービスのインストールと起動

```bash
# サービスファイルをsystemdディレクトリにコピー
sudo cp systemd/itsm-system-https.service /etc/systemd/system/
sudo cp systemd/itsm-frontend-https.service /etc/systemd/system/

# systemdデーモンのリロード
sudo systemctl daemon-reload

# サービスの有効化
sudo systemctl enable itsm-system-https.service
sudo systemctl enable itsm-frontend-https.service

# サービスの起動
sudo systemctl start itsm-system-https.service
sudo systemctl start itsm-frontend-https.service

# ステータス確認
sudo systemctl status itsm-system-https.service
sudo systemctl status itsm-frontend-https.service
```

---

## 6. ファイアウォール設定

HTTPSポートを許可します：

```bash
# UFWを使用している場合
sudo ufw allow 5443/tcp comment 'ITSM Backend HTTPS'
sudo ufw allow 5050/tcp comment 'ITSM Frontend HTTPS'

# HTTPポートを閉じる（リダイレクトのみ使用する場合）
# sudo ufw delete allow 5000/tcp

# 設定の確認
sudo ufw status numbered
```

---

## 7. ブラウザでのアクセス

### 7.1 HTTPSアクセス

ブラウザで以下のURLにアクセス：

```
https://192.168.0.187:5050/index.html
```

### 7.2 自己署名証明書の警告

初回アクセス時、ブラウザで証明書警告が表示されます：

**Chrome/Edge:**
1. "詳細設定" をクリック
2. "192.168.0.187にアクセスする（安全ではありません）" をクリック

**Firefox:**
1. "詳細..." をクリック
2. "危険性を承知で続行" をクリック

### 7.3 証明書を信頼する（推奨）

警告を回避するには、証明書を信頼済みストアに追加します：

#### Linuxの場合

```bash
# 証明書を信頼済みストアにコピー
sudo cp ssl/server.crt /usr/local/share/ca-certificates/itsm-system.crt

# 証明書ストアを更新
sudo update-ca-certificates

# ブラウザを再起動
```

#### Windowsの場合

1. `ssl/server.crt`を右クリック → "証明書のインストール"
2. "ローカルコンピューター" を選択
3. "証明書をすべて次のストアに配置する" → "信頼されたルート証明機関"
4. ブラウザを再起動

---

## 8. セキュリティ強化

### 8.1 HSTS（HTTP Strict Transport Security）

既に`backend/server.js`のhelmet設定で有効化されていますが、明示的に設定：

```javascript
app.use(helmet.hsts({
  maxAge: 31536000, // 1年
  includeSubDomains: true,
  preload: true
}));
```

### 8.2 セキュリティヘッダーの確認

HTTPSサーバー起動後、以下のコマンドで確認：

```bash
curl -I https://192.168.0.187:5443/api/v1/health
```

期待される出力：

```
HTTP/1.1 200 OK
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
Content-Security-Policy: default-src 'self'
```

### 8.3 TLS設定の検証

OpenSSLでTLS設定を確認：

```bash
# TLS 1.2接続テスト
openssl s_client -connect 192.168.0.187:5443 -tls1_2

# TLS 1.3接続テスト
openssl s_client -connect 192.168.0.187:5443 -tls1_3

# 暗号スイートの確認
nmap --script ssl-enum-ciphers -p 5443 192.168.0.187
```

---

## 9. トラブルシューティング

### 9.1 証明書エラー

**問題:** `ENOENT: no such file or directory, open './ssl/server.crt'`

**解決策:**
```bash
# 証明書が存在するか確認
ls -la ssl/

# 証明書を再生成
./scripts/generate-ssl-cert.sh
```

### 9.2 ポート競合

**問題:** `Error: listen EADDRINUSE: address already in use :::5443`

**解決策:**
```bash
# ポート使用状況を確認
sudo lsof -i :5443

# プロセスを停止
sudo systemctl stop itsm-system-https

# または特定のプロセスをkill
sudo kill -9 <PID>
```

### 9.3 権限エラー

**問題:** `Error: EACCES: permission denied, open './ssl/server.key'`

**解決策:**
```bash
# ファイル所有者を確認
ls -la ssl/

# 所有者を変更（systemdサービスのユーザーに合わせる）
sudo chown kensan:kensan ssl/server.key
sudo chmod 600 ssl/server.key
```

### 9.4 ブラウザアクセス失敗

**問題:** `ERR_CONNECTION_REFUSED`

**解決策:**
```bash
# サービスの状態確認
sudo systemctl status itsm-system-https
sudo systemctl status itsm-frontend-https

# ログ確認
sudo journalctl -u itsm-system-https -f
sudo journalctl -u itsm-frontend-https -f

# ファイアウォール確認
sudo ufw status
```

---

## 10. Let's Encryptへの移行（将来的な本番環境）

自己署名証明書は開発・内部環境用です。公開環境では**Let's Encrypt**を使用します。

### 10.1 Certbotのインストール

```bash
sudo apt-get update
sudo apt-get install certbot
```

### 10.2 証明書の取得（スタンドアロンモード）

```bash
# ポート80/443を一時的に停止
sudo systemctl stop itsm-system-https
sudo systemctl stop itsm-frontend-https

# 証明書取得
sudo certbot certonly --standalone -d your-domain.com

# 証明書の場所: /etc/letsencrypt/live/your-domain.com/
```

### 10.3 .env設定の変更

```bash
SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
```

### 10.4 自動更新

```bash
# 更新テスト
sudo certbot renew --dry-run

# cron設定
sudo crontab -e

# 毎月1日の午前3時に更新チェック
0 3 1 * * certbot renew --quiet --post-hook "systemctl restart itsm-system-https"
```

---

## 11. チェックリスト

### 証明書生成

- [ ] `./scripts/generate-ssl-cert.sh`を実行
- [ ] `ssl/server.crt`と`ssl/server.key`が生成されている
- [ ] SANにIPアドレスが含まれている（192.168.0.187）
- [ ] `ssl/`を`.gitignore`に追加

### 環境変数設定

- [ ] `.env`に`ENABLE_HTTPS=true`を設定
- [ ] SSL証明書のパスを正しく設定
- [ ] CORS設定にHTTPSのURLを追加

### サーバー設定

- [ ] `backend/server.js`でHTTPSサーバーが起動する
- [ ] `scripts/frontend-https-server.js`を作成・実行権限付与
- [ ] HTTPからHTTPSへのリダイレクトが動作する

### systemdサービス

- [ ] `systemd/itsm-system-https.service`を作成
- [ ] `systemd/itsm-frontend-https.service`を作成
- [ ] サービスファイルを`/etc/systemd/system/`にコピー
- [ ] `sudo systemctl daemon-reload`を実行
- [ ] サービスを有効化・起動

### セキュリティ

- [ ] TLS 1.2/1.3のみ許可されている
- [ ] 強力な暗号スイートが設定されている
- [ ] HSTSヘッダーが送信されている
- [ ] 秘密鍵の権限が600に設定されている

### アクセステスト

- [ ] `https://192.168.0.187:5050/`でフロントエンドにアクセス可能
- [ ] `https://192.168.0.187:5443/api/v1/health`でAPIにアクセス可能
- [ ] ブラウザでログイン・操作が正常に動作

---

## まとめ

このガイドに従うことで、ITSM-SystemをHTTPS対応の本番環境として運用できます。

### 重要なポイント

1. **自己署名証明書は内部環境専用** - 公開環境ではLet's Encryptを使用
2. **秘密鍵を厳重に保管** - バージョン管理システムに含めない
3. **定期的な証明書更新** - 証明書の有効期限（365日）を把握
4. **セキュリティヘッダーの検証** - 定期的に設定を確認

### 次のステップ

- [ ] 証明書の有効期限管理
- [ ] 監視・アラート設定（証明書期限切れ）
- [ ] バックアップ戦略（証明書含む）
- [ ] セキュリティ監査
