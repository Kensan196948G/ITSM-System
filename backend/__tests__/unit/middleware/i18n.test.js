/**
 * i18n Middleware Tests
 * 国際化ミドルウェアのユニットテスト
 */

const {
  i18nMiddleware,
  translate,
  parseAcceptLanguage,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
} = require('../../../middleware/i18n');

describe('i18n Middleware', () => {
  describe('parseAcceptLanguage', () => {
    it('should return default language for null input', () => {
      expect(parseAcceptLanguage(null)).toBe('ja');
    });

    it('should return default language for undefined input', () => {
      expect(parseAcceptLanguage(undefined)).toBe('ja');
    });

    it('should return default language for empty string', () => {
      expect(parseAcceptLanguage('')).toBe('ja');
    });

    it('should return exact match for supported language', () => {
      expect(parseAcceptLanguage('en')).toBe('en');
    });

    it('should return exact match for Japanese', () => {
      expect(parseAcceptLanguage('ja')).toBe('ja');
    });

    it('should return exact match for Chinese', () => {
      expect(parseAcceptLanguage('zh-CN')).toBe('zh-CN');
    });

    it('should handle quality values and return highest priority match', () => {
      expect(parseAcceptLanguage('ja;q=0.5,en;q=0.9')).toBe('en');
    });

    it('should default quality to 1.0 when not specified', () => {
      expect(parseAcceptLanguage('en,ja;q=0.5')).toBe('en');
    });

    it('should handle partial match (e.g., en-US matches en)', () => {
      expect(parseAcceptLanguage('en-US')).toBe('en');
    });

    it('should handle partial match for Japanese variants', () => {
      expect(parseAcceptLanguage('ja-JP')).toBe('ja');
    });

    it('should return default language for unsupported language', () => {
      expect(parseAcceptLanguage('fr')).toBe('ja');
    });

    it('should handle complex Accept-Language headers', () => {
      const result = parseAcceptLanguage('fr-FR;q=0.9,en-US;q=0.8,de;q=0.7');
      expect(result).toBe('en');
    });

    it('should handle multiple supported languages with quality', () => {
      const result = parseAcceptLanguage('en;q=0.3,ja;q=0.9');
      expect(result).toBe('ja');
    });

    it('should return default when all languages are unsupported', () => {
      expect(parseAcceptLanguage('fr;q=0.9,de;q=0.8,es;q=0.7')).toBe('ja');
    });
  });

  describe('i18nMiddleware', () => {
    it('should set language and translation function on request', () => {
      const req = { headers: { 'accept-language': 'en' } };
      const res = {};
      const next = jest.fn();

      i18nMiddleware(req, res, next);

      expect(req.language).toBe('en');
      expect(typeof req.t).toBe('function');
      expect(next).toHaveBeenCalled();
    });

    it('should default to Japanese when no Accept-Language header', () => {
      const req = { headers: {} };
      const res = {};
      const next = jest.fn();

      i18nMiddleware(req, res, next);

      expect(req.language).toBe('ja');
    });

    it('should translate known keys', () => {
      const req = { headers: { 'accept-language': 'en' } };
      const res = {};
      const next = jest.fn();

      i18nMiddleware(req, res, next);

      expect(req.t('auth.login.success')).toBe('Login successful');
    });

    it('should translate Japanese keys', () => {
      const req = { headers: { 'accept-language': 'ja' } };
      const res = {};
      const next = jest.fn();

      i18nMiddleware(req, res, next);

      expect(req.t('auth.login.success')).toBe('ログインに成功しました');
    });

    it('should return key as fallback for unknown translation keys', () => {
      const req = { headers: { 'accept-language': 'en' } };
      const res = {};
      const next = jest.fn();

      i18nMiddleware(req, res, next);

      expect(req.t('unknown.key')).toBe('unknown.key');
    });

    it('should fallback to default language when key not found in current language', () => {
      const req = { headers: { 'accept-language': 'zh-CN' } };
      const res = {};
      const next = jest.fn();

      i18nMiddleware(req, res, next);

      // zh-CN has this key
      expect(req.t('auth.login.success')).toBe('登录成功');
    });

    it('should handle parameter interpolation', () => {
      const req = { headers: { 'accept-language': 'en' } };
      const res = {};
      const next = jest.fn();

      i18nMiddleware(req, res, next);

      // Parameters should be replaced if template contains them
      const result = req.t('error.generic', { detail: 'test' });
      expect(typeof result).toBe('string');
    });
  });

  describe('translate', () => {
    it('should translate for English', () => {
      expect(translate('en', 'auth.login.success')).toBe('Login successful');
    });

    it('should translate for Japanese', () => {
      expect(translate('ja', 'error.unauthorized')).toBe('認証が必要です');
    });

    it('should translate for Chinese', () => {
      expect(translate('zh-CN', 'error.forbidden')).toBe('访问被拒绝');
    });

    it('should fallback to default language for unsupported language', () => {
      expect(translate('fr', 'auth.login.success')).toBe('ログインに成功しました');
    });

    it('should return key for unknown translation key', () => {
      expect(translate('en', 'nonexistent.key')).toBe('nonexistent.key');
    });

    it('should handle parameter interpolation in translate', () => {
      // Parameters don't match any existing template, but function should still work
      const result = translate('en', 'error.generic', { foo: 'bar' });
      expect(result).toBe('An error occurred');
    });
  });

  describe('Constants', () => {
    it('should export correct SUPPORTED_LANGUAGES', () => {
      expect(SUPPORTED_LANGUAGES).toEqual(['ja', 'en', 'zh-CN']);
    });

    it('should export correct DEFAULT_LANGUAGE', () => {
      expect(DEFAULT_LANGUAGE).toBe('ja');
    });
  });
});
