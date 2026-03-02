const { maskSecrets, maskObject } = require('../../../utils/logger');

describe('Logger - maskSecrets', () => {
  test('非文字列はそのまま返す', () => {
    expect(maskSecrets(null)).toBeNull();
    expect(maskSecrets(undefined)).toBeUndefined();
    expect(maskSecrets(123)).toBe(123);
    expect(maskSecrets(true)).toBe(true);
  });

  test('JWTトークンをマスクする', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTYxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const result = maskSecrets(`Token: ${jwt}`);
    expect(result).toBe('Token: [JWT_REDACTED]');
    expect(result).not.toContain('eyJ');
  });

  test('Bearerトークンをマスクする', () => {
    const result = maskSecrets('Authorization: Bearer abc123.def456.ghi789');
    expect(result).toContain('Bearer [TOKEN_REDACTED]');
    expect(result).not.toContain('abc123');
  });

  test('パスワードフィールドをマスクする', () => {
    expect(maskSecrets('password=mysecretpass123')).toBe('password=[REDACTED]');
    expect(maskSecrets('passwd: secret')).toBe('passwd=[REDACTED]');
    expect(maskSecrets('pwd=test123')).toBe('pwd=[REDACTED]');
  });

  test('APIキーフィールドをマスクする', () => {
    expect(maskSecrets('api_key=sk-1234567890')).toBe('api_key=[REDACTED]');
    expect(maskSecrets('apikey=abcdef')).toBe('apikey=[REDACTED]');
    expect(maskSecrets('api-secret=xyz')).toBe('api-secret=[REDACTED]');
  });

  test('長い16進トークンをマスクする', () => {
    const hexToken = 'a'.repeat(64);
    const result = maskSecrets(`Refresh token: ${hexToken}`);
    expect(result).toContain('[TOKEN_REDACTED]');
    expect(result).not.toContain(hexToken);
  });

  test('secretフィールドをマスクする', () => {
    expect(maskSecrets('secret=my_secret_value')).toBe('secret=[REDACTED]');
    expect(maskSecrets('jwt_secret=abc123')).toBe('jwt_secret=[REDACTED]');
    expect(maskSecrets('client_secret=xyz')).toBe('client_secret=[REDACTED]');
  });

  test('DB接続文字列をマスクする', () => {
    expect(maskSecrets('sqlite:///path/to/db.sqlite')).toBe('[DB_URI_REDACTED]');
    expect(maskSecrets('postgres://user:pass@host/db')).toBe('[DB_URI_REDACTED]');
    expect(maskSecrets('mongodb://admin:pass@localhost/mydb')).toBe('[DB_URI_REDACTED]');
  });

  test('SMTP接続文字列のパスワード部分をマスクする', () => {
    const result = maskSecrets('smtp://user:password123@smtp.example.com');
    expect(result).toContain('smtp://[REDACTED]@');
    expect(result).not.toContain('password123');
  });

  test('シークレットを含まない文字列はそのまま返す', () => {
    const msg = 'User logged in successfully';
    expect(maskSecrets(msg)).toBe(msg);
  });

  test('複数のシークレットを同時にマスクする', () => {
    const msg = 'password=abc123 api_key=sk-xyz';
    const result = maskSecrets(msg);
    expect(result).not.toContain('abc123');
    expect(result).not.toContain('sk-xyz');
  });

  test('連続呼び出しでlastIndexがリセットされる', () => {
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjEsImlhdCI6MTYxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    // global フラグ付き正規表現は lastIndex を保持するため、リセットが必要
    maskSecrets(`First: ${jwt}`);
    const result = maskSecrets(`Second: ${jwt}`);
    expect(result).toBe('Second: [JWT_REDACTED]');
  });
});

describe('Logger - maskObject', () => {
  test('null/undefined はそのまま返す', () => {
    expect(maskObject(null)).toBeNull();
    expect(maskObject(undefined)).toBeUndefined();
  });

  test('文字列はmaskSecretsを適用する', () => {
    expect(maskObject('password=abc')).toBe('password=[REDACTED]');
  });

  test('数値・真偽値はそのまま返す', () => {
    expect(maskObject(42)).toBe(42);
    expect(maskObject(true)).toBe(true);
  });

  test('Errorオブジェクトのmessageとstackをマスクする', () => {
    const err = new Error('password=secret123');
    err.code = 'ERR_AUTH';
    const result = maskObject(err);
    expect(result.message).toBe('password=[REDACTED]');
    expect(result.code).toBe('ERR_AUTH');
    expect(result).toHaveProperty('stack');
  });

  test('Errorオブジェクトのcodeがない場合はcodeプロパティなし', () => {
    const err = new Error('test error');
    const result = maskObject(err);
    expect(result).not.toHaveProperty('code');
  });

  test('配列を再帰的にマスクする', () => {
    const arr = ['password=abc', 'normal text', { token: 'secret' }];
    const result = maskObject(arr);
    expect(result[0]).toBe('password=[REDACTED]');
    expect(result[1]).toBe('normal text');
    expect(result[2].token).toBe('[REDACTED]');
  });

  test('フィールド名ベースでシークレットキーをマスクする', () => {
    const obj = {
      password: 'secret123',
      secret: 'my_secret',
      token: 'abc.def.ghi',
      api_key: 'sk-1234',
      apikey: 'key123',
      authorization: 'Bearer xyz',
      cookie: 'session=abc',
      private_key: '-----BEGIN RSA-----',
      username: 'admin'
    };
    const result = maskObject(obj);
    expect(result.password).toBe('[REDACTED]');
    expect(result.secret).toBe('[REDACTED]');
    expect(result.token).toBe('[REDACTED]');
    expect(result.api_key).toBe('[REDACTED]');
    expect(result.apikey).toBe('[REDACTED]');
    expect(result.authorization).toBe('[REDACTED]');
    expect(result.cookie).toBe('[REDACTED]');
    expect(result.private_key).toBe('[REDACTED]');
    expect(result.username).toBe('admin');
  });

  test('ネストされたオブジェクトを再帰的にマスクする', () => {
    const obj = {
      user: {
        name: 'test',
        credentials: {
          password: 'secret',
          token: 'abc123'
        }
      }
    };
    const result = maskObject(obj);
    expect(result.user.name).toBe('test');
    expect(result.user.credentials.password).toBe('[REDACTED]');
    expect(result.user.credentials.token).toBe('[REDACTED]');
  });

  test('大文字小文字を無視してフィールド名をマッチする', () => {
    const obj = {
      PASSWORD: 'secret',
      AccessToken: 'abc',
      API_KEY: 'key'
    };
    const result = maskObject(obj);
    expect(result.PASSWORD).toBe('[REDACTED]');
    expect(result.AccessToken).toBe('[REDACTED]');
    expect(result.API_KEY).toBe('[REDACTED]');
  });

  test('値が文字列内にシークレットパターンを含む場合もマスクする', () => {
    const obj = {
      log: 'User authenticated with password=abc123'
    };
    const result = maskObject(obj);
    expect(result.log).toBe('User authenticated with password=[REDACTED]');
  });
});

describe('Logger - logger instance', () => {
  test('loggerはwinston loggerインスタンスである', () => {
    const logger = require('../../../utils/logger');
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  test('maskSecretsとmaskObjectがエクスポートされている', () => {
    const logger = require('../../../utils/logger');
    expect(typeof logger.maskSecrets).toBe('function');
    expect(typeof logger.maskObject).toBe('function');
  });
});
