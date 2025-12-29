/**
 * Unit Tests for Audit Log Middleware
 * Tests audit logging functionality for POST/PUT/DELETE requests
 */

const auditLog = require('../../../middleware/auditLog');
const { db } = require('../../../db');

// Mock database
jest.mock('../../../db', () => ({
  db: {
    run: jest.fn()
  }
}));

describe('Audit Log Middleware Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup mock request
    req = {
      method: 'POST',
      path: '/api/vulnerabilities',
      body: { title: 'Test Vulnerability', severity: 'High' },
      user: { id: 1, username: 'admin' },
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      get: jest.fn((header) => {
        if (header === 'user-agent') return 'Jest Test Agent';
        return null;
      })
    };

    // Setup mock response
    res = {
      send: jest.fn()
    };

    // Setup mock next function
    next = jest.fn();

    // Mock db.run to succeed
    db.run.mockImplementation((sql, params, callback) => {
      if (callback) callback(null);
    });
  });

  describe('POSTリクエストを監査ログに記録', () => {
    test('POST /api/vulnerabilities を監査ログに記録する', (done) => {
      req.method = 'POST';
      req.path = '/api/vulnerabilities';

      auditLog(req, res, next);

      // next() が呼ばれることを確認
      expect(next).toHaveBeenCalled();

      // レスポンスをトリガー
      const originalSend = res.send;
      res.send({ success: true });

      // 非同期処理を待つため、setImmediate を使用
      setImmediate(() => {
        // db.run が呼ばれたことを確認
        expect(db.run).toHaveBeenCalled();

        // 呼び出されたパラメータを確認
        const callArgs = db.run.mock.calls[0];
        const sql = callArgs[0];
        const params = callArgs[1];

        expect(sql).toContain('INSERT INTO audit_logs');
        expect(params[0]).toBe(1); // user_id
        expect(params[1]).toBe('create'); // action
        expect(params[2]).toBe('vulnerabilities'); // resource_type
        expect(params[5]).toContain('Test Vulnerability'); // new_values
        expect(params[6]).toBe('127.0.0.1'); // ip_address
        expect(params[7]).toBe('Jest Test Agent'); // user_agent

        done();
      });
    });

    test('PUT /api/users/:id を監査ログに記録する', (done) => {
      req.method = 'PUT';
      req.path = '/api/users/5';
      req.body = { role: 'admin' };

      auditLog(req, res, next);

      expect(next).toHaveBeenCalled();

      res.send({ success: true });

      setImmediate(() => {
        expect(db.run).toHaveBeenCalled();

        const callArgs = db.run.mock.calls[0];
        const params = callArgs[1];

        expect(params[1]).toBe('update'); // action
        expect(params[2]).toBe('users'); // resource_type
        expect(params[3]).toBe('5'); // resource_id

        done();
      });
    });

    test('DELETE /api/incidents/:id を監査ログに記録する', (done) => {
      req.method = 'DELETE';
      req.path = '/api/incidents/123';

      auditLog(req, res, next);

      expect(next).toHaveBeenCalled();

      res.send({ success: true });

      setImmediate(() => {
        expect(db.run).toHaveBeenCalled();

        const callArgs = db.run.mock.calls[0];
        const params = callArgs[1];

        expect(params[1]).toBe('delete'); // action
        expect(params[2]).toBe('incidents'); // resource_type
        expect(params[3]).toBe('123'); // resource_id

        done();
      });
    });
  });

  describe('セキュリティ関連アクションをマーク', () => {
    test('PUT /api/vulnerabilities/:id をセキュリティアクションとしてマーク', (done) => {
      req.method = 'PUT';
      req.path = '/api/vulnerabilities/CVE-2024-001';

      auditLog(req, res, next);

      res.send({ success: true });

      setImmediate(() => {
        const callArgs = db.run.mock.calls[0];
        const params = callArgs[1];

        expect(params[8]).toBe(1); // is_security_action = 1

        done();
      });
    });

    test('POST /api/incidents をセキュリティアクションとしてマーク', (done) => {
      req.method = 'POST';
      req.path = '/api/incidents';

      auditLog(req, res, next);

      res.send({ success: true });

      setImmediate(() => {
        const callArgs = db.run.mock.calls[0];
        const params = callArgs[1];

        expect(params[8]).toBe(1); // is_security_action = 1

        done();
      });
    });

    test('PUT /api/users/:id をセキュリティアクションとしてマーク', (done) => {
      req.method = 'PUT';
      req.path = '/api/users/5';

      auditLog(req, res, next);

      res.send({ success: true });

      setImmediate(() => {
        const callArgs = db.run.mock.calls[0];
        const params = callArgs[1];

        expect(params[8]).toBe(1); // is_security_action = 1

        done();
      });
    });

    test('POST /api/changes (is_security_change=1) をセキュリティアクションとしてマーク', (done) => {
      req.method = 'POST';
      req.path = '/api/changes';
      req.body = { title: 'Security Patch', is_security_change: 1 };

      auditLog(req, res, next);

      res.send({ success: true });

      setImmediate(() => {
        const callArgs = db.run.mock.calls[0];
        const params = callArgs[1];

        expect(params[8]).toBe(1); // is_security_action = 1

        done();
      });
    });

    test('POST /api/changes (is_security_change=0) を通常アクションとしてマーク', (done) => {
      req.method = 'POST';
      req.path = '/api/changes';
      req.body = { title: 'Normal Change', is_security_change: 0 };

      auditLog(req, res, next);

      res.send({ success: true });

      setImmediate(() => {
        const callArgs = db.run.mock.calls[0];
        const params = callArgs[1];

        expect(params[8]).toBe(0); // is_security_action = 0

        done();
      });
    });
  });

  describe('IPアドレスを正しく記録', () => {
    test('req.ip からIPアドレスを取得', (done) => {
      req.ip = '192.168.1.100';

      auditLog(req, res, next);

      res.send({ success: true });

      setImmediate(() => {
        const callArgs = db.run.mock.calls[0];
        const params = callArgs[1];

        expect(params[6]).toBe('192.168.1.100'); // ip_address

        done();
      });
    });

    test('req.connection.remoteAddress からIPアドレスを取得（req.ipがない場合）', (done) => {
      req.ip = null;
      req.connection.remoteAddress = '10.0.0.5';

      auditLog(req, res, next);

      res.send({ success: true });

      setImmediate(() => {
        const callArgs = db.run.mock.calls[0];
        const params = callArgs[1];

        expect(params[6]).toBe('10.0.0.5'); // ip_address

        done();
      });
    });

    test('IPアドレスが取得できない場合はnull', (done) => {
      req.ip = null;
      req.connection.remoteAddress = null;

      auditLog(req, res, next);

      res.send({ success: true });

      setImmediate(() => {
        const callArgs = db.run.mock.calls[0];
        const params = callArgs[1];

        expect(params[6]).toBe(null); // ip_address

        done();
      });
    });
  });

  describe('監査対象外パスは記録しない', () => {
    test('GETリクエストは記録しない', () => {
      req.method = 'GET';
      req.path = '/api/vulnerabilities';

      auditLog(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(db.run).not.toHaveBeenCalled();
    });

    test('/health/* パスは記録しない', () => {
      req.method = 'POST';
      req.path = '/health/check';

      auditLog(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(db.run).not.toHaveBeenCalled();
    });

    test('/metrics パスは記録しない', () => {
      req.method = 'POST';
      req.path = '/metrics';

      auditLog(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(db.run).not.toHaveBeenCalled();
    });

    test('/api-docs/* パスは記録しない', () => {
      req.method = 'POST';
      req.path = '/api-docs/swagger.json';

      auditLog(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(db.run).not.toHaveBeenCalled();
    });
  });

  describe('認証されていないリクエスト', () => {
    test('user がない場合、user_id は null', (done) => {
      req.user = null;

      auditLog(req, res, next);

      res.send({ success: true });

      setImmediate(() => {
        const callArgs = db.run.mock.calls[0];
        const params = callArgs[1];

        expect(params[0]).toBe(null); // user_id

        done();
      });
    });
  });

  describe('データベースエラーハンドリング', () => {
    test('データベースエラーが発生してもレスポンスは返される', (done) => {
      // db.run をエラーを返すようにモック
      db.run.mockImplementation((sql, params, callback) => {
        if (callback) callback(new Error('Database error'));
      });

      // console.error をモック
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      auditLog(req, res, next);

      res.send({ success: true });

      setImmediate(() => {
        // エラーがログ出力されることを確認
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          '[AuditLog] Failed to write audit log:',
          expect.any(Error)
        );

        consoleErrorSpy.mockRestore();
        done();
      });
    });
  });
});
