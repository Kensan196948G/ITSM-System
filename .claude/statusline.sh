#!/bin/bash
# ITSM-System Custom Status Line
# Claude Codeセッション情報を表示

# 標準入力からJSONを読み取る
input=$(cat)

# jqがない場合の簡易パーサー（grepとsedを使用）
if ! command -v jq &> /dev/null; then
    # モデル名を抽出
    MODEL_NAME=$(echo "$input" | grep -o '"display_name"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"display_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')

    # カレントディレクトリを抽出（current_dirまたはcwd）
    CURRENT_DIR=$(echo "$input" | grep -o '"current_dir"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"current_dir"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    if [ -z "$CURRENT_DIR" ]; then
        CURRENT_DIR=$(echo "$input" | grep -o '"cwd"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*"cwd"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/')
    fi

    # コストを抽出
    TOTAL_COST=$(echo "$input" | grep -o '"total_cost_usd"[[:space:]]*:[[:space:]]*[0-9.]*' | head -1 | sed 's/.*:[[:space:]]*\([0-9.]*\).*/\1/')

    # トークン数を抽出
    INPUT_TOKENS=$(echo "$input" | grep -o '"input_tokens"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | sed 's/.*:[[:space:]]*\([0-9]*\).*/\1/')
    OUTPUT_TOKENS=$(echo "$input" | grep -o '"output_tokens"[[:space:]]*:[[:space:]]*[0-9]*' | head -1 | sed 's/.*:[[:space:]]*\([0-9]*\).*/\1/')
else
    # jqを使用して値を抽出
    MODEL_NAME=$(echo "$input" | jq -r '.model.display_name // .model.id // "Unknown"')
    CURRENT_DIR=$(echo "$input" | jq -r '.workspace.current_dir // .cwd // "Unknown"')
    TOTAL_COST=$(echo "$input" | jq -r '.cost.total_cost_usd // 0')
    INPUT_TOKENS=$(echo "$input" | jq -r '.context_window.current_usage.input_tokens // 0')
    OUTPUT_TOKENS=$(echo "$input" | jq -r '.context_window.current_usage.output_tokens // 0')
fi

# ディレクトリ名のみを抽出（フルパスではなく）
DIR_NAME=$(basename "$CURRENT_DIR" 2>/dev/null || echo "$CURRENT_DIR")

# Gitブランチ情報を取得
GIT_BRANCH=""
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null)
    if [ -n "$BRANCH" ]; then
        # 変更ファイル数をカウント
        MODIFIED=$(git status --porcelain 2>/dev/null | grep -c '^.M' || echo "0")
        UNTRACKED=$(git status --porcelain 2>/dev/null | grep -c '^??' || echo "0")

        if [ "$MODIFIED" != "0" ] || [ "$UNTRACKED" != "0" ]; then
            GIT_BRANCH=" | \033[32m🌿 $BRANCH\033[0m (\033[33mM:$MODIFIED\033[0m \033[31m?:$UNTRACKED\033[0m)"
        else
            GIT_BRANCH=" | \033[32m🌿 $BRANCH\033[0m ✓"
        fi
    fi
fi

# トークン合計を計算
TOTAL_TOKENS=$((INPUT_TOKENS + OUTPUT_TOKENS))

# トークン表示（Kフォーマット）
if [ "$TOTAL_TOKENS" -gt 0 ]; then
    TOKENS_DISPLAY=$(printf "%.1fK" $(echo "scale=1; $TOTAL_TOKENS / 1000" | bc 2>/dev/null || echo "0"))
else
    TOKENS_DISPLAY="0"
fi

# コスト表示
COST_DISPLAY=$(printf "%.4f" "$TOTAL_COST" 2>/dev/null || echo "0.0000")

# ステータスラインを出力（ANSI色コード使用）
echo -e "\033[1;36m🤖 $MODEL_NAME\033[0m | \033[33m📁 $DIR_NAME\033[0m$GIT_BRANCH | \033[35m📊 $TOKENS_DISPLAY tokens\033[0m | \033[32m💰 \$$COST_DISPLAY\033[0m"
