# データ移行ツール

本番環境へのデータ移行ツール群です。

## 実装済みツール一覧

### Microsoft 365連携

| ファイル | 説明 |
|---------|------|
| `test-m365-connection.js` | M365 Graph API接続テスト |
| `extract-users-from-m365.js` | Azure ADからユーザー情報を抽出 |
| `extract-devices-from-intune.js` | Intuneからデバイス情報を抽出（Device.Read.All権限必要） |

### データ投入

| ファイル | 説明 |
|---------|------|
| `load-users.js` | ユーザーデータをDBに投入 |
| `load-assets.js` | 資産データをDBに投入 |
| `import-csv.js` | CSVファイルから各種データをインポート |

### データ管理

| ファイル | 説明 |
|---------|------|
| `remove-dummy-data.js` | ダミー/シードデータを削除 |
| `validate-migration.js` | 移行後のデータ整合性検証 |

---

## クイックスタート

### 1. 環境変数の設定

`.env`ファイルにMicrosoft 365認証情報を設定:

```bash
# Microsoft 365 Graph API Configuration (Non-Interactive Authentication)
M365_TENANT_ID=your-tenant-id
M365_CLIENT_ID=your-client-id
M365_CLIENT_SECRET=your-client-secret
M365_GRAPH_ENDPOINT=https://graph.microsoft.com/v1.0

# Production Mode - Disable automatic seed data insertion
DISABLE_SEED_DATA=true
```

### 2. M365接続テスト

```bash
node backend/scripts/migrate/test-m365-connection.js
```

### 3. M365からユーザー抽出・投入

```bash
# ユーザー抽出
node backend/scripts/migrate/extract-users-from-m365.js

# 確認（オプション）
cat data/extracted/users-m365.json | jq '.[:3]'

# データ投入
node backend/scripts/migrate/load-users.js --file=data/extracted/users-m365.json
```

### 4. CSVからの資産インポート

```bash
# CSVファイルを配置
cp your-assets.csv data/import/assets.csv

# インポート実行
node backend/scripts/migrate/import-csv.js --file=data/import/assets.csv --entity=assets

# データ投入
node backend/scripts/migrate/load-assets.js --file=data/transformed/assets.json
```

### 5. ダミーデータ削除

```bash
# ドライラン（削除せずに確認のみ）
node backend/scripts/migrate/remove-dummy-data.js --dry-run

# 本番実行
node backend/scripts/migrate/remove-dummy-data.js
```

### 6. データ検証

```bash
node backend/scripts/migrate/validate-migration.js --verbose
```

---

## ディレクトリ構造

```
backend/scripts/migrate/
├── README.md                      # このファイル
├── test-m365-connection.js        # M365接続テスト
├── extract-users-from-m365.js     # M365ユーザー抽出
├── extract-devices-from-intune.js # Intuneデバイス抽出
├── load-users.js                  # ユーザー投入
├── load-assets.js                 # 資産投入
├── import-csv.js                  # CSV汎用インポート
├── remove-dummy-data.js           # ダミーデータ削除
└── validate-migration.js          # データ検証

data/
├── extracted/                     # 抽出データ
│   └── users-m365.json
├── transformed/                   # 変換済みデータ
│   └── assets.json
├── import/                        # インポート用CSV配置場所
│   └── my-assets.csv
└── templates/                     # CSVテンプレート
    ├── assets-template.csv
    └── incidents-template.csv

backend/backups/
└── pre-migration/                 # 移行前バックアップ
    └── itsm_nexus_YYYY-MM-DDTHH-MM-SS.db
```

---

## CSVテンプレート

### 資産 (assets-template.csv)

```csv
asset_tag,name,type,criticality,status
PC-001,営業部PC001,Endpoint,3,Operational
SRV-001,ファイルサーバー,Server,5,Operational
NET-001,メインルーター,Network,5,Operational
CLD-001,Microsoft 365テナント,Cloud,5,Operational
```

**フィールド説明**:
- `asset_tag`: 資産タグ（ユニーク）
- `name`: 資産名
- `type`: Server, Endpoint, Network, Cloud, Mobile, Other
- `criticality`: 1-5（5が最重要）
- `status`: Operational, Warning, Critical, Maintenance, Decommissioned

### インシデント (incidents-template.csv)

```csv
ticket_id,title,description,status,priority,is_security_incident
INC-001,ネットワーク接続障害,本社ネットワークに接続できない,Identified,High,false
SEC-001,不審なログイン試行,未知のIPからの複数回ログイン試行を検出,In-Progress,Critical,true
```

---

## コマンドオプション

### extract-users-from-m365.js

```bash
node backend/scripts/migrate/extract-users-from-m365.js [options]

オプション:
  --output=<file>  出力ファイル（デフォルト: data/extracted/users-m365.json）
  --filter=<type>  フィルター: all, internal, external
  --limit=<n>      取得件数上限
```

### load-users.js

```bash
node backend/scripts/migrate/load-users.js [options]

オプション:
  --file=<path>    入力ファイル（必須）
  --mode=<mode>    insert, update, upsert（デフォルト: upsert）
  --dry-run        実際には投入しない
```

### import-csv.js

```bash
node backend/scripts/migrate/import-csv.js [options]

オプション:
  --file=<path>    CSVファイルパス（必須）
  --entity=<type>  エンティティ: users, assets, incidents, changes, problems
  --encoding=<enc> 文字エンコーディング（デフォルト: utf-8）
```

### remove-dummy-data.js

```bash
node backend/scripts/migrate/remove-dummy-data.js [options]

オプション:
  --dry-run        削除せずに確認のみ
  --keep-admin     adminユーザーを保持（デフォルト: true）
  --no-backup      バックアップを作成しない
```

### validate-migration.js

```bash
node backend/scripts/migrate/validate-migration.js [options]

オプション:
  --entity=<type>  特定エンティティのみ検証
  --verbose        詳細出力
  --fix            自動修正を試行
```

---

## Azure AD アプリ登録設定

### 必要な権限

| 権限 | タイプ | 説明 |
|-----|--------|------|
| User.Read.All | Application | ユーザー情報の読み取り |
| Device.Read.All | Application | デバイス情報の読み取り（オプション） |

### 設定手順

1. [Azure Portal](https://portal.azure.com) → Azure Active Directory → アプリの登録
2. 新規登録 → 名前: "ITSM-Sec Nexus"
3. API のアクセス許可 → Microsoft Graph → アプリケーションの許可
4. `User.Read.All` を追加 → 管理者の同意を付与
5. 証明書とシークレット → 新しいクライアントシークレット → 値をコピー
6. `.env` に設定:
   - M365_TENANT_ID: 概要ページの「ディレクトリ (テナント) ID」
   - M365_CLIENT_ID: 概要ページの「アプリケーション (クライアント) ID」
   - M365_CLIENT_SECRET: 作成したシークレットの値

---

## トラブルシューティング

### M365認証エラー

```bash
# 接続テスト
node backend/scripts/migrate/test-m365-connection.js

# 環境変数確認
echo $M365_TENANT_ID
echo $M365_CLIENT_ID
```

**よくあるエラー**:
- `AADSTS7000215`: Client Secret が無効または期限切れ
- `AADSTS700016`: テナントIDまたはクライアントIDが不正
- `403 Insufficient privileges`: 権限不足（管理者の同意が必要）

### データ投入エラー

```bash
# データ検証
node backend/scripts/migrate/validate-migration.js --verbose

# バックアップから復元
cp backend/backups/pre-migration/itsm_nexus_LATEST.db backend/itsm_nexus.db
```

### シードデータが再挿入される

`.env` に以下を設定:
```bash
DISABLE_SEED_DATA=true
```

サービス再起動:
```bash
sudo systemctl restart itsm-system-https.service
```

---

## 関連ドキュメント

- [運用マニュアル](/mnt/LinuxHDD/ITSM-System/Docs/運用マニュアル.md)
- [開発者ガイド](/mnt/LinuxHDD/ITSM-System/Docs/開発者ガイド.md)

---

**最終更新**: 2026-01-02
**バージョン**: 2.0.0
