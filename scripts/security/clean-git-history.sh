#!/bin/bash
#####################################################################
# Git履歴からのシークレット削除スクリプト
#
# このスクリプトは BFG Repo-Cleaner を使用して
# Git履歴から機密情報を完全に削除します。
#
# ⚠️ 警告: このスクリプトは履歴を書き換えます
# ⚠️ チームメンバーに事前通知が必要です
# ⚠️ 実行後は force push が必要です
#####################################################################

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔐 Git履歴シークレット削除スクリプト"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 作業ディレクトリ
WORK_DIR="/tmp/itsm-git-clean-$(date +%Y%m%d-%H%M%S)"
REPO_URL="https://github.com/Kensan196948G/ITSM-System.git"

# 削除対象のシークレットパターン
SECRETS_FILE="$WORK_DIR/secrets.txt"

echo ""
echo "📋 Step 1: 作業ディレクトリを準備"
mkdir -p "$WORK_DIR"
cd "$WORK_DIR"

echo ""
echo "📋 Step 2: シークレットパターンファイルを作成"
cat > "$SECRETS_FILE" << 'EOF'
# 旧Brave Search API Key
***REDACTED_BRAVE_KEY***==>***REDACTED_BRAVE_KEY***

# 旧Context7 API Key
***REDACTED_CONTEXT7_KEY***==>***REDACTED_CONTEXT7_KEY***

# JWT Secret (開発用だが削除推奨)
***REDACTED_JWT_SECRET***==>***REDACTED_JWT_SECRET***
EOF

echo "シークレットパターンファイル作成完了: $SECRETS_FILE"

echo ""
echo "📋 Step 3: BFG Repo-Cleanerの確認"
if ! command -v java &> /dev/null; then
    echo "❌ Javaがインストールされていません"
    echo "   BFG Repo-Cleanerを使用するにはJavaが必要です"
    echo ""
    echo "   インストール方法:"
    echo "   - Ubuntu/Debian: sudo apt install default-jre"
    echo "   - macOS: brew install openjdk"
    echo "   - Windows: https://adoptium.net/ からダウンロード"
    exit 1
fi

BFG_JAR="$WORK_DIR/bfg.jar"
if [ ! -f "$BFG_JAR" ]; then
    echo "BFG Repo-Cleanerをダウンロード中..."
    curl -L -o "$BFG_JAR" https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
fi

echo ""
echo "📋 Step 4: リポジトリをミラークローン"
echo "⚠️ これには時間がかかる場合があります..."
git clone --mirror "$REPO_URL" itsm-system.git

echo ""
echo "📋 Step 5: BFGでシークレットを削除"
cd itsm-system.git
java -jar "$BFG_JAR" --replace-text "$SECRETS_FILE" .

echo ""
echo "📋 Step 6: Git GCでクリーンアップ"
git reflog expire --expire=now --all
git gc --prune=now --aggressive

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ ローカルでのクリーンアップ完了"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "⚠️ 次のステップ（手動実行が必要）:"
echo ""
echo "1. 変更を確認:"
echo "   cd $WORK_DIR/itsm-system.git"
echo "   git log --all --oneline -S 'BSAg8mI' | head -5"
echo "   (出力がなければ成功)"
echo ""
echo "2. リモートにプッシュ（⚠️ 破壊的操作）:"
echo "   git push --force"
echo ""
echo "3. チームメンバーに通知:"
echo "   全員がリポジトリを再クローンする必要があります"
echo ""
echo "4. 古いキーが本当に無効化されていることを確認"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
