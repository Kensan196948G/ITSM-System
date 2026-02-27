/**
 * Export Service Tests
 * データエクスポートサービスのユニットテスト
 */

jest.mock('../../../db', () => ({
  db: {
    all: jest.fn()
  },
  initDb: jest.fn()
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

const {
  exportEntityData,
  isValidEntity,
  getExportableEntities,
  excludeSensitiveData,
  EXPORTABLE_ENTITIES
} = require('../../../services/exportService');

const { db } = require('../../../db');

describe('Export Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isValidEntity', () => {
    it('should return true for valid entity "incidents"', () => {
      expect(isValidEntity('incidents')).toBe(true);
    });

    it('should return true for valid entity "vulnerabilities"', () => {
      expect(isValidEntity('vulnerabilities')).toBe(true);
    });

    it('should return true for valid entity "audit_logs"', () => {
      expect(isValidEntity('audit_logs')).toBe(true);
    });

    it('should return true for valid entity "changes"', () => {
      expect(isValidEntity('changes')).toBe(true);
    });

    it('should return true for valid entity "assets"', () => {
      expect(isValidEntity('assets')).toBe(true);
    });

    it('should return true for valid entity "sla_agreements"', () => {
      expect(isValidEntity('sla_agreements')).toBe(true);
    });

    it('should return false for invalid entity', () => {
      expect(isValidEntity('nonexistent')).toBe(false);
    });

    it('should return false for empty string', () => {
      expect(isValidEntity('')).toBe(false);
    });
  });

  describe('getExportableEntities', () => {
    it('should return array of entity names', () => {
      const entities = getExportableEntities();
      expect(Array.isArray(entities)).toBe(true);
      expect(entities.length).toBeGreaterThan(0);
    });

    it('should include all expected entities', () => {
      const entities = getExportableEntities();
      expect(entities).toContain('incidents');
      expect(entities).toContain('vulnerabilities');
      expect(entities).toContain('audit_logs');
      expect(entities).toContain('changes');
      expect(entities).toContain('assets');
      expect(entities).toContain('problems');
      expect(entities).toContain('releases');
      expect(entities).toContain('service_requests');
      expect(entities).toContain('sla_agreements');
    });
  });

  describe('exportEntityData', () => {
    it('should reject with error for invalid entity', async () => {
      await expect(exportEntityData('invalid_entity')).rejects.toThrow(
        'Invalid entity: invalid_entity'
      );
    });

    it('should fetch data without filters', async () => {
      const mockRows = [
        { id: 1, title: 'Test Incident', status: 'open' },
        { id: 2, title: 'Test Incident 2', status: 'closed' }
      ];

      db.all.mockImplementation((sql, params, callback) => {
        callback(null, mockRows);
      });

      const result = await exportEntityData('incidents');
      expect(result).toEqual(mockRows);
      expect(db.all).toHaveBeenCalled();
    });

    it('should apply from_date filter', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      await exportEntityData('incidents', { from_date: '2026-01-01' });
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).toContain('WHERE');
      expect(sql).toContain('created_at >= ?');
      expect(params).toContain('2026-01-01');
    });

    it('should apply to_date filter', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      await exportEntityData('incidents', { to_date: '2026-12-31' });
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).toContain('created_at <= ?');
      expect(params).toContain('2026-12-31');
    });

    it('should apply both date filters', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      await exportEntityData('incidents', {
        from_date: '2026-01-01',
        to_date: '2026-12-31'
      });
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).toContain('created_at >= ?');
      expect(sql).toContain('created_at <= ?');
      expect(params).toEqual(['2026-01-01', '2026-12-31']);
    });

    it('should apply status filter when column exists', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      await exportEntityData('incidents', { status: 'open' });
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).toContain('status = ?');
      expect(params).toContain('open');
    });

    it('should apply priority filter when column exists', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      await exportEntityData('incidents', { priority: 'High' });
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).toContain('priority = ?');
      expect(params).toContain('High');
    });

    it('should apply severity filter when column exists', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      await exportEntityData('vulnerabilities', { severity: 'Critical' });
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).toContain('severity = ?');
      expect(params).toContain('Critical');
    });

    it('should apply user_id filter when column exists', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      await exportEntityData('audit_logs', { user_id: 1 });
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).toContain('user_id = ?');
      expect(params).toContain(1);
    });

    it('should not apply status filter when column does not exist', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      // user_activity does not have a 'status' column in EXPORTABLE_ENTITIES
      await exportEntityData('user_activity', { status: 'active' });
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).not.toContain('status = ?');
    });

    it('should reject on database error', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(new Error('DB error'));
      });

      await expect(exportEntityData('incidents')).rejects.toThrow('DB error');
    });

    it('should apply multiple filters together', async () => {
      db.all.mockImplementation((sql, params, callback) => {
        callback(null, []);
      });

      await exportEntityData('incidents', {
        from_date: '2026-01-01',
        status: 'open',
        priority: 'High'
      });
      const [sql, params] = db.all.mock.calls[0];
      expect(sql).toContain('created_at >= ?');
      expect(sql).toContain('status = ?');
      expect(sql).toContain('priority = ?');
      expect(params.length).toBe(3);
    });
  });

  describe('excludeSensitiveData', () => {
    it('should return data as-is when no sensitive columns specified', () => {
      const data = [{ id: 1, name: 'test' }];
      expect(excludeSensitiveData(data, [])).toEqual(data);
    });

    it('should remove sensitive columns from data', () => {
      const data = [
        { id: 1, name: 'test', password: 'secret', token: 'abc123' },
        { id: 2, name: 'test2', password: 'secret2', token: 'def456' }
      ];

      const result = excludeSensitiveData(data, ['password', 'token']);
      expect(result[0]).not.toHaveProperty('password');
      expect(result[0]).not.toHaveProperty('token');
      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('name');
      expect(result[1]).not.toHaveProperty('password');
    });

    it('should not modify original data', () => {
      const data = [{ id: 1, password: 'secret' }];
      excludeSensitiveData(data, ['password']);
      expect(data[0]).toHaveProperty('password');
    });
  });

  describe('EXPORTABLE_ENTITIES', () => {
    it('should define dateColumn for each entity', () => {
      Object.values(EXPORTABLE_ENTITIES).forEach((entity) => {
        expect(entity).toHaveProperty('dateColumn');
      });
    });

    it('should define orderBy for each entity', () => {
      Object.values(EXPORTABLE_ENTITIES).forEach((entity) => {
        expect(entity).toHaveProperty('orderBy');
      });
    });

    it('should define columns as arrays', () => {
      Object.values(EXPORTABLE_ENTITIES).forEach((entity) => {
        expect(Array.isArray(entity.columns)).toBe(true);
        expect(entity.columns.length).toBeGreaterThan(0);
      });
    });

    it('audit_logs should have sensitiveColumns defined', () => {
      expect(EXPORTABLE_ENTITIES.audit_logs.sensitiveColumns).toBeDefined();
      expect(EXPORTABLE_ENTITIES.audit_logs.sensitiveColumns).toContain('old_values');
      expect(EXPORTABLE_ENTITIES.audit_logs.sensitiveColumns).toContain('new_values');
    });
  });
});
