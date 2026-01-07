/**
 * i18n Middleware for Backend
 * Handles Accept-Language header and provides translation utilities
 */

const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-CN'];
const DEFAULT_LANGUAGE = 'ja';

// Translation messages for common API responses
const messages = {
  ja: {
    // Common messages
    'error.generic': 'エラーが発生しました',
    'error.unauthorized': '認証が必要です',
    'error.forbidden': 'アクセスが拒否されました',
    'error.notFound': 'リソースが見つかりません',
    'error.validation': '入力内容を確認してください',
    'error.serverError': 'サーバーエラーが発生しました',

    // Auth messages
    'auth.login.success': 'ログインに成功しました',
    'auth.login.failed': 'ログインに失敗しました',
    'auth.logout.success': 'ログアウトしました',
    'auth.register.success': 'ユーザーを登録しました',
    'auth.invalidCredentials': 'ユーザー名またはパスワードが正しくありません',
    'auth.tokenExpired': 'トークンの有効期限が切れました',

    // Incident messages
    'incident.created': 'インシデントを作成しました',
    'incident.updated': 'インシデントを更新しました',
    'incident.deleted': 'インシデントを削除しました',

    // Change messages
    'change.created': '変更要求を作成しました',
    'change.updated': '変更要求を更新しました',
    'change.approved': '変更要求を承認しました',
    'change.rejected': '変更要求を却下しました',

    // Asset messages
    'asset.created': '資産を登録しました',
    'asset.updated': '資産を更新しました',
    'asset.deleted': '資産を削除しました',

    // SLA messages
    'sla.created': 'SLAを作成しました',
    'sla.updated': 'SLAを更新しました',
    'sla.violation': 'SLA違反が発生しました',

    // Success messages
    'success.operation': '操作が完了しました',
    'success.saved': '保存しました',
    'success.deleted': '削除しました',
    'success.updated': '更新しました'
  },
  en: {
    // Common messages
    'error.generic': 'An error occurred',
    'error.unauthorized': 'Authentication required',
    'error.forbidden': 'Access denied',
    'error.notFound': 'Resource not found',
    'error.validation': 'Please check your input',
    'error.serverError': 'Server error occurred',

    // Auth messages
    'auth.login.success': 'Login successful',
    'auth.login.failed': 'Login failed',
    'auth.logout.success': 'Logged out successfully',
    'auth.register.success': 'User registered successfully',
    'auth.invalidCredentials': 'Invalid username or password',
    'auth.tokenExpired': 'Token expired',

    // Incident messages
    'incident.created': 'Incident created successfully',
    'incident.updated': 'Incident updated successfully',
    'incident.deleted': 'Incident deleted successfully',

    // Change messages
    'change.created': 'Change request created successfully',
    'change.updated': 'Change request updated successfully',
    'change.approved': 'Change request approved',
    'change.rejected': 'Change request rejected',

    // Asset messages
    'asset.created': 'Asset registered successfully',
    'asset.updated': 'Asset updated successfully',
    'asset.deleted': 'Asset deleted successfully',

    // SLA messages
    'sla.created': 'SLA created successfully',
    'sla.updated': 'SLA updated successfully',
    'sla.violation': 'SLA violation occurred',

    // Success messages
    'success.operation': 'Operation completed successfully',
    'success.saved': 'Saved successfully',
    'success.deleted': 'Deleted successfully',
    'success.updated': 'Updated successfully'
  },
  'zh-CN': {
    // Common messages
    'error.generic': '发生错误',
    'error.unauthorized': '需要认证',
    'error.forbidden': '访问被拒绝',
    'error.notFound': '未找到资源',
    'error.validation': '请检查您的输入',
    'error.serverError': '服务器错误',

    // Auth messages
    'auth.login.success': '登录成功',
    'auth.login.failed': '登录失败',
    'auth.logout.success': '已登出',
    'auth.register.success': '用户注册成功',
    'auth.invalidCredentials': '用户名或密码错误',
    'auth.tokenExpired': '令牌已过期',

    // Incident messages
    'incident.created': '事件创建成功',
    'incident.updated': '事件更新成功',
    'incident.deleted': '事件删除成功',

    // Change messages
    'change.created': '变更请求创建成功',
    'change.updated': '变更请求更新成功',
    'change.approved': '变更请求已批准',
    'change.rejected': '变更请求已拒绝',

    // Asset messages
    'asset.created': '资产注册成功',
    'asset.updated': '资产更新成功',
    'asset.deleted': '资产删除成功',

    // SLA messages
    'sla.created': 'SLA创建成功',
    'sla.updated': 'SLA更新成功',
    'sla.violation': 'SLA违规',

    // Success messages
    'success.operation': '操作成功',
    'success.saved': '保存成功',
    'success.deleted': '删除成功',
    'success.updated': '更新成功'
  }
};

/**
 * Parse Accept-Language header and return best matching language
 * @param {string} acceptLanguage - Accept-Language header value
 * @returns {string} - Best matching language code
 */
function parseAcceptLanguage(acceptLanguage) {
  if (!acceptLanguage) {
    return DEFAULT_LANGUAGE;
  }

  // Parse Accept-Language header (e.g., "en-US,en;q=0.9,ja;q=0.8")
  const languages = acceptLanguage
    .split(',')
    .map((lang) => {
      const parts = lang.trim().split(';');
      const code = parts[0];
      const quality = parts[1] ? parseFloat(parts[1].split('=')[1]) : 1.0;
      return { code, quality };
    })
    .sort((a, b) => b.quality - a.quality);

  // Find best matching supported language
  for (const lang of languages) {
    // Exact match
    if (SUPPORTED_LANGUAGES.includes(lang.code)) {
      return lang.code;
    }

    // Partial match (e.g., "en-US" matches "en")
    const baseCode = lang.code.split('-')[0];
    const match = SUPPORTED_LANGUAGES.find((supported) => supported.startsWith(baseCode));
    if (match) {
      return match;
    }
  }

  return DEFAULT_LANGUAGE;
}

/**
 * i18n middleware - attaches language and translation function to request object
 */
function i18nMiddleware(req, res, next) {
  // Get language from Accept-Language header
  const acceptLanguage = req.headers['accept-language'];
  const language = parseAcceptLanguage(acceptLanguage);

  // Attach language to request object
  req.language = language;

  // Attach translation function to request object
  req.t = (key, params = {}) => {
    let text = messages[language]?.[key] || messages[DEFAULT_LANGUAGE]?.[key] || key;

    // Simple parameter interpolation
    Object.entries(params).forEach(([paramKey, value]) => {
      text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), value);
    });

    return text;
  };

  next();
}

/**
 * Get translation for a specific language
 * @param {string} language - Language code
 * @param {string} key - Translation key
 * @param {object} params - Optional parameters for interpolation
 * @returns {string} - Translated string
 */
function translate(language, key, params = {}) {
  let text = messages[language]?.[key] || messages[DEFAULT_LANGUAGE]?.[key] || key;

  Object.entries(params).forEach(([paramKey, value]) => {
    text = text.replace(new RegExp(`{{${paramKey}}}`, 'g'), value);
  });

  return text;
}

module.exports = {
  i18nMiddleware,
  translate,
  parseAcceptLanguage,
  SUPPORTED_LANGUAGES,
  DEFAULT_LANGUAGE
};
