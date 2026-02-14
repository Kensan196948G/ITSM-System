/**
 * Winston Logger Configuration
 * 構造化ロギング + シークレットマスキング
 *
 * - JSON形式ログ出力（本番環境）
 * - ログレベル分離（error/warn/info/debug）
 * - シークレットマスキング（JWT, パスワード, トークン, APIキー等）
 * - 環境別設定（test=silent, development=console, production=file+rotate）
 */

const path = require('path');
const winston = require('winston');
require('winston-daily-rotate-file');

const LOG_DIR = path.resolve(__dirname, '..', 'logs');

// シークレットマスキング用の正規表現パターン
const SECRET_PATTERNS = [
  // JWT トークン (eyJ で始まる Base64 エンコード文字列)
  {
    pattern: /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
    replacement: '[JWT_REDACTED]'
  },
  // Bearer トークン
  { pattern: /Bearer\s+[A-Za-z0-9_.-]+/gi, replacement: 'Bearer [TOKEN_REDACTED]' },
  // パスワード系 (key=value 形式)
  { pattern: /(password|passwd|pwd)\s*[:=]\s*\S+/gi, replacement: '$1=[REDACTED]' },
  // APIキー系 (key=value 形式)
  { pattern: /(api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*\S+/gi, replacement: '$1=[REDACTED]' },
  // トークン値 (hex 64文字以上 - リフレッシュトークン等)
  { pattern: /\b[0-9a-f]{64,}\b/gi, replacement: '[TOKEN_REDACTED]' },
  // secret 系 (key=value 形式)
  {
    pattern: /(secret|jwt[_-]?secret|client[_-]?secret)\s*[:=]\s*\S+/gi,
    replacement: '$1=[REDACTED]'
  },
  // DB接続文字列
  { pattern: /(sqlite|mysql|postgres|mongodb):\/\/[^\s]+/gi, replacement: '[DB_URI_REDACTED]' },
  // メールアドレスのパスワード部分 (smtp://user:pass@host 形式)
  { pattern: /smtp:\/\/[^:]+:[^@]+@/gi, replacement: 'smtp://[REDACTED]@' }
];

/**
 * ログメッセージ内のシークレット情報をマスクする
 * @param {string} message - ログメッセージ
 * @returns {string} マスク済みメッセージ
 */
function maskSecrets(message) {
  if (typeof message !== 'string') return message;
  let masked = message;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    // 正規表現の lastIndex をリセット（global フラグ使用時に必要）
    pattern.lastIndex = 0;
    masked = masked.replace(pattern, replacement);
  }
  return masked;
}

/**
 * オブジェクト内のシークレットを再帰的にマスクする
 * @param {*} obj - マスク対象
 * @returns {*} マスク済みオブジェクト
 */
function maskObject(obj) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return maskSecrets(obj);
  if (typeof obj !== 'object') return obj;
  if (obj instanceof Error) {
    return {
      message: maskSecrets(obj.message),
      stack: maskSecrets(obj.stack),
      ...(obj.code && { code: obj.code })
    };
  }
  if (Array.isArray(obj)) return obj.map(maskObject);

  const masked = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    // フィールド名ベースのマスキング
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('api_key') ||
      lowerKey.includes('apikey') ||
      lowerKey.includes('authorization') ||
      lowerKey.includes('cookie') ||
      lowerKey.includes('private_key')
    ) {
      masked[key] = '[REDACTED]';
    } else {
      masked[key] = maskObject(value);
    }
  }
  return masked;
}

/**
 * シークレットマスキングフォーマッター
 */
const secretMaskFormat = winston.format((info) => {
  // メッセージのマスキング
  if (info.message) {
    info.message = maskSecrets(info.message);
  }

  // splat 引数（printf の %s 等）のマスキング
  if (info.splat) {
    info.splat = info.splat.map(maskObject);
  }

  // メタデータのマスキング
  const { level, message, timestamp, service, splat, ...meta } = info;
  if (Object.keys(meta).length > 0) {
    const maskedMeta = maskObject(meta);
    Object.assign(info, maskedMeta);
  }

  return info;
});

/**
 * 環境に応じたログレベルを決定
 */
function getLogLevel() {
  switch (process.env.NODE_ENV) {
    case 'production':
      return 'info';
    case 'test':
      return 'silent';
    default:
      return 'debug';
  }
}

/**
 * 環境に応じたトランスポートを構築
 */
function buildTransports() {
  const env = process.env.NODE_ENV || 'development';

  // テスト環境: 出力なし
  if (env === 'test') {
    return [new winston.transports.Console({ silent: true })];
  }

  const transports = [];

  // コンソール出力（開発・本番共通）
  transports.push(
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          ({ timestamp: ts, level: lvl, message: msg, service: svc, ...meta }) => {
            const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
            return `${ts} [${svc || 'app'}] ${lvl}: ${msg}${metaStr}`;
          }
        )
      )
    })
  );

  // 本番環境: ファイル出力 + ローテーション
  if (env === 'production') {
    // 全ログ（info以上）
    transports.push(
      new winston.transports.DailyRotateFile({
        dirname: LOG_DIR,
        filename: 'app-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        maxSize: '20m',
        maxFiles: '30d',
        format: winston.format.json()
      })
    );

    // エラーログ専用
    transports.push(
      new winston.transports.DailyRotateFile({
        dirname: LOG_DIR,
        filename: 'error-%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        level: 'error',
        maxSize: '20m',
        maxFiles: '90d',
        format: winston.format.json()
      })
    );
  }

  return transports;
}

/**
 * Winston ロガーインスタンスを作成
 */
const logger = winston.createLogger({
  level: getLogLevel(),
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    secretMaskFormat(),
    winston.format.errors({ stack: true })
  ),
  defaultMeta: { service: 'itsm-nexus' },
  transports: buildTransports()
});

// エクスポート（テスト用にヘルパー関数も公開）
module.exports = logger;
module.exports.maskSecrets = maskSecrets;
module.exports.maskObject = maskObject;
