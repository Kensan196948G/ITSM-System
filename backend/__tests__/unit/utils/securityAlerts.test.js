/**
 * Unit Tests for Security Alerts Utility
 * Tests alert generation logic for various security events
 */

const { generateAlert } = require('../../../utils/securityAlerts');
const { db } = require('../../../db');
const logger = require('../../../utils/logger');

// Mock database
jest.mock('../../../db', () => ({
  db: {
    get: jest.fn(),
    all: jest.fn(),
    run: jest.fn()
  }
}));

// Mock Winston logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

describe('Security Alerts Utility Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('failed_loginアラートを生成', () => {
    test('15分以内に5回以上の失敗ログインでアラート生成', async () => {
      const context = {
        user: { id: 1, username: 'testuser' },
        action: 'failed_login',
        resource_type: 'user',
        ip_address: '192.168.1.100'
      };

      // db.get をモック（5回の失敗ログイン）
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { count: 5 });
      });

      // db.run をモック（アラート保存）
      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 123 }, null);
      });

      const alert = await generateAlert(context);

      expect(alert).not.toBeNull();
      expect(alert.alert_type).toBe('failed_login');
      expect(alert.severity).toBe('high');
      expect(alert.description).toContain('testuser');
      expect(alert.description).toContain('5 failed login attempts');
      expect(alert.affected_user_id).toBe(1);
      expect(alert.source_ip).toBe('192.168.1.100');
      expect(alert.is_acknowledged).toBe(false);
      expect(alert.id).toBe(123);
    });

    test('15分以内に5回未満の失敗ログインではアラート生成しない', async () => {
      const context = {
        user: { id: 1, username: 'testuser' },
        action: 'failed_login',
        resource_type: 'user',
        ip_address: '192.168.1.100'
      };

      // db.get をモック（4回の失敗ログイン）
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { count: 4 });
      });

      const alert = await generateAlert(context);

      expect(alert).toBeNull();
      expect(db.run).not.toHaveBeenCalled();
    });
  });

  describe('suspicious_activityアラートを生成', () => {
    test('30秒以内に異なるIPアドレスからのログインでアラート生成', async () => {
      const context = {
        user: { id: 1, username: 'testuser' },
        action: 'login',
        resource_type: 'user',
        ip_address: '10.0.0.2'
      };

      // db.all をモック（異なるIPアドレスからのログイン）
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, [
          { ip_address: '10.0.0.2', created_at: new Date().toISOString() },
          { ip_address: '192.168.1.1', created_at: new Date(Date.now() - 10000).toISOString() }
        ]);
      });

      // db.run をモック（アラート保存）
      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 124 }, null);
      });

      const alert = await generateAlert(context);

      expect(alert).not.toBeNull();
      expect(alert.alert_type).toBe('suspicious_activity');
      expect(alert.severity).toBe('high');
      expect(alert.description).toContain('different IP addresses');
      expect(alert.description).toContain('192.168.1.1');
      expect(alert.description).toContain('10.0.0.2');
      expect(alert.id).toBe(124);
    });

    test('同じIPアドレスからのログインではアラート生成しない', async () => {
      const context = {
        user: { id: 1, username: 'testuser' },
        action: 'login',
        resource_type: 'user',
        ip_address: '192.168.1.1'
      };

      // db.all をモック（同じIPアドレスからのログイン）
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, [
          { ip_address: '192.168.1.1', created_at: new Date().toISOString() },
          { ip_address: '192.168.1.1', created_at: new Date(Date.now() - 10000).toISOString() }
        ]);
      });

      const alert = await generateAlert(context);

      expect(alert).toBeNull();
      expect(db.run).not.toHaveBeenCalled();
    });
  });

  describe('privilege_escalationアラートを生成', () => {
    test('analyst から admin への権限昇格でアラート生成', async () => {
      const context = {
        user: { id: 2, username: 'manager_user' },
        action: 'update',
        resource_type: 'user',
        oldValues: { id: 5, role: 'analyst' },
        newValues: { id: 5, role: 'admin' }
      };

      // db.run をモック（アラート保存）
      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 125 }, null);
      });

      const alert = await generateAlert(context);

      expect(alert).not.toBeNull();
      expect(alert.alert_type).toBe('privilege_escalation');
      expect(alert.severity).toBe('critical');
      expect(alert.description).toContain('manager_user');
      expect(alert.description).toContain('analyst');
      expect(alert.description).toContain('admin');
      expect(alert.affected_user_id).toBe(5);
      expect(alert.affected_resource_type).toBe('user');
      expect(alert.id).toBe(125);
    });

    test('viewer から admin への権限昇格でアラート生成', async () => {
      const context = {
        user: { id: 1, username: 'admin' },
        action: 'update',
        resource_type: 'user',
        oldValues: { id: 10, role: 'viewer' },
        newValues: { id: 10, role: 'admin' }
      };

      // db.run をモック（アラート保存）
      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 126 }, null);
      });

      const alert = await generateAlert(context);

      expect(alert).not.toBeNull();
      expect(alert.alert_type).toBe('privilege_escalation');
      expect(alert.severity).toBe('critical');
      expect(alert.description).toContain('viewer');
      expect(alert.description).toContain('admin');
      expect(alert.id).toBe(126);
    });

    test('admin から admin への変更ではアラート生成しない', async () => {
      const context = {
        user: { id: 1, username: 'admin' },
        action: 'update',
        resource_type: 'user',
        oldValues: { id: 5, role: 'admin' },
        newValues: { id: 5, role: 'admin' }
      };

      const alert = await generateAlert(context);

      expect(alert).toBeNull();
      expect(db.run).not.toHaveBeenCalled();
    });

    test('analyst から manager への変更ではアラート生成しない', async () => {
      const context = {
        user: { id: 1, username: 'admin' },
        action: 'update',
        resource_type: 'user',
        oldValues: { id: 5, role: 'analyst' },
        newValues: { id: 5, role: 'manager' }
      };

      const alert = await generateAlert(context);

      expect(alert).toBeNull();
      expect(db.run).not.toHaveBeenCalled();
    });
  });

  describe('vulnerability_detectedアラートを生成', () => {
    test('Critical脆弱性でアラート生成', async () => {
      const context = {
        user: { id: 3, username: 'analyst' },
        action: 'create',
        resource_type: 'vulnerability',
        resource_data: {
          id: 1,
          vulnerability_id: 'CVE-2024-001',
          title: 'Remote Code Execution',
          severity: 'Critical'
        }
      };

      // db.run をモック（アラート保存）
      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 127 }, null);
      });

      const alert = await generateAlert(context);

      expect(alert).not.toBeNull();
      expect(alert.alert_type).toBe('vulnerability_detected');
      expect(alert.severity).toBe('critical');
      expect(alert.description).toContain('Critical severity vulnerability');
      expect(alert.description).toContain('Remote Code Execution');
      expect(alert.description).toContain('CVE-2024-001');
      expect(alert.affected_resource_type).toBe('vulnerability');
      expect(alert.affected_resource_id).toBe('CVE-2024-001');
      expect(alert.id).toBe(127);
    });

    test('High脆弱性でアラート生成', async () => {
      const context = {
        user: { id: 3, username: 'analyst' },
        action: 'create',
        resource_type: 'vulnerability',
        resource_data: {
          id: 2,
          vulnerability_id: 'CVE-2024-002',
          title: 'SQL Injection',
          severity: 'High'
        }
      };

      // db.run をモック（アラート保存）
      db.run.mockImplementation((sql, params, callback) => {
        callback.call({ lastID: 128 }, null);
      });

      const alert = await generateAlert(context);

      expect(alert).not.toBeNull();
      expect(alert.alert_type).toBe('vulnerability_detected');
      expect(alert.severity).toBe('high');
      expect(alert.description).toContain('High severity vulnerability');
      expect(alert.id).toBe(128);
    });

    test('Medium脆弱性ではアラート生成しない', async () => {
      const context = {
        user: { id: 3, username: 'analyst' },
        action: 'create',
        resource_type: 'vulnerability',
        resource_data: {
          id: 3,
          vulnerability_id: 'CVE-2024-003',
          title: 'Information Disclosure',
          severity: 'Medium'
        }
      };

      const alert = await generateAlert(context);

      expect(alert).toBeNull();
      expect(db.run).not.toHaveBeenCalled();
    });

    test('Low脆弱性ではアラート生成しない', async () => {
      const context = {
        user: { id: 3, username: 'analyst' },
        action: 'create',
        resource_type: 'vulnerability',
        resource_data: {
          id: 4,
          vulnerability_id: 'CVE-2024-004',
          title: 'Minor Issue',
          severity: 'Low'
        }
      };

      const alert = await generateAlert(context);

      expect(alert).toBeNull();
      expect(db.run).not.toHaveBeenCalled();
    });
  });

  describe('必須コンテキストバリデーション', () => {
    test('user がない場合はアラート生成しない', async () => {
      const context = {
        action: 'create',
        resource_type: 'vulnerability'
      };

      const alert = await generateAlert(context);

      expect(alert).toBeNull();
    });

    test('action がない場合はアラート生成しない', async () => {
      const context = {
        user: { id: 1, username: 'admin' },
        resource_type: 'vulnerability'
      };

      const alert = await generateAlert(context);

      expect(alert).toBeNull();
    });

    test('resource_type がない場合はアラート生成しない', async () => {
      const context = {
        user: { id: 1, username: 'admin' },
        action: 'create'
      };

      const alert = await generateAlert(context);

      expect(alert).toBeNull();
    });
  });

  describe('データベースエラーハンドリング', () => {
    test('データベースエラーが発生した場合はnullを返す', async () => {
      const context = {
        user: { id: 1, username: 'testuser' },
        action: 'failed_login',
        resource_type: 'user',
        ip_address: '192.168.1.100'
      };

      // db.get をエラーを返すようにモック
      db.get.mockImplementation((sql, params, callback) => {
        callback(new Error('Database error'));
      });

      const alert = await generateAlert(context);

      expect(alert).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });

    test('アラート保存中のエラーを処理', async () => {
      const context = {
        user: { id: 1, username: 'testuser' },
        action: 'failed_login',
        resource_type: 'user',
        ip_address: '192.168.1.100'
      };

      // db.get をモック（5回の失敗ログイン）
      db.get.mockImplementation((sql, params, callback) => {
        callback(null, { count: 5 });
      });

      // db.run をエラーを返すようにモック
      db.run.mockImplementation((sql, params, callback) => {
        callback(new Error('Save error'));
      });

      // エラーが発生してもnullを返すことを確認
      const result = await generateAlert(context);

      expect(result).toBeNull();
      expect(logger.error).toHaveBeenCalled();
    });
  });
});
