/**
 * Database Health Service Unit Tests
 * Task #5: SQLite整合性チェック
 */

// Mock backupService.runIntegrityCheck
jest.mock('../../../services/backupService', () => ({
  runIntegrityCheck: jest.fn()
}));
const { runIntegrityCheck } = require('../../../services/backupService');

// Mock emailService.sendEmail
jest.mock('../../../services/emailService', () => ({
  sendEmail: jest.fn()
}));
const { sendEmail } = require('../../../services/emailService');

// Mock logger
jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn()
}));
const logger = require('../../../utils/logger');

const { checkDatabaseIntegrity } = require('../../../services/dbHealthService');

describe('dbHealthService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('checkDatabaseIntegrity', () => {
    it('should return ok status when integrity check passes', async () => {
      runIntegrityCheck.mockResolvedValue(true);

      const result = await checkDatabaseIntegrity();

      expect(result.status).toBe('ok');
      expect(result.details).toBe('Database integrity verified');
      expect(result.timestamp).toBeDefined();
      expect(logger.info).toHaveBeenCalledWith('[DB Health] Integrity check passed');
    });

    it('should return failed status when integrity check fails', async () => {
      runIntegrityCheck.mockResolvedValue(false);

      const result = await checkDatabaseIntegrity();

      expect(result.status).toBe('failed');
      expect(result.details).toBe('Integrity check failed');
      expect(result.timestamp).toBeDefined();
      expect(logger.error).toHaveBeenCalledWith('[DB Health] Integrity check failed');
    });

    it('should return error status when runIntegrityCheck throws', async () => {
      runIntegrityCheck.mockRejectedValue(new Error('sqlite3 not found'));

      const result = await checkDatabaseIntegrity();

      expect(result.status).toBe('error');
      expect(result.details).toBe('sqlite3 not found');
      expect(result.timestamp).toBeDefined();
    });

    it('should send alert email when check fails and DB_HEALTH_ALERT_EMAIL is set', async () => {
      runIntegrityCheck.mockResolvedValue(false);
      sendEmail.mockResolvedValue({ success: true });
      process.env.DB_HEALTH_ALERT_EMAIL = 'admin@test.com';

      await checkDatabaseIntegrity();

      expect(sendEmail).toHaveBeenCalledTimes(1);
      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: 'admin@test.com',
          subject: expect.stringContaining('データベース整合性チェック失敗')
        })
      );
    });

    it('should not send alert email when check fails but DB_HEALTH_ALERT_EMAIL is not set', async () => {
      runIntegrityCheck.mockResolvedValue(false);
      delete process.env.DB_HEALTH_ALERT_EMAIL;

      await checkDatabaseIntegrity();

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should not send alert email when check passes', async () => {
      runIntegrityCheck.mockResolvedValue(true);
      process.env.DB_HEALTH_ALERT_EMAIL = 'admin@test.com';

      await checkDatabaseIntegrity();

      expect(sendEmail).not.toHaveBeenCalled();
    });

    it('should handle email sending failure gracefully', async () => {
      runIntegrityCheck.mockResolvedValue(false);
      sendEmail.mockRejectedValue(new Error('SMTP connection failed'));
      process.env.DB_HEALTH_ALERT_EMAIL = 'admin@test.com';

      const result = await checkDatabaseIntegrity();

      expect(result.status).toBe('failed');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send alert email')
      );
    });

    it('should use DATABASE_PATH env var when available', async () => {
      runIntegrityCheck.mockResolvedValue(true);
      process.env.DATABASE_PATH = '/custom/path/test.db';

      await checkDatabaseIntegrity();

      expect(runIntegrityCheck).toHaveBeenCalledWith('/custom/path/test.db');
    });

    it('should use default path when DATABASE_PATH is not set', async () => {
      runIntegrityCheck.mockResolvedValue(true);
      delete process.env.DATABASE_PATH;

      await checkDatabaseIntegrity();

      expect(runIntegrityCheck).toHaveBeenCalledWith(expect.stringContaining('itsm_nexus.db'));
    });

    it('should include db path in alert email text when check fails', async () => {
      runIntegrityCheck.mockResolvedValue(false);
      sendEmail.mockResolvedValue({ success: true });
      process.env.DB_HEALTH_ALERT_EMAIL = 'admin@test.com';
      process.env.DATABASE_PATH = '/data/production.db';

      await checkDatabaseIntegrity();

      expect(sendEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          text: expect.stringContaining('/data/production.db')
        })
      );
    });
  });
});
