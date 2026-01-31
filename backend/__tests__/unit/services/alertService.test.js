/**
 * Alert Service Unit Tests
 * Phase 9.2: アラートルール評価エンジン
 */

const alertService = require('../../../services/alertService');
const monitoringService = require('../../../services/monitoringService');

// Mock monitoringService
jest.mock('../../../services/monitoringService');

// Mock notificationService
jest.mock('../../../services/notificationService', () => ({
  sendSlackNotification: jest.fn().mockResolvedValue({ success: true }),
  sendWebhookNotification: jest.fn().mockResolvedValue({ success: true })
}));

// Mock emailService
jest.mock('../../../services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true })
}));

describe('Alert Service Unit Tests', () => {
  let mockDb;
  let mockQueryBuilder;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock query builder (chainable methods)
    mockQueryBuilder = {
      insert: jest.fn().mockResolvedValue([1]),
      update: jest.fn().mockResolvedValue(1),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue([{ count: 0 }]),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnThis()
    };

    // Mock database (function that returns query builder)
    mockDb = jest.fn(() => mockQueryBuilder);
    Object.assign(mockDb, mockQueryBuilder);

    alertService.setDatabase(mockDb);
    monitoringService.setDatabase(mockDb);

    // Mock getSystemMetrics
    monitoringService.getSystemMetrics.mockResolvedValue({
      metrics: {
        cpu: { usage_percent: 45.5 },
        memory: { usage_percent: 60.2 },
        disk: { usage_percent: 75.3 },
        active_users: { current: 12 }
      }
    });

    // Mock getBusinessMetrics
    monitoringService.getBusinessMetrics.mockResolvedValue({
      metrics: {
        sla_compliance: { current_rate: 95.5 },
        incidents_open: { total: 15 }
      }
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('evaluateRule()', () => {
    it('should evaluate rule successfully with > condition', async () => {
      const rule = {
        id: 1,
        rule_name: 'CPU High Usage',
        metric_name: 'itsm_cpu_usage_percent',
        condition: '>',
        threshold: 40,
        severity: 'warning'
      };

      const result = await alertService.evaluateRule(rule);

      expect(result.ruleId).toBe(1);
      expect(result.ruleName).toBe('CPU High Usage');
      expect(result.currentValue).toBe(45.5);
      expect(result.threshold).toBe(40);
      expect(result.isFiring).toBe(true);
    });

    it('should evaluate rule with < condition', async () => {
      const rule = {
        id: 2,
        rule_name: 'SLA Low Compliance',
        metric_name: 'itsm_sla_compliance_rate',
        condition: '<',
        threshold: 98,
        severity: 'critical'
      };

      const result = await alertService.evaluateRule(rule);

      expect(result.currentValue).toBe(95.5);
      expect(result.isFiring).toBe(true);
    });

    it('should evaluate rule with >= condition', async () => {
      const rule = {
        id: 3,
        rule_name: 'Memory Critical',
        metric_name: 'itsm_memory_usage_percent',
        condition: '>=',
        threshold: 60.2,
        severity: 'critical'
      };

      const result = await alertService.evaluateRule(rule);

      expect(result.currentValue).toBe(60.2);
      expect(result.isFiring).toBe(true);
    });

    it('should evaluate rule with <= condition', async () => {
      const rule = {
        id: 4,
        rule_name: 'Disk Usage Normal',
        metric_name: 'itsm_disk_usage_percent',
        condition: '<=',
        threshold: 80,
        severity: 'info'
      };

      const result = await alertService.evaluateRule(rule);

      expect(result.currentValue).toBe(75.3);
      expect(result.isFiring).toBe(true);
    });

    it('should evaluate rule with == condition', async () => {
      const rule = {
        id: 5,
        rule_name: 'Active Users Exact',
        metric_name: 'itsm_active_users_total',
        condition: '==',
        threshold: 12,
        severity: 'info'
      };

      const result = await alertService.evaluateRule(rule);

      expect(result.currentValue).toBe(12);
      expect(result.isFiring).toBe(true);
    });

    it('should evaluate rule with != condition', async () => {
      const rule = {
        id: 6,
        rule_name: 'Incidents Changed',
        metric_name: 'itsm_incidents_open',
        condition: '!=',
        threshold: 10,
        severity: 'warning'
      };

      const result = await alertService.evaluateRule(rule);

      expect(result.currentValue).toBe(15);
      expect(result.isFiring).toBe(true);
    });

    it('should not fire when condition not met (>)', async () => {
      const rule = {
        id: 7,
        rule_name: 'CPU Very High',
        metric_name: 'itsm_cpu_usage_percent',
        condition: '>',
        threshold: 90,
        severity: 'critical'
      };

      const result = await alertService.evaluateRule(rule);

      expect(result.isFiring).toBe(false);
    });

    it('should not fire when condition not met (<)', async () => {
      const rule = {
        id: 8,
        rule_name: 'SLA Too Low',
        metric_name: 'itsm_sla_compliance_rate',
        condition: '<',
        threshold: 90,
        severity: 'critical'
      };

      const result = await alertService.evaluateRule(rule);

      expect(result.isFiring).toBe(false);
    });

    it('should handle invalid condition gracefully', async () => {
      const rule = {
        id: 9,
        rule_name: 'Invalid Condition',
        metric_name: 'itsm_cpu_usage_percent',
        condition: 'INVALID',
        threshold: 50,
        severity: 'warning'
      };

      const result = await alertService.evaluateRule(rule);

      expect(result.isFiring).toBe(false);
    });

    it('should handle metric from history when not in current metrics', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        metric_value: 123.45
      });

      const rule = {
        id: 10,
        rule_name: 'Custom Metric',
        metric_name: 'custom_metric_name',
        condition: '>',
        threshold: 100,
        severity: 'info'
      };

      const result = await alertService.evaluateRule(rule);

      expect(result.currentValue).toBe(123.45);
      expect(result.isFiring).toBe(true);
    });

    it('should return zero when metric not found anywhere', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const rule = {
        id: 11,
        rule_name: 'Missing Metric',
        metric_name: 'nonexistent_metric',
        condition: '>',
        threshold: 0,
        severity: 'info'
      };

      const result = await alertService.evaluateRule(rule);

      expect(result.currentValue).toBe(0);
      expect(result.isFiring).toBe(false);
    });

    it('should handle evaluation error gracefully', async () => {
      monitoringService.getSystemMetrics.mockRejectedValue(new Error('Metrics collection failed'));

      const rule = {
        id: 12,
        rule_name: 'Error Rule',
        metric_name: 'itsm_cpu_usage_percent',
        condition: '>',
        threshold: 50,
        severity: 'critical'
      };

      const result = await alertService.evaluateRule(rule);

      expect(result.isFiring).toBe(false);
      expect(result.error).toBe('Metrics collection failed');
    });
  });

  describe('evaluateAllRules()', () => {
    it('should evaluate all enabled rules', async () => {
      const mockRules = [
        {
          id: 1,
          rule_name: 'CPU High',
          metric_name: 'itsm_cpu_usage_percent',
          condition: '>',
          threshold: 40,
          severity: 'warning',
          enabled: 1
        },
        {
          id: 2,
          rule_name: 'Memory High',
          metric_name: 'itsm_memory_usage_percent',
          condition: '>',
          threshold: 50,
          severity: 'warning',
          enabled: 1
        }
      ];

      mockDb.select.mockResolvedValue(mockRules);
      mockQueryBuilder.first.mockResolvedValue(null);

      const results = await alertService.evaluateAllRules();

      expect(results).toHaveLength(2);
      expect(results[0].ruleName).toBe('CPU High');
      expect(results[1].ruleName).toBe('Memory High');
    });

    it('should only evaluate enabled rules', async () => {
      mockDb.select.mockResolvedValue([]);

      await alertService.evaluateAllRules();

      expect(mockDb.where).toHaveBeenCalledWith('enabled', 1);
    });

    it('should fire alert when rule is firing and no existing alert', async () => {
      const mockRules = [
        {
          id: 1,
          rule_name: 'CPU Critical',
          metric_name: 'itsm_cpu_usage_percent',
          condition: '>',
          threshold: 30,
          severity: 'critical',
          enabled: 1
        }
      ];

      mockDb.select.mockResolvedValue(mockRules);
      mockQueryBuilder.first.mockResolvedValue(null);

      await alertService.evaluateAllRules();

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
    });

    it('should not create duplicate alert when already firing', async () => {
      const mockRules = [
        {
          id: 1,
          rule_name: 'CPU Critical',
          metric_name: 'itsm_cpu_usage_percent',
          condition: '>',
          threshold: 30,
          severity: 'critical',
          enabled: 1
        }
      ];

      mockDb.select.mockResolvedValue(mockRules);
      mockDb.first.mockResolvedValue({ id: 100, status: 'firing' });

      await alertService.evaluateAllRules();

      expect(mockQueryBuilder.insert).not.toHaveBeenCalled();
    });

    it('should auto-resolve alerts when rule stops firing', async () => {
      const mockRules = [
        {
          id: 1,
          rule_name: 'CPU Normal',
          metric_name: 'itsm_cpu_usage_percent',
          condition: '>',
          threshold: 90,
          severity: 'critical',
          enabled: 1
        }
      ];

      mockDb.select.mockResolvedValue(mockRules);

      await alertService.evaluateAllRules();

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resolved'
        })
      );
    });
  });

  describe('fireAlert()', () => {
    it('should fire alert and save to database', async () => {
      const rule = {
        id: 1,
        rule_name: 'CPU Critical',
        metric_name: 'itsm_cpu_usage_percent',
        threshold: 90,
        severity: 'critical'
      };

      const alertId = await alertService.fireAlert(rule, 95.5);

      expect(alertId).toBe(1);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          rule_id: 1,
          rule_name: 'CPU Critical',
          metric_name: 'itsm_cpu_usage_percent',
          current_value: 95.5,
          threshold: 90,
          severity: 'critical',
          status: 'firing'
        })
      );
    });

    it('should send notifications to configured channels', async () => {
      const notificationService = require('../../../services/notificationService');

      const rule = {
        id: 1,
        rule_name: 'CPU Critical',
        metric_name: 'itsm_cpu_usage_percent',
        threshold: 90,
        severity: 'critical',
        notification_channels: '["slack-alerts"]'
      };

      mockDb.first.mockResolvedValue({
        id: 10,
        channel_name: 'slack-alerts',
        channel_type: 'slack',
        config: '{"webhook_url":"https://hooks.slack.com/test"}',
        enabled: 1
      });

      await alertService.fireAlert(rule, 95.5);

      expect(notificationService.sendSlackNotification).toHaveBeenCalled();
    });

    it('should handle notification errors gracefully', async () => {
      const notificationService = require('../../../services/notificationService');
      notificationService.sendSlackNotification.mockResolvedValue({
        success: false,
        error: 'Webhook failed'
      });

      const rule = {
        id: 1,
        rule_name: 'CPU Critical',
        metric_name: 'itsm_cpu_usage_percent',
        threshold: 90,
        severity: 'critical',
        notification_channels: '["slack-alerts"]'
      };

      mockDb.first.mockResolvedValue({
        id: 10,
        channel_name: 'slack-alerts',
        channel_type: 'slack',
        config: '{"webhook_url":"https://hooks.slack.com/test"}',
        enabled: 1
      });

      await alertService.fireAlert(rule, 95.5);

      expect(mockQueryBuilder.insert).toHaveBeenCalledTimes(2); // Alert + notification history
    });

    it('should skip disabled notification channels', async () => {
      const rule = {
        id: 1,
        rule_name: 'CPU Critical',
        metric_name: 'itsm_cpu_usage_percent',
        threshold: 90,
        severity: 'critical',
        notification_channels: '["slack-alerts"]'
      };

      mockDb.first.mockResolvedValue({
        id: 10,
        channel_name: 'slack-alerts',
        channel_type: 'slack',
        config: '{"webhook_url":"https://hooks.slack.com/test"}',
        enabled: 0
      });

      await alertService.fireAlert(rule, 95.5);

      const notificationService = require('../../../services/notificationService');
      expect(notificationService.sendSlackNotification).not.toHaveBeenCalled();
    });
  });

  describe('acknowledgeAlert()', () => {
    it('should acknowledge alert successfully', async () => {
      await alertService.acknowledgeAlert(123, 5);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id', 123);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'acknowledged',
          acknowledged_by: 5
        })
      );
    });

    it('should set acknowledged_at timestamp', async () => {
      await alertService.acknowledgeAlert(123, 5);

      const updateCall = mockQueryBuilder.update.mock.calls[0][0];
      expect(updateCall).toHaveProperty('acknowledged_at');
    });
  });

  describe('resolveAlert()', () => {
    it('should resolve alert successfully', async () => {
      await alertService.resolveAlert(456);

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('id', 456);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'resolved'
        })
      );
    });

    it('should set resolved_at timestamp', async () => {
      await alertService.resolveAlert(456);

      const updateCall = mockQueryBuilder.update.mock.calls[0][0];
      expect(updateCall).toHaveProperty('resolved_at');
    });
  });

  describe('getActiveAlerts()', () => {
    it('should get active alerts (firing and acknowledged)', async () => {
      const mockAlerts = [
        {
          id: 1,
          rule_name: 'CPU Critical',
          status: 'firing',
          severity: 'critical'
        },
        {
          id: 2,
          rule_name: 'Memory High',
          status: 'acknowledged',
          severity: 'warning'
        }
      ];

      mockDb.select.mockResolvedValue(mockAlerts);

      const result = await alertService.getActiveAlerts();

      expect(result).toHaveLength(2);
      expect(mockQueryBuilder.whereIn).toHaveBeenCalledWith('status', ['firing', 'acknowledged']);
    });

    it('should order alerts by created_at desc', async () => {
      mockDb.select.mockResolvedValue([]);

      await alertService.getActiveAlerts();

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('created_at', 'desc');
    });
  });

  describe('getAlertHistory()', () => {
    beforeEach(() => {
      mockQueryBuilder.clone.mockReturnValue({
        count: jest.fn().mockResolvedValue([{ count: 100 }]),
        first: jest.fn().mockResolvedValue({ count: 100 })
      });
    });

    it('should get alert history with pagination', async () => {
      mockDb.select.mockResolvedValue([]);

      const result = await alertService.getAlertHistory({}, { limit: 20, offset: 40 });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(40);
      expect(result.total).toBe(100);
    });

    it('should filter by severity', async () => {
      mockDb.select.mockResolvedValue([]);

      await alertService.getAlertHistory({ severity: 'critical' });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('severity', 'critical');
    });

    it('should filter by status', async () => {
      mockDb.select.mockResolvedValue([]);

      await alertService.getAlertHistory({ status: 'firing' });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('status', 'firing');
    });

    it('should filter by start date', async () => {
      mockDb.select.mockResolvedValue([]);

      await alertService.getAlertHistory({ startDate: '2026-01-01T00:00:00Z' });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'created_at',
        '>=',
        '2026-01-01T00:00:00Z'
      );
    });

    it('should filter by end date', async () => {
      mockDb.select.mockResolvedValue([]);

      await alertService.getAlertHistory({ endDate: '2026-01-31T23:59:59Z' });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'created_at',
        '<=',
        '2026-01-31T23:59:59Z'
      );
    });

    it('should use default pagination (50, 0)', async () => {
      mockDb.select.mockResolvedValue([]);

      await alertService.getAlertHistory();

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(50);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
    });

    it('should order by created_at desc', async () => {
      mockDb.select.mockResolvedValue([]);

      await alertService.getAlertHistory();

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('created_at', 'desc');
    });
  });

  describe('Database Initialization', () => {
    it('should throw error when database not initialized in evaluateRule', async () => {
      alertService.setDatabase(null);

      const rule = {
        id: 1,
        rule_name: 'Test',
        metric_name: 'test_metric',
        condition: '>',
        threshold: 50,
        severity: 'warning'
      };

      await expect(alertService.evaluateRule(rule)).rejects.toThrow('Database not initialized');
    });

    it('should throw error when database not initialized in evaluateAllRules', async () => {
      alertService.setDatabase(null);

      await expect(alertService.evaluateAllRules()).rejects.toThrow('Database not initialized');
    });

    it('should throw error when database not initialized in fireAlert', async () => {
      alertService.setDatabase(null);

      const rule = {
        id: 1,
        rule_name: 'Test',
        metric_name: 'test_metric',
        threshold: 50,
        severity: 'warning'
      };

      await expect(alertService.fireAlert(rule, 60)).rejects.toThrow('Database not initialized');
    });

    it('should throw error when database not initialized in acknowledgeAlert', async () => {
      alertService.setDatabase(null);

      await expect(alertService.acknowledgeAlert(1, 1)).rejects.toThrow('Database not initialized');
    });

    it('should throw error when database not initialized in resolveAlert', async () => {
      alertService.setDatabase(null);

      await expect(alertService.resolveAlert(1)).rejects.toThrow('Database not initialized');
    });

    it('should throw error when database not initialized in getActiveAlerts', async () => {
      alertService.setDatabase(null);

      await expect(alertService.getActiveAlerts()).rejects.toThrow('Database not initialized');
    });

    it('should throw error when database not initialized in getAlertHistory', async () => {
      alertService.setDatabase(null);

      await expect(alertService.getAlertHistory()).rejects.toThrow('Database not initialized');
    });
  });
});
