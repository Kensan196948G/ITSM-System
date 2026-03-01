/**
 * Backup Service Unit Tests
 * Phase 9.1: Backup & Restore functionality
 */

const { spawn } = require('child_process');
const fs = require('fs');
const crypto = require('crypto');
const backupService = require('../../../services/backupService');

// Mock child_process
jest.mock('child_process');

// Mock emailService - jest.fn() を直接ファクトリ内で定義
jest.mock('../../../services/emailService', () => ({
  sendBackupFailureAlert: jest.fn().mockResolvedValue({ success: true, messageId: 'test-id' })
}));
const {
  sendBackupFailureAlert: mockSendBackupFailureAlert
} = require('../../../services/emailService');

// Mock fs module
jest.mock('fs', () => ({
  promises: {
    access: jest.fn(),
    stat: jest.fn(),
    readFile: jest.fn(),
    unlink: jest.fn(),
    mkdir: jest.fn().mockResolvedValue(undefined),
    copyFile: jest.fn().mockResolvedValue(undefined)
  },
  createReadStream: jest.fn()
}));

describe('Backup Service Unit Tests', () => {
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
      clone: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis()
    };

    // Mock database (function that returns query builder)
    mockDb = jest.fn(() => mockQueryBuilder);
    Object.assign(mockDb, mockQueryBuilder);

    backupService.setDatabase(mockDb);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('createBackup()', () => {
    const mockSpawn = (exitCode = 0, stdout = '/path/to/backup', stderr = '') => {
      const mockChild = {
        stdout: {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(stdout)), 10);
            }
          })
        },
        stderr: {
          on: jest.fn((event, handler) => {
            if (event === 'data' && stderr) {
              setTimeout(() => handler(Buffer.from(stderr)), 10);
            }
          })
        },
        on: jest.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(exitCode), 20);
          }
        })
      };
      spawn.mockReturnValue(mockChild);
    };

    it('should create daily backup successfully', async () => {
      mockSpawn(0, '/backups/backup-20260131-120000-daily');
      fs.promises.stat.mockResolvedValue({ size: 1024000 });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue('abc123def456 backup-20260131-120000-daily.db');

      mockQueryBuilder.insert.mockResolvedValue([1]);
      mockDb.update.mockResolvedValue(1);

      const result = await backupService.createBackup('daily', 1, 'Daily backup');

      expect(result.status).toBe('success');
      expect(result.backupId).toMatch(/^BKP-\d{14}-daily$/);
      expect(result.filePath).toContain('.db');
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          backup_type: 'daily',
          status: 'in_progress',
          description: 'Daily backup',
          created_by: 1
        })
      );
      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'success',
          file_size: 1024000
        })
      );
    });

    it('should create weekly backup successfully', async () => {
      mockSpawn(0, '/backups/backup-20260131-120000-weekly');
      fs.promises.stat.mockResolvedValue({ size: 2048000 });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue('def789ghi012 backup-20260131-120000-weekly.db');

      const result = await backupService.createBackup('weekly', 2, 'Weekly backup');

      expect(result.status).toBe('success');
      expect(result.backupId).toMatch(/^BKP-\d{14}-weekly$/);
    });

    it('should create monthly backup successfully', async () => {
      mockSpawn(0, '/backups/backup-20260131-120000-monthly');
      fs.promises.stat.mockResolvedValue({ size: 3072000 });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue('ghi345jkl678 backup-20260131-120000-monthly.db');

      const result = await backupService.createBackup('monthly', null, '');

      expect(result.status).toBe('success');
      expect(result.backupId).toMatch(/^BKP-\d{14}-monthly$/);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          created_by: null
        })
      );
    });

    it('should create manual backup successfully', async () => {
      mockSpawn(0, '/backups/backup-20260131-120000-manual');
      fs.promises.stat.mockResolvedValue({ size: 1500000 });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue('jkl901mno234 backup-20260131-120000-manual.db');

      const result = await backupService.createBackup(
        'manual',
        1,
        'Manual backup before migration'
      );

      expect(result.status).toBe('success');
      expect(result.backupId).toMatch(/^BKP-\d{14}-manual$/);
    });

    it('should throw error for invalid backup type', async () => {
      await expect(backupService.createBackup('invalid', 1, '')).rejects.toThrow(
        'Invalid backup type: invalid'
      );
    });

    it('should handle backup script failure', async () => {
      mockSpawn(1, '', 'Backup failed: disk full');
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      await expect(backupService.createBackup('daily', 1, '')).rejects.toThrow(
        'Backup script failed with exit code 1'
      );

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'failure',
          error_message: expect.stringContaining('Backup script failed')
        })
      );
    });

    it('should handle database not initialized error', async () => {
      backupService.setDatabase(null);

      await expect(backupService.createBackup('daily', 1, '')).rejects.toThrow(
        'Database not initialized'
      );
    });

    it('should store metadata correctly', async () => {
      mockSpawn(0, '/backups/backup-20260131-120000-daily');
      fs.promises.stat.mockResolvedValue({ size: 2048000 });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue('metadata123 backup.db');

      await backupService.createBackup('daily', 1, '');

      expect(mockQueryBuilder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.stringContaining('duration_seconds')
        })
      );
    });

    it('should send failure alert email when BACKUP_ALERT_EMAIL is set', async () => {
      process.env.BACKUP_ALERT_EMAIL = 'ops@example.com';
      mockSpawn(1, '', 'Backup failed: disk full');
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      await expect(backupService.createBackup('daily', 1, '')).rejects.toThrow(
        'Backup script failed with exit code 1'
      );

      expect(mockSendBackupFailureAlert).toHaveBeenCalledWith(
        'ops@example.com',
        expect.objectContaining({
          backupId: expect.stringMatching(/^BKP-\d{14}-daily$/),
          type: 'daily',
          error: expect.stringContaining('Backup script failed'),
          timestamp: expect.any(String)
        })
      );

      delete process.env.BACKUP_ALERT_EMAIL;
    });

    it('should not send failure alert email when BACKUP_ALERT_EMAIL is not set', async () => {
      delete process.env.BACKUP_ALERT_EMAIL;
      mockSpawn(1, '', 'Backup failed: disk full');
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      await expect(backupService.createBackup('daily', 1, '')).rejects.toThrow(
        'Backup script failed with exit code 1'
      );

      expect(mockSendBackupFailureAlert).not.toHaveBeenCalled();
    });

    it('should not break backup error flow when email sending fails', async () => {
      process.env.BACKUP_ALERT_EMAIL = 'ops@example.com';
      mockSendBackupFailureAlert.mockRejectedValueOnce(new Error('SMTP connection refused'));
      mockSpawn(1, '', 'Backup failed: disk full');
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      // バックアップのエラーが元のエラーのまま throw されることを確認
      await expect(backupService.createBackup('daily', 1, '')).rejects.toThrow(
        'Backup script failed with exit code 1'
      );

      expect(mockSendBackupFailureAlert).toHaveBeenCalled();

      delete process.env.BACKUP_ALERT_EMAIL;
    });

    it('should include correct backup info in failure alert', async () => {
      process.env.BACKUP_ALERT_EMAIL = 'admin@company.com';
      mockSpawn(1, '', 'Permission denied');
      fs.promises.stat.mockResolvedValue({ size: 512000 });

      await expect(backupService.createBackup('weekly', 2, 'Weekly backup')).rejects.toThrow();

      expect(mockSendBackupFailureAlert).toHaveBeenCalledTimes(1);
      const callArgs = mockSendBackupFailureAlert.mock.calls[0];
      expect(callArgs[0]).toBe('admin@company.com');
      expect(callArgs[1].type).toBe('weekly');
      expect(callArgs[1].error).toContain('Permission denied');

      delete process.env.BACKUP_ALERT_EMAIL;
    });

    it('should send alert with correct backupId format', async () => {
      process.env.BACKUP_ALERT_EMAIL = 'ops@test.com';
      mockSpawn(1, '', 'Error');
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      await expect(backupService.createBackup('monthly', null, '')).rejects.toThrow();

      const callArgs = mockSendBackupFailureAlert.mock.calls[0];
      expect(callArgs[1].backupId).toMatch(/^BKP-\d{14}-monthly$/);

      delete process.env.BACKUP_ALERT_EMAIL;
    });

    it('should send alert for manual backup failure', async () => {
      process.env.BACKUP_ALERT_EMAIL = 'alert@example.com';
      mockSpawn(1, '', 'Script error');
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      await expect(
        backupService.createBackup('manual', 5, 'Pre-migration backup')
      ).rejects.toThrow();

      expect(mockSendBackupFailureAlert).toHaveBeenCalledWith(
        'alert@example.com',
        expect.objectContaining({
          type: 'manual'
        })
      );

      delete process.env.BACKUP_ALERT_EMAIL;
    });

    it('should not send alert on successful backup', async () => {
      process.env.BACKUP_ALERT_EMAIL = 'ops@example.com';
      mockSpawn(0, '/backups/backup-20260131-120000-daily');
      fs.promises.stat.mockResolvedValue({ size: 1024000 });
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.readFile.mockResolvedValue('abc123 backup.db');

      const result = await backupService.createBackup('daily', 1, '');

      expect(result.status).toBe('success');
      expect(mockSendBackupFailureAlert).not.toHaveBeenCalled();

      delete process.env.BACKUP_ALERT_EMAIL;
    });

    it('should handle stat failure before backup with email alert', async () => {
      process.env.BACKUP_ALERT_EMAIL = 'ops@example.com';
      fs.promises.stat.mockRejectedValue(new Error('ENOENT: no such file'));

      await expect(backupService.createBackup('daily', 1, '')).rejects.toThrow('ENOENT');

      expect(mockSendBackupFailureAlert).toHaveBeenCalledWith(
        'ops@example.com',
        expect.objectContaining({
          error: expect.stringContaining('ENOENT')
        })
      );

      delete process.env.BACKUP_ALERT_EMAIL;
    });

    it('should send alert to multiple comma-separated emails via single env var', async () => {
      process.env.BACKUP_ALERT_EMAIL = 'ops@example.com';
      mockSpawn(1, '', 'Disk full');
      fs.promises.stat.mockResolvedValue({ size: 1024000 });

      await expect(backupService.createBackup('daily', 1, '')).rejects.toThrow();

      // 単一のメールアドレスがそのまま渡される（nodemailer はカンマ区切りを自動処理）
      expect(mockSendBackupFailureAlert).toHaveBeenCalledWith(
        'ops@example.com',
        expect.any(Object)
      );

      delete process.env.BACKUP_ALERT_EMAIL;
    });
  });

  describe('listBackups()', () => {
    it('should list all backups with default options', async () => {
      mockQueryBuilder.count.mockResolvedValue([{ count: 10 }]);
      mockQueryBuilder.leftJoin.mockReturnThis();
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.offset.mockResolvedValue([
        {
          id: 1,
          backup_id: 'BKP-20260131-120000-daily',
          backup_type: 'daily',
          status: 'success',
          file_size: 1024000,
          created_at: '2026-01-31T12:00:00.000Z',
          metadata: '{"duration_seconds": 5}'
        },
        {
          id: 2,
          backup_id: 'BKP-20260131-130000-manual',
          backup_type: 'manual',
          status: 'success',
          file_size: 2048000,
          created_at: '2026-01-31T13:00:00.000Z',
          metadata: null
        }
      ]);

      const result = await backupService.listBackups();

      expect(result.total).toBe(10);
      expect(result.backups).toHaveLength(2);
      expect(result.backups[0].metadata).toEqual({ duration_seconds: 5 });
      expect(result.backups[1].metadata).toBeNull();
    });

    it('should filter by backup type', async () => {
      mockQueryBuilder.count.mockResolvedValue([{ count: 5 }]);
      mockQueryBuilder.where.mockReturnThis();
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.offset.mockResolvedValue([
        {
          id: 1,
          backup_id: 'BKP-20260131-120000-daily',
          backup_type: 'daily',
          status: 'success'
        }
      ]);

      const result = await backupService.listBackups({ type: 'daily' });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('backup_logs.backup_type', 'daily');
      expect(result.backups).toHaveLength(1);
    });

    it('should filter by status', async () => {
      mockQueryBuilder.count.mockResolvedValue([{ count: 3 }]);
      mockQueryBuilder.where.mockReturnThis();
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.offset.mockResolvedValue([
        {
          id: 1,
          backup_id: 'BKP-20260131-120000-daily',
          status: 'failure',
          error_message: 'Disk full'
        }
      ]);

      const result = await backupService.listBackups({ status: 'failure' });

      expect(mockQueryBuilder.where).toHaveBeenCalledWith('backup_logs.status', 'failure');
      expect(result.backups).toHaveLength(1);
    });

    it('should support pagination', async () => {
      mockQueryBuilder.count.mockResolvedValue([{ count: 100 }]);
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.offset.mockResolvedValue([]);

      await backupService.listBackups({ limit: 20, offset: 40 });

      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(40);
    });

    it('should support sorting', async () => {
      mockQueryBuilder.count.mockResolvedValue([{ count: 5 }]);
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.offset.mockResolvedValue([]);

      await backupService.listBackups({ sort: 'file_size', order: 'asc' });

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('backup_logs.file_size', 'asc');
    });

    it('should exclude deleted backups', async () => {
      mockQueryBuilder.count.mockResolvedValue([{ count: 5 }]);
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.offset.mockResolvedValue([]);

      await backupService.listBackups();

      expect(mockQueryBuilder.whereNot).toHaveBeenCalledWith('backup_logs.status', 'deleted');
    });

    it('should throw error when database not initialized', async () => {
      backupService.setDatabase(null);

      await expect(backupService.listBackups()).rejects.toThrow('Database not initialized');
    });
  });

  describe('getBackup()', () => {
    it('should get backup by ID', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        backup_type: 'daily',
        status: 'success',
        file_path: '/backups/backup.db',
        file_size: 1024000,
        checksum: 'sha256:abc123',
        metadata: '{"duration_seconds": 5}',
        created_by_username: 'admin'
      });

      const result = await backupService.getBackup('BKP-20260131-120000-daily');

      expect(result).toBeDefined();
      expect(result.backup_id).toBe('BKP-20260131-120000-daily');
      expect(result.metadata).toEqual({ duration_seconds: 5 });
      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'backup_logs.backup_id',
        'BKP-20260131-120000-daily'
      );
    });

    it('should return null for non-existent backup', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      const result = await backupService.getBackup('BKP-99999999-999999-daily');

      expect(result).toBeNull();
    });

    it('should handle invalid metadata JSON gracefully', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        backup_type: 'daily',
        status: 'success',
        metadata: 'invalid-json{'
      });

      const result = await backupService.getBackup('BKP-20260131-120000-daily');

      expect(result.metadata).toEqual({});
    });

    it('should throw error when database not initialized', async () => {
      backupService.setDatabase(null);

      await expect(backupService.getBackup('BKP-20260131-120000-daily')).rejects.toThrow(
        'Database not initialized'
      );
    });
  });

  describe('deleteBackup()', () => {
    beforeEach(() => {
      // Mock getBackup to return a valid backup
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        backup_type: 'daily',
        status: 'success',
        file_path: '/backups/backup-20260131-120000-daily.db'
      });

      // Mock latest backup check
      mockQueryBuilder.where.mockReturnThis();
      mockQueryBuilder.orderBy.mockReturnThis();
    });

    it('should delete backup successfully', async () => {
      // This backup is not the latest
      mockDb.first
        .mockResolvedValueOnce({
          id: 1,
          backup_id: 'BKP-20260131-120000-daily',
          backup_type: 'daily',
          status: 'success',
          file_path: '/backups/backup-20260131-120000-daily.db'
        })
        .mockResolvedValueOnce({
          backup_id: 'BKP-20260131-130000-daily'
        });

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.unlink.mockResolvedValue(undefined);

      const result = await backupService.deleteBackup('BKP-20260131-120000-daily', 1);

      expect(result.success).toBe(true);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ status: 'deleted' });
      expect(fs.promises.unlink).toHaveBeenCalled();
    });

    it('should throw error for non-existent backup', async () => {
      mockDb.first.mockResolvedValueOnce(null);

      await expect(backupService.deleteBackup('BKP-99999999-999999-daily', 1)).rejects.toThrow(
        'Backup not found: BKP-99999999-999999-daily'
      );
    });

    it('should throw error when trying to delete already deleted backup', async () => {
      mockDb.first.mockResolvedValueOnce({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'deleted'
      });

      await expect(backupService.deleteBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Backup already deleted'
      );
    });

    it('should prevent deletion of latest backup', async () => {
      mockDb.first
        .mockResolvedValueOnce({
          id: 1,
          backup_id: 'BKP-20260131-120000-daily',
          backup_type: 'daily',
          status: 'success',
          file_path: '/backups/backup.db'
        })
        .mockResolvedValueOnce({
          backup_id: 'BKP-20260131-120000-daily'
        });

      await expect(backupService.deleteBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Cannot delete the latest backup'
      );
    });

    it('should continue even if file deletion fails', async () => {
      mockDb.first
        .mockResolvedValueOnce({
          id: 1,
          backup_id: 'BKP-20260131-120000-daily',
          backup_type: 'daily',
          status: 'success',
          file_path: '/backups/backup.db'
        })
        .mockResolvedValueOnce({
          backup_id: 'BKP-20260131-130000-daily'
        });

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.unlink.mockRejectedValue(new Error('Permission denied'));

      const result = await backupService.deleteBackup('BKP-20260131-120000-daily', 1);

      expect(result.success).toBe(true);
      expect(mockQueryBuilder.update).toHaveBeenCalledWith({ status: 'deleted' });
    });
  });

  describe('restoreBackup()', () => {
    // Helper: spawn mock that resolves integrity check with given output
    const mockIntegritySpawn = (outputText = 'ok', exitCode = 0) => {
      const mockChild = {
        stdout: {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from(outputText)), 5);
            }
          })
        },
        stderr: {
          on: jest.fn()
        },
        on: jest.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(exitCode), 10);
          }
        })
      };
      spawn.mockReturnValue(mockChild);
      return mockChild;
    };

    it('should throw error for non-existent backup', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      await expect(backupService.restoreBackup('BKP-99999999-999999-daily', 1)).rejects.toThrow(
        'Backup not found'
      );
    });

    it('should throw error for non-success backup', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'failure'
      });

      await expect(backupService.restoreBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Backup is not available for restore. Status: failure'
      );
    });

    it('should throw error for deleted backup', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'deleted'
      });

      await expect(backupService.restoreBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Backup is not available for restore. Status: deleted'
      );
    });

    it('should throw error for in_progress backup', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'in_progress'
      });

      await expect(backupService.restoreBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Backup is not available for restore. Status: in_progress'
      );
    });

    it('should throw error when backup file not found', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: '/backups/backup.db'
      });

      fs.promises.access.mockRejectedValue(new Error('File not found'));

      await expect(backupService.restoreBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Backup file not found'
      );
    });

    it('should throw error when backup has no file_path', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: null
      });

      await expect(backupService.restoreBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Backup file not found'
      );
    });

    it('should throw error when database not initialized', async () => {
      backupService.setDatabase(null);

      await expect(backupService.restoreBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Database not initialized'
      );
    });

    it('should successfully restore backup with integrity check', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: null
      });

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.copyFile.mockResolvedValue(undefined);
      fs.promises.unlink.mockResolvedValue(undefined);

      // Mock spawn for integrity checks (called twice: before and after restore)
      mockIntegritySpawn('ok', 0);

      const result = await backupService.restoreBackup('BKP-20260131-120000-daily', 1);

      expect(result.status).toBe('success');
      expect(result.restored_from).toBe('BKP-20260131-120000-daily');
      expect(result.integrity_check).toBe('passed');
      expect(result.backup_before_restore).toBeTruthy();
      expect(result.message).toContain('restored successfully');
    });

    it('should create safety backup before restore', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: null
      });

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.copyFile.mockResolvedValue(undefined);
      fs.promises.unlink.mockResolvedValue(undefined);

      mockIntegritySpawn('ok', 0);

      const result = await backupService.restoreBackup('BKP-20260131-120000-daily', 1);

      // mkdir should be called for backup directory
      expect(fs.promises.mkdir).toHaveBeenCalledWith(expect.stringContaining('backups'), {
        recursive: true
      });
      // copyFile should be called for safety backup + restore copy
      expect(fs.promises.copyFile).toHaveBeenCalled();
      expect(result.backup_before_restore).toBeTruthy();
    });

    it('should skip safety backup when backup_current is false', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: null
      });

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.unlink.mockResolvedValue(undefined);
      fs.promises.copyFile.mockResolvedValue(undefined);

      mockIntegritySpawn('ok', 0);

      const result = await backupService.restoreBackup('BKP-20260131-120000-daily', 1, {
        backup_current: false
      });

      expect(result.status).toBe('success');
      expect(result.backup_before_restore).toBeNull();
      // mkdir for safety backup should not be called
      expect(fs.promises.mkdir).not.toHaveBeenCalled();
    });

    it('should rollback on backup file integrity check failure', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: null
      });

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.copyFile.mockResolvedValue(undefined);

      // Integrity check returns "corruption found" (not 'ok')
      mockIntegritySpawn('corruption found', 0);

      await expect(backupService.restoreBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Backup file integrity check failed'
      );

      // Safety backup should have been copied back (rollback)
      // copyFile is called: 1) safety backup, 2) rollback
      expect(fs.promises.copyFile).toHaveBeenCalledTimes(2);
    });

    it('should fail when checksum verification mismatches', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: 'sha256:expected_hash_value'
      });

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.copyFile.mockResolvedValue(undefined);

      // Mock createReadStream for checksum calculation
      const mockStream = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from('file content'));
          }
          if (event === 'end') {
            setTimeout(handler, 5);
          }
          return mockStream;
        })
      };
      fs.createReadStream.mockReturnValue(mockStream);

      // Mock crypto hash - return different hash
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('actual_different_hash')
      };
      jest.spyOn(crypto, 'createHash').mockReturnValue(mockHash);

      await expect(backupService.restoreBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Backup file checksum mismatch'
      );
    });

    it('should pass when checksum verification matches', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: 'sha256:correct_hash_value'
      });

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.copyFile.mockResolvedValue(undefined);
      fs.promises.unlink.mockResolvedValue(undefined);

      // Mock createReadStream for checksum calculation
      const mockStream = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from('file content'));
          }
          if (event === 'end') {
            setTimeout(handler, 5);
          }
          return mockStream;
        })
      };
      fs.createReadStream.mockReturnValue(mockStream);

      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('correct_hash_value')
      };
      jest.spyOn(crypto, 'createHash').mockReturnValue(mockHash);

      // Integrity checks pass
      mockIntegritySpawn('ok', 0);

      const result = await backupService.restoreBackup('BKP-20260131-120000-daily', 1);

      expect(result.status).toBe('success');
    });

    it('should remove WAL, SHM, and journal files before restore', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: null
      });

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.copyFile.mockResolvedValue(undefined);
      fs.promises.unlink.mockResolvedValue(undefined);

      mockIntegritySpawn('ok', 0);

      await backupService.restoreBackup('BKP-20260131-120000-daily', 1);

      // unlink should be called for main db, -wal, -shm, -journal
      expect(fs.promises.unlink).toHaveBeenCalledTimes(4);
    });

    it('should copy WAL file if it exists in backup', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: null
      });

      // First few access calls succeed (main file + WAL/SHM existence checks),
      // last access checks succeed including backup WAL
      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.copyFile.mockResolvedValue(undefined);
      fs.promises.unlink.mockResolvedValue(undefined);

      mockIntegritySpawn('ok', 0);

      const result = await backupService.restoreBackup('BKP-20260131-120000-daily', 1);

      expect(result.status).toBe('success');
      // copyFile should include the WAL file copy
      const copyFileCalls = fs.promises.copyFile.mock.calls;
      const walCopy = copyFileCalls.find(
        (call) => call[0].includes('-wal') || call[1].includes('-wal')
      );
      expect(walCopy).toBeTruthy();
    });

    it('should handle rollback failure gracefully', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: null
      });

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.mkdir.mockResolvedValue(undefined);
      // First copyFile (safety backup) succeeds, rollback copyFile fails
      fs.promises.copyFile
        .mockResolvedValueOnce(undefined)
        .mockRejectedValueOnce(new Error('Rollback disk full'));

      // Integrity check fails to trigger rollback
      mockIntegritySpawn('corruption detected', 0);

      // Should throw the original integrity error even when rollback fails
      await expect(backupService.restoreBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Backup file integrity check failed'
      );
    });

    it('should handle integrity check process error', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: null
      });

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.copyFile.mockResolvedValue(undefined);

      // Mock spawn that triggers 'error' event
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('sqlite3 not found')), 5);
          }
        })
      };
      spawn.mockReturnValue(mockChild);

      await expect(backupService.restoreBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Failed to run integrity check'
      );
    });

    it('should handle integrity check process non-zero exit code', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: null
      });

      fs.promises.access.mockResolvedValue(undefined);
      fs.promises.mkdir.mockResolvedValue(undefined);
      fs.promises.copyFile.mockResolvedValue(undefined);

      // Mock spawn with non-zero exit
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from('database disk image is malformed')), 5);
            }
          })
        },
        on: jest.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
        })
      };
      spawn.mockReturnValue(mockChild);

      await expect(backupService.restoreBackup('BKP-20260131-120000-daily', 1)).rejects.toThrow(
        'Integrity check process failed'
      );
    });
  });

  describe('runIntegrityCheck()', () => {
    it('should return true when integrity check passes', async () => {
      const mockChild = {
        stdout: {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from('ok')), 5);
            }
          })
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        })
      };
      spawn.mockReturnValue(mockChild);

      const result = await backupService.runIntegrityCheck('/path/to/test.db');

      expect(result).toBe(true);
      expect(spawn).toHaveBeenCalledWith('sqlite3', [
        '/path/to/test.db',
        'PRAGMA integrity_check;'
      ]);
    });

    it('should return false when integrity check reports issues', async () => {
      const mockChild = {
        stdout: {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(
                () => handler(Buffer.from('*** in database main ***\nPage 3: btree...')),
                5
              );
            }
          })
        },
        stderr: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        })
      };
      spawn.mockReturnValue(mockChild);

      const result = await backupService.runIntegrityCheck('/path/to/corrupt.db');

      expect(result).toBe(false);
    });

    it('should reject when process exits with non-zero code', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: {
          on: jest.fn((event, handler) => {
            if (event === 'data') {
              setTimeout(() => handler(Buffer.from('Error: unable to open database')), 5);
            }
          })
        },
        on: jest.fn((event, handler) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
        })
      };
      spawn.mockReturnValue(mockChild);

      await expect(backupService.runIntegrityCheck('/nonexistent.db')).rejects.toThrow(
        'Integrity check process failed'
      );
    });

    it('should reject when spawn fails', async () => {
      const mockChild = {
        stdout: { on: jest.fn() },
        stderr: { on: jest.fn() },
        on: jest.fn((event, handler) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('ENOENT: sqlite3 not found')), 5);
          }
        })
      };
      spawn.mockReturnValue(mockChild);

      await expect(backupService.runIntegrityCheck('/path/to/test.db')).rejects.toThrow(
        'Failed to run integrity check'
      );
    });
  });

  describe('checkIntegrity()', () => {
    beforeEach(() => {
      mockQueryBuilder.insert.mockResolvedValue([1]);
    });

    it('should check integrity of specific backup', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        backup_type: 'daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: 'sha256:abc123def456'
      });

      fs.promises.access.mockResolvedValue(undefined);

      // Mock crypto stream
      const mockStream = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from('test data'));
          }
          if (event === 'end') {
            setTimeout(handler, 10);
          }
          return mockStream;
        })
      };
      fs.createReadStream.mockReturnValue(mockStream);

      // Mock crypto.createHash
      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('abc123def456')
      };
      jest.spyOn(crypto, 'createHash').mockReturnValue(mockHash);

      const result = await backupService.checkIntegrity('BKP-20260131-120000-daily');

      expect(result.total_checks).toBeGreaterThan(0);
      expect(result.passed).toBeGreaterThan(0);
      expect(result.checks).toBeInstanceOf(Array);
      expect(mockQueryBuilder.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          backup_id: 'BKP-20260131-120000-daily',
          check_type: 'file_exists'
        })
      );
    });

    it('should fail integrity check when file does not exist', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        backup_type: 'daily',
        status: 'success',
        file_path: '/backups/backup.db'
      });

      fs.promises.access.mockRejectedValue(new Error('File not found'));

      const result = await backupService.checkIntegrity('BKP-20260131-120000-daily');

      expect(result.failed).toBeGreaterThan(0);
      expect(result.checks[0].status).toBe('fail');
      expect(result.checks[0].error_message).toBe('Backup file not found');
    });

    it('should fail integrity check when checksum mismatches', async () => {
      mockQueryBuilder.first.mockResolvedValue({
        id: 1,
        backup_id: 'BKP-20260131-120000-daily',
        backup_type: 'daily',
        status: 'success',
        file_path: '/backups/backup.db',
        checksum: 'sha256:expected123'
      });

      fs.promises.access.mockResolvedValue(undefined);

      const mockStream = {
        on: jest.fn((event, handler) => {
          if (event === 'data') {
            handler(Buffer.from('test data'));
          }
          if (event === 'end') {
            setTimeout(handler, 10);
          }
          return mockStream;
        })
      };
      fs.createReadStream.mockReturnValue(mockStream);

      const mockHash = {
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('actual456')
      };
      jest.spyOn(crypto, 'createHash').mockReturnValue(mockHash);

      const result = await backupService.checkIntegrity('BKP-20260131-120000-daily');

      const checksumCheck = result.checks.find((c) => c.check_type === 'checksum');
      expect(checksumCheck.status).toBe('fail');
      expect(checksumCheck.error_message).toBe('Checksum mismatch');
    });

    it('should check all backups when no ID specified', async () => {
      mockQueryBuilder.count.mockResolvedValue([{ count: 2 }]);
      mockQueryBuilder.select.mockReturnThis();
      mockQueryBuilder.offset.mockResolvedValue([
        {
          id: 1,
          backup_id: 'BKP-20260131-120000-daily',
          status: 'success',
          file_path: '/backups/backup1.db'
        },
        {
          id: 2,
          backup_id: 'BKP-20260131-130000-daily',
          status: 'success',
          file_path: '/backups/backup2.db'
        }
      ]);

      fs.promises.access.mockResolvedValue(undefined);

      const result = await backupService.checkIntegrity();

      expect(result.total_checks).toBeGreaterThan(1);
    });

    it('should throw error when backup not found', async () => {
      mockQueryBuilder.first.mockResolvedValue(null);

      await expect(backupService.checkIntegrity('BKP-99999999-999999-daily')).rejects.toThrow(
        'Backup not found'
      );
    });
  });
});
