/**
 * Error Patterns Service
 * エラーパターン定義・検出サービス
 * Phase 9.2: 監視・ヘルスチェック強化
 */

/**
 * エラーパターン定義
 * ITSM-Sec Nexus環境に適応した12種類のパターン
 */
const patterns = [
  {
    id: 'http_4xx_error',
    name: 'HTTP 4xxエラー',
    pattern: /\s4\d{2}\s/,
    severity: 'warning',
    auto_fix: false,
    description: 'HTTPステータスコード4xxの検出（クライアントエラー）',
    actions: ['log_alert'],
    cooldown_seconds: 60
  },
  {
    id: 'http_5xx_error',
    name: 'HTTP 5xxエラー',
    pattern: /\s5\d{2}\s/,
    severity: 'critical',
    auto_fix: true,
    description: 'HTTPステータスコード5xxの検出（サーバーエラー）',
    actions: ['alert_admin', 'service_restart'],
    cooldown_seconds: 300
  },
  {
    id: 'database_connection_error',
    name: 'データベース接続エラー',
    pattern: /SQLITE_CANTOPEN|database\s+connection\s+failed|Unable to open database/i,
    severity: 'critical',
    auto_fix: true,
    description: 'SQLiteデータベース接続エラー（CANTOPEN）',
    actions: ['alert_admin', 'database_restart', 'service_restart'],
    cooldown_seconds: 300
  },
  {
    id: 'database_lock_error',
    name: 'データベースロックエラー',
    pattern: /SQLITE_BUSY|database is locked|database table is locked/i,
    severity: 'high',
    auto_fix: true,
    description: 'SQLiteデータベースロック（SQLITE_BUSY）',
    actions: ['log_alert', 'database_optimize'],
    cooldown_seconds: 180
  },
  {
    id: 'nodejs_exception',
    name: 'Node.js例外',
    pattern: /Error:|Exception:|Uncaught|UnhandledPromiseRejection/i,
    severity: 'high',
    auto_fix: false,
    description: 'Node.js例外・エラースタックトレース検出',
    actions: ['log_alert', 'alert_admin'],
    cooldown_seconds: 120
  },
  {
    id: 'memory_high_usage',
    name: 'メモリ高負荷',
    pattern: /memory.*usage.*90%|heap.*out.*of.*memory|FATAL ERROR.*CALL_AND_RETRY_LAST/i,
    severity: 'critical',
    auto_fix: true,
    description: 'メモリ使用率90%超過またはOOM検出',
    actions: ['alert_admin', 'cleanup_cache', 'service_restart'],
    cooldown_seconds: 300
  },
  {
    id: 'disk_space_critical',
    name: 'ディスク容量不足',
    pattern: /disk.*usage.*90%|ENOSPC|no space left on device/i,
    severity: 'critical',
    auto_fix: true,
    description: 'ディスク使用率90%超過またはENOSPC検出',
    actions: ['alert_admin', 'cleanup_logs', 'cleanup_backups'],
    cooldown_seconds: 600
  },
  {
    id: 'cache_failure',
    name: 'キャッシュ障害',
    pattern: /node-cache.*error|cache.*failed|cache.*unavailable/i,
    severity: 'warning',
    auto_fix: true,
    description: 'node-cacheキャッシュシステム障害',
    actions: ['cleanup_cache', 'log_alert'],
    cooldown_seconds: 120
  },
  {
    id: 'scheduler_job_failure',
    name: 'スケジューラジョブ失敗',
    pattern: /\[Scheduler\].*failed|\[Scheduler\].*error|cron.*job.*failed/i,
    severity: 'high',
    auto_fix: true,
    description: 'スケジューラジョブ実行失敗検出',
    actions: ['alert_admin', 'restart_scheduler'],
    cooldown_seconds: 300
  },
  {
    id: 'service_unavailable',
    name: 'サービス停止',
    pattern: /systemctl.*inactive|systemctl.*failed|service.*unavailable|Connection refused/i,
    severity: 'critical',
    auto_fix: true,
    description: 'systemdサービス停止またはConnection refused検出',
    actions: ['alert_admin', 'service_restart'],
    cooldown_seconds: 300
  },
  {
    id: 'log_file_too_large',
    name: 'ログファイル肥大化',
    pattern: /log.*file.*size.*exceeds.*100MB|log.*rotation.*failed/i,
    severity: 'warning',
    auto_fix: true,
    description: 'ログファイルサイズ100MB超過検出',
    actions: ['cleanup_logs', 'log_alert'],
    cooldown_seconds: 3600
  },
  {
    id: 'port_in_use',
    name: 'ポート使用中',
    pattern: /EADDRINUSE|address already in use|port.*already.*in.*use/i,
    severity: 'critical',
    auto_fix: true,
    description: 'ポート使用中エラー（EADDRINUSE）',
    actions: ['alert_admin', 'kill_process', 'service_restart'],
    cooldown_seconds: 180
  }
];

/**
 * Severityレベルの定義と優先度
 */
const severityLevels = {
  critical: { level: 4, label: 'Critical', color: 'red' },
  high: { level: 3, label: 'High', color: 'orange' },
  warning: { level: 2, label: 'Warning', color: 'yellow' },
  info: { level: 1, label: 'Info', color: 'blue' }
};

/**
 * Severityレベル情報を取得
 * @param {string} severity - Severity名
 * @returns {Object} Severityレベル情報
 */
function getSeverityLevel(severity) {
  return severityLevels[severity] || severityLevels.info;
}

/**
 * ログ行をエラーパターンとマッチング
 * @param {string} logLine - ログ行
 * @returns {Object|null} マッチしたパターン情報、マッチしない場合はnull
 */
function matchError(logLine) {
  if (!logLine || typeof logLine !== 'string') {
    return null;
  }

  // 全パターンをチェック（優先度順）
  const sortedPatterns = [...patterns].sort(
    (a, b) => getSeverityLevel(b.severity).level - getSeverityLevel(a.severity).level
  );

  for (const pattern of sortedPatterns) {
    if (pattern.pattern.test(logLine)) {
      return {
        matched: true,
        pattern_id: pattern.id,
        pattern_name: pattern.name,
        severity: pattern.severity,
        severity_level: getSeverityLevel(pattern.severity).level,
        auto_fix: pattern.auto_fix,
        description: pattern.description,
        actions: pattern.actions,
        cooldown_seconds: pattern.cooldown_seconds,
        matched_line: logLine.substring(0, 500) // 最大500文字まで
      };
    }
  }

  return null;
}

/**
 * 全パターンを取得
 * @returns {Array} 全エラーパターン
 */
function getAllPatterns() {
  return patterns.map((pattern) => ({
    id: pattern.id,
    name: pattern.name,
    severity: pattern.severity,
    severity_level: getSeverityLevel(pattern.severity).level,
    auto_fix: pattern.auto_fix,
    description: pattern.description,
    actions: pattern.actions,
    cooldown_seconds: pattern.cooldown_seconds
  }));
}

/**
 * パターンIDで検索
 * @param {string} patternId - パターンID
 * @returns {Object|null} パターン情報、見つからない場合はnull
 */
function getPatternById(patternId) {
  const pattern = patterns.find((p) => p.id === patternId);
  if (!pattern) return null;

  return {
    id: pattern.id,
    name: pattern.name,
    severity: pattern.severity,
    severity_level: getSeverityLevel(pattern.severity).level,
    auto_fix: pattern.auto_fix,
    description: pattern.description,
    actions: pattern.actions,
    cooldown_seconds: pattern.cooldown_seconds
  };
}

/**
 * 複数ログ行を一括マッチング
 * @param {Array<string>} logLines - ログ行配列
 * @returns {Array} マッチ結果配列
 */
function matchMultipleErrors(logLines) {
  if (!Array.isArray(logLines)) {
    return [];
  }

  const results = [];
  for (const line of logLines) {
    const match = matchError(line);
    if (match) {
      results.push(match);
    }
  }

  return results;
}

/**
 * Severityでフィルタリング
 * @param {Array} matches - マッチ結果配列
 * @param {string} minSeverity - 最小Severityレベル
 * @returns {Array} フィルタ済み結果
 */
function filterBySeverity(matches, minSeverity = 'warning') {
  const minLevel = getSeverityLevel(minSeverity).level;

  return matches.filter((match) => getSeverityLevel(match.severity).level >= minLevel);
}

/**
 * 統計情報を生成
 * @param {Array} matches - マッチ結果配列
 * @returns {Object} 統計情報
 */
function generateStatistics(matches) {
  if (!Array.isArray(matches) || matches.length === 0) {
    return {
      total: 0,
      by_severity: {},
      by_pattern: {},
      auto_fixable: 0
    };
  }

  const stats = {
    total: matches.length,
    by_severity: {},
    by_pattern: {},
    auto_fixable: 0
  };

  for (const match of matches) {
    // Severityごとのカウント
    stats.by_severity[match.severity] = (stats.by_severity[match.severity] || 0) + 1;

    // パターンごとのカウント
    stats.by_pattern[match.pattern_id] = (stats.by_pattern[match.pattern_id] || 0) + 1;

    // 自動修復可能なエラー数
    if (match.auto_fix) {
      stats.auto_fixable += 1;
    }
  }

  return stats;
}

module.exports = {
  patterns,
  getSeverityLevel,
  matchError,
  getAllPatterns,
  getPatternById,
  matchMultipleErrors,
  filterBySeverity,
  generateStatistics
};
