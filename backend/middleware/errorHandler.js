/**
 * グローバルエラーハンドリングミドルウェア
 * アプリケーション全体のエラー処理を一元化
 */

const logger = require('../utils/logger');

/**
 * カスタムエラークラス
 */
class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.timestamp = new Date().toISOString();

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400);
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = '認証に失敗しました') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = '権限がありません') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'リソース') {
    super(`${resource}が見つかりません`, 404);
    this.name = 'NotFoundError';
  }
}

class DatabaseError extends AppError {
  constructor(message = 'データベースエラーが発生しました') {
    super(message, 500);
    this.name = 'DatabaseError';
  }
}

/**
 * エラーハンドリングミドルウェア
 */
const errorHandler = (err, req, res, next) => {
  // デフォルト値の設定
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';
  err.message = err.message || '内部サーバーエラー';

  // 開発環境と本番環境で異なるエラー情報を返す
  const isDevelopment = process.env.NODE_ENV === 'development';

  // エラーログ記録
  if (err.statusCode >= 500) {
    logger.error('Server Error', err);
  } else if (err.statusCode >= 400) {
    logger.warn(`Client Error: ${err.message}`);
  }

  // レスポンスの構築
  const errorResponse = {
    status: err.status,
    message: err.message,
    timestamp: err.timestamp || new Date().toISOString(),
    path: req.path,
    method: req.method
  };

  // 開発環境では追加情報を提供
  if (isDevelopment) {
    errorResponse.stack = err.stack;
    errorResponse.name = err.name;

    if (err.errors) {
      errorResponse.errors = err.errors;
    }
  }

  // 特定のエラータイプに対する処理
  if (err.name === 'ValidationError' && err.errors) {
    errorResponse.errors = err.errors;
  }

  // ステータスコードに基づくレスポンス
  res.status(err.statusCode).json(errorResponse);
};

/**
 * 404エラーハンドラー
 */
const notFoundHandler = (req, res, next) => {
  const err = new NotFoundError(`パス ${req.originalUrl} が見つかりません`);
  next(err);
};

/**
 * 非同期エラーハンドリングラッパー
 * async/await関数用のエラーハンドリング
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

/**
 * グローバルプロセスエラーハンドラー
 */
const setupGlobalErrorHandlers = () => {
  // 未処理のPromise拒否
  process.on('unhandledRejection', (reason) => {
    logger.error('Unhandled Promise Rejection', reason);
    // アプリケーションを終了させるか、ログだけ記録するかを選択
    if (process.env.NODE_ENV === 'production') {
      // 本番環境ではエラーを投げてプロセスを終了
      throw reason;
    }
  });

  // 未捕捉の例外
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', error);
    // アプリケーションを終了させるか、ログだけ記録するかを選択
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });

  logger.info('Global error handlers initialized');
};

/**
 * データベースエラーハンドリングユーティリティ
 */
const handleDatabaseError = (error, context = 'データベース操作') => {
  logger.error(`${context}中にエラーが発生しました`, error);

  // SQLite固有のエラーコード
  const sqliteErrors = {
    SQLITE_CONSTRAINT: 'データの整合性制約違反です',
    SQLITE_BUSY: 'データベースがビジー状態です',
    SQLITE_LOCKED: 'データベースがロックされています',
    SQLITE_NOTFOUND: 'リソースが見つかりません',
    SQLITE_FULL: 'データベースが満杯です',
    SQLITE_CANTOPEN: 'データベースを開けません',
    SQLITE_PROTOCOL: 'プロトコルエラー',
    SQLITE_EMPTY: 'データベースが空です',
    SQLITE_SCHEMA: 'スキーマが変更されました',
    SQLITE_TOOBIG: 'データが大きすぎます',
    SQLITE_CONSTRAINT_UNIQUE: '一意性制約違反です',
    SQLITE_CONSTRAINT_NOTNULL: 'NULL値は許可されていません',
    SQLITE_CONSTRAINT_FOREIGNKEY: '外部キー制約違反です'
  };

  // エラーコードに基づくメッセージ
  const errorCode = error.code || '';
  const userMessage = sqliteErrors[errorCode] || 'データベースエラーが発生しました';

  throw new DatabaseError(userMessage);
};

/**
 * 入力バリデーションエラーハンドリング
 */
const handleValidationError = (errors) => {
  const formattedErrors = errors.map((error) => ({
    field: error.path || 'unknown',
    message: error.msg || '無効な値です',
    value: error.value
  }));

  throw new ValidationError('入力データのバリデーションに失敗しました', formattedErrors);
};

module.exports = {
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  DatabaseError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  setupGlobalErrorHandlers,
  handleDatabaseError,
  handleValidationError,
  logger
};
