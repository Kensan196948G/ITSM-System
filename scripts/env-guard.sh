#!/bin/bash

# ============================================================================
# ITSM-Sec Nexus - 環境ガードスクリプト
# ============================================================================
# 本番環境への誤操作を防止するための検証スクリプト
#
# 使用例:
#   source scripts/env-guard.sh
#   check_environment_safety "本番環境にデプロイ"
# ============================================================================

# 色定義
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'
BOLD='\033[1m'

# 環境検出
detect_environment() {
    local env_file="${1:-.env}"

    if [ ! -f "$env_file" ]; then
        echo "unknown"
        return 1
    fi

    local node_env=$(grep "^NODE_ENV=" "$env_file" | cut -d'=' -f2 | tr -d '[:space:]' | tr -d '"' | tr -d "'")
    echo "$node_env"
}

# 環境表示バナー
show_environment_banner() {
    local current_env=$(detect_environment)

    echo ""
    if [ "$current_env" = "production" ]; then
        echo -e "${RED}${BOLD}╔════════════════════════════════════════════╗${NC}"
        echo -e "${RED}${BOLD}║                                            ║${NC}"
        echo -e "${RED}${BOLD}║    ⚠️  本番環境 (PRODUCTION MODE) ⚠️     ║${NC}"
        echo -e "${RED}${BOLD}║                                            ║${NC}"
        echo -e "${RED}${BOLD}║    すべての操作は慎重に行ってください    ║${NC}"
        echo -e "${RED}${BOLD}║                                            ║${NC}"
        echo -e "${RED}${BOLD}╚════════════════════════════════════════════╝${NC}"
    elif [ "$current_env" = "development" ]; then
        echo -e "${GREEN}${BOLD}╔════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}${BOLD}║                                            ║${NC}"
        echo -e "${GREEN}${BOLD}║      開発環境 (DEVELOPMENT MODE)          ║${NC}"
        echo -e "${GREEN}${BOLD}║                                            ║${NC}"
        echo -e "${GREEN}${BOLD}╚════════════════════════════════════════════╝${NC}"
    else
        echo -e "${YELLOW}${BOLD}╔════════════════════════════════════════════╗${NC}"
        echo -e "${YELLOW}${BOLD}║                                            ║${NC}"
        echo -e "${YELLOW}${BOLD}║        ⚠️  環境が不明です ⚠️             ║${NC}"
        echo -e "${YELLOW}${BOLD}║                                            ║${NC}"
        echo -e "${YELLOW}${BOLD}╚════════════════════════════════════════════╝${NC}"
    fi
    echo ""
}

# 本番環境チェック
is_production() {
    local current_env=$(detect_environment)
    [ "$current_env" = "production" ]
}

# 安全確認プロンプト
confirm_action() {
    local action="$1"
    local require_yes="${2:-false}"

    if is_production; then
        echo -e "${RED}${BOLD}⚠️  警告: 本番環境で「${action}」を実行しようとしています${NC}"

        if [ "$require_yes" = "true" ]; then
            read -p "実行するには 'yes' と入力してください: " -r
            if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
                echo -e "${YELLOW}操作をキャンセルしました${NC}"
                return 1
            fi
        else
            read -p "続行しますか? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                echo -e "${YELLOW}操作をキャンセルしました${NC}"
                return 1
            fi
        fi
    fi

    return 0
}

# データベース操作の安全確認
confirm_database_operation() {
    local operation="$1"

    if is_production; then
        echo -e "${RED}${BOLD}⚠️  データベース操作: ${operation}${NC}"
        echo -e "${YELLOW}本番データベースに影響があります${NC}"

        # データベースファイルの情報表示
        if [ -f "./backend/itsm_nexus.db" ]; then
            local db_size=$(du -h "./backend/itsm_nexus.db" | cut -f1)
            local db_modified=$(stat -c %y "./backend/itsm_nexus.db" 2>/dev/null || stat -f "%Sm" "./backend/itsm_nexus.db" 2>/dev/null)
            echo -e "${YELLOW}データベース: ${db_size}, 最終更新: ${db_modified}${NC}"
        fi

        read -p "バックアップを作成しましたか? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${YELLOW}まずバックアップを作成してください: npm run backup${NC}"
            return 1
        fi

        read -p "本当に実行しますか? 'yes' と入力してください: " -r
        if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
            echo -e "${YELLOW}操作をキャンセルしました${NC}"
            return 1
        fi
    fi

    return 0
}

# デプロイ前チェック
pre_deployment_check() {
    echo -e "${BOLD}デプロイ前チェックを実行中...${NC}"

    local errors=0

    # 環境ファイルの存在確認
    if [ ! -f ".env" ]; then
        echo -e "${RED}✗ .envファイルが存在しません${NC}"
        ((errors++))
    else
        echo -e "${GREEN}✓ .envファイルが存在します${NC}"
    fi

    # 必須環境変数のチェック
    local required_vars=("NODE_ENV" "JWT_SECRET" "DATABASE_PATH" "HTTPS_PORT")
    for var in "${required_vars[@]}"; do
        if ! grep -q "^${var}=" ".env" 2>/dev/null; then
            echo -e "${RED}✗ 環境変数 ${var} が設定されていません${NC}"
            ((errors++))
        else
            echo -e "${GREEN}✓ 環境変数 ${var} が設定されています${NC}"
        fi
    done

    # JWT_SECRETの強度チェック（本番環境のみ）
    if is_production; then
        local jwt_secret=$(grep "^JWT_SECRET=" ".env" | cut -d'=' -f2)
        if [[ ${#jwt_secret} -lt 32 ]]; then
            echo -e "${RED}✗ JWT_SECRETが短すぎます (最低32文字推奨)${NC}"
            ((errors++))
        else
            echo -e "${GREEN}✓ JWT_SECRETの長さが適切です${NC}"
        fi

        if [[ "$jwt_secret" == *"development"* ]] || [[ "$jwt_secret" == *"test"* ]]; then
            echo -e "${RED}✗ 本番環境で開発用のJWT_SECRETが使用されています${NC}"
            ((errors++))
        else
            echo -e "${GREEN}✓ JWT_SECRETは本番用です${NC}"
        fi
    fi

    # SSLファイルの存在確認
    local ssl_cert=$(grep "^SSL_CERT_PATH=" ".env" | cut -d'=' -f2)
    local ssl_key=$(grep "^SSL_KEY_PATH=" ".env" | cut -d'=' -f2)

    if [ ! -f "$ssl_cert" ]; then
        echo -e "${RED}✗ SSL証明書ファイルが存在しません: $ssl_cert${NC}"
        ((errors++))
    else
        echo -e "${GREEN}✓ SSL証明書ファイルが存在します${NC}"
    fi

    if [ ! -f "$ssl_key" ]; then
        echo -e "${RED}✗ SSL秘密鍵ファイルが存在しません: $ssl_key${NC}"
        ((errors++))
    else
        echo -e "${GREEN}✓ SSL秘密鍵ファイルが存在します${NC}"
    fi

    # node_modulesの存在確認
    if [ ! -d "node_modules" ]; then
        echo -e "${RED}✗ node_modulesが存在しません (npm installを実行してください)${NC}"
        ((errors++))
    else
        echo -e "${GREEN}✓ node_modulesが存在します${NC}"
    fi

    echo ""
    if [ $errors -eq 0 ]; then
        echo -e "${GREEN}${BOLD}✓ すべてのチェックに合格しました${NC}"
        return 0
    else
        echo -e "${RED}${BOLD}✗ ${errors}個のエラーが見つかりました${NC}"
        return 1
    fi
}

# 環境情報の表示
show_environment_info() {
    local env_file="${1:-.env}"

    if [ ! -f "$env_file" ]; then
        echo -e "${RED}環境ファイルが見つかりません: $env_file${NC}"
        return 1
    fi

    echo -e "${BOLD}環境情報:${NC}"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    local node_env=$(grep "^NODE_ENV=" "$env_file" | cut -d'=' -f2)
    local https_port=$(grep "^HTTPS_PORT=" "$env_file" | cut -d'=' -f2)
    local db_path=$(grep "^DATABASE_PATH=" "$env_file" | cut -d'=' -f2)
    local log_level=$(grep "^LOG_LEVEL=" "$env_file" | cut -d'=' -f2)

    if [ "$node_env" = "production" ]; then
        echo -e "環境:         ${RED}${BOLD}${node_env}${NC}"
    else
        echo -e "環境:         ${GREEN}${node_env}${NC}"
    fi

    echo -e "HTTPSポート:  ${https_port}"
    echo -e "DB:           ${db_path}"
    echo -e "ログレベル:   ${log_level}"

    if [ -f "$db_path" ]; then
        local db_size=$(du -h "$db_path" | cut -f1)
        echo -e "DBサイズ:     ${db_size}"
    else
        echo -e "DBサイズ:     ${YELLOW}ファイルなし${NC}"
    fi

    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# 環境チェック（メイン関数）
check_environment_safety() {
    local action="${1:-操作}"

    show_environment_banner
    show_environment_info

    if is_production; then
        confirm_action "$action" true
        return $?
    fi

    return 0
}

# スクリプトが直接実行された場合
if [ "${BASH_SOURCE[0]}" = "${0}" ]; then
    case "${1:-}" in
        --show-banner)
            show_environment_banner
            ;;
        --show-info)
            show_environment_info
            ;;
        --check)
            pre_deployment_check
            ;;
        --is-production)
            if is_production; then
                echo "production"
                exit 0
            else
                echo "not-production"
                exit 1
            fi
            ;;
        *)
            echo "ITSM-Sec Nexus - 環境ガードスクリプト"
            echo ""
            echo "使用方法:"
            echo "  $0 --show-banner      環境バナーを表示"
            echo "  $0 --show-info        環境情報を表示"
            echo "  $0 --check            デプロイ前チェック"
            echo "  $0 --is-production    本番環境かチェック"
            echo ""
            echo "スクリプト内で使用:"
            echo "  source scripts/env-guard.sh"
            echo "  check_environment_safety \"操作名\""
            ;;
    esac
fi
