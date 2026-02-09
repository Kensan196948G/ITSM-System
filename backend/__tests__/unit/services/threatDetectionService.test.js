/**
 * Threat Detection Service Unit Tests
 */

const mockDb = {
  get: jest.fn(),
  all: jest.fn(),
  run: jest.fn()
};

const mockEmailService = {
  sendSecurityAlert: jest.fn().mockResolvedValue({ success: true })
};

const mockNotificationService = {
  notifyIncident: jest.fn().mockResolvedValue()
};

jest.mock('../../../db', () => ({
  db: mockDb
}));

jest.mock('../../../services/emailService', () => mockEmailService);
jest.mock('../../../services/notificationService', () => mockNotificationService);

describe('Threat Detection Service Unit Tests', () => {
  let threatDetectionService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    threatDetectionService = require('../../../services/threatDetectionService');
  });

  describe('monitorLoginFailure', () => {
    it('should detect brute force attack', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, Array(5).fill({ username: 'test', action: 'login_failed' }));
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const loginAttempt = {
        username: 'test',
        ip: '192.168.1.1',
        timestamp: new Date()
      };

      await threatDetectionService.monitorLoginFailure(loginAttempt);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_threats'),
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should not detect threat with few failures', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [{ username: 'test', action: 'login_failed' }]);
      });

      const loginAttempt = {
        username: 'test',
        ip: '192.168.1.1',
        timestamp: new Date()
      };

      await threatDetectionService.monitorLoginFailure(loginAttempt);

      expect(mockDb.run).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_threats'),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });

  describe('monitorSuspiciousAccess', () => {
    it('should detect suspicious activity with multiple IPs', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { ip_address: '192.168.1.1' },
          { ip_address: '192.168.1.2' },
          { ip_address: '192.168.1.3' }
        ]);
      });
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const accessInfo = {
        username: 'test',
        ip: '192.168.1.3',
        location: 'Tokyo'
      };

      await threatDetectionService.monitorSuspiciousAccess(accessInfo);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_threats'),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });

  describe('monitorPrivilegeEscalation', () => {
    it('should detect privilege escalation', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const privilegeChange = {
        username: 'test',
        oldRole: 'viewer',
        newRole: 'admin',
        changedBy: 'admin'
      };

      await threatDetectionService.monitorPrivilegeEscalation(privilegeChange);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_threats'),
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should not detect threat for role downgrade', async () => {
      const privilegeChange = {
        username: 'test',
        oldRole: 'admin',
        newRole: 'viewer',
        changedBy: 'admin'
      };

      await threatDetectionService.monitorPrivilegeEscalation(privilegeChange);

      expect(mockDb.run).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_threats'),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });

  describe('monitorVulnerabilityExploitation', () => {
    it('should detect critical vulnerability exploitation', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const vulnerabilityInfo = {
        vulnerabilityId: 'CVE-2024-0001',
        severity: 'Critical',
        affectedAsset: 'ASSET-001'
      };

      await threatDetectionService.monitorVulnerabilityExploitation(vulnerabilityInfo);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_threats'),
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should not detect non-critical vulnerabilities', async () => {
      const vulnerabilityInfo = {
        vulnerabilityId: 'CVE-2024-0002',
        severity: 'Low',
        affectedAsset: 'ASSET-002'
      };

      await threatDetectionService.monitorVulnerabilityExploitation(vulnerabilityInfo);

      expect(mockDb.run).not.toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_threats'),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });

  describe('detectThreat', () => {
    beforeEach(() => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });
    });

    it('should save threat and send alerts', async () => {
      const threatInfo = {
        type: 'bruteForce',
        username: 'test',
        ip: '192.168.1.1',
        details: { failureCount: 5 }
      };

      const threat = await threatDetectionService.detectThreat(threatInfo);

      expect(threat.id).toContain('THREAT-');
      expect(threat.type).toBe('bruteForce');
      expect(threat.severity).toBe('High');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO security_threats'),
        expect.any(Array),
        expect.any(Function)
      );
      expect(mockEmailService.sendSecurityAlert).toHaveBeenCalled();
      expect(mockNotificationService.notifyIncident).toHaveBeenCalled();
    });
  });

  describe('executeAutomatedResponse', () => {
    it('should lock account for brute force attack', async () => {
      mockDb.run
        .mockImplementationOnce((query, params, callback) => {
          callback(null); // lockAccount
        })
        .mockImplementationOnce((query, params, callback) => {
          callback(null); // saveResponse
        });

      const threat = {
        id: 'THREAT-001',
        type: 'bruteForce',
        username: 'test'
      };

      const action = await threatDetectionService.executeAutomatedResponse(threat);

      expect(action).toBe('Account temporarily locked');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET locked_until'),
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should require additional auth for suspicious activity', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const threat = {
        id: 'THREAT-002',
        type: 'suspiciousActivity',
        username: 'test'
      };

      const action = await threatDetectionService.executeAutomatedResponse(threat);

      expect(action).toBe('Additional authentication required');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET require_2fa'),
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should block privilege escalation', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const threat = {
        id: 'THREAT-003',
        type: 'privilegeEscalation',
        username: 'test'
      };

      const action = await threatDetectionService.executeAutomatedResponse(threat);

      expect(action).toBe('Privilege escalation blocked');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET privilege_change_blocked_until'),
        expect.any(Array),
        expect.any(Function)
      );
    });

    it('should isolate asset for vulnerability exploitation', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      const threat = {
        id: 'THREAT-004',
        type: 'vulnerabilityExploitation',
        details: { affectedAsset: 'ASSET-001' }
      };

      const action = await threatDetectionService.executeAutomatedResponse(threat);

      expect(action).toBe('Asset isolated for investigation');
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE assets SET status = "Isolated"'),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });

  describe('lockAccount', () => {
    it('should lock user account for specified minutes', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      await threatDetectionService.lockAccount('test', 30);

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET locked_until'),
        expect.arrayContaining([expect.any(String), 'test']),
        expect.any(Function)
      );
    });
  });

  describe('requireAdditionalAuth', () => {
    it('should enable 2FA for user', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      await threatDetectionService.requireAdditionalAuth('test');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET require_2fa = 1'),
        ['test'],
        expect.any(Function)
      );
    });
  });

  describe('blockPrivilegeChange', () => {
    it('should block privilege changes for user', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      await threatDetectionService.blockPrivilegeChange('test');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE users SET privilege_change_blocked_until'),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });

  describe('isolateAsset', () => {
    it('should isolate asset', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(null);
      });

      await threatDetectionService.isolateAsset('ASSET-001');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE assets SET status = "Isolated"'),
        ['ASSET-001'],
        expect.any(Function)
      );
    });
  });

  describe('getRecentFailures', () => {
    it('should return recent login failures', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { username: 'test', action: 'login_failed', timestamp: '2024-01-01' },
          { username: 'test', action: 'login_failed', timestamp: '2024-01-02' }
        ]);
      });

      const failures = await threatDetectionService.getRecentFailures('test', 300000);

      expect(failures).toHaveLength(2);
    });

    it('should return empty array when no failures', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const failures = await threatDetectionService.getRecentFailures('test', 300000);

      expect(failures).toEqual([]);
    });
  });

  describe('getRecentAccesses', () => {
    it('should return recent successful logins', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { ip_address: '192.168.1.1', timestamp: '2024-01-01' },
          { ip_address: '192.168.1.2', timestamp: '2024-01-02' }
        ]);
      });

      const accesses = await threatDetectionService.getRecentAccesses('test', 600000);

      expect(accesses).toHaveLength(2);
    });
  });

  describe('getActiveThreats', () => {
    it('should return active threats', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { threat_id: 'T1', status: 'Active' },
          { threat_id: 'T2', status: 'Active' }
        ]);
      });

      const threats = await threatDetectionService.getActiveThreats();

      expect(threats).toHaveLength(2);
    });

    it('should return empty array when no active threats', async () => {
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const threats = await threatDetectionService.getActiveThreats();

      expect(threats).toEqual([]);
    });
  });

  describe('resolveThreat', () => {
    it('should resolve threat', async () => {
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      const result = await threatDetectionService.resolveThreat('THREAT-001');

      expect(result).toBe(1);
      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE security_threats SET status = "Resolved"'),
        expect.any(Array),
        expect.any(Function)
      );
    });
  });
});
