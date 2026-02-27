/**
 * Error Patterns Service Tests
 * エラーパターン検出・統計サービスのユニットテスト
 */

const {
  patterns,
  getSeverityLevel,
  matchError,
  getAllPatterns,
  getPatternById,
  matchMultipleErrors,
  filterBySeverity,
  generateStatistics
} = require('../../../services/errorPatterns');

describe('Error Patterns Service', () => {
  describe('getSeverityLevel', () => {
    it('should return correct level for critical severity', () => {
      const result = getSeverityLevel('critical');
      expect(result).toEqual({ level: 4, label: 'Critical', color: 'red' });
    });

    it('should return correct level for high severity', () => {
      const result = getSeverityLevel('high');
      expect(result).toEqual({ level: 3, label: 'High', color: 'orange' });
    });

    it('should return correct level for warning severity', () => {
      const result = getSeverityLevel('warning');
      expect(result).toEqual({ level: 2, label: 'Warning', color: 'yellow' });
    });

    it('should return correct level for info severity', () => {
      const result = getSeverityLevel('info');
      expect(result).toEqual({ level: 1, label: 'Info', color: 'blue' });
    });

    it('should return info level for unknown severity', () => {
      const result = getSeverityLevel('unknown');
      expect(result).toEqual({ level: 1, label: 'Info', color: 'blue' });
    });
  });

  describe('matchError', () => {
    it('should return null for null input', () => {
      expect(matchError(null)).toBeNull();
    });

    it('should return null for non-string input', () => {
      expect(matchError(123)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(matchError('')).toBeNull();
    });

    it('should return null for non-matching log line', () => {
      expect(matchError('normal log message with no errors')).toBeNull();
    });

    it('should match HTTP 4xx error', () => {
      const result = matchError('GET /api/v1/users 404 - 5ms');
      expect(result).not.toBeNull();
      expect(result.matched).toBe(true);
      expect(result.pattern_id).toBe('http_4xx_error');
      expect(result.severity).toBe('warning');
    });

    it('should match HTTP 5xx error', () => {
      const result = matchError('POST /api/v1/incidents 500 - 100ms');
      expect(result).not.toBeNull();
      expect(result.matched).toBe(true);
      expect(result.pattern_id).toBe('http_5xx_error');
      expect(result.severity).toBe('critical');
    });

    it('should match database connection error (SQLITE_CANTOPEN)', () => {
      const result = matchError('SQLITE_CANTOPEN: unable to open database file');
      expect(result).not.toBeNull();
      expect(result.pattern_id).toBe('database_connection_error');
      expect(result.severity).toBe('critical');
      expect(result.auto_fix).toBe(true);
    });

    it('should match database lock error (SQLITE_BUSY)', () => {
      const result = matchError('SQLITE_BUSY: database is locked');
      expect(result).not.toBeNull();
      expect(result.pattern_id).toBe('database_lock_error');
      expect(result.severity).toBe('high');
    });

    it('should match Node.js exception', () => {
      const result = matchError('Error: Cannot read property of undefined');
      expect(result).not.toBeNull();
      expect(result.pattern_id).toBe('nodejs_exception');
    });

    it('should match memory high usage', () => {
      const result = matchError('FATAL ERROR CALL_AND_RETRY_LAST Allocation failed');
      expect(result).not.toBeNull();
      expect(result.pattern_id).toBe('memory_high_usage');
      expect(result.severity).toBe('critical');
    });

    it('should match disk space critical', () => {
      const result = matchError('ENOSPC: no space left on device');
      expect(result).not.toBeNull();
      expect(result.pattern_id).toBe('disk_space_critical');
    });

    it('should match cache failure', () => {
      const result = matchError('node-cache cache failed to initialize');
      expect(result).not.toBeNull();
      expect(result.pattern_id).toBe('cache_failure');
    });

    it('should match scheduler job failure', () => {
      const result = matchError('[Scheduler] Job cleanup failed with timeout');
      expect(result).not.toBeNull();
      expect(result.pattern_id).toBe('scheduler_job_failure');
    });

    it('should match service unavailable', () => {
      const result = matchError('Connection refused at port 6443');
      expect(result).not.toBeNull();
      expect(result.pattern_id).toBe('service_unavailable');
    });

    it('should match log file too large', () => {
      const result = matchError('log rotation failed for app.log');
      expect(result).not.toBeNull();
      expect(result.pattern_id).toBe('log_file_too_large');
    });

    it('should match port in use', () => {
      const result = matchError('EADDRINUSE: address already in use :::6443');
      expect(result).not.toBeNull();
      expect(result.pattern_id).toBe('port_in_use');
    });

    it('should truncate matched_line to 500 characters', () => {
      const longLine = `Error: ${'x'.repeat(600)}`;
      const result = matchError(longLine);
      expect(result).not.toBeNull();
      expect(result.matched_line.length).toBeLessThanOrEqual(500);
    });

    it('should include actions array in result', () => {
      const result = matchError('EADDRINUSE: port 443 already in use');
      expect(result.actions).toEqual(expect.arrayContaining(['alert_admin', 'service_restart']));
    });

    it('should include cooldown_seconds in result', () => {
      const result = matchError('Error: something went wrong');
      expect(result).not.toBeNull();
      expect(typeof result.cooldown_seconds).toBe('number');
    });

    it('should prioritize critical patterns over lower severity', () => {
      // A line matching both critical and warning should return critical
      const result = matchError('Error: service unavailable Connection refused');
      expect(result).not.toBeNull();
      expect(result.severity).toBe('critical');
    });
  });

  describe('getAllPatterns', () => {
    it('should return all patterns', () => {
      const result = getAllPatterns();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(patterns.length);
    });

    it('should return patterns with correct structure', () => {
      const result = getAllPatterns();
      result.forEach((p) => {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('name');
        expect(p).toHaveProperty('severity');
        expect(p).toHaveProperty('severity_level');
        expect(p).toHaveProperty('auto_fix');
        expect(p).toHaveProperty('description');
        expect(p).toHaveProperty('actions');
        expect(p).toHaveProperty('cooldown_seconds');
      });
    });

    it('should not include regex pattern in output', () => {
      const result = getAllPatterns();
      result.forEach((p) => {
        expect(p).not.toHaveProperty('pattern');
      });
    });
  });

  describe('getPatternById', () => {
    it('should return pattern for valid id', () => {
      const result = getPatternById('http_5xx_error');
      expect(result).not.toBeNull();
      expect(result.id).toBe('http_5xx_error');
      expect(result.name).toBe('HTTP 5xxエラー');
    });

    it('should return null for invalid id', () => {
      const result = getPatternById('nonexistent_pattern');
      expect(result).toBeNull();
    });

    it('should include severity_level in result', () => {
      const result = getPatternById('http_5xx_error');
      expect(result.severity_level).toBe(4);
    });
  });

  describe('matchMultipleErrors', () => {
    it('should return empty array for non-array input', () => {
      expect(matchMultipleErrors('not an array')).toEqual([]);
    });

    it('should return empty array for empty array', () => {
      expect(matchMultipleErrors([])).toEqual([]);
    });

    it('should match multiple errors from log lines', () => {
      const lines = [
        'Normal log line',
        'GET /api 500 - server error',
        'Normal log line 2',
        'SQLITE_BUSY: database is locked',
        'Another normal line'
      ];
      const results = matchMultipleErrors(lines);
      expect(results.length).toBe(2);
    });

    it('should skip non-matching lines', () => {
      const lines = ['normal line 1', 'normal line 2', 'normal line 3'];
      const results = matchMultipleErrors(lines);
      expect(results.length).toBe(0);
    });
  });

  describe('filterBySeverity', () => {
    it('should filter matches by minimum severity', () => {
      const matches = [
        { severity: 'warning', pattern_id: 'a' },
        { severity: 'critical', pattern_id: 'b' },
        { severity: 'high', pattern_id: 'c' },
        { severity: 'info', pattern_id: 'd' }
      ];

      const result = filterBySeverity(matches, 'high');
      expect(result.length).toBe(2);
      expect(result.map((m) => m.pattern_id)).toEqual(['b', 'c']);
    });

    it('should use warning as default minimum severity', () => {
      const matches = [
        { severity: 'warning', pattern_id: 'a' },
        { severity: 'info', pattern_id: 'b' }
      ];

      const result = filterBySeverity(matches);
      expect(result.length).toBe(1);
      expect(result[0].pattern_id).toBe('a');
    });

    it('should return all matches for info filter', () => {
      const matches = [
        { severity: 'info', pattern_id: 'a' },
        { severity: 'warning', pattern_id: 'b' }
      ];

      const result = filterBySeverity(matches, 'info');
      expect(result.length).toBe(2);
    });

    it('should return only critical matches for critical filter', () => {
      const matches = [
        { severity: 'warning', pattern_id: 'a' },
        { severity: 'high', pattern_id: 'b' },
        { severity: 'critical', pattern_id: 'c' }
      ];

      const result = filterBySeverity(matches, 'critical');
      expect(result.length).toBe(1);
      expect(result[0].pattern_id).toBe('c');
    });
  });

  describe('generateStatistics', () => {
    it('should return empty stats for non-array input', () => {
      const result = generateStatistics(null);
      expect(result).toEqual({
        total: 0,
        by_severity: {},
        by_pattern: {},
        auto_fixable: 0
      });
    });

    it('should return empty stats for empty array', () => {
      const result = generateStatistics([]);
      expect(result).toEqual({
        total: 0,
        by_severity: {},
        by_pattern: {},
        auto_fixable: 0
      });
    });

    it('should correctly count by severity', () => {
      const matches = [
        { severity: 'critical', pattern_id: 'a', auto_fix: true },
        { severity: 'critical', pattern_id: 'b', auto_fix: false },
        { severity: 'high', pattern_id: 'c', auto_fix: true }
      ];

      const result = generateStatistics(matches);
      expect(result.total).toBe(3);
      expect(result.by_severity.critical).toBe(2);
      expect(result.by_severity.high).toBe(1);
    });

    it('should correctly count by pattern', () => {
      const matches = [
        { severity: 'critical', pattern_id: 'http_5xx_error', auto_fix: true },
        { severity: 'critical', pattern_id: 'http_5xx_error', auto_fix: true },
        { severity: 'high', pattern_id: 'database_lock_error', auto_fix: true }
      ];

      const result = generateStatistics(matches);
      expect(result.by_pattern.http_5xx_error).toBe(2);
      expect(result.by_pattern.database_lock_error).toBe(1);
    });

    it('should correctly count auto_fixable', () => {
      const matches = [
        { severity: 'critical', pattern_id: 'a', auto_fix: true },
        { severity: 'high', pattern_id: 'b', auto_fix: false },
        { severity: 'warning', pattern_id: 'c', auto_fix: true }
      ];

      const result = generateStatistics(matches);
      expect(result.auto_fixable).toBe(2);
    });
  });
});
