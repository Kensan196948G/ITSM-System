/**
 * Application Constants
 * 定数定義（API_BASE, トークンキー等）
 */

// API Base URL（自動的にホスト名とポートを検出）
export const API_BASE = `${window.location.origin}/api/v1`;

// LocalStorage Keys
export const TOKEN_KEY = 'itsm_auth_token';
export const USER_KEY = 'itsm_user_info';
export const TOKEN_EXPIRY_KEY = 'itsm_token_expiry';

// Token Refresh Configuration
export const TOKEN_REFRESH_MARGIN = 5 * 60 * 1000; // 5 minutes before expiry

// Security Management Storage
export const SECURITY_MGMT_STORAGE_KEY = 'itsm_security_management_data';

// i18n Configuration
export const I18N_STORAGE_KEY = 'itsm_language';
export const DEFAULT_LANGUAGE = 'ja';
export const SUPPORTED_LANGUAGES = ['ja', 'en', 'zh-CN'];

// Pagination
export const DEFAULT_PAGE_SIZE = 10;

// Chart Colors
export const CHART_COLORS = {
  primary: '#3b82f6',
  success: '#10b981',
  warning: '#f59e0b',
  danger: '#ef4444',
  info: '#06b6d4',
  purple: '#8b5cf6',
  pink: '#ec4899',
  indigo: '#6366f1'
};

// Status Colors
export const STATUS_COLORS = {
  open: '#3b82f6',
  in_progress: '#f59e0b',
  resolved: '#10b981',
  closed: '#6b7280',
  pending: '#f59e0b',
  approved: '#10b981',
  rejected: '#ef4444',
  cancelled: '#6b7280'
};

// Priority Colors
export const PRIORITY_COLORS = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#6b7280'
};

// Severity Colors
export const SEVERITY_COLORS = {
  critical: '#dc2626',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981'
};

// NIST CSF 2.0 Function Icons
export const CSF_FUNCTION_ICONS = {
  GV: 'fa-balance-scale',     // Govern
  ID: 'fa-search',            // Identify
  PR: 'fa-shield-alt',        // Protect
  DE: 'fa-eye',               // Detect
  RS: 'fa-reply',             // Respond
  RC: 'fa-redo'               // Recover
};

// NIST CSF 2.0 Function Colors
export const CSF_FUNCTION_COLORS = {
  GV: '#8b5cf6',  // Purple
  ID: '#3b82f6',  // Blue
  PR: '#10b981',  // Green
  DE: '#f59e0b',  // Amber
  RS: '#ef4444',  // Red
  RC: '#06b6d4'   // Cyan
};

console.log('API Base URL:', API_BASE);
