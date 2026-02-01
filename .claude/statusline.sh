#!/usr/bin/env bash
set -euo pipefail

input="$(cat)"

# ===== 共通パース =====
MODEL=$(echo "$input" | jq -r '.model.display_name')
DIR=$(echo  "$input" | jq -r '.workspace.current_dir')
PROJECT=${DIR##*/}

SESSION_ID=$(echo "$input" | jq -r '.session.id // "-"')

OS_NAME=$(uname -s 2>/dev/null || echo "Unknown")
ENV_TAG="Linux"
case "$OS_NAME" in
  *[Ww][Ii][Nn]*) ENV_TAG="Windows" ;;
  *[Dd]arwin*)    ENV_TAG="macOS"   ;;
esac

# Git 情報（ブランチ or HEAD 短縮コミット）
GIT_SEG=""
if git -C "$DIR" rev-parse --git-dir > /dev/null 2>&1; then
  BRANCH=$(git -C "$DIR" branch --show-current 2>/dev/null || true)
  if [ -n "$BRANCH" ]; then
    GIT_SEG=" 🌿 $BRANCH"
  else
    SHORT_HEAD=$(git -C "$DIR" rev-parse --short HEAD 2>/dev/null || true)
    [ -n "$SHORT_HEAD" ] && GIT_SEG=" 🌿 $SHORT_HEAD"
  fi
fi

# ===== コンテキスト使用状況（🔥📊）=====  [context_window メタデータ利用]
USED_PCT=$(echo "$input"      | jq -r '.context_window.used_percentage      // 0')
REMAIN_PCT=$(echo "$input"    | jq -r '.context_window.remaining_percentage // 0')
AUTO_LEFT=$(echo "$input"     | jq -r '.context_window.auto_compact_remaining_tokens // empty')

COLOR="\033[32m"
[ "$(printf '%.0f' "$USED_PCT")" -ge 70 ] && COLOR="\033[33m"
[ "$(printf '%.0f' "$USED_PCT")" -ge 90 ] && COLOR="\033[31m"

FIRE_SEG="🔥 \033[1m${COLOR}$(printf '%.0f' "$USED_PCT")%%\033[0m"
BAR_LEN=20
FILLED=$(( BAR_LEN * $(printf '%.0f' "$USED_PCT") / 100 ))
BAR="$(printf '%*s' "$FILLED" '' | tr ' ' '=')"
BAR="$BAR$(printf '%*s' $((BAR_LEN-FILLED)) '' | tr ' ' '-')"
if [ -n "${AUTO_LEFT:-}" ]; then
  AUTO_SEG="📊 [$BAR] 残 ${AUTO_LEFT}tks"
else
  AUTO_SEG="📊 [$BAR] 残 ${REMAIN_PCT%%%}%"
fi

# ===== ccusage 連携（💰 ブロック残りなど）=====  [ccusage statusline] [web:37][web:41]
COST_SEG=""
if command -v ccusage >/dev/null 2>&1; then
  # ccusage 側の statusline 出力をそのまま食う or JSON で整形
  CCJSON=$(ccusage blocks --json 2>/dev/null || echo '')
  if [ -n "$CCJSON" ]; then
    SESSION_COST=$(echo "$CCJSON" | jq -r '.current_block.session_cost   // "?"')
    TODAY_COST=$(echo   "$CCJSON" | jq -r '.today.total_cost             // "?"')
    BLOCK_LEFT=$(echo   "$CCJSON" | jq -r '.current_block.time_remaining // "?"')
    COST_SEG="💰 ${SESSION_COST} / 今日 ${TODAY_COST} / 残 ${BLOCK_LEFT}"
  fi
fi

# ===== 3 行目用: レスポンスタイム / ネットワーク / 要約 =====
# total_api_duration_ms があればレスポンスタイムに流用 [web:20][web:35]
RESP_MS=$(echo "$input" | jq -r '.metrics.total_api_duration_ms // 0')
if [ "$RESP_MS" -gt 0 ]; then
  RESP_SEG="⚡ ${RESP_MS}ms"
else
  RESP_SEG="⚡ n/a"
fi

# ネットワーク状態は直接のフィールドがないため簡易表示
NET_SEG="🌐 online"

# 最終メッセージ要約/進行中タスク名（高度例）
# transcript_path から自前で要約を読む or 別プロセスで生成したメタデータを読む想定。[web:39]
TASK_SEG=""
TRANSCRIPT_PATH=$(echo "$input" | jq -r '.transcript_path // empty')
if [ -n "$TRANSCRIPT_PATH" ] && [ -r "$TRANSCRIPT_PATH" ]; then
  # 例: 外部で書き出した last_task.txt を読む（なければ空のまま）
  META_DIR="$(dirname "$TRANSCRIPT_PATH")"
  if [ -f "$META_DIR/last_task.txt" ]; then
    LAST_TASK=$(head -c 60 "$META_DIR/last_task.txt")
    TASK_SEG=" 🔍 ${LAST_TASK}"
  fi
fi

# ===== 出力 =====

# 1行目: 現在コンテキスト
echo -e "🤖 $MODEL  📁 $PROJECT$GIT_SEG  🔑 ${SESSION_ID}  🖥 ${ENV_TAG}"

# 2行目: 使用状況・お金まわり
if [ -n "$COST_SEG" ]; then
  echo -e "$FIRE_SEG  $AUTO_SEG  |  $COST_SEG"
else
  echo -e "$FIRE_SEG  $AUTO_SEG"
fi

# 3行目: レスポンスタイム・ネットワーク・タスク
echo -e "$RESP_SEG  $NET_SEG$TASK_SEG"
