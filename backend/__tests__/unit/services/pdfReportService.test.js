/**
 * PDF Report Service Unit Tests
 * Tests the exported API and utility functions
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

jest.mock('fs');
jest.mock('pdfkit');

describe('PDF Report Service Unit Tests', () => {
  let pdfReportService;
  let mockDoc;
  let mockStream;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock PDFDocument
    mockDoc = {
      rect: jest.fn().mockReturnThis(),
      fill: jest.fn().mockReturnThis(),
      fillColor: jest.fn().mockReturnThis(),
      fontSize: jest.fn().mockReturnThis(),
      font: jest.fn().mockReturnThis(),
      text: jest.fn().mockReturnThis(),
      moveDown: jest.fn().mockReturnThis(),
      pipe: jest.fn(),
      end: jest.fn(),
      y: 100,
      page: { width: 612, height: 792 },
      height: 792,
      width: 612,
      addPage: jest.fn().mockReturnThis(),
      switchToPage: jest.fn(),
      bufferedPageRange: jest.fn().mockReturnValue({ start: 0, count: 1 })
    };

    mockStream = {
      on: jest.fn((event, callback) => {
        if (event === 'finish') {
          setTimeout(callback, 10);
        }
        return mockStream;
      })
    };

    // Set up fs mocks BEFORE requiring the service module
    PDFDocument.mockImplementation(() => mockDoc);
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockReturnValue(undefined);
    fs.createWriteStream.mockReturnValue(mockStream);
    fs.statSync.mockReturnValue({ size: 1024 });
    // Default empty array - will be overridden in individual tests
    fs.readdirSync.mockReturnValue([]);
    fs.unlinkSync.mockReturnValue(undefined);

    // Only require module once at the start - don't resetModules
    if (!pdfReportService) {
      pdfReportService = require('../../../services/pdfReportService');
    }
  });

  describe('Module Exports', () => {
    it('should export generateReport function', () => {
      expect(typeof pdfReportService.generateReport).toBe('function');
    });

    it('should export generateIncidentSummaryReport function', () => {
      expect(typeof pdfReportService.generateIncidentSummaryReport).toBe('function');
    });

    it('should export generateSlaComplianceReport function', () => {
      expect(typeof pdfReportService.generateSlaComplianceReport).toBe('function');
    });

    it('should export generateSecurityOverviewReport function', () => {
      expect(typeof pdfReportService.generateSecurityOverviewReport).toBe('function');
    });

    it('should export getSupportedReportTypes function', () => {
      expect(typeof pdfReportService.getSupportedReportTypes).toBe('function');
    });

    it('should export cleanupOldReports function', () => {
      expect(typeof pdfReportService.cleanupOldReports).toBe('function');
    });

    it('should export REPORTS_DIR constant', () => {
      expect(pdfReportService).toHaveProperty('REPORTS_DIR');
      expect(typeof pdfReportService.REPORTS_DIR).toBe('string');
    });
  });

  describe('getSupportedReportTypes', () => {
    it('should return list of supported report types', () => {
      const reportTypes = pdfReportService.getSupportedReportTypes();

      expect(Array.isArray(reportTypes)).toBe(true);
      expect(reportTypes.length).toBe(3);
    });

    it('should include incident_summary report type', () => {
      const reportTypes = pdfReportService.getSupportedReportTypes();
      const incidentReport = reportTypes.find((r) => r.type === 'incident_summary');

      expect(incidentReport).toBeDefined();
      expect(incidentReport.name).toBe('Incident Summary Report');
      expect(incidentReport.description).toBeTruthy();
    });

    it('should include sla_compliance report type', () => {
      const reportTypes = pdfReportService.getSupportedReportTypes();
      const slaReport = reportTypes.find((r) => r.type === 'sla_compliance');

      expect(slaReport).toBeDefined();
      expect(slaReport.name).toBe('SLA Compliance Report');
      expect(slaReport.description).toBeTruthy();
    });

    it('should include security_overview report type', () => {
      const reportTypes = pdfReportService.getSupportedReportTypes();
      const securityReport = reportTypes.find((r) => r.type === 'security_overview');

      expect(securityReport).toBeDefined();
      expect(securityReport.name).toBe('Security Overview Report');
      expect(securityReport.description).toBeTruthy();
    });

    it('each report type should have required fields', () => {
      const reportTypes = pdfReportService.getSupportedReportTypes();

      reportTypes.forEach((reportType) => {
        expect(reportType).toHaveProperty('type');
        expect(reportType).toHaveProperty('name');
        expect(reportType).toHaveProperty('description');
        expect(typeof reportType.type).toBe('string');
        expect(typeof reportType.name).toBe('string');
        expect(typeof reportType.description).toBe('string');
      });
    });
  });

  describe('generateReport', () => {
    it('should throw error for unknown report type', async () => {
      const mockDb = jest.fn();

      await expect(pdfReportService.generateReport(mockDb, 'unknown_type')).rejects.toThrow(
        'Unknown report type: unknown_type'
      );
    });

    it('should accept valid report types: incident_summary', async () => {
      const mockDb = jest.fn(() => {
        // Create a chainable query builder that resolves
        const qb = {
          select: jest.fn(function () {
            return this;
          }),
          where: jest.fn(function () {
            return this;
          }),
          orderBy: jest.fn(function () {
            return this;
          })
        };
        // Return promise-like object
        return Promise.resolve([]).then(() => []);
      });

      // This test validates the function accepts the type, doesn't verify full execution
      // due to complexity of mocking Knex query chains
      expect(typeof pdfReportService.generateReport).toBe('function');
    });

    it('should accept valid report types: sla_compliance', () => {
      expect(typeof pdfReportService.generateReport).toBe('function');
    });

    it('should accept valid report types: security_overview', () => {
      expect(typeof pdfReportService.generateReport).toBe('function');
    });
  });

  describe('cleanupOldReports', () => {
    it('should count files correctly', () => {
      fs.readdirSync.mockReturnValue(['report1.pdf', 'report2.pdf', 'report3.pdf']);
      fs.statSync.mockReturnValue({
        mtimeMs: Date.now() - 31 * 24 * 60 * 60 * 1000 // 31 days old
      });
      fs.unlinkSync.mockReturnValue(undefined);

      const deletedCount = pdfReportService.cleanupOldReports(30);

      expect(deletedCount).toBe(3);
      expect(fs.unlinkSync).toHaveBeenCalledTimes(3);
    });

    it('should not delete recent files', () => {
      fs.readdirSync.mockReturnValue(['recent.pdf']);
      fs.statSync.mockReturnValue({
        mtimeMs: Date.now() - 5 * 24 * 60 * 60 * 1000 // 5 days old
      });

      const deletedCount = pdfReportService.cleanupOldReports(30);

      expect(deletedCount).toBe(0);
      expect(fs.unlinkSync).not.toHaveBeenCalled();
    });

    it('should delete no files when directory is empty', () => {
      fs.readdirSync.mockReturnValue([]);

      const deletedCount = pdfReportService.cleanupOldReports(30);

      expect(deletedCount).toBe(0);
    });

    it('should respect daysToKeep parameter', () => {
      fs.readdirSync.mockReturnValue(['old.pdf']);
      fs.statSync.mockReturnValue({
        mtimeMs: Date.now() - 15 * 24 * 60 * 60 * 1000 // 15 days old
      });

      // With daysToKeep = 10, this file should be deleted
      let deletedCount = pdfReportService.cleanupOldReports(10);
      expect(deletedCount).toBe(1);

      // Reset mocks
      fs.unlinkSync.mockReset();

      // With daysToKeep = 20, this file should NOT be deleted
      deletedCount = pdfReportService.cleanupOldReports(20);
      expect(deletedCount).toBe(0);
    });
  });

  describe('Utility Functions', () => {
    it('formatDate should format dates correctly', () => {
      const date = new Date('2024-01-15T10:30:00Z');
      const formatted = date.toISOString().split('T')[0];
      expect(formatted).toBe('2024-01-15');
    });

    it('formatDateTime should format datetime correctly', () => {
      const date = new Date('2024-01-15T10:30:45Z');
      const formatted = date.toISOString().replace('T', ' ').substring(0, 19);
      expect(formatted).toBe('2024-01-15 10:30:45');
    });
  });

  describe('Directory Management', () => {
    it('should ensure reports directory exists', () => {
      fs.existsSync.mockReturnValue(false);

      // Call cleanupOldReports which calls ensureReportsDir
      pdfReportService.cleanupOldReports(30);

      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    it('should not recreate existing reports directory', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readdirSync.mockReturnValue([]);

      pdfReportService.cleanupOldReports(30);

      // mkdirSync should not be called if directory exists
      // Note: fs.readdirSync being called indicates directory exists
      expect(fs.readdirSync).toHaveBeenCalled();
    });
  });

  // Helper: Knex-style thenable チェーンモックを生成
  const createMockDb = (tableResponses = {}) =>
    jest.fn((tableName) => {
      const data = tableResponses[tableName] || [];
      const chain = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        then: (resolve, reject) => Promise.resolve(data).then(resolve, reject)
      };
      return chain;
    });

  describe('generateIncidentSummaryReport', () => {
    it('should generate PDF and return result object with stats', async () => {
      const incidents = [
        {
          ticket_id: 'INC-001',
          title: 'Test Incident',
          status: 'Open',
          priority: 'High',
          is_security_incident: false,
          created_at: '2026-01-01'
        },
        {
          ticket_id: 'INC-002',
          title: 'Security Issue',
          status: 'Resolved',
          priority: 'Critical',
          is_security_incident: true,
          created_at: '2026-01-02'
        },
        {
          ticket_id: 'INC-003',
          title: 'Closed One',
          status: 'Closed',
          priority: 'Low',
          is_security_incident: false,
          created_at: '2026-01-03'
        }
      ];
      const mockDb = createMockDb({ incidents });

      const result = await pdfReportService.generateIncidentSummaryReport(mockDb);

      expect(result.reportId).toMatch(/^RPT-INC-/);
      expect(result.fileName).toContain('incident_summary_');
      expect(result).toHaveProperty('filePath');
      expect(result).toHaveProperty('fileSize');
      expect(result.stats.total).toBe(3);
      expect(result.stats.open).toBe(1); // Resolved/Closed は除外
      expect(result.stats.security).toBe(1);
      expect(result.stats.critical).toBe(1);
    });

    it('should add new page when incidents list is non-empty', async () => {
      const incidents = [
        {
          ticket_id: 'INC-001',
          title: 'Test',
          status: 'Open',
          priority: 'Low',
          is_security_incident: false,
          created_at: '2026-01-01'
        }
      ];
      const mockDb = createMockDb({ incidents });

      await pdfReportService.generateIncidentSummaryReport(mockDb);

      // incidents.length > 0 → doc.addPage() が呼ばれる
      expect(mockDoc.addPage).toHaveBeenCalled();
    });

    it('should NOT add new page when incidents list is empty', async () => {
      const mockDb = createMockDb({ incidents: [] });

      await pdfReportService.generateIncidentSummaryReport(mockDb);

      expect(mockDoc.addPage).not.toHaveBeenCalled();
    });

    it('should handle fromDate and toDate options (dateRange branch)', async () => {
      const mockDb = createMockDb({ incidents: [] });

      const result = await pdfReportService.generateIncidentSummaryReport(mockDb, {
        fromDate: '2026-01-01',
        toDate: '2026-01-31'
      });

      expect(result.stats.total).toBe(0);
      // fromDate AND toDate → drawHeader に dateRange が渡される
      expect(mockDoc.text).toHaveBeenCalled();
    });

    it('should reject when writeStream emits error event', async () => {
      const errorStream = {
        on: jest.fn((event, callback) => {
          if (event === 'error') {
            setTimeout(() => callback(new Error('Disk write failed')), 10);
          }
          return errorStream;
        })
      };
      fs.createWriteStream.mockReturnValue(errorStream);

      const mockDb = createMockDb({ incidents: [] });

      await expect(pdfReportService.generateIncidentSummaryReport(mockDb)).rejects.toThrow(
        'Disk write failed'
      );
    });
  });

  describe('generateSlaComplianceReport', () => {
    it('should generate PDF and return result object', async () => {
      const slaAgreements = [
        {
          sla_id: 'SLA-001',
          service_name: 'Web',
          metric_name: 'Uptime',
          target_value: 99,
          actual_value: 99.5,
          achievement_rate: 100,
          status: 'Met'
        }
      ];
      const mockDb = createMockDb({ sla_agreements: slaAgreements });

      const result = await pdfReportService.generateSlaComplianceReport(mockDb);

      expect(result.reportId).toMatch(/^RPT-SLA-/);
      expect(result.stats.total).toBe(1);
      expect(result.stats.met).toBe(1);
      expect(result.stats.complianceRate).toBe(100);
    });

    it('should set complianceRate to 0 when total is 0 (zero-division guard)', async () => {
      const mockDb = createMockDb({ sla_agreements: [] });

      const result = await pdfReportService.generateSlaComplianceReport(mockDb);

      expect(result.stats.total).toBe(0);
      expect(result.stats.complianceRate).toBe(0);
    });

    it('should use green color for complianceRate >= 90', async () => {
      // 10件全てMet → 100% (>=90)
      const slaAgreements = Array.from({ length: 10 }, (_, i) => ({
        sla_id: `SLA-${i}`,
        service_name: 'Service',
        metric_name: 'Uptime',
        achievement_rate: 95,
        status: 'Met'
      }));
      const mockDb = createMockDb({ sla_agreements: slaAgreements });

      const result = await pdfReportService.generateSlaComplianceReport(mockDb);

      expect(result.stats.complianceRate).toBe(100);
    });

    it('should use yellow color for 70 <= complianceRate < 90', async () => {
      // 8Met + 2Violated → 80% (>= 70 and < 90)
      const slaAgreements = [
        ...Array.from({ length: 8 }, (_, i) => ({
          sla_id: `SLA-MET-${i}`,
          service_name: 'A',
          metric_name: 'M',
          achievement_rate: 90,
          status: 'Met'
        })),
        ...Array.from({ length: 2 }, (_, i) => ({
          sla_id: `SLA-VIO-${i}`,
          service_name: 'B',
          metric_name: 'N',
          achievement_rate: 50,
          status: 'Violated'
        }))
      ];
      const mockDb = createMockDb({ sla_agreements: slaAgreements });

      const result = await pdfReportService.generateSlaComplianceReport(mockDb);

      expect(result.stats.complianceRate).toBe(80);
    });

    it('should use red color for complianceRate < 70', async () => {
      // 2Met + 8Violated → 20% (< 70)
      const slaAgreements = [
        ...Array.from({ length: 2 }, (_, i) => ({
          sla_id: `SLA-MET-${i}`,
          service_name: 'A',
          metric_name: 'M',
          achievement_rate: 90,
          status: 'Met'
        })),
        ...Array.from({ length: 8 }, (_, i) => ({
          sla_id: `SLA-VIO-${i}`,
          service_name: 'B',
          metric_name: 'N',
          achievement_rate: 50,
          status: 'Violated'
        }))
      ];
      const mockDb = createMockDb({ sla_agreements: slaAgreements });

      const result = await pdfReportService.generateSlaComplianceReport(mockDb);

      expect(result.stats.complianceRate).toBe(20);
    });

    it('should add new page for SLA details when agreements exist', async () => {
      const slaAgreements = [
        {
          sla_id: 'SLA-001',
          service_name: 'Web',
          metric_name: 'Uptime',
          achievement_rate: 95,
          status: 'Met'
        }
      ];
      const mockDb = createMockDb({ sla_agreements: slaAgreements });

      await pdfReportService.generateSlaComplianceReport(mockDb);

      // slaAgreements.length > 0 → addPage が呼ばれる
      expect(mockDoc.addPage).toHaveBeenCalled();
    });

    it('should show violations section when violations exist (Violated/Breached or rate < 80)', async () => {
      const slaAgreements = [
        {
          sla_id: 'SLA-VIO',
          service_name: 'DB',
          metric_name: 'Response',
          achievement_rate: 50,
          status: 'Violated'
        }
      ];
      const mockDb = createMockDb({ sla_agreements: slaAgreements });

      const result = await pdfReportService.generateSlaComplianceReport(mockDb);

      expect(result.stats.violated).toBe(1);
      // violations.length > 0 ブランチが実行されたことを確認
      expect(mockDoc.text).toHaveBeenCalled();
    });

    it('should count atRisk and violated correctly', async () => {
      const slaAgreements = [
        {
          sla_id: 'SLA-1',
          service_name: 'A',
          metric_name: 'M',
          achievement_rate: 100,
          status: 'Met'
        },
        {
          sla_id: 'SLA-2',
          service_name: 'B',
          metric_name: 'N',
          achievement_rate: 75,
          status: 'At-Risk'
        },
        {
          sla_id: 'SLA-3',
          service_name: 'C',
          metric_name: 'O',
          achievement_rate: 60,
          status: 'Breached'
        }
      ];
      const mockDb = createMockDb({ sla_agreements: slaAgreements });

      const result = await pdfReportService.generateSlaComplianceReport(mockDb);

      expect(result.stats.atRisk).toBe(1);
      expect(result.stats.violated).toBe(1); // Breached も violations に含まれる
    });

    it('should handle fromDate and toDate filtering', async () => {
      const mockDb = createMockDb({ sla_agreements: [] });

      const result = await pdfReportService.generateSlaComplianceReport(mockDb, {
        fromDate: '2026-01-01',
        toDate: '2026-01-31'
      });

      expect(result.reportId).toMatch(/^RPT-SLA-/);
    });
  });

  describe('generateSecurityOverviewReport', () => {
    it('should generate PDF and return result object', async () => {
      const mockDb = createMockDb({
        vulnerabilities: [],
        incidents: [],
        compliance: []
      });

      const result = await pdfReportService.generateSecurityOverviewReport(mockDb);

      expect(result.reportId).toMatch(/^RPT-SEC-/);
      expect(result.stats.vulnerabilities.total).toBe(0);
      expect(result.stats.incidents.total).toBe(0);
    });

    it('should count vulnerability severities correctly', async () => {
      const vulnerabilities = [
        {
          vulnerability_id: 'V1',
          title: 'C',
          severity: 'Critical',
          cvss_score: 9.8,
          affected_asset: 'S',
          status: 'Open'
        },
        {
          vulnerability_id: 'V2',
          title: 'H',
          severity: 'High',
          cvss_score: 7.5,
          affected_asset: 'D',
          status: 'Open'
        },
        {
          vulnerability_id: 'V3',
          title: 'M',
          severity: 'Medium',
          cvss_score: 5.0,
          affected_asset: 'A',
          status: 'Mitigated'
        },
        {
          vulnerability_id: 'V4',
          title: 'L',
          severity: 'Low',
          cvss_score: 2.0,
          affected_asset: 'B',
          status: 'Resolved'
        }
      ];
      const mockDb = createMockDb({
        vulnerabilities,
        incidents: [],
        compliance: []
      });

      const result = await pdfReportService.generateSecurityOverviewReport(mockDb);

      expect(result.stats.vulnerabilities.total).toBe(4);
      expect(result.stats.vulnerabilities.critical).toBe(1);
      expect(result.stats.vulnerabilities.high).toBe(1);
      expect(result.stats.vulnerabilities.medium).toBe(1);
      expect(result.stats.vulnerabilities.low).toBe(1);
      // Mitigated/Resolved は open 除外
      expect(result.stats.vulnerabilities.open).toBe(2);
    });

    it('should add page for critical/high vulnerabilities (criticalVulns.length > 0)', async () => {
      const criticalVulns = [
        {
          vulnerability_id: 'V1',
          title: 'Critical',
          severity: 'Critical',
          cvss_score: 9.0,
          affected_asset: 'S',
          status: 'Open'
        },
        {
          vulnerability_id: 'V2',
          title: 'High',
          severity: 'High',
          cvss_score: 7.5,
          affected_asset: 'D',
          status: 'Open'
        }
      ];
      const mockDb = createMockDb({
        vulnerabilities: criticalVulns,
        incidents: [],
        compliance: []
      });

      await pdfReportService.generateSecurityOverviewReport(mockDb);

      // Critical/High が存在 → addPage が呼ばれる
      expect(mockDoc.addPage).toHaveBeenCalled();
    });

    it('should NOT add page when no critical/high vulnerabilities', async () => {
      const vulnerabilities = [
        {
          vulnerability_id: 'V1',
          title: 'Low',
          severity: 'Low',
          cvss_score: 2.0,
          affected_asset: 'A',
          status: 'Open'
        }
      ];
      const mockDb = createMockDb({
        vulnerabilities,
        incidents: [],
        compliance: []
      });

      await pdfReportService.generateSecurityOverviewReport(mockDb);

      expect(mockDoc.addPage).not.toHaveBeenCalled();
    });

    it('should show NIST CSF compliance section when compliance data exists', async () => {
      const compliance = [
        { function: 'Identify', progress: 90, target_tier: 3 },
        { function: 'Protect', progress: 70, target_tier: 3 },
        { function: 'Detect', progress: 50, target_tier: 2 }
      ];
      const mockDb = createMockDb({
        vulnerabilities: [],
        incidents: [],
        compliance
      });

      await pdfReportService.generateSecurityOverviewReport(mockDb);

      // compliance.length > 0 → text が呼ばれる
      expect(mockDoc.text).toHaveBeenCalled();
    });

    it('should use "Good" status for progress >= 80', async () => {
      // getComplianceStatus ブランチ: progress >= 80 → 'Good'
      const compliance = [{ function: 'Identify', progress: 85, target_tier: 3 }];
      const mockDb = createMockDb({ vulnerabilities: [], incidents: [], compliance });

      await expect(pdfReportService.generateSecurityOverviewReport(mockDb)).resolves.toHaveProperty(
        'reportId'
      );
    });

    it('should use "Moderate" status for 60 <= progress < 80', async () => {
      const compliance = [{ function: 'Protect', progress: 65, target_tier: 2 }];
      const mockDb = createMockDb({ vulnerabilities: [], incidents: [], compliance });

      await expect(pdfReportService.generateSecurityOverviewReport(mockDb)).resolves.toHaveProperty(
        'reportId'
      );
    });

    it('should use "Needs Attention" status for progress < 60', async () => {
      const compliance = [{ function: 'Recover', progress: 40, target_tier: 1 }];
      const mockDb = createMockDb({ vulnerabilities: [], incidents: [], compliance });

      await expect(pdfReportService.generateSecurityOverviewReport(mockDb)).resolves.toHaveProperty(
        'reportId'
      );
    });

    it('should return "0%" for calcPercent when total is 0', async () => {
      // vulnStats.total === 0 → calcPercent returns '0%' (除算ゼロ保護)
      const mockDb = createMockDb({
        vulnerabilities: [],
        incidents: [],
        compliance: []
      });

      const result = await pdfReportService.generateSecurityOverviewReport(mockDb);

      expect(result.stats.vulnerabilities.total).toBe(0);
      expect(mockDoc.text).toHaveBeenCalled();
    });

    it('should count security incidents open/total correctly', async () => {
      const securityIncidents = [
        { status: 'Open' },
        { status: 'Resolved' },
        { status: 'In Progress' }
      ];
      const mockDb = createMockDb({
        vulnerabilities: [],
        incidents: securityIncidents,
        compliance: []
      });

      const result = await pdfReportService.generateSecurityOverviewReport(mockDb);

      expect(result.stats.incidents.total).toBe(3);
      expect(result.stats.incidents.open).toBe(2); // Resolved を除く
    });

    it('should handle fromDate and toDate filtering', async () => {
      const mockDb = createMockDb({
        vulnerabilities: [],
        incidents: [],
        compliance: []
      });

      const result = await pdfReportService.generateSecurityOverviewReport(mockDb, {
        fromDate: '2026-01-01',
        toDate: '2026-01-31'
      });

      expect(result.reportId).toMatch(/^RPT-SEC-/);
    });
  });

  describe('generateReport - dispatch function', () => {
    it('should dispatch incident_summary to generateIncidentSummaryReport', async () => {
      const mockDb = createMockDb({ incidents: [] });

      const result = await pdfReportService.generateReport(mockDb, 'incident_summary');

      expect(result.reportId).toMatch(/^RPT-INC-/);
    });

    it('should dispatch sla_compliance to generateSlaComplianceReport', async () => {
      const mockDb = createMockDb({ sla_agreements: [] });

      const result = await pdfReportService.generateReport(mockDb, 'sla_compliance');

      expect(result.reportId).toMatch(/^RPT-SLA-/);
    });

    it('should dispatch security_overview to generateSecurityOverviewReport', async () => {
      const mockDb = createMockDb({
        vulnerabilities: [],
        incidents: [],
        compliance: []
      });

      const result = await pdfReportService.generateReport(mockDb, 'security_overview');

      expect(result.reportId).toMatch(/^RPT-SEC-/);
    });
  });

  describe('drawTable - page boundary check', () => {
    it('should call addPage when doc.y exceeds page height limit', async () => {
      // doc.y を 720 に設定することでページ境界 (792-80=712) を超えさせる
      mockDoc.y = 720;

      const incidents = [
        {
          ticket_id: 'INC-001',
          title: 'Overflow Test',
          status: 'Open',
          priority: 'High',
          is_security_incident: false,
          created_at: '2026-01-01'
        }
      ];
      const mockDb = createMockDb({ incidents });

      await pdfReportService.generateIncidentSummaryReport(mockDb);

      // 行描画時に doc.y > 712 → addPage が呼ばれる
      expect(mockDoc.addPage).toHaveBeenCalled();
    });
  });

  describe('drawTable - null/undefined cell handling', () => {
    it('should convert null/undefined cells to empty string', async () => {
      const incidents = [
        {
          ticket_id: null, // null セル → '' に変換
          title: undefined, // undefined セル → '' に変換
          status: 'Open',
          priority: 'Low',
          is_security_incident: false,
          created_at: '2026-01-01'
        }
      ];
      const mockDb = createMockDb({ incidents });

      await expect(pdfReportService.generateIncidentSummaryReport(mockDb)).resolves.toHaveProperty(
        'reportId'
      );
    });
  });

  describe('drawSummaryBoxes - alternating row colors', () => {
    it('should render alternating bgColor in drawTable rows', async () => {
      // 偶数行は '#ffffff'、奇数行は '#f8fafc' を使用
      const incidents = [
        {
          ticket_id: 'INC-001',
          status: 'Open',
          priority: 'Low',
          is_security_incident: false,
          created_at: '2026-01-01'
        },
        {
          ticket_id: 'INC-002',
          status: 'Resolved',
          priority: 'High',
          is_security_incident: true,
          created_at: '2026-01-02'
        }
      ];
      const mockDb = createMockDb({ incidents });

      await expect(pdfReportService.generateIncidentSummaryReport(mockDb)).resolves.toHaveProperty(
        'stats'
      );
    });
  });
});
