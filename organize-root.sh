#!/bin/bash

# ITSM-Sec Nexus - ルートフォルダ整理スクリプト

set -e

echo "========================================"
echo "ITSM-Sec Nexus ルートフォルダ整理"
echo "========================================"
echo ""

# カレントディレクトリを確認
if [ ! -f "package.json" ]; then
    echo "❌ プロジェクトルートで実行してください"
    exit 1
fi

echo "📁 新しいディレクトリ構造を作成中..."

# 新しいディレクトリを作成
mkdir -p scripts
mkdir -p services
mkdir -p config/env
mkdir -p config/eslint
mkdir -p config/jest
mkdir -p config/prettier
mkdir -p config/playwright
mkdir -p config/mcp
mkdir -p logs
mkdir -p backups

echo "✅ ディレクトリ作成完了"
echo ""

echo "📦 ファイルを移動中..."

# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# 1. スクリプトファイル → scripts/
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "  📜 スクリプトファイルを移動..."
mv deploy-services.sh scripts/ 2>/dev/null || true
mv install-service.sh scripts/ 2>/dev/null || true
mv uninstall-service.sh scripts/ 2>/dev/null || true
mv manage-env.sh scripts/ 2>/dev/null || true
mv service-manager.sh scripts/ 2>/dev/null || true
mv switch-env.sh scripts/ 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# 2. Systemdサービス → services/
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "  ⚙️  Systemdサービスファイルを移動..."
mv itsm-sec-nexus-dev.service services/ 2>/dev/null || true
mv itsm-sec-nexus-prod.service services/ 2>/dev/null || true
mv itsm-sec-nexus.service services/ 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# 3. 環境変数ファイル → config/env/
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "  🔧 環境変数ファイルを移動..."
mv .env.development config/env/ 2>/dev/null || true
mv .env.production config/env/ 2>/dev/null || true
mv .env.example config/env/ 2>/dev/null || true
mv .env.https.example config/env/ 2>/dev/null || true
mv .env.migration.example config/env/ 2>/dev/null || true
mv .env.production.example config/env/ 2>/dev/null || true
mv .env.test config/env/ 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# 4. ESLint設定 → config/eslint/
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "  🔍 ESLint設定を移動..."
mv .eslintrc.json config/eslint/ 2>/dev/null || true
mv .eslintrc.browser.json config/eslint/ 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# 5. Jest設定 → config/jest/
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "  🧪 Jest設定を移動..."
mv jest.config.js config/jest/ 2>/dev/null || true
mv jest.config.e2e.js config/jest/ 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# 6. Prettier設定 → config/prettier/
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "  ✨ Prettier設定を移動..."
mv .prettierrc config/prettier/ 2>/dev/null || true
mv .prettierignore config/prettier/ 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# 7. Playwright設定 → config/playwright/
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "  🎭 Playwright設定を移動..."
mv playwright.config.js config/playwright/ 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# 8. MCP設定 → config/mcp/
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "  🔌 MCP設定を移動..."
mv .mcp.json config/mcp/ 2>/dev/null || true
mv .mcp.json.linux config/mcp/ 2>/dev/null || true
mv .mcp.json.windows config/mcp/ 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# 9. その他の設定ファイル → config/
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "  ⚙️  その他の設定を移動..."
mv knexfile.js config/ 2>/dev/null || true
mv opencode.json config/ 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# 10. ログファイル → logs/
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "  📋 ログファイルを移動..."
mv backend-dev.log logs/ 2>/dev/null || true
mv backend-prod.log logs/ 2>/dev/null || true
mv backend-server.log logs/ 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# 11. ドキュメント → docs/
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "  📚 ドキュメントを移動..."
mv ACCESS_INFO.md docs/ 2>/dev/null || true
mv API_DOCS_QUICK_REFERENCE.md docs/ 2>/dev/null || true
mv ENVIRONMENT_SETUP.md docs/ 2>/dev/null || true
mv GITHUB_ISSUES_P0_TO_P2.md docs/ 2>/dev/null || true
mv QUICKSTART_SYSTEMD.md docs/ 2>/dev/null || true
mv ROADMAP.md docs/ 2>/dev/null || true
mv SECURITY_API_KEY_ROTATION_REQUIRED.md docs/ 2>/dev/null || true
mv security-audit-report.md docs/ 2>/dev/null || true
mv SYSTEMD_SERVICE.md docs/ 2>/dev/null || true

# ━━━━━━━━━━━━━━━━━━━━━━━━━━
# 12. フロントエンドファイル → frontend/
# ━━━━━━━━━━━━━━━━━━━━━━━━━━
echo "  🎨 フロントエンドファイルを確認..."
if [ -f "app.js" ] && [ -f "frontend/app.js" ]; then
    echo "  ⚠️  ルート直下のapp.jsは重複のため削除しません（手動確認が必要）"
fi
if [ -f "index.html" ] && [ -f "frontend/index.html" ]; then
    echo "  ⚠️  ルート直下のindex.htmlは重複のため削除しません（手動確認が必要）"
fi
if [ -f "style.css" ] && [ -f "frontend/style.css" ]; then
    echo "  ⚠️  ルート直下のstyle.cssは重複のため削除しません（手動確認が必要）"
fi

echo ""
echo "========================================"
echo "✅ 整理完了！"
echo "========================================"
echo ""
echo "📁 新しいフォルダ構成:"
echo ""
tree -L 2 -d -I 'node_modules|.git' 2>/dev/null || {
    echo "  scripts/         - 運用スクリプト"
    echo "  services/        - Systemdサービス定義"
    echo "  config/          - 設定ファイル"
    echo "    ├── env/       - 環境変数"
    echo "    ├── eslint/    - ESLint設定"
    echo "    ├── jest/      - Jest設定"
    echo "    ├── prettier/  - Prettier設定"
    echo "    ├── playwright/ - Playwright設定"
    echo "    └── mcp/       - MCP設定"
    echo "  logs/            - ログファイル"
    echo "  docs/            - ドキュメント"
}
echo ""
echo "⚠️  次のアクション:"
echo "  1. Systemdサービスファイルのパスを更新する必要があります"
echo "  2. スクリプトへのパスを更新してください"
echo ""
echo "詳細は UPDATE_PATHS.md を参照してください"
