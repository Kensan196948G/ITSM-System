/**
 * MicrosoftGraphService Unit Tests
 *
 * このサービスは非対話型認証のため意図的に無効化されたスタブ実装です。
 * すべてのメソッドが固定値を返すことを検証します。
 */

// logger をモック（外部依存を排除）
jest.mock('../../../utils/logger', () => ({
  warn: jest.fn(),
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
}));

const logger = require('../../../utils/logger');
const {
  MicrosoftGraphService,
  microsoftGraphService
} = require('../../../services/microsoftGraphService');

// ============================================================
// テストスイート
// ============================================================

describe('MicrosoftGraphService', () => {
  let service;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new MicrosoftGraphService();
  });

  // ──────────────────────────────────────────────────────────
  // constructor
  // ──────────────────────────────────────────────────────────
  describe('constructor', () => {
    it('初期設定がすべて null であること', () => {
      expect(service.config).toEqual({
        tenantId: null,
        clientId: null,
        clientSecret: null,
        graphEndpoint: null
      });
    });

    it('accessToken が null で初期化されること', () => {
      expect(service.accessToken).toBeNull();
    });

    it('tokenExpiry が null で初期化されること', () => {
      expect(service.tokenExpiry).toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────
  // isConfigured()
  // ──────────────────────────────────────────────────────────
  describe('isConfigured()', () => {
    it('常に false を返すこと', () => {
      expect(service.isConfigured()).toBe(false);
    });

    it('複数回呼び出しても常に false を返すこと', () => {
      expect(service.isConfigured()).toBe(false);
      expect(service.isConfigured()).toBe(false);
      expect(service.isConfigured()).toBe(false);
    });

    it('logger を呼び出さないこと', () => {
      service.isConfigured();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────
  // getAccessToken()
  // ──────────────────────────────────────────────────────────
  describe('getAccessToken()', () => {
    it('エラーをスローすること', async () => {
      await expect(service.getAccessToken()).rejects.toThrow(
        'Microsoft Graph API は無効化されています。非対話型認証を使用してください。'
      );
    });

    it('スローされるのは Error インスタンスであること', async () => {
      await expect(service.getAccessToken()).rejects.toBeInstanceOf(Error);
    });

    it('複数回呼び出してもすべてエラーをスローすること', async () => {
      await expect(service.getAccessToken()).rejects.toThrow();
      await expect(service.getAccessToken()).rejects.toThrow();
    });
  });

  // ──────────────────────────────────────────────────────────
  // getUsers()
  // ──────────────────────────────────────────────────────────
  describe('getUsers()', () => {
    it('空配列を返すこと', async () => {
      const result = await service.getUsers();
      expect(result).toEqual([]);
    });

    it('返り値が Array インスタンスであること', async () => {
      const result = await service.getUsers();
      expect(Array.isArray(result)).toBe(true);
    });

    it('logger.warn を呼び出すこと', async () => {
      await service.getUsers();
      expect(logger.warn).toHaveBeenCalledWith(
        '[MicrosoftGraphService] 無効化されています。空の配列を返します。'
      );
    });

    it('複数回呼び出すたびに logger.warn が呼ばれること', async () => {
      await service.getUsers();
      await service.getUsers();
      expect(logger.warn).toHaveBeenCalledTimes(2);
    });
  });

  // ──────────────────────────────────────────────────────────
  // getUserById()
  // ──────────────────────────────────────────────────────────
  describe('getUserById()', () => {
    it('null を返すこと', async () => {
      const result = await service.getUserById('user-123');
      expect(result).toBeNull();
    });

    it('logger.warn を userId 付きで呼び出すこと', async () => {
      await service.getUserById('user-abc');
      expect(logger.warn).toHaveBeenCalledWith(
        '[MicrosoftGraphService] 無効化されています。userId=user-abc'
      );
    });

    it('異なる userId でも常に null を返すこと', async () => {
      expect(await service.getUserById('user-1')).toBeNull();
      expect(await service.getUserById('user-2')).toBeNull();
      expect(await service.getUserById('')).toBeNull();
    });

    it('undefined を渡した場合も null を返すこと', async () => {
      const result = await service.getUserById(undefined);
      expect(result).toBeNull();
    });

    it('userId が logger メッセージに含まれること', async () => {
      const userId = 'test-user-xyz';
      await service.getUserById(userId);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(userId));
    });
  });

  // ──────────────────────────────────────────────────────────
  // syncUsersToDatabase()
  // ──────────────────────────────────────────────────────────
  describe('syncUsersToDatabase()', () => {
    it('正しい同期スキップ結果オブジェクトを返すこと', async () => {
      const result = await service.syncUsersToDatabase();
      expect(result).toEqual({
        success: true,
        synced: 0,
        skipped: true,
        message: 'Microsoft Graph API は無効化されています'
      });
    });

    it('success が true であること', async () => {
      const result = await service.syncUsersToDatabase();
      expect(result.success).toBe(true);
    });

    it('synced が 0 であること', async () => {
      const result = await service.syncUsersToDatabase();
      expect(result.synced).toBe(0);
    });

    it('skipped が true であること', async () => {
      const result = await service.syncUsersToDatabase();
      expect(result.skipped).toBe(true);
    });

    it('logger.warn を呼び出すこと', async () => {
      await service.syncUsersToDatabase();
      expect(logger.warn).toHaveBeenCalledWith(
        '[MicrosoftGraphService] 無効化されています。同期をスキップします。'
      );
    });

    it('呼び出しごとに同一の結果オブジェクトを返すこと（冪等性）', async () => {
      const result1 = await service.syncUsersToDatabase();
      const result2 = await service.syncUsersToDatabase();
      expect(result1).toEqual(result2);
    });
  });

  // ──────────────────────────────────────────────────────────
  // getGroups()
  // ──────────────────────────────────────────────────────────
  describe('getGroups()', () => {
    it('空配列を返すこと', async () => {
      const result = await service.getGroups();
      expect(result).toEqual([]);
    });

    it('返り値が Array インスタンスであること', async () => {
      const result = await service.getGroups();
      expect(Array.isArray(result)).toBe(true);
    });

    it('logger.warn を呼び出すこと', async () => {
      await service.getGroups();
      expect(logger.warn).toHaveBeenCalledWith(
        '[MicrosoftGraphService] 無効化されています。空の配列を返します。'
      );
    });
  });

  // ──────────────────────────────────────────────────────────
  // getGroupMembers()
  // ──────────────────────────────────────────────────────────
  describe('getGroupMembers()', () => {
    it('空配列を返すこと', async () => {
      const result = await service.getGroupMembers('group-123');
      expect(result).toEqual([]);
    });

    it('返り値が Array インスタンスであること', async () => {
      const result = await service.getGroupMembers('group-abc');
      expect(Array.isArray(result)).toBe(true);
    });

    it('logger.warn を groupId 付きで呼び出すこと', async () => {
      await service.getGroupMembers('group-xyz');
      expect(logger.warn).toHaveBeenCalledWith(
        '[MicrosoftGraphService] 無効化されています。groupId=group-xyz'
      );
    });

    it('異なる groupId でも常に空配列を返すこと', async () => {
      expect(await service.getGroupMembers('g-1')).toEqual([]);
      expect(await service.getGroupMembers('g-2')).toEqual([]);
      expect(await service.getGroupMembers('')).toEqual([]);
    });

    it('groupId が logger メッセージに含まれること', async () => {
      const groupId = 'test-group-xyz';
      await service.getGroupMembers(groupId);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(groupId));
    });
  });

  // ──────────────────────────────────────────────────────────
  // シングルトンインスタンス
  // ──────────────────────────────────────────────────────────
  describe('シングルトンインスタンス (microsoftGraphService)', () => {
    it('MicrosoftGraphService のインスタンスであること', () => {
      expect(microsoftGraphService).toBeInstanceOf(MicrosoftGraphService);
    });

    it('isConfigured() が false を返すこと', () => {
      expect(microsoftGraphService.isConfigured()).toBe(false);
    });

    it('同じインスタンスが export されること（シングルトン）', () => {
      const {
        microsoftGraphService: instance2
      } = require('../../../services/microsoftGraphService');
      expect(microsoftGraphService).toBe(instance2);
    });

    it('getUsers() が空配列を返すこと', async () => {
      const result = await microsoftGraphService.getUsers();
      expect(result).toEqual([]);
    });

    it('syncUsersToDatabase() が skipped:true を返すこと', async () => {
      const result = await microsoftGraphService.syncUsersToDatabase();
      expect(result.skipped).toBe(true);
    });
  });
});
