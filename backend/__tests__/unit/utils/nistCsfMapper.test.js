/**
 * NIST CSF Mapper Unit Tests
 */

const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn()
};

jest.mock('../../../db', () => ({
  db: mockDb
}));

describe('NIST CSF Mapper Unit Tests', () => {
  let NistCsfMapper;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    NistCsfMapper = require('../../../utils/nistCsfMapper');
  });

  describe('mapVulnerabilityToCSF', () => {
    it('should map Identified status to IDENTIFY function', () => {
      const vulnerability = {
        severity: 'Critical',
        status: 'Identified'
      };

      const mapping = NistCsfMapper.mapVulnerabilityToCSF(vulnerability);

      expect(mapping.function).toBe('IDENTIFY');
      expect(mapping.category).toContain('Asset vulnerabilities');
      expect(mapping.impact).toBe(1.0);
    });

    it('should map In-Progress status to RESPOND function', () => {
      const vulnerability = {
        severity: 'High',
        status: 'In-Progress'
      };

      const mapping = NistCsfMapper.mapVulnerabilityToCSF(vulnerability);

      expect(mapping.function).toBe('RESPOND');
      expect(mapping.category).toContain('Incidents are contained');
      expect(mapping.impact).toBe(0.7);
    });

    it('should map Mitigated status to PROTECT function', () => {
      const vulnerability = {
        severity: 'Medium',
        status: 'Mitigated'
      };

      const mapping = NistCsfMapper.mapVulnerabilityToCSF(vulnerability);

      expect(mapping.function).toBe('PROTECT');
      expect(mapping.category).toContain('vulnerability management plan');
      expect(mapping.impact).toBe(0.4);
    });

    it('should map Resolved status to RECOVER function', () => {
      const vulnerability = {
        severity: 'Low',
        status: 'Resolved'
      };

      const mapping = NistCsfMapper.mapVulnerabilityToCSF(vulnerability);

      expect(mapping.function).toBe('RECOVER');
      expect(mapping.category).toContain('Recovery plan');
      expect(mapping.impact).toBe(0.1);
    });

    it('should default to IDENTIFY for unknown status', () => {
      const vulnerability = {
        severity: 'Critical',
        status: 'Unknown'
      };

      const mapping = NistCsfMapper.mapVulnerabilityToCSF(vulnerability);

      expect(mapping.function).toBe('IDENTIFY');
    });

    it('should handle missing severity', () => {
      const vulnerability = {
        status: 'Identified'
      };

      const mapping = NistCsfMapper.mapVulnerabilityToCSF(vulnerability);

      expect(mapping.impact).toBe(0);
    });
  });

  describe('getCsfProgress', () => {
    it('should calculate CSF progress for all functions', async () => {
      mockDb.get
        .mockImplementationOnce((query, callback) => {
          callback(null, { count: 5 }); // GOVERN policies
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { count: 10 }); // IDENTIFY vulnerabilities
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { rate: 75.0 }); // PROTECT mitigation rate
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { avg_hours: 24 }); // RESPOND avg time
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { rate: 80.0 }); // RECOVER recovery rate
        });

      const progress = await NistCsfMapper.getCsfProgress();

      expect(progress).toHaveProperty('GOVERN');
      expect(progress).toHaveProperty('IDENTIFY');
      expect(progress).toHaveProperty('PROTECT');
      expect(progress).toHaveProperty('DETECT');
      expect(progress).toHaveProperty('RESPOND');
      expect(progress).toHaveProperty('RECOVER');
      expect(progress.GOVERN.score).toBeGreaterThan(0);
      expect(progress.PROTECT.mitigation_rate).toBe(0.75);
      expect(progress.RESPOND.avg_response_time).toBe(24);
      expect(progress.RECOVER.recovery_rate).toBe(0.8);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.get.mockImplementation((query, callback) => {
        callback(new Error('DB error'), null);
      });

      const progress = await NistCsfMapper.getCsfProgress();

      expect(progress).toHaveProperty('GOVERN');
      expect(progress.GOVERN.score).toBe(0);
    });

    it('should set default high score when no data', async () => {
      mockDb.get
        .mockImplementationOnce((query, callback) => {
          callback(null, { count: 0 }); // GOVERN
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { count: 0 }); // IDENTIFY
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { rate: null }); // PROTECT (no vulnerabilities)
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { avg_hours: null }); // RESPOND
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { rate: null }); // RECOVER
        });

      const progress = await NistCsfMapper.getCsfProgress();

      expect(progress.PROTECT.score).toBe(100); // No vulnerabilities = perfect
      expect(progress.RESPOND.score).toBe(100); // No data = default high
      expect(progress.RECOVER.score).toBe(100);
    });

    it('should calculate RESPOND score based on response time', async () => {
      mockDb.get
        .mockImplementationOnce((query, callback) => {
          callback(null, { count: 0 }); // GOVERN
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { count: 0 }); // IDENTIFY
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { rate: 100 }); // PROTECT
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { avg_hours: 48 }); // RESPOND: 48 hours = 50 points
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { rate: 100 }); // RECOVER
        });

      const progress = await NistCsfMapper.getCsfProgress();

      expect(progress.RESPOND.score).toBeCloseTo(0, 0); // 48h = 0 points (max 0)
    });
  });

  describe('updateCsfProgress', () => {
    it('should update CSF progress for vulnerability', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => {
          callback(null, {
            id: 1,
            severity: 'Critical',
            status: 'Mitigated'
          });
        })
        .mockImplementation((query, callback) => {
          if (typeof callback === 'function') {
            callback(null, { count: 5, rate: 80 });
          }
        });

      mockDb.run.mockImplementation((query, params, callback) => {
        if (typeof callback === 'function') {
          callback(null);
        }
      });

      const result = await NistCsfMapper.updateCsfProgress(1);

      expect(result).toHaveProperty('vulnerability_id', 1);
      expect(result).toHaveProperty('csf_mapping');
      expect(result).toHaveProperty('csf_progress');
      expect(result.csf_mapping.function).toBe('PROTECT');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE vulnerabilities'),
        expect.arrayContaining(['PROTECT']),
        expect.any(Function)
      );
    });

    it('should reject when vulnerability not found', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      await expect(NistCsfMapper.updateCsfProgress(999)).rejects.toThrow('Vulnerability not found');
    });

    it('should handle database errors', async () => {
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(new Error('DB error'), null);
      });

      await expect(NistCsfMapper.updateCsfProgress(1)).rejects.toThrow('DB error');
    });

    it('should update compliance table with new scores', async () => {
      mockDb.get
        .mockImplementationOnce((query, params, callback) => {
          callback(null, {
            id: 1,
            severity: 'High',
            status: 'Resolved'
          });
        })
        .mockImplementation((query, callback) => {
          if (typeof callback === 'function') {
            callback(null, { count: 10, rate: 90 });
          }
        });

      mockDb.run.mockImplementation((query, params, callback) => {
        if (typeof callback === 'function') {
          callback(null);
        }
      });

      await NistCsfMapper.updateCsfProgress(1);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE compliance SET progress'),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });

  describe('generateComplianceReport', () => {
    it('should generate comprehensive compliance report', async () => {
      mockDb.get.mockImplementation((query, callback) => {
        callback(null, { count: 5, rate: 75, avg_hours: 24 });
      });

      mockDb.all.mockImplementation((query, callback) => {
        callback(null, [
          { function: 'IDENTIFY', severity: 'High', status: 'Identified', count: 3 },
          { function: 'PROTECT', severity: 'Medium', status: 'Mitigated', count: 5 }
        ]);
      });

      const report = await NistCsfMapper.generateComplianceReport();

      expect(report).toHaveProperty('timestamp');
      expect(report).toHaveProperty('overall_compliance_score');
      expect(report).toHaveProperty('functions');
      expect(report).toHaveProperty('vulnerability_breakdown');
      expect(report).toHaveProperty('recommendations');
      expect(report.overall_compliance_score).toBeGreaterThanOrEqual(0);
      expect(report.overall_compliance_score).toBeLessThanOrEqual(100);
    });

    it('should include recommendations for low scores', async () => {
      mockDb.get
        .mockImplementationOnce((query, callback) => {
          callback(null, { count: 1 }); // GOVERN: low score
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { count: 0 }); // IDENTIFY
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { rate: 30 }); // PROTECT: low
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { avg_hours: 72 }); // RESPOND: low
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { rate: 40 }); // RECOVER: low
        });

      mockDb.all.mockImplementation((query, callback) => {
        callback(null, []);
      });

      const report = await NistCsfMapper.generateComplianceReport();

      expect(report.recommendations.length).toBeGreaterThan(0);
      expect(report.recommendations[0]).toHaveProperty('function');
      expect(report.recommendations[0]).toHaveProperty('current_score');
      expect(report.recommendations[0]).toHaveProperty('recommendation');
      expect(report.recommendations[0]).toHaveProperty('priority');
    });

    it('should prioritize recommendations by severity', async () => {
      mockDb.get
        .mockImplementationOnce((query, callback) => {
          callback(null, { count: 0 }); // GOVERN: 0
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { count: 0 }); // IDENTIFY: 30
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { rate: 40 }); // PROTECT: 40
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { avg_hours: 100 }); // RESPOND: 0
        })
        .mockImplementationOnce((query, callback) => {
          callback(null, { rate: 65 }); // RECOVER: 65
        });

      mockDb.all.mockImplementation((query, callback) => {
        callback(null, []);
      });

      const report = await NistCsfMapper.generateComplianceReport();

      const highPriority = report.recommendations.filter((r) => r.priority === 'High');
      const mediumPriority = report.recommendations.filter((r) => r.priority === 'Medium');

      expect(highPriority.length).toBeGreaterThan(0);
      expect(mediumPriority.length).toBeGreaterThan(0);
    });

    it('should handle empty vulnerability breakdown', async () => {
      mockDb.get.mockImplementation((query, callback) => {
        callback(null, { count: 0, rate: 100, avg_hours: 0 });
      });

      mockDb.all.mockImplementation((query, callback) => {
        callback(null, null);
      });

      const report = await NistCsfMapper.generateComplianceReport();

      expect(report.vulnerability_breakdown).toEqual([]);
    });

    it('should handle database errors gracefully', async () => {
      mockDb.get.mockImplementation((query, callback) => {
        callback(null, { count: 5, rate: 75, avg_hours: 24 });
      });

      mockDb.all.mockImplementation((query, callback) => {
        callback(new Error('DB error'), null);
      });

      await expect(NistCsfMapper.generateComplianceReport()).rejects.toThrow('DB error');
    });
  });
});
