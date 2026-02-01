/**
 * Monitoring Service Unit Tests
 * Phase 9.2: メトリクス収集・履歴保存機能
 */

const os = require('os');
const fs = require('fs');
const monitoringService = require('../../../services/monitoringService');
const { register } = require('../../../middleware/metrics');

// Mock os module
jest.mock('os');

// Mock fs module
jest.mock('fs', () => ({
  statfsSync: jest.fn()
}));

// Mock metrics register
jest.mock('../../../middleware/metrics', () => ({
  register: {
    metrics: jest.fn()
  }
}));

describe('Monitoring Service Unit Tests', () => {
  let mockDb;
  let mockQueryBuilder;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock query builder (chainable methods)
    mockQueryBuilder = {
      insert: jest.fn().mockResolvedValue([1]),
      update: jest.fn().mockResolvedValue(1),
      where: jest.fn().mockReturnThis(),
      whereNot: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
      count: jest.fn().mockResolvedValue([{ count: 0 }]),
      orderBy: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      delete: jest.fn().mockResolvedValue(0)
    };

    // Mock database (function that returns query builder)
    mockDb = jest.fn(() => mockQueryBuilder);
    Object.assign(mockDb, mockQueryBuilder);

    monitoringService.setDatabase(mockDb);

    // Mock os methods
    os.totalmem.mockReturnValue(8589934592); // 8GB
    os.freemem.mockReturnValue(4294967296); // 4GB
    os.uptime.mockReturnValue(86400); // 1 day
    os.cpus.mockReturnValue([
      {
        times: { user: 1000000, nice: 0, sys: 500000, idle: 3500000, irq: 0 }
      },
      {
        times: { user: 1200000, nice: 0, sys: 600000, idle: 3200000, irq: 0 }
      }
    ]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('getSystemMetrics()', () => {
    beforeEach(() => {
      register.metrics.mockResolvedValue(`
# HELP itsm_cpu_usage_percent CPU使用率
# TYPE itsm_cpu_usage_percent gauge
itsm_cpu_usage_percent 45.5
# HELP itsm_active_users_total アクティブユーザー数
# TYPE itsm_active_users_total counter
itsm_active_users_total 12
# HELP itsm_http_requests_total HTTPリクエスト数
# TYPE itsm_http_requests_total counter
itsm_http_requests_total 1500
`);

      fs.statfsSync.mockReturnValue({
        blocks: 1000000000,
        bsize: 4096,
        bavail: 500000000
      });
    });

    it('should get system metrics successfully', async () => {
      const result = await monitoringService.getSystemMetrics();

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('cpu');
      expect(result.metrics).toHaveProperty('memory');
      expect(result.metrics).toHaveProperty('disk');
      expect(result.metrics).toHaveProperty('uptime');
    });

    it('should calculate CPU usage correctly', async () => {
      const result = await monitoringService.getSystemMetrics();

      expect(result.metrics.cpu).toHaveProperty('usage_percent');
      expect(result.metrics.cpu.usage_percent).toBeGreaterThanOrEqual(0);
      expect(result.metrics.cpu.usage_percent).toBeLessThanOrEqual(100);
    });

    it('should calculate memory usage correctly', async () => {
      const result = await monitoringService.getSystemMetrics();

      expect(result.metrics.memory).toHaveProperty('total_mb');
      expect(result.metrics.memory).toHaveProperty('used_mb');
      expect(result.metrics.memory).toHaveProperty('usage_percent');
      expect(result.metrics.memory.total_mb).toBe(8192);
      expect(result.metrics.memory.used_mb).toBe(4096);
      expect(result.metrics.memory.usage_percent).toBe(50);
    });

    it('should calculate disk usage correctly', async () => {
      const result = await monitoringService.getSystemMetrics();

      expect(result.metrics.disk).toHaveProperty('total_gb');
      expect(result.metrics.disk).toHaveProperty('used_gb');
      expect(result.metrics.disk).toHaveProperty('free_gb');
      expect(result.metrics.disk).toHaveProperty('usage_percent');
    });

    it('should set CPU threshold_status to critical when usage > 90%', async () => {
      register.metrics.mockResolvedValue(`itsm_cpu_usage_percent 95.0`);

      const result = await monitoringService.getSystemMetrics();

      expect(result.metrics.cpu.threshold_status).toBe('critical');
    });

    it('should set CPU threshold_status to warning when usage > 80%', async () => {
      register.metrics.mockResolvedValue(`itsm_cpu_usage_percent 85.0`);

      const result = await monitoringService.getSystemMetrics();

      expect(result.metrics.cpu.threshold_status).toBe('warning');
    });

    it('should set CPU threshold_status to normal when usage <= 80%', async () => {
      register.metrics.mockResolvedValue(`itsm_cpu_usage_percent 75.0`);

      const result = await monitoringService.getSystemMetrics();

      expect(result.metrics.cpu.threshold_status).toBe('normal');
    });

    it('should set memory threshold_status to critical when usage > 90%', async () => {
      os.totalmem.mockReturnValue(1000);
      os.freemem.mockReturnValue(50); // 95% used

      const result = await monitoringService.getSystemMetrics();

      expect(result.metrics.memory.threshold_status).toBe('critical');
    });

    it('should set disk threshold_status to warning when usage > 80%', async () => {
      fs.statfsSync.mockReturnValue({
        blocks: 1000000000,
        bsize: 4096,
        bavail: 150000000 // 85% used
      });

      const result = await monitoringService.getSystemMetrics();

      expect(result.metrics.disk.threshold_status).toBe('warning');
    });

    it('should format uptime correctly', async () => {
      os.uptime.mockReturnValue(90061); // 1d 1h 1m 1s

      const result = await monitoringService.getSystemMetrics();

      expect(result.metrics.uptime.seconds).toBe(90061);
      expect(result.metrics.uptime.formatted).toBe('1d 1h 1m 1s');
    });

    it('should include active users from Prometheus metrics', async () => {
      const result = await monitoringService.getSystemMetrics();

      expect(result.metrics.active_users.current).toBe(12);
    });

    it('should include requests_per_minute from Prometheus metrics', async () => {
      const result = await monitoringService.getSystemMetrics();

      expect(result.metrics.requests_per_minute.current).toBe(1500);
    });

    it('should handle disk stats error gracefully', async () => {
      fs.statfsSync.mockImplementation(() => {
        throw new Error('Disk access error');
      });

      const result = await monitoringService.getSystemMetrics();

      expect(result.metrics.disk.total_gb).toBe(0);
      expect(result.metrics.disk.usage_percent).toBe(0);
    });
  });

  describe('getBusinessMetrics()', () => {
    beforeEach(() => {
      register.metrics.mockResolvedValue(`itsm_cpu_usage_percent 45.5`);

      // Mock SLA agreements and incidents count
      mockQueryBuilder.count
        .mockResolvedValueOnce([{ count: 45 }]) // Met SLAs
        .mockResolvedValueOnce([{ count: 50 }]) // Total SLAs
        .mockResolvedValueOnce([{ count: 5 }]) // High priority incidents
        .mockResolvedValueOnce([{ count: 8 }]) // Medium priority incidents
        .mockResolvedValueOnce([{ count: 3 }]) // Low priority incidents
        .mockResolvedValueOnce([{ count: 2 }]) // Critical priority incidents
        .mockResolvedValueOnce([{ count: 1 }]); // Security incidents
    });

    it('should get business metrics successfully', async () => {
      const result = await monitoringService.getBusinessMetrics();

      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('metrics');
      expect(result.metrics).toHaveProperty('sla_compliance');
      expect(result.metrics).toHaveProperty('incidents_open');
      expect(result.metrics).toHaveProperty('security_incidents');
    });

    it('should calculate SLA compliance rate correctly', async () => {
      const result = await monitoringService.getBusinessMetrics();

      expect(result.metrics.sla_compliance.current_rate).toBe(90);
    });

    it('should handle zero SLAs gracefully', async () => {
      mockQueryBuilder.count.mockReset();
      mockQueryBuilder.count
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }]);

      const result = await monitoringService.getBusinessMetrics();

      expect(result.metrics.sla_compliance.current_rate).toBe(0);
    });

    it('should count open incidents by priority', async () => {
      const result = await monitoringService.getBusinessMetrics();

      expect(result.metrics.incidents_open.total).toBe(18);
      expect(result.metrics.incidents_open.by_priority.critical).toBe(2);
      expect(result.metrics.incidents_open.by_priority.high).toBe(5);
      expect(result.metrics.incidents_open.by_priority.medium).toBe(8);
      expect(result.metrics.incidents_open.by_priority.low).toBe(3);
    });

    it('should count security incidents', async () => {
      const result = await monitoringService.getBusinessMetrics();

      expect(result.metrics.security_incidents.current).toBe(1);
    });

    it('should throw error when database not initialized', async () => {
      monitoringService.setDatabase(null);

      await expect(monitoringService.getBusinessMetrics()).rejects.toThrow(
        'Database not initialized'
      );
    });
  });

  describe('getMetricsHistory()', () => {
    it('should get metrics history successfully', async () => {
      const mockHistory = [
        {
          metric_name: 'itsm_cpu_usage_percent',
          metric_value: 45.5,
          labels: null,
          timestamp: '2026-01-31T12:00:00.000Z'
        },
        {
          metric_name: 'itsm_cpu_usage_percent',
          metric_value: 48.2,
          labels: null,
          timestamp: '2026-01-31T12:05:00.000Z'
        }
      ];

      mockQueryBuilder.limit.mockResolvedValue(mockHistory);

      const result = await monitoringService.getMetricsHistory('itsm_cpu_usage_percent');

      expect(result).toHaveLength(2);
      expect(result[0].metric_name).toBe('itsm_cpu_usage_percent');
      expect(mockQueryBuilder.where).toHaveBeenCalledWith('metric_name', 'itsm_cpu_usage_percent');
    });

    it('should filter history by start time', async () => {
      mockQueryBuilder.limit.mockResolvedValue([]);

      await monitoringService.getMetricsHistory(
        'itsm_cpu_usage_percent',
        '2026-01-31T00:00:00.000Z'
      );

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'timestamp',
        '>=',
        '2026-01-31T00:00:00.000Z'
      );
    });

    it('should filter history by end time', async () => {
      mockQueryBuilder.limit.mockResolvedValue([]);

      await monitoringService.getMetricsHistory(
        'itsm_cpu_usage_percent',
        null,
        '2026-01-31T23:59:59.000Z'
      );

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'timestamp',
        '<=',
        '2026-01-31T23:59:59.000Z'
      );
    });

    it('should parse JSON labels correctly', async () => {
      mockQueryBuilder.limit.mockResolvedValue([
        {
          metric_name: 'itsm_incidents_open',
          metric_value: 5,
          labels: '{"priority":"high"}',
          timestamp: '2026-01-31T12:00:00.000Z'
        }
      ]);

      const result = await monitoringService.getMetricsHistory('itsm_incidents_open');

      expect(result[0].labels).toEqual({ priority: 'high' });
    });

    it('should limit results to 1000 records', async () => {
      mockQueryBuilder.limit.mockResolvedValue([]);

      await monitoringService.getMetricsHistory('itsm_cpu_usage_percent');

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(1000);
    });

    it('should throw error when database not initialized', async () => {
      monitoringService.setDatabase(null);

      await expect(monitoringService.getMetricsHistory('itsm_cpu_usage_percent')).rejects.toThrow(
        'Database not initialized'
      );
    });
  });

  describe('saveMetricsSnapshot()', () => {
    beforeEach(() => {
      register.metrics.mockResolvedValue(`
itsm_cpu_usage_percent 45.5
itsm_active_users_total 12
itsm_http_requests_total 1500
`);

      fs.statfsSync.mockReturnValue({
        blocks: 1000000000,
        bsize: 4096,
        bavail: 500000000
      });

      // Mock SLA and incidents queries
      mockQueryBuilder.count
        .mockResolvedValueOnce([{ count: 45 }]) // Met SLAs
        .mockResolvedValueOnce([{ count: 50 }]) // Total SLAs
        .mockResolvedValueOnce([{ count: 5 }]) // High priority
        .mockResolvedValueOnce([{ count: 8 }]) // Medium priority
        .mockResolvedValueOnce([{ count: 3 }]) // Low priority
        .mockResolvedValueOnce([{ count: 2 }]) // Critical priority
        .mockResolvedValueOnce([{ count: 1 }]); // Security incidents
    });

    it('should save metrics snapshot successfully', async () => {
      await monitoringService.saveMetricsSnapshot();

      expect(mockQueryBuilder.insert).toHaveBeenCalled();
      expect(mockQueryBuilder.insert.mock.calls.length).toBeGreaterThan(5);
    });

    it('should save system metrics to history', async () => {
      await monitoringService.saveMetricsSnapshot();

      const insertCalls = mockQueryBuilder.insert.mock.calls;
      const cpuMetric = insertCalls.find(
        (call) => call[0].metric_name === 'itsm_cpu_usage_percent'
      );

      expect(cpuMetric).toBeDefined();
      expect(cpuMetric[0]).toHaveProperty('metric_value');
      expect(cpuMetric[0]).toHaveProperty('timestamp');
    });

    it('should save SLA compliance metric', async () => {
      await monitoringService.saveMetricsSnapshot();

      const insertCalls = mockQueryBuilder.insert.mock.calls;
      const slaMetric = insertCalls.find(
        (call) => call[0].metric_name === 'itsm_sla_compliance_rate'
      );

      expect(slaMetric).toBeDefined();
      expect(slaMetric[0].metric_value).toBe(90);
    });

    it('should save incident metrics with labels', async () => {
      await monitoringService.saveMetricsSnapshot();

      const insertCalls = mockQueryBuilder.insert.mock.calls;
      const incidentMetrics = insertCalls.filter(
        (call) => call[0].metric_name === 'itsm_incidents_open'
      );

      expect(incidentMetrics.length).toBe(4);
    });

    it('should throw error when database not initialized', async () => {
      monitoringService.setDatabase(null);

      await expect(monitoringService.saveMetricsSnapshot()).rejects.toThrow(
        'Database not initialized'
      );
    });
  });

  describe('cleanOldMetrics()', () => {
    it('should delete old metrics successfully', async () => {
      mockQueryBuilder.delete.mockResolvedValue(150);

      const result = await monitoringService.cleanOldMetrics(30);

      expect(result).toBe(150);
      expect(mockQueryBuilder.where).toHaveBeenCalled();
      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it('should use default retention of 30 days', async () => {
      mockQueryBuilder.delete.mockResolvedValue(100);

      await monitoringService.cleanOldMetrics();

      expect(mockQueryBuilder.delete).toHaveBeenCalled();
    });

    it('should calculate cutoff date correctly', async () => {
      mockQueryBuilder.delete.mockResolvedValue(50);

      await monitoringService.cleanOldMetrics(7);

      const whereCall = mockQueryBuilder.where.mock.calls[0];
      expect(whereCall[0]).toBe('timestamp');
      expect(whereCall[1]).toBe('<');
    });

    it('should throw error when database not initialized', async () => {
      monitoringService.setDatabase(null);

      await expect(monitoringService.cleanOldMetrics(30)).rejects.toThrow(
        'Database not initialized'
      );
    });
  });

  describe('registerCustomMetric()', () => {
    it('should register custom metric successfully', async () => {
      mockQueryBuilder.insert.mockResolvedValue([123]);

      const result = await monitoringService.registerCustomMetric('custom_api_latency', 45.5, {
        endpoint: '/api/v1/incidents'
      });

      expect(result).toBe(123);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_name: 'custom_api_latency',
          metric_value: 45.5,
          labels: '{"endpoint":"/api/v1/incidents"}'
        })
      );
    });

    it('should register metric without labels', async () => {
      mockQueryBuilder.insert.mockResolvedValue([124]);

      const result = await monitoringService.registerCustomMetric('custom_counter', 100);

      expect(result).toBe(124);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          metric_name: 'custom_counter',
          metric_value: 100,
          labels: null
        })
      );
    });

    it('should throw error for invalid metric name', async () => {
      await expect(monitoringService.registerCustomMetric('', 100)).rejects.toThrow(
        'Invalid metric name or value'
      );
    });

    it('should throw error for invalid metric value', async () => {
      await expect(
        monitoringService.registerCustomMetric('test_metric', 'not_a_number')
      ).rejects.toThrow('Invalid metric name or value');
    });

    it('should throw error when database not initialized', async () => {
      monitoringService.setDatabase(null);

      await expect(monitoringService.registerCustomMetric('test_metric', 100)).rejects.toThrow(
        'Database not initialized'
      );
    });
  });
});
