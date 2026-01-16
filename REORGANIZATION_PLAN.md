# ルートフォルダ整理計画

## 📊 現状分析

ルート直下に**47個のファイル**が混在しています。

---

## 🎯 新しいフォルダ構成

```
/mnt/LinuxHDD/ITSM-System/
├── README.md                    # プロジェクトREADME（ルートに残す）
├── README.en.md                 # 英語版README（ルートに残す）
├── CHANGELOG.md                 # 変更履歴（ルートに残す）
├── package.json                 # プロジェクト設定（ルートに残す）
├── package-lock.json            # 依存関係（ルートに残す）
│
├── scripts/                     # ✨ NEW - 運用スクリプト
│   ├── deploy-services.sh      # サービスデプロイ
│   ├── install-service.sh      # サービスインストール
│   ├── uninstall-service.sh    # サービスアンインストール
│   ├── manage-env.sh           # 環境管理
│   ├── service-manager.sh      # サービス管理（旧）
│   └── switch-env.sh           # 環境切り替え
│
├── services/                    # ✨ NEW - Systemdサービス定義
│   ├── itsm-sec-nexus-dev.service
│   ├── itsm-sec-nexus-prod.service
│   └── itsm-sec-nexus.service  # 旧（削除候補）
│
├── config/                      # ✨ NEW - 設定ファイル
│   ├── env/                    # 環境変数
│   │   ├── .env.development
│   │   ├── .env.production
│   │   ├── .env.example
│   │   ├── .env.https.example
│   │   ├── .env.migration.example
│   │   ├── .env.production.example
│   │   └── .env.test
│   ├── eslint/
│   │   ├── .eslintrc.json
│   │   └── .eslintrc.browser.json
│   ├── jest/
│   │   ├── jest.config.js
│   │   └── jest.config.e2e.js
│   ├── prettier/
│   │   ├── .prettierrc
│   │   └── .prettierignore
│   ├── playwright/
│   │   └── playwright.config.js
│   ├── mcp/
│   │   ├── .mcp.json
│   │   ├── .mcp.json.linux
│   │   └── .mcp.json.windows
│   ├── .gitignore              # Git設定（ルートのシンボリックリンク）
│   ├── knexfile.js             # Knex設定
│   └── opencode.json           # OpenCode設定
│
├── logs/                        # ✨ NEW - ログファイル
│   ├── backend-dev.log
│   ├── backend-prod.log
│   └── backend-server.log      # 旧（削除候補）
│
├── docs/                        # 📚 ドキュメント（既存）
│   ├── README.md
│   ├── DEVELOPMENT_WORKFLOW.md
│   ├── BEST_PRACTICES.md
│   ├── DEPLOYMENT_CHECKLIST.md
│   ├── ENVIRONMENT_SETUP.md
│   ├── SYSTEMD_SERVICE.md
│   ├── QUICKSTART_SYSTEMD.md
│   ├── ACCESS_INFO.md
│   ├── API_DOCS_QUICK_REFERENCE.md
│   ├── ROADMAP.md
│   ├── GITHUB_ISSUES_P0_TO_P2.md
│   ├── SECURITY_API_KEY_ROTATION_REQUIRED.md
│   ├── security-audit-report.md
│   └── ... (その他のMDファイル)
│
├── frontend/                    # フロントエンド（既存）
├── backend/                     # バックエンド（既存）
├── assets/                      # 静的リソース（既存）
├── ssl/                         # SSL証明書（既存）
├── e2e/                         # E2Eテスト（既存）
├── coverage/                    # カバレッジレポート（既存）
├── data/                        # データファイル（既存）
│
└── .env                         # 現在の環境変数（ルートに残す）
```

---

## 📋 移動対象ファイル

### 1. スクリプト → scripts/

- `deploy-services.sh`
- `install-service.sh`
- `uninstall-service.sh`
- `manage-env.sh`
- `service-manager.sh`
- `switch-env.sh`

### 2. Systemdサービス → services/

- `itsm-sec-nexus-dev.service`
- `itsm-sec-nexus-prod.service`
- `itsm-sec-nexus.service`（旧）

### 3. 環境変数 → config/env/

- `.env.development`
- `.env.production`
- `.env.example`
- `.env.https.example`
- `.env.migration.example`
- `.env.production.example`
- `.env.test`

### 4. 設定ファイル → config/

- `.eslintrc.json` → `config/eslint/`
- `.eslintrc.browser.json` → `config/eslint/`
- `jest.config.js` → `config/jest/`
- `jest.config.e2e.js` → `config/jest/`
- `.prettierrc` → `config/prettier/`
- `.prettierignore` → `config/prettier/`
- `playwright.config.js` → `config/playwright/`
- `.mcp.json*` → `config/mcp/`
- `knexfile.js` → `config/`
- `opencode.json` → `config/`

### 5. ログファイル → logs/

- `backend-dev.log`
- `backend-prod.log`
- `backend-server.log`

### 6. ドキュメント → docs/

- `ACCESS_INFO.md`
- `API_DOCS_QUICK_REFERENCE.md`
- `ENVIRONMENT_SETUP.md`
- `GITHUB_ISSUES_P0_TO_P2.md`
- `QUICKSTART_SYSTEMD.md`
- `ROADMAP.md`
- `SECURITY_API_KEY_ROTATION_REQUIRED.md`
- `security-audit-report.md`
- `SYSTEMD_SERVICE.md`

### 7. ルートに残すファイル

- `README.md`
- `README.en.md`
- `CHANGELOG.md`
- `package.json`
- `package-lock.json`
- `.env`（現在使用中）
- `.gitignore`

### 8. 問題のあるファイル（要確認）

- `app.js`（本来は`frontend/`にあるべき）
- `index.html`（本来は`frontend/`にあるべき）
- `style.css`（本来は`frontend/`にあるべき）

---

## ✅ 整理後のメリット

✅ **見通しが良くなる**
- ルート直下が8個のファイル/フォルダのみ
- 目的のファイルを素早く発見

✅ **管理しやすくなる**
- スクリプトは`scripts/`に集約
- 設定ファイルは`config/`に集約
- ログは`logs/`に集約

✅ **新規開発者に優しい**
- フォルダ名で目的が明確
- README.mdがトップにある

---

## 🔄 移行手順

自動移行スクリプトを実行：

```bash
./organize-root.sh
```

---

次ステップ: `organize-root.sh`スクリプトを作成します。
