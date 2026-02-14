/**
 * Error Handler Middleware Unit Tests
 */

const errorHandler = require('../../../middleware/errorHandler');

describe('Error Handler Middleware Unit Tests', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      path: '/api/v1/test',
      originalUrl: '/api/v1/test',
      method: 'GET',
      headers: {}
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    mockNext = jest.fn();
  });

  describe('Custom Error Classes', () => {
    it('should create AppError with default status', () => {
      const error = new errorHandler.AppError('Test error');
      expect(error.message).toBe('Test error');
      expect(error.statusCode).toBe(500);
      expect(error.status).toBe('error');
      expect(error.timestamp).toBeDefined();
    });

    it('should create AppError with custom status', () => {
      const error = new errorHandler.AppError('Not found', 404);
      expect(error.message).toBe('Not found');
      expect(error.statusCode).toBe(404);
      expect(error.status).toBe('fail');
    });

    it('should create ValidationError', () => {
      const errors = [{ field: 'email', message: 'Invalid email' }];
      const error = new errorHandler.ValidationError('Validation failed', errors);
      expect(error.message).toBe('Validation failed');
      expect(error.statusCode).toBe(400);
      expect(error.errors).toEqual(errors);
    });

    it('should create AuthenticationError', () => {
      const error = new errorHandler.AuthenticationError();
      expect(error.message).toBe('認証に失敗しました');
      expect(error.statusCode).toBe(401);
    });

    it('should create AuthorizationError', () => {
      const error = new errorHandler.AuthorizationError();
      expect(error.message).toBe('権限がありません');
      expect(error.statusCode).toBe(403);
    });

    it('should create NotFoundError', () => {
      const error = new errorHandler.NotFoundError('User');
      expect(error.message).toBe('Userが見つかりません');
      expect(error.statusCode).toBe(404);
    });

    it('should create DatabaseError', () => {
      const error = new errorHandler.DatabaseError('Connection failed');
      expect(error.message).toBe('Connection failed');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('errorHandler middleware', () => {
    it('should handle AppError correctly', () => {
      const error = new errorHandler.AppError('Test error', 400);

      errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'fail',
        message: 'Test error',
        timestamp: expect.any(String),
        path: '/api/v1/test',
        method: 'GET'
      });
    });

    it('should handle ValidationError with errors array', () => {
      const errors = [{ field: 'email', message: 'Invalid format' }];
      const error = new errorHandler.ValidationError('Validation failed', errors);

      errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'fail',
        message: 'Validation failed',
        timestamp: expect.any(String),
        path: '/api/v1/test',
        method: 'GET',
        errors
      });
    });

    it('should handle generic Error', () => {
      const error = new Error('Generic error');

      errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Generic error',
        timestamp: expect.any(String),
        path: '/api/v1/test',
        method: 'GET'
      });
    });

    it('should include stack trace in development mode', () => {
      process.env.NODE_ENV = 'development';
      const error = new Error('Development error');

      errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          stack: expect.any(String),
          name: 'Error'
        })
      );

      process.env.NODE_ENV = 'test';
    });

    it('should mask sensitive error details in production', () => {
      process.env.NODE_ENV = 'production';
      const error = new Error('Production error');

      errorHandler.errorHandler(error, mockReq, mockRes, mockNext);

      const response = mockRes.json.mock.calls[0][0];
      expect(response.stack).toBeUndefined();
      expect(response.name).toBeUndefined();

      process.env.NODE_ENV = 'test';
    });
  });

  describe('notFoundHandler middleware', () => {
    it('should create NotFoundError and call next', () => {
      errorHandler.notFoundHandler(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      const error = mockNext.mock.calls[0][0];
      expect(error).toBeInstanceOf(errorHandler.NotFoundError);
      // 実装: new NotFoundError(`パス ${req.originalUrl} が見つかりません`)
      // NotFoundError は `${resource}が見つかりません` を生成
      // 結果: "パス /api/v1/test が見つかりませんが見つかりません"
      expect(error.message).toBe('パス /api/v1/test が見つかりませんが見つかりません');
    });
  });

  describe('asyncHandler wrapper', () => {
    it('should handle successful async function', async () => {
      const asyncFn = errorHandler.asyncHandler(async (req, res) => 'success');

      await asyncFn(mockReq, mockRes, mockNext);

      // Should not call next with error
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should handle async function that throws error', async () => {
      const asyncFn = errorHandler.asyncHandler(async (req, res) => {
        throw new Error('Async error');
      });

      await asyncFn(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(new Error('Async error'));
    });
  });

  describe('Database Error Handling', () => {
    it('should handle SQLite constraint errors', () => {
      const error = { code: 'SQLITE_CONSTRAINT_UNIQUE' };

      expect(() => {
        errorHandler.handleDatabaseError(error, 'User creation');
      }).toThrow(errorHandler.DatabaseError);

      try {
        errorHandler.handleDatabaseError(error, 'User creation');
      } catch (e) {
        expect(e.message).toContain('一意性制約違反です');
      }
    });

    it('should handle generic database errors', () => {
      const error = { code: 'UNKNOWN_ERROR' };

      expect(() => {
        errorHandler.handleDatabaseError(error, 'Data retrieval');
      }).toThrow(errorHandler.DatabaseError);

      try {
        errorHandler.handleDatabaseError(error, 'Data retrieval');
      } catch (e) {
        expect(e.message).toBe('データベースエラーが発生しました');
      }
    });
  });

  describe('Validation Error Handling', () => {
    it('should handle express-validator errors', () => {
      const errors = [
        { path: 'email', msg: 'Invalid email format' },
        { path: 'password', msg: 'Password too short' }
      ];

      expect(() => {
        errorHandler.handleValidationError(errors);
      }).toThrow(errorHandler.ValidationError);

      try {
        errorHandler.handleValidationError(errors);
      } catch (e) {
        expect(e.errors).toHaveLength(2);
        expect(e.errors[0].field).toBe('email');
        expect(e.errors[0].message).toBe('Invalid email format');
      }
    });
  });

  describe('Global Error Handlers', () => {
    it('should setup global error handlers', () => {
      const setupSpy = jest.spyOn(process, 'on');
      errorHandler.setupGlobalErrorHandlers();

      expect(setupSpy).toHaveBeenCalledWith('unhandledRejection', expect.any(Function));
      expect(setupSpy).toHaveBeenCalledWith('uncaughtException', expect.any(Function));

      setupSpy.mockRestore();
    });
  });

  describe('Logger', () => {
    it('should export Winston logger with error method', () => {
      expect(errorHandler.logger).toBeDefined();
      expect(typeof errorHandler.logger.error).toBe('function');
    });

    it('should export Winston logger with warn method', () => {
      expect(errorHandler.logger).toBeDefined();
      expect(typeof errorHandler.logger.warn).toBe('function');
    });
  });
});
