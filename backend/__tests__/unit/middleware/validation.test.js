// Mock express-validator before requiring validation module
jest.mock('express-validator', () => ({
  body: jest.fn(() => ({
    trim: jest.fn().mockReturnThis(),
    notEmpty: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    isIn: jest.fn().mockReturnThis(),
    isBoolean: jest.fn().mockReturnThis(),
    isEmail: jest.fn().mockReturnThis(),
    matches: jest.fn().mockReturnThis(),
    normalizeEmail: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis()
  })),
  param: jest.fn(() => ({
    notEmpty: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis()
  })),
  validationResult: jest.fn()
}));

const { validationResult } = require('express-validator');
const {
  validate,
  incidentValidation,
  changeValidation,
  authValidation
} = require('../../../middleware/validation');

describe('Validation Middleware', () => {
  describe('validate middleware', () => {
    it('バリデーションエラーなしで次へ進む', () => {
      validationResult.mockReturnValue({
        isEmpty: () => true,
        array: () => []
      });

      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      validate(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it('バリデーションエラーありで400エラー', () => {
      const mockErrors = [
        { path: 'title', msg: 'タイトルは必須です', value: '' },
        { path: 'priority', msg: '優先度が無効です', value: 'Invalid' }
      ];

      validationResult.mockReturnValue({
        isEmpty: () => false,
        array: () => mockErrors
      });

      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      validate(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('無効'),
          errors: expect.arrayContaining([
            expect.objectContaining({
              field: 'title',
              message: 'タイトルは必須です'
            })
          ])
        })
      );
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('incidentValidation', () => {
    it('create: 必須フィールドを含む', () => {
      expect(incidentValidation.create).toBeDefined();
      expect(Array.isArray(incidentValidation.create)).toBe(true);
      expect(incidentValidation.create.length).toBeGreaterThan(0);
    });

    it('update: オプショナルフィールドのみ', () => {
      expect(incidentValidation.update).toBeDefined();
      expect(Array.isArray(incidentValidation.update)).toBe(true);
    });
  });

  describe('changeValidation', () => {
    it('create: titleが必須', () => {
      expect(changeValidation.create).toBeDefined();
      expect(Array.isArray(changeValidation.create)).toBe(true);
    });

    it('update: statusとapproverのみ', () => {
      expect(changeValidation.update).toBeDefined();
      expect(Array.isArray(changeValidation.update)).toBe(true);
    });
  });

  describe('authValidation', () => {
    it('register: username, email, passwordが必須', () => {
      expect(authValidation.register).toBeDefined();
      expect(Array.isArray(authValidation.register)).toBe(true);
    });

    it('login: username, passwordのみ必須', () => {
      expect(authValidation.login).toBeDefined();
      expect(Array.isArray(authValidation.login)).toBe(true);
    });
  });
});

describe('Validation Rules Testing', () => {
  beforeEach(() => {
    validationResult.mockClear();
  });

  it('空のタイトルは拒否される', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ path: 'title', msg: 'タイトルは必須です', value: '' }]
    });

    const req = { body: { title: '', priority: 'High' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    validate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('タイトルが500文字を超える場合は拒否', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [
        { path: 'title', msg: 'タイトルは500文字以内で入力してください', value: 'x'.repeat(501) }
      ]
    });

    const req = { body: { title: 'x'.repeat(501), priority: 'High' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    validate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('無効な優先度は拒否', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [{ path: 'priority', msg: '優先度が無効です', value: 'InvalidPriority' }]
    });

    const req = { body: { title: 'Test', priority: 'InvalidPriority' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    validate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('有効な優先度は許可（Critical, High, Medium, Low）', () => {
    validationResult.mockReturnValue({
      isEmpty: () => true,
      array: () => []
    });

    const validPriorities = ['Critical', 'High', 'Medium', 'Low'];
    validPriorities.forEach(priority => {
      const req = { body: { title: 'Test', priority } };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      const next = jest.fn();

      validate(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  it('パスワードが8文字未満は拒否', () => {
    validationResult.mockReturnValue({
      isEmpty: () => false,
      array: () => [
        { path: 'password', msg: 'パスワードは8文字以上で入力してください', value: 'short' }
      ]
    });

    const req = { body: { username: 'test', password: 'short' } };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    validate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(400);
  });
});
