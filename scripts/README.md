# Scripts フォルダ構成

このディレクトリには、ITSM-Systemの起動・セットアップ・運用に関するスクリプトが格納されています。

## 📁 フォルダ構造

```
scripts/
├── Windows/                    # Windows専用スクリプト
│   ├── start-dev.bat          # 開発環境起動（Backend + Frontend）
│   └── stop-dev.bat           # 開発環境停止
│
└── Linux/                      # Linux専用スクリプト
    ├── startup/               # システム起動・停止スクリプト
    │   ├── start-system.sh   # システム起動
    │   └── stop-system.sh    # システム停止
    │
    ├── setup/                 # セットアップスクリプト
    │   ├── setup-environment.sh  # 環境変数セットアップ
    │   ├── setup-ssl.sh         # SSL証明書セットアップ（統合版）
    │   └── setup-services.sh    # systemdサービスインストール（統合版）
    │
    ├── operations/            # 運用スクリプト
    │   ├── backup.sh         # データベースバックアップ
    │   ├── restore.sh        # データベースリストア
    │   └── restart-services.sh  # サービス再起動
    │
    └── lib/                   # 共通ライブラリ・設定ファイル
        ├── frontend-https-server.js  # フロントエンドHTTPSサーバー
        └── itsm-sudoers-config      # sudoers設定ファイル
```

---

## 🪟 Windows スクリプト

### 開発環境起動

```cmd
scripts\Windows\start-dev.bat
```

**機能:**
- Node.js と npm の存在確認
- 依存関係のインストール（必要に応じて）
- .env ファイルの確認・作成
- データベースマイグレーション実行
- バックエンドAPIサーバー起動（ポート 5000）
- フロントエンドHTTPサーバー起動（ポート 8080）
- ブラウザ自動起動

**アクセスURL:**
- Frontend: `http://localhost:8080/index.html`
- Backend API: `http://localhost:5000/api/v1`

### 開発環境停止

```cmd
scripts\Windows\stop-dev.bat
```

**機能:**
- ポート 5000 で動作中のプロセスを停止（Backend）
- ポート 8080 で動作中のプロセスを停止（Frontend）

---

## 🐧 Linux スクリプト

### 1. 起動・停止（startup/）

#### システム起動

```bash
./scripts/Linux/startup/start-system.sh
```

**機能:**
- Node.js の存在確認
- 依存関係のインストール（必要に応じて）
- .env ファイルの IP アドレス更新
- バックエンドAPIサーバー起動（ポート 5000）
- フロントエンドHTTPサーバー起動（ポート 5050、Python http.server）
- アクセスURL表示

#### システム停止

```bash
./scripts/Linux/startup/stop-system.sh
```

**機能:**
- バックエンドAPIサーバー停止
- フロントエンドHTTPサーバー停止
- ポート使用状況の確認

---

### 2. セットアップ（setup/）

#### 環境変数セットアップ

```bash
./scripts/Linux/setup/setup-environment.sh
```

**機能:**
- システムIPアドレスの自動検出
- セキュアな秘密鍵の自動生成（JWT_SECRET、REDIS_PASSWORD、GRAFANA_PASSWORD）
- `.env.production` ファイルの作成
- 適切なファイル権限の設定（600）

**生成される秘密鍵:**
- JWT_SECRET: 64バイト
- REDIS_PASSWORD: 32バイト
- GRAFANA_ADMIN_PASSWORD: 16バイト

#### SSL証明書セットアップ（統合版）

```bash
./scripts/Linux/setup/setup-ssl.sh [IPアドレス]
```

**機能:**
- **自己署名証明書生成** （開発・テスト用）
  - OpenSSL設定ファイル自動生成
  - SAN（Subject Alternative Name）対応
  - IPアドレスとドメイン名の両方をサポート
  - 秘密鍵・CSR・証明書の生成
  - 証明書の詳細表示と検証
- **Let's Encrypt証明書取得** （本番用）
  - certbot のインストール（必要に応じて）
  - スタンドアロンモードでの証明書取得
  - 自動更新の設定（cron）
- .gitignore への ssl/ 追加

**統合元スクリプト:**
- `generate-ssl-cert.sh`（自己署名証明書生成）
- `setup-ssl.sh`（Let's Encrypt セットアップ）

**生成されるファイル:**
- `ssl/server.crt` - サーバー証明書
- `ssl/server.key` - 秘密鍵
- `ssl/server.csr` - 証明書署名要求
- `ssl/openssl.cnf` - OpenSSL 設定ファイル

#### systemdサービスセットアップ（統合版）

```bash
./scripts/Linux/setup/setup-services.sh
```

**機能:**
1. **sudoers設定**
   - パスワードなしでsystemctlコマンドを実行可能に
   - セキュアな権限設定（440）
   - 構文検証
   - 既存設定のバックアップ
2. **サービスタイプ選択**
   - HTTPS サービス（推奨）
   - HTTP サービス（レガシー）
   - 両方
3. **systemdサービスインストール**
   - サービスファイルのコピー
   - systemd daemon のリロード
   - サービスの有効化
   - サービスの起動（オプション）

**統合元スクリプト:**
- `install-systemd.sh`（HTTP版）
- `install-https-services.sh`（HTTPS版）
- `setup-sudoers.sh`
- `setup-sudo-nopasswd.sh`

**対応サービス:**
- `itsm-system-https.service` - バックエンドHTTPS（ポート 5443）
- `itsm-frontend-https.service` - フロントエンドHTTPS（ポート 5050）
- `itsm-system.service` - バックエンドHTTP（ポート 5000）
- `itsm-frontend.service` - フロントエンドHTTP（ポート 8080）

---

### 3. 運用（operations/）

#### データベースバックアップ

```bash
./scripts/Linux/operations/backup.sh [daily|weekly|monthly]
```

**機能:**
- 自動バックアップタイプ判定（日次・週次・月次）
- SQLダンプとバイナリバックアップの両方を作成
- WAL・SHMファイルのバックアップ
- SHA256チェックサム生成
- 古いバックアップの自動削除（保持ポリシー適用）
- リモートサーバーへのアップロード（オプション）
- AWS S3へのアップロード（オプション）

**保持ポリシー:**
- 日次: 7日間
- 週次: 4週間
- 月次: 12ヶ月

**バックアップ先:**
- `backend/backups/daily/`
- `backend/backups/weekly/`
- `backend/backups/monthly/`

#### データベースリストア

```bash
./scripts/Linux/operations/restore.sh <backup_file_path>
```

**機能:**
- チェックサム検証
- 現在のデータベースの安全バックアップ
- サービスの自動停止・起動
- データベースの整合性チェック
- ロールバック機能（失敗時）
- ヘルスチェック

**使用例:**
```bash
./scripts/Linux/operations/restore.sh backend/backups/daily/itsm_nexus_daily_20251228_020000.db
```

#### サービス再起動

```bash
./scripts/Linux/operations/restart-services.sh
```

**機能:**
- HTTPS バックエンドサービスの再起動
- HTTPS フロントエンドサービスの再起動
- サービス状態の確認
- ポート使用状況の確認

**対象サービス:**
- `itsm-system-https.service`
- `itsm-frontend-https.service`

---

### 4. ライブラリ（lib/）

#### フロントエンドHTTPSサーバー

**ファイル:** `frontend-https-server.js`

**機能:**
- 静的ファイル配信（HTTPS）
- セキュリティヘッダー送信（CSP、HSTS、など）
- HTTPからHTTPSへのリダイレクト
- TLS 1.2/1.3対応
- パストラバーサル対策
- MIMEタイプ自動判定

**使用方法:**
```bash
node scripts/Linux/lib/frontend-https-server.js
```

**環境変数:**
- `FRONTEND_HTTPS_PORT`: HTTPSポート（デフォルト: 5050）
- `FRONTEND_HTTP_PORT`: HTTPポート（デフォルト: 8080）
- `SSL_CERT_PATH`: 証明書パス
- `SSL_KEY_PATH`: 秘密鍵パス
- `HTTP_REDIRECT_TO_HTTPS`: HTTPリダイレクト有効化

#### sudoers設定ファイル

**ファイル:** `itsm-sudoers-config`

systemctl コマンドをパスワードなしで実行するための sudoers 設定テンプレートです。
`setup-services.sh` によって自動的にインストールされます。

---

## 🔄 統合されたスクリプト（削除済み）

以下のスクリプトは統合され、新しいスクリプトに置き換えられました：

### setup-ssl.sh に統合
- ❌ `generate-ssl-cert.sh` - 自己署名証明書生成
- ❌ `setup-https.sh` - HTTPS環境一括セットアップ

### setup-services.sh に統合
- ❌ `install-systemd.sh` - HTTP版systemdサービスインストール
- ❌ `install-https-services.sh` - HTTPS版systemdサービスインストール
- ❌ `setup-sudoers.sh` - sudoers設定
- ❌ `setup-sudo-nopasswd.sh` - sudo NOPASSWD設定

### リネーム
- ✅ `setup-env.sh` → `setup-environment.sh`
- ✅ `restart-all-services.sh` → `restart-services.sh`

---

## 📊 削減効果

| カテゴリ | 統合前 | 統合後 | 削減率 |
|---------|-------|-------|-------|
| Linux スクリプト | 13個 | 9個 | 約30%削減 |
| 全体 | 16個 | 12個 | 25%削減 |

---

## 🚀 クイックスタートガイド

### Windows（開発環境）

```cmd
# 起動
scripts\Windows\start-dev.bat

# 停止
scripts\Windows\stop-dev.bat
```

### Linux（本番環境セットアップ）

```bash
# 1. 環境変数セットアップ
./scripts/Linux/setup/setup-environment.sh

# 2. SSL証明書生成
./scripts/Linux/setup/setup-ssl.sh

# 3. systemdサービスインストール
./scripts/Linux/setup/setup-services.sh

# 4. サービス起動（自動）
# または手動起動:
sudo systemctl start itsm-system-https itsm-frontend-https
```

### Linux（日常運用）

```bash
# システム起動
./scripts/Linux/startup/start-system.sh

# システム停止
./scripts/Linux/startup/stop-system.sh

# バックアップ（日次）
./scripts/Linux/operations/backup.sh daily

# サービス再起動
./scripts/Linux/operations/restart-services.sh
```

---

## 📝 注意事項

1. **実行権限**: Linux スクリプトには実行権限が必要です
   ```bash
   chmod +x scripts/Linux/**/*.sh
   ```

2. **セキュリティ**:
   - `.env` ファイルは `.gitignore` に追加されています
   - `ssl/` ディレクトリは `.gitignore` に追加されています
   - 秘密鍵ファイルの権限は 600 に設定されます

3. **systemd サービス**:
   - サービスは system wide で動作します（/etc/systemd/system/）
   - sudoers 設定により、パスワードなしで操作可能

4. **バックアップ**:
   - cron で自動実行する場合は、crontab に登録してください
   - リモートバックアップには環境変数 `BACKUP_REMOTE_HOST` の設定が必要

---

## 🤝 貢献

スクリプトの改善提案は Issue または Pull Request でお願いします。

---

## 📄 ライセンス

ITSM-System プロジェクトのライセンスに準じます。
