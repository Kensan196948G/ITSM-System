/**
 * ITSM-Sec Nexus - ES Modules エントリポイント
 *
 * このファイルはESモジュールシステムのエントリポイントです。
 * 各モジュールをインポートしてグローバルに公開することで、
 * 既存のapp.js（レガシーグローバルスコープ）との後方互換性を維持しながら
 * モジュール化を段階的に進めます。
 *
 * 移行戦略:
 * 1. このファイルでモジュールをインポートしてグローバル公開（現在）
 * 2. app.jsの関数を徐々にモジュールに移行（将来）
 * 3. app.jsを段階的に縮小・廃止（最終目標）
 */

// ===== Core Modules =====
import { ApiClient, apiClient } from './core/api-client.js';

// ===== Shared UI Modules =====
import { Toast } from './shared/ui/toast.js';
import {
  createEl,
  clearElement,
  setText,
  createBadge,
  createLoadingSpinner,
  createErrorMessage
} from './shared/ui/dom-utils.js';

// ===== Feature Modules =====
import { renderKpiCards } from './features/dashboard/kpi-cards.js';

// ===== Config =====
import {
  API_BASE,
  TOKEN_KEY,
  USER_KEY,
  TOKEN_EXPIRY_KEY,
  CHART_COLORS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  SEVERITY_COLORS
} from './config/constants.js';

// ===== グローバル公開（後方互換性のため） =====
// app.jsおよびその他のスクリプトがグローバルアクセスできるよう公開
window.__itsmModules = {
  // Core
  ApiClient,
  apiClient,

  // UI
  Toast,

  // DOM Utilities
  createEl,
  clearElement,
  setText,
  createBadge,
  createLoadingSpinner,
  createErrorMessage,

  // Features
  renderKpiCards,

  // Config
  API_BASE,
  TOKEN_KEY,
  USER_KEY,
  TOKEN_EXPIRY_KEY,
  CHART_COLORS,
  STATUS_COLORS,
  PRIORITY_COLORS,
  SEVERITY_COLORS
};

// デバッグ用: モジュールロード完了通知
if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
  console.log('[ITSM Modules] ES Modules loaded successfully', Object.keys(window.__itsmModules));
}
