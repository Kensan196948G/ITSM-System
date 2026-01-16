/* eslint-env browser */

/**
 * ITSM-Sec Nexus - Secure Application Logic
 * XSS Protection: No innerHTML usage, DOM API only
 */

// ===== Configuration =====
// 自動的にホスト名を検出（IPアドレスまたはlocalhost）
// 開発環境: HTTP port 5000, 本番環境: HTTPS port 5443
const API_BASE =
  window.location.protocol === 'https:'
    ? `https://${window.location.hostname}:6443/api/v1`
    : `http://${window.location.hostname}:6000/api/v1`;

const TOKEN_KEY = 'itsm_auth_token';
const USER_KEY = 'itsm_user_info';

console.log('API Base URL:', API_BASE);

// ===== SLA/Alert Status Helper Functions =====
function getStatusColor(status) {
  if (status === 'Met') return '#16a34a';
  if (status === 'At-Risk') return '#f59e0b';
  return '#dc2626';
}

function getStatusBgColor(status) {
  if (status === 'Met') return '#dcfce7';
  if (status === 'At-Risk') return '#fef3c7';
  return '#fee2e2';
}

function getStatusTextColor(status) {
  if (status === 'Met') return '#166534';
  if (status === 'At-Risk') return '#92400e';
  return '#991b1b';
}

function getStatusLabel(status) {
  if (status === 'Met') return '達成';
  if (status === 'At-Risk') return 'リスク';
  return '違反';
}

function getRateColor(rate) {
  if (rate >= 90) return '#16a34a';
  if (rate >= 70) return '#f59e0b';
  return '#dc2626';
}

function getAlertTypeBgColor(alertType) {
  if (alertType === 'violation') return '#fee2e2';
  if (alertType === 'at_risk') return '#fef3c7';
  return '#dbeafe';
}

function getAlertTypeTextColor(alertType) {
  if (alertType === 'violation') return '#991b1b';
  if (alertType === 'at_risk') return '#92400e';
  return '#1e40af';
}

function getAlertTypeLabel(alertType) {
  if (alertType === 'violation') return '違反';
  if (alertType === 'at_risk') return 'リスク';
  return '閾値割れ';
}

function getAlertTypeBorderColor(alertType) {
  if (alertType === 'violation') return '#dc2626';
  if (alertType === 'at_risk') return '#f59e0b';
  return '#3b82f6';
}

// ===== Authentication State =====
let currentUser = null;
let authToken = null;

// ===== Toast Notification System =====
const Toast = {
  success(message, duration = 3000) {
    Toastify({
      text: message,
      duration,
      gravity: 'top',
      position: 'right',
      style: {
        background: 'linear-gradient(to right, #10b981, #059669)',
        borderRadius: '8px',
        fontFamily: 'var(--font-main)',
        fontWeight: '600'
      },
      close: true,
      stopOnFocus: true
    }).showToast();
  },

  error(message, duration = 5000) {
    Toastify({
      text: message,
      duration,
      gravity: 'top',
      position: 'right',
      style: {
        background: 'linear-gradient(to right, #ef4444, #dc2626)',
        borderRadius: '8px',
        fontFamily: 'var(--font-main)',
        fontWeight: '600'
      },
      close: true,
      stopOnFocus: true
    }).showToast();
  },

  warning(message, duration = 4000) {
    Toastify({
      text: message,
      duration,
      gravity: 'top',
      position: 'right',
      style: {
        background: 'linear-gradient(to right, #f59e0b, #d97706)',
        borderRadius: '8px',
        fontFamily: 'var(--font-main)',
        fontWeight: '600'
      },
      close: true,
      stopOnFocus: true
    }).showToast();
  },

  info(message, duration = 3000) {
    Toastify({
      text: message,
      duration,
      gravity: 'top',
      position: 'right',
      style: {
        background: 'linear-gradient(to right, #3b82f6, #2563eb)',
        borderRadius: '8px',
        fontFamily: 'var(--font-main)',
        fontWeight: '600'
      },
      close: true,
      stopOnFocus: true
    }).showToast();
  }
};

// ===== Paginator Class =====

class Paginator {
  constructor(data, itemsPerPage = 10) {
    this.data = data;
    this.itemsPerPage = itemsPerPage;
    this.currentPage = 1;
  }

  get totalPages() {
    return Math.ceil(this.data.length / this.itemsPerPage);
  }

  get currentData() {
    const start = (this.currentPage - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.data.slice(start, end);
  }

  nextPage() {
    if (this.currentPage < this.totalPages) {
      this.currentPage++;
    }
  }

  prevPage() {
    if (this.currentPage > 1) {
      this.currentPage--;
    }
  }

  goToPage(page) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
    }
  }
}

// ===== DOM Utility Functions (XSS Safe) =====

function createEl(tag, props = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([key, value]) => {
    if (key === 'className') {
      el.className = value;
    } else if (key === 'textContent') {
      el.textContent = value;
    } else if (key.startsWith('data-')) {
      el.setAttribute(key, value);
    } else {
      el[key] = value;
    }
  });
  children.forEach((child) => {
    if (typeof child === 'string') {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  });
  return el;
}

function clearElement(el) {
  if (!el) return; // Null check
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function setText(el, text) {
  // eslint-disable-next-line no-param-reassign
  el.textContent = text;
}

function createBadge(text, variant) {
  return createEl('span', { className: `badge badge-${variant}`, textContent: text });
}

// Helper: Create explanation section
function createExplanationSection(meaning, necessity) {
  const section = createEl('div');
  section.style.cssText =
    'background: #f0f9ff; border-left: 4px solid #3b82f6; padding: 16px; margin-bottom: 24px; border-radius: 8px;';

  const meaningTitle = createEl('h4');
  meaningTitle.style.cssText = 'margin: 0 0 8px 0; color: #1e40af; font-size: 14px;';
  setText(meaningTitle, '📖 意味');

  const meaningText = createEl('p');
  meaningText.style.cssText =
    'margin: 0 0 16px 0; color: #334155; font-size: 13px; line-height: 1.6;';
  setText(meaningText, meaning);

  const necessityTitle = createEl('h4');
  necessityTitle.style.cssText = 'margin: 0 0 8px 0; color: #1e40af; font-size: 14px;';
  setText(necessityTitle, '💡 必要性');

  const necessityText = createEl('p');
  necessityText.style.cssText = 'margin: 0; color: #334155; font-size: 13px; line-height: 1.6;';
  setText(necessityText, necessity);

  section.appendChild(meaningTitle);
  section.appendChild(meaningText);
  section.appendChild(necessityTitle);
  section.appendChild(necessityText);

  return section;
}

// ===== Security Management Data Store =====

const SECURITY_MGMT_STORAGE_KEY = 'itsm_security_management_data';

const defaultSecurityManagementData = {
  policies: [
    {
      id: 'POL-001',
      name: 'パスワードポリシー',
      nist_function: 'PR',
      category: 'Identity Management',
      status: 'active',
      review_date: '2025-01-15'
    },
    {
      id: 'POL-002',
      name: 'データ暗号化標準',
      nist_function: 'PR',
      category: 'Data Security',
      status: 'active',
      review_date: '2024-12-01'
    },
    {
      id: 'POL-003',
      name: 'インシデント対応手順',
      nist_function: 'RS',
      category: 'Response Planning',
      status: 'active',
      review_date: '2025-02-10'
    },
    {
      id: 'POL-004',
      name: 'アクセス制御ポリシー',
      nist_function: 'PR',
      category: 'Access Control',
      status: 'active',
      review_date: '2024-11-20'
    },
    {
      id: 'POL-005',
      name: 'バックアップ・リカバリ計画',
      nist_function: 'RC',
      category: 'Recovery Planning',
      status: 'draft',
      review_date: '2025-01-05'
    },
    {
      id: 'POL-006',
      name: 'ネットワーク分離ポリシー',
      nist_function: 'PR',
      category: 'Network Security',
      status: 'active',
      review_date: '2025-01-20'
    },
    {
      id: 'POL-007',
      name: 'ログ監視・保管規定',
      nist_function: 'DE',
      category: 'Monitoring',
      status: 'active',
      review_date: '2025-02-01'
    },
    {
      id: 'POL-008',
      name: 'クラウドセキュリティ基準',
      nist_function: 'PR',
      category: 'Cloud Security',
      status: 'active',
      review_date: '2024-12-15'
    },
    {
      id: 'POL-009',
      name: 'モバイルデバイス管理',
      nist_function: 'PR',
      category: 'Device Management',
      status: 'active',
      review_date: '2025-01-10'
    },
    {
      id: 'POL-010',
      name: 'サードパーティ評価基準',
      nist_function: 'ID',
      category: 'Supply Chain',
      status: 'active',
      review_date: '2025-02-15'
    },
    {
      id: 'POL-011',
      name: 'セキュリティ意識向上プログラム',
      nist_function: 'GV',
      category: 'Training',
      status: 'active',
      review_date: '2025-01-25'
    },
    {
      id: 'POL-012',
      name: '脆弱性管理手順',
      nist_function: 'DE',
      category: 'Vulnerability Management',
      status: 'draft',
      review_date: '2025-02-20'
    },
    {
      id: 'POL-013',
      name: 'データ分類・取扱基準',
      nist_function: 'GV',
      category: 'Data Governance',
      status: 'active',
      review_date: '2024-12-10'
    },
    {
      id: 'POL-014',
      name: '物理セキュリティ規定',
      nist_function: 'PR',
      category: 'Physical Security',
      status: 'active',
      review_date: '2025-01-30'
    },
    {
      id: 'POL-015',
      name: '事業継続計画（BCP）',
      nist_function: 'RC',
      category: 'Business Continuity',
      status: 'draft',
      review_date: '2025-02-05'
    }
  ],
  risks: [
    {
      id: 'RISK-001',
      name: 'SQLインジェクション脆弱性',
      level: 'Critical',
      impact: 'High',
      probability: 'Medium',
      status: '対策中',
      assignee: '山田太郎'
    },
    {
      id: 'RISK-002',
      name: '古いSSL/TLS証明書',
      level: 'High',
      impact: 'Medium',
      probability: 'High',
      status: '対策済',
      assignee: '佐藤花子'
    },
    {
      id: 'RISK-003',
      name: '不十分なログ監視',
      level: 'Medium',
      impact: 'Medium',
      probability: 'Medium',
      status: '未対応',
      assignee: '鈴木一郎'
    },
    {
      id: 'RISK-004',
      name: 'パスワード強度不足',
      level: 'Medium',
      impact: 'Medium',
      probability: 'High',
      status: '対策中',
      assignee: '田中美咲'
    },
    {
      id: 'RISK-005',
      name: 'バックアップ復旧テスト未実施',
      level: 'High',
      impact: 'High',
      probability: 'Medium',
      status: '未対応',
      assignee: '高橋健太'
    }
  ],
  events: [
    {
      id: 'EVT-001',
      name: '不正ログイン試行検知',
      severity: 'Critical',
      detectedAt: '2025-12-29 14:35:22',
      source: 'IDS/IPS',
      status: '対応中',
      assignee: '山田太郎'
    },
    {
      id: 'EVT-002',
      name: 'マルウェア検知',
      severity: 'High',
      detectedAt: '2025-12-29 13:20:15',
      source: 'EDR',
      status: '調査中',
      assignee: '佐藤花子'
    },
    {
      id: 'EVT-003',
      name: 'データ流出の可能性',
      severity: 'Critical',
      detectedAt: '2025-12-29 12:45:08',
      source: 'DLP',
      status: '対応完了',
      assignee: '鈴木一郎'
    },
    {
      id: 'EVT-004',
      name: '異常なネットワークトラフィック',
      severity: 'Medium',
      detectedAt: '2025-12-29 11:10:33',
      source: 'SIEM',
      status: '監視中',
      assignee: '高橋美咲'
    },
    {
      id: 'EVT-005',
      name: '権限昇格の試み',
      severity: 'High',
      detectedAt: '2025-12-29 10:25:47',
      source: 'IAM監視',
      status: '対応中',
      assignee: '田中健二'
    },
    {
      id: 'EVT-006',
      name: 'DDoS攻撃検知',
      severity: 'Critical',
      detectedAt: '2025-12-29 09:15:30',
      source: 'WAF',
      status: '対応完了',
      assignee: '伊藤美香'
    },
    {
      id: 'EVT-007',
      name: 'フィッシングメール検知',
      severity: 'Medium',
      detectedAt: '2025-12-29 08:40:12',
      source: 'メールゲートウェイ',
      status: '対応完了',
      assignee: '渡辺直樹'
    },
    {
      id: 'EVT-008',
      name: '不正ファイルアクセス',
      severity: 'High',
      detectedAt: '2025-12-29 07:55:45',
      source: 'ファイルサーバー監視',
      status: '調査中',
      assignee: '中村さくら'
    },
    {
      id: 'EVT-009',
      name: 'ポートスキャン検知',
      severity: 'Low',
      detectedAt: '2025-12-29 06:30:18',
      source: 'IDS/IPS',
      status: '監視中',
      assignee: '小林健太'
    },
    {
      id: 'EVT-010',
      name: 'SQLインジェクション試行',
      severity: 'Critical',
      detectedAt: '2025-12-29 05:20:55',
      source: 'WAF',
      status: '対応中',
      assignee: '加藤優子'
    },
    {
      id: 'EVT-011',
      name: 'ランサムウェア検知',
      severity: 'Critical',
      detectedAt: '2025-12-29 04:10:22',
      source: 'EDR',
      status: '対応中',
      assignee: '山本拓也'
    },
    {
      id: 'EVT-012',
      name: 'USBデバイス不正接続',
      severity: 'Medium',
      detectedAt: '2025-12-29 03:05:40',
      source: 'エンドポイント監視',
      status: '対応完了',
      assignee: '木村麻衣'
    },
    {
      id: 'EVT-013',
      name: 'クロスサイトスクリプティング',
      severity: 'High',
      detectedAt: '2025-12-29 02:45:15',
      source: 'WAF',
      status: '調査中',
      assignee: '林太一'
    },
    {
      id: 'EVT-014',
      name: '未承認アプリ実行',
      severity: 'Medium',
      detectedAt: '2025-12-29 01:30:50',
      source: 'アプリケーション制御',
      status: '対応中',
      assignee: '吉田奈々'
    },
    {
      id: 'EVT-015',
      name: 'DNS異常クエリ',
      severity: 'Low',
      detectedAt: '2025-12-29 00:20:33',
      source: 'DNSモニター',
      status: '監視中',
      assignee: '森下隆'
    },
    {
      id: 'EVT-016',
      name: '機密データ転送検知',
      severity: 'High',
      detectedAt: '2025-12-28 23:15:28',
      source: 'DLP',
      status: '対応中',
      assignee: '井上真理'
    },
    {
      id: 'EVT-017',
      name: 'ブルートフォース攻撃',
      severity: 'Critical',
      detectedAt: '2025-12-28 22:10:45',
      source: '認証サーバー',
      status: '対応完了',
      assignee: '松本康介'
    },
    {
      id: 'EVT-018',
      name: 'SSL証明書期限切れ',
      severity: 'Medium',
      detectedAt: '2025-12-28 21:05:12',
      source: '証明書管理',
      status: '対応中',
      assignee: '橋本智子'
    },
    {
      id: 'EVT-019',
      name: '異常な管理者アカウント作成',
      severity: 'High',
      detectedAt: '2025-12-28 20:00:38',
      source: 'Active Directory',
      status: '調査中',
      assignee: '清水大輔'
    },
    {
      id: 'EVT-020',
      name: 'ゼロデイ脆弱性検知',
      severity: 'Critical',
      detectedAt: '2025-12-28 19:45:20',
      source: '脆弱性スキャナー',
      status: '対応中',
      assignee: '藤井恵美'
    }
  ],
  accessRules: [
    {
      id: 'AC-001',
      ruleName: '管理者アクセス制限',
      resourceType: 'Web Portal',
      resourceName: '社内ポータル',
      principal: 'AdminGroup',
      permissions: 'Read/Write/Delete',
      status: 'Active'
    },
    {
      id: 'AC-002',
      ruleName: 'データベース読取専用',
      resourceType: 'Database',
      resourceName: '顧客DB',
      principal: 'AnalystGroup',
      permissions: 'Read',
      status: 'Active'
    },
    {
      id: 'AC-003',
      ruleName: 'ファイアウォールルール',
      resourceType: 'Network',
      resourceName: 'DMZ',
      principal: 'NetOpsTeam',
      permissions: 'Configure',
      status: 'Active'
    },
    {
      id: 'AC-004',
      ruleName: '共有フォルダアクセス',
      resourceType: 'File Share',
      resourceName: '営業共有',
      principal: 'SalesTeam',
      permissions: 'Read/Write',
      status: 'Active'
    },
    {
      id: 'AC-005',
      ruleName: 'API認証設定',
      resourceType: 'API',
      resourceName: 'REST API',
      principal: 'DeveloperGroup',
      permissions: 'Execute',
      status: 'Active'
    },
    {
      id: 'AC-006',
      ruleName: 'VPNアクセス制御',
      resourceType: 'Network',
      resourceName: 'VPN Gateway',
      principal: 'RemoteWorkers',
      permissions: 'Connect',
      status: 'Active'
    },
    {
      id: 'AC-007',
      ruleName: 'バックアップストレージ',
      resourceType: 'Storage',
      resourceName: 'Backup Server',
      principal: 'BackupAdmins',
      permissions: 'Read/Write',
      status: 'Active'
    },
    {
      id: 'AC-008',
      ruleName: 'メール送信制限',
      resourceType: 'Email Server',
      resourceName: 'SMTP Gateway',
      principal: 'AllUsers',
      permissions: 'Send',
      status: 'Active'
    },
    {
      id: 'AC-009',
      ruleName: 'クラウドストレージアクセス',
      resourceType: 'Cloud Storage',
      resourceName: 'S3 Bucket',
      principal: 'DataTeam',
      permissions: 'Read/Write/Delete',
      status: 'Active'
    },
    {
      id: 'AC-010',
      ruleName: 'Kubernetesクラスタ管理',
      resourceType: 'Container',
      resourceName: 'K8s Prod Cluster',
      principal: 'DevOpsTeam',
      permissions: 'Deploy/Scale',
      status: 'Active'
    },
    {
      id: 'AC-011',
      ruleName: 'ログ閲覧権限',
      resourceType: 'Logging',
      resourceName: 'Central Logs',
      principal: 'SecurityTeam',
      permissions: 'Read',
      status: 'Active'
    },
    {
      id: 'AC-012',
      ruleName: 'CI/CDパイプライン',
      resourceType: 'DevOps',
      resourceName: 'Jenkins Server',
      principal: 'Developers',
      permissions: 'Build/Deploy',
      status: 'Active'
    },
    {
      id: 'AC-013',
      ruleName: 'ゲストWi-Fiアクセス',
      resourceType: 'Network',
      resourceName: 'Guest SSID',
      principal: 'Visitors',
      permissions: 'Internet Only',
      status: 'Inactive'
    },
    {
      id: 'AC-014',
      ruleName: 'データウェアハウス',
      resourceType: 'Database',
      resourceName: 'DWH Cluster',
      principal: 'BI Analysts',
      permissions: 'Read/Query',
      status: 'Active'
    },
    {
      id: 'AC-015',
      ruleName: 'テスト環境アクセス',
      resourceType: 'Environment',
      resourceName: 'Test Env',
      principal: 'QA Team',
      permissions: 'Full Access',
      status: 'Active'
    }
  ]
};

let securityManagementState = loadSecurityManagementState();

function cloneSecurityManagementDefaults() {
  return JSON.parse(JSON.stringify(defaultSecurityManagementData));
}

function generateSecurityManagementId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}

function ensureSecurityManagementIds(items, prefix) {
  items.forEach((item) => {
    if (!item.id) {
      // eslint-disable-next-line no-param-reassign
      item.id = generateSecurityManagementId(prefix);
    }
  });
}

function loadSecurityManagementState() {
  const fallback = cloneSecurityManagementDefaults();

  if (typeof localStorage === 'undefined') {
    return fallback;
  }

  try {
    const raw = localStorage.getItem(SECURITY_MGMT_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    const parsed = JSON.parse(raw);
    const normalized = cloneSecurityManagementDefaults();

    if (parsed && typeof parsed === 'object') {
      if (Array.isArray(parsed.policies)) normalized.policies = parsed.policies;
      if (Array.isArray(parsed.risks)) normalized.risks = parsed.risks;
      if (Array.isArray(parsed.events)) normalized.events = parsed.events;
      if (Array.isArray(parsed.accessRules)) normalized.accessRules = parsed.accessRules;
    }

    ensureSecurityManagementIds(normalized.policies, 'POL');
    ensureSecurityManagementIds(normalized.risks, 'RISK');
    ensureSecurityManagementIds(normalized.events, 'EVT');
    ensureSecurityManagementIds(normalized.accessRules, 'AC');

    return normalized;
  } catch (error) {
    console.warn('[Security Management] Failed to load local data:', error);
    return fallback;
  }
}

function persistSecurityManagementState() {
  if (typeof localStorage === 'undefined') {
    return;
  }

  try {
    localStorage.setItem(SECURITY_MGMT_STORAGE_KEY, JSON.stringify(securityManagementState));
  } catch (error) {
    console.warn('[Security Management] Failed to persist local data:', error);
  }
}

function refreshSecurityManagementView() {
  persistSecurityManagementState();
  loadView('security-management');
}

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCurrentDateTimeLocal() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatDateTimeLocal(value) {
  if (!value) return '';
  const sanitized = value.includes('T') ? value : value.replace(' ', 'T');
  const [datePart, timePart = '00:00'] = sanitized.split('T');
  const trimmedTime = timePart.slice(0, 5);
  return `${datePart} ${trimmedTime}:00`;
}

function toDateTimeLocalValue(value) {
  if (!value) return '';
  return value.replace(' ', 'T').slice(0, 16);
}

// ===== API Client (with Authentication) =====

async function apiCall(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };

  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  try {
    const fetchOptions = {
      ...options,
      headers
    };
    if (!fetchOptions.cache && (!fetchOptions.method || fetchOptions.method === 'GET')) {
      fetchOptions.cache = 'no-store';
    }

    const response = await fetch(`${API_BASE}${endpoint}`, fetchOptions);

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('認証が必要です');
    }

    if (response.status === 403) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || errorData.message || '';
      if (
        errorMessage.includes('トークンが無効') ||
        errorMessage.includes('Invalid or expired token')
      ) {
        handleUnauthorized();
        throw new Error('認証が必要です');
      }
      throw new Error(errorData.error || `HTTP Error ${response.status}`);
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP Error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}

// ===== Authentication Functions =====

function handleUnauthorized() {
  logout();
  showLoginScreen();
}

function showLoginScreen() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-container').style.display = 'none';
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-container').style.display = 'flex';

  // Initialize language switcher
  initLanguageSwitcher();
}

function initLanguageSwitcher() {
  const container = document.getElementById('language-switcher-container');
  if (container && typeof window.createLanguageSwitcher === 'function') {
    clearElement(container);
    const switcher = window.createLanguageSwitcher();
    container.appendChild(switcher);
  }
}

async function login(username, password, totpToken = null) {
  try {
    const requestBody = { username, password };
    if (totpToken) {
      requestBody.totpToken = totpToken;
    }

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    const data = await res.json();

    if (!res.ok) {
      // Check if 2FA is required
      if (data.requires2FA) {
        return { success: false, requires2FA: true, username, password };
      }
      throw new Error(data.error || 'ログインに失敗しました');
    }

    authToken = data.token;
    currentUser = data.user;

    localStorage.setItem(TOKEN_KEY, authToken);
    localStorage.setItem(USER_KEY, JSON.stringify(currentUser));

    showApp();
    updateUserInfo();
    loadView('dash');

    return { success: true };
  } catch (error) {
    console.error('Login error:', error);
    return { success: false, error: error.message };
  }
}

function show2FALoginModal(username, password) {
  openModal('二要素認証');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  const container = createEl('div');
  container.style.textAlign = 'center';

  const icon = createEl('div', { textContent: '' });
  icon.style.fontSize = '3rem';
  icon.style.marginBottom = '16px';
  container.appendChild(icon);

  const description = createEl('p', {
    textContent: '認証アプリに表示されている6桁のコードを入力してください。'
  });
  description.style.marginBottom = '24px';
  description.style.color = '#64748b';
  container.appendChild(description);

  const tokenInput = createEl('input', { type: 'text', maxLength: 6 });
  tokenInput.style.width = '180px';
  tokenInput.style.padding = '16px';
  tokenInput.style.fontSize = '1.8rem';
  tokenInput.style.textAlign = 'center';
  tokenInput.style.letterSpacing = '0.5em';
  tokenInput.style.border = '2px solid var(--border-color)';
  tokenInput.style.borderRadius = '8px';
  tokenInput.placeholder = '000000';
  tokenInput.autocomplete = 'one-time-code';
  container.appendChild(tokenInput);

  const backupHint = createEl('p');
  backupHint.style.marginTop = '20px';
  backupHint.style.fontSize = '0.85rem';
  backupHint.style.color = '#94a3b8';
  setText(backupHint, '認証アプリにアクセスできない場合は、バックアップコードを使用できます。');
  container.appendChild(backupHint);

  modalBody.appendChild(container);

  const cancelBtn = createEl('button', {
    className: 'btn-cancel',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  const verifyBtn = createEl('button', {
    className: 'btn-primary',
    textContent: 'ログイン'
  });

  verifyBtn.addEventListener('click', async () => {
    const token = tokenInput.value.trim();
    if (!token) {
      Toast.warning('コードを入力してください');
      return;
    }

    verifyBtn.disabled = true;
    verifyBtn.textContent = '確認中...';

    const result = await login(username, password, token);

    if (result.success) {
      closeModal();
      Toast.success('ログインしました');
    } else {
      Toast.error(result.error || '認証に失敗しました');
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'ログイン';
      tokenInput.value = '';
      tokenInput.focus();
    }
  });

  // Enter key to submit
  tokenInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      verifyBtn.click();
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(verifyBtn);

  // Auto-focus the input
  setTimeout(() => tokenInput.focus(), 100);
}

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  showLoginScreen();
}

async function checkAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const userStr = localStorage.getItem(USER_KEY);

  if (token && userStr) {
    authToken = token;
    currentUser = JSON.parse(userStr);
    try {
      await apiCall('/auth/me');
      showApp();
      updateUserInfo();
      return true;
    } catch (error) {
      logout();
      return false;
    }
  }

  showLoginScreen();
  return false;
}

function updateUserInfo() {
  const userEl = document.getElementById('current-user');
  if (userEl && currentUser) {
    setText(userEl, `${currentUser.username} (${currentUser.role})`);
  }
}

// ===== View Rendering Functions =====

async function loadView(viewId) {
  const container = document.getElementById('main-view');
  const titleEl = document.getElementById('section-title');

  clearElement(container);

  const viewTitles = {
    dash: 'ダッシュボード',
    incidents: 'インシデント管理',
    problems: '問題管理',
    changes: '変更管理',
    releases: 'リリース管理',
    requests: 'サービス要求管理',
    cmdb: '構成管理 (CMDB)',
    sla: 'SLA管理',
    'sla-alerts': 'SLAアラート履歴',
    knowledge: 'ナレッジ管理',
    capacity: 'キャパシティ管理',
    security: 'セキュリティ管理',
    'security-dashboard': 'セキュリティダッシュボード',
    'security-management': 'セキュリティ管理',
    'audit-dashboard': '監査ダッシュボード',
    'audit-logs': '監査ログ',
    'compliance-policies': 'コンプライアンスポリシー',
    'compliance-management': 'コンプライアンス管理',
    'user-settings': 'ユーザー設定',
    settings_general: 'システム基本設定',
    settings_users: 'ユーザー・権限管理',
    settings_notifications: '通知設定',
    settings_reports: 'レポート管理',
    settings_integrations: '統合設定'
  };

  setText(titleEl, viewTitles[viewId] || '統合ダッシュボード');

  try {
    switch (viewId) {
      case 'dash':
        await renderDashboard(container);
        break;
      case 'incidents':
        await renderIncidents(container);
        break;
      case 'problems':
        await renderProblems(container);
        break;
      case 'changes':
        await renderChanges(container);
        break;
      case 'releases':
        await renderReleases(container);
        break;
      case 'requests':
        await renderServiceRequests(container);
        break;
      case 'cmdb':
        await renderCMDB(container);
        break;
      case 'sla':
        await renderSLAManagement(container);
        break;
      case 'sla-alerts':
        await renderSLAAlertHistory(container);
        break;
      case 'knowledge':
        await renderKnowledge(container);
        break;
      case 'capacity':
        await renderCapacity(container);
        break;
      case 'security':
        await renderSecurity(container);
        break;
      case 'security-dashboard':
        await renderSecurityDashboard(container);
        break;
      case 'audit-dashboard':
        await renderAuditDashboard(container);
        break;
      case 'audit-logs':
        await renderAuditLogs(container);
        break;
      case 'security-management':
        await renderSecurityManagement(container);
        break;
      case 'compliance-policies':
        await renderCompliancePolicies(container);
        break;
      case 'compliance-management':
        await renderComplianceManagement(container);
        break;
      case 'user-settings':
        await renderUserSettings(container);
        break;
      case 'settings_general':
        renderSettingsGeneral(container);
        break;
      case 'settings_users':
        renderSettingsUsers(container);
        break;
      case 'settings_notifications':
        await renderSettingsNotifications(container);
        break;
      case 'settings_reports':
        await renderSettingsReports(container);
        break;
      case 'settings_integrations':
        await renderSettingsIntegrations(container);
        break;
      default:
        renderPlaceholder(container, viewTitles[viewId] || viewId);
    }
  } catch (error) {
    console.error('View loading error:', error);
    renderError(container, error.message);
  }
}

// ===== Dashboard View =====

async function renderDashboard(container) {
  try {
    // Header with refresh button
    const headerWrapper = createEl('div');
    headerWrapper.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const title = createEl('h2');
    setText(title, 'ダッシュボード');

    const refreshBtn = createEl('button', { className: 'btn-primary' });
    setText(refreshBtn, '🔄 更新');
    refreshBtn.addEventListener('click', () => loadView('dash'));

    headerWrapper.appendChild(title);
    headerWrapper.appendChild(refreshBtn);
    container.appendChild(headerWrapper);

    // 説明セクション
    const explanation = createExplanationSection(
      'システム全体の稼働状況を一目で把握できる統合監視画面です。KPI（重要業績評価指標）と視覚的なグラフで現状を表示します。',
      'IT運用における意思決定の起点となります。インシデント数、SLA達成率、セキュリティリスクなどの重要指標をリアルタイムで監視し、問題の早期発見と迅速な対応を可能にします。経営層への報告資料としても活用できます。'
    );
    container.appendChild(explanation);

    // 新しいAPIからデータを取得（並列実行）
    const [kpiData, widgetData] = await Promise.all([
      apiCall('/dashboard/kpi'),
      apiCall('/dashboard/widgets')
    ]);

    // 強化版KPIカードセクション
    await renderEnhancedKpiCards(container, kpiData, widgetData);

    // CSF Progress Section
    const csfCard = createEl('div', { className: 'card-large glass' });
    csfCard.style.marginTop = '24px';
    csfCard.style.padding = '32px';
    csfCard.style.borderRadius = '24px';
    csfCard.style.background = 'white';

    const h3 = createEl('h3', { textContent: 'NIST CSF 2.0 実装進捗状況' });
    h3.style.marginBottom = '24px';
    csfCard.appendChild(h3);

    const progressList = createEl('div', { className: 'progress-list' });
    progressList.style.display = 'flex';
    progressList.style.flexDirection = 'column';
    progressList.style.gap = '20px';

    const csfItems = [
      { label: 'GOVERN (統治)', value: kpiData.csf_progress.govern, color: '#4f46e5' },
      { label: 'IDENTIFY (識別)', value: kpiData.csf_progress.identify, color: '#0284c7' },
      { label: 'PROTECT (保護)', value: kpiData.csf_progress.protect, color: '#059669' },
      { label: 'DETECT (検知)', value: kpiData.csf_progress.detect, color: '#dc2626' },
      { label: 'RESPOND (対応)', value: kpiData.csf_progress.respond, color: '#ea580c' },
      { label: 'RECOVER (復旧)', value: kpiData.csf_progress.recover, color: '#7c3aed' }
    ];

    csfItems.forEach((item) => {
      const itemDiv = createEl('div');

      const headerDiv = createEl('div');
      headerDiv.style.display = 'flex';
      headerDiv.style.justifyContent = 'space-between';
      headerDiv.style.marginBottom = '8px';

      headerDiv.appendChild(
        createEl('span', { textContent: item.label, style: 'font-weight: 600;' })
      );
      headerDiv.appendChild(
        createEl('span', { textContent: `${item.value}%`, style: 'font-weight: 700;' })
      );

      const progressBg = createEl('div');
      progressBg.style.width = '100%';
      progressBg.style.height = '8px';
      progressBg.style.background = '#e2e8f0';
      progressBg.style.borderRadius = '4px';
      progressBg.style.overflow = 'hidden';

      const progressBar = createEl('div');
      progressBar.style.width = `${item.value}%`;
      progressBar.style.height = '100%';
      progressBar.style.background = item.color;
      progressBar.style.transition = 'width 0.3s';

      progressBg.appendChild(progressBar);

      itemDiv.appendChild(headerDiv);
      itemDiv.appendChild(progressBg);

      progressList.appendChild(itemDiv);
    });

    csfCard.appendChild(progressList);
    container.appendChild(csfCard);

    // Charts Section（新しいAPIを使用）
    await renderDashboardCharts(container, kpiData);
  } catch (error) {
    renderError(container, 'ダッシュボードデータの読み込みに失敗しました');
  }
}

// ===== 強化版KPIカードセクション =====

async function renderEnhancedKpiCards(container, kpiData, widgetData) {
  // メインKPIグリッド
  const mainGrid = createEl('div', { className: 'grid' });

  // 基本KPIカード
  const basicCards = [
    {
      icon: 'fa-ticket',
      value: kpiData.active_incidents,
      label: '有効なインシデント',
      color: 'rgba(79, 70, 229, 0.1)',
      iconColor: 'var(--accent-blue)',
      detail: widgetData.activeIncidents
        ? `緊急: ${widgetData.activeIncidents.critical} | 高: ${widgetData.activeIncidents.high}`
        : null
    },
    {
      icon: 'fa-check-double',
      value: widgetData.kpi?.slaAchievementRate?.value
        ? `${widgetData.kpi.slaAchievementRate.value}%`
        : `${kpiData.sla_compliance}%`,
      label: 'SLA達成率',
      color: 'rgba(16, 185, 129, 0.1)',
      iconColor: 'var(--accent-green)',
      detail: widgetData.kpi?.slaAchievementRate?.description || null
    },
    {
      icon: 'fa-radiation',
      value: widgetData.vulnerabilityStats?.criticalOpen || kpiData.vulnerabilities.critical,
      label: '未対策の重要脆弱性',
      color: 'rgba(244, 63, 94, 0.1)',
      iconColor: 'var(--accent-red)',
      detail: widgetData.vulnerabilityStats
        ? `高: ${widgetData.vulnerabilityStats.highOpen} | 解決済: ${widgetData.vulnerabilityStats.resolved}`
        : null
    },
    {
      icon: 'fa-shield-virus',
      value: `${kpiData.csf_progress.govern}%`,
      label: 'GOVERN進捗率',
      color: 'rgba(245, 158, 11, 0.1)',
      iconColor: 'var(--accent-orange)',
      detail: null
    }
  ];

  basicCards.forEach((card) => {
    const cardEl = createEl('div', { className: 'stat-card glass' });

    const header = createEl('div', { className: 'stat-header' });
    const iconDiv = createEl('div', { className: 'stat-icon' });
    iconDiv.style.background = card.color;
    iconDiv.style.color = card.iconColor;
    iconDiv.appendChild(createEl('i', { className: `fas ${card.icon}` }));
    header.appendChild(iconDiv);

    cardEl.appendChild(header);
    cardEl.appendChild(
      createEl('div', { className: 'stat-val', textContent: String(card.value) })
    );
    cardEl.appendChild(createEl('div', { className: 'stat-label', textContent: card.label }));

    // 詳細情報を追加
    if (card.detail) {
      const detailEl = createEl('div');
      detailEl.style.cssText = 'font-size: 11px; color: #64748b; margin-top: 8px;';
      detailEl.textContent = card.detail;
      cardEl.appendChild(detailEl);
    }

    mainGrid.appendChild(cardEl);
  });

  container.appendChild(mainGrid);

  // 追加KPIウィジェットセクション
  const additionalGrid = createEl('div');
  additionalGrid.style.cssText =
    'display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; margin-top: 16px;';

  // MTTR（平均修復時間）カード
  if (widgetData.kpi?.mttr) {
    const mttrCard = createKpiDetailCard(
      'fa-clock',
      widgetData.kpi.mttr.value,
      widgetData.kpi.mttr.unit,
      widgetData.kpi.mttr.label,
      widgetData.kpi.mttr.description,
      '#3b82f6'
    );
    additionalGrid.appendChild(mttrCard);
  }

  // MTBF（平均故障間隔）カード
  if (widgetData.kpi?.mtbf) {
    const mtbfCard = createKpiDetailCard(
      'fa-heartbeat',
      widgetData.kpi.mtbf.value,
      widgetData.kpi.mtbf.unit,
      widgetData.kpi.mtbf.label,
      widgetData.kpi.mtbf.description,
      '#10b981'
    );
    additionalGrid.appendChild(mtbfCard);
  }

  // 今週の変更リクエストカード
  if (widgetData.weeklyChanges) {
    const changesCard = createKpiDetailCard(
      'fa-exchange-alt',
      widgetData.weeklyChanges.total,
      '件',
      '今週の変更リクエスト',
      `承認: ${widgetData.weeklyChanges.approved} | 保留: ${widgetData.weeklyChanges.pending} | 実施済: ${widgetData.weeklyChanges.implemented}`,
      '#8b5cf6'
    );
    additionalGrid.appendChild(changesCard);
  }

  // 問題管理カード
  if (widgetData.problemStats) {
    const problemCard = createKpiDetailCard(
      'fa-bug',
      widgetData.problemStats.open,
      '件',
      '未解決の問題',
      `対応中: ${widgetData.problemStats.inProgress} | 解決済: ${widgetData.problemStats.resolved}`,
      '#f59e0b'
    );
    additionalGrid.appendChild(problemCard);
  }

  container.appendChild(additionalGrid);
}

// KPI詳細カード作成ヘルパー関数
function createKpiDetailCard(icon, value, unit, label, description, color) {
  const card = createEl('div', { className: 'stat-card glass' });
  card.style.cssText = 'padding: 20px; border-radius: 16px; background: white;';

  const iconContainer = createEl('div');
  iconContainer.style.cssText = `
    width: 48px; height: 48px; border-radius: 12px;
    background: ${color}15; display: flex; align-items: center;
    justify-content: center; margin-bottom: 12px;
  `;
  const iconEl = createEl('i', { className: `fas ${icon}` });
  iconEl.style.cssText = `font-size: 20px; color: ${color};`;
  iconContainer.appendChild(iconEl);
  card.appendChild(iconContainer);

  const valueContainer = createEl('div');
  valueContainer.style.cssText = 'display: flex; align-items: baseline; gap: 4px; margin-bottom: 4px;';

  const valueEl = createEl('span');
  valueEl.style.cssText = 'font-size: 28px; font-weight: 700; color: #1e293b;';
  valueEl.textContent = String(value);
  valueContainer.appendChild(valueEl);

  const unitEl = createEl('span');
  unitEl.style.cssText = 'font-size: 14px; color: #64748b;';
  unitEl.textContent = unit;
  valueContainer.appendChild(unitEl);

  card.appendChild(valueContainer);

  const labelEl = createEl('div');
  labelEl.style.cssText = 'font-size: 14px; font-weight: 600; color: #334155; margin-bottom: 4px;';
  labelEl.textContent = label;
  card.appendChild(labelEl);

  const descEl = createEl('div');
  descEl.style.cssText = 'font-size: 11px; color: #64748b;';
  descEl.textContent = description;
  card.appendChild(descEl);

  return card;
}

// ===== Dashboard Charts (Chart.js) =====

async function renderDashboardCharts(container, dashboardData) {
  try {
    // 新しいチャートAPIからデータを取得
    const chartData = await apiCall('/dashboard/charts');

    // Charts Container
    const chartsSection = createEl('div', { className: 'charts-section' });
    chartsSection.style.marginTop = '24px';
    chartsSection.style.display = 'grid';
    chartsSection.style.gridTemplateColumns = 'repeat(auto-fit, minmax(500px, 1fr))';
    chartsSection.style.gap = '24px';

    // Chart 1: Incident Trend (Line Chart) - 新しいAPIのデータを使用
    const incidentTrendCard = createEl('div', { className: 'card-large glass' });
    incidentTrendCard.style.padding = '24px';
    incidentTrendCard.style.borderRadius = '24px';
    incidentTrendCard.style.background = 'white';

    const h3Trend = createEl('h3', { textContent: 'インシデント推移（過去7日間）' });
    h3Trend.style.marginBottom = '16px';
    incidentTrendCard.appendChild(h3Trend);

    const canvasTrend = createEl('canvas');
    canvasTrend.style.maxHeight = '300px';
    incidentTrendCard.appendChild(canvasTrend);

    // 新しいAPIからのインシデント推移データを使用
    const incidentTrendData = chartData.incidentTrend || { labels: [], datasets: [] };

    // eslint-disable-next-line no-new
    new Chart(canvasTrend, {
      type: 'line',
      data: {
        labels: incidentTrendData.labels,
        datasets: incidentTrendData.datasets.map((ds) => ({
          ...ds,
          pointRadius: 4,
          pointBackgroundColor: ds.borderColor
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 5
            }
          }
        }
      }
    });

    chartsSection.appendChild(incidentTrendCard);

    // Chart 2: Priority Distribution (Bar Chart) - 新しいAPIのデータを使用
    const priorityCard = createEl('div', { className: 'card-large glass' });
    priorityCard.style.padding = '24px';
    priorityCard.style.borderRadius = '24px';
    priorityCard.style.background = 'white';

    const h3Priority = createEl('h3', { textContent: '優先度別インシデント数' });
    h3Priority.style.marginBottom = '16px';
    priorityCard.appendChild(h3Priority);

    const canvasPriority = createEl('canvas');
    canvasPriority.style.maxHeight = '300px';
    priorityCard.appendChild(canvasPriority);

    // 新しいAPIからの優先度別データを使用
    const priorityData = chartData.incidentsByPriority || { labels: [], datasets: [] };

    // eslint-disable-next-line no-new
    new Chart(canvasPriority, {
      type: 'bar',
      data: priorityData,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });

    chartsSection.appendChild(priorityCard);

    // Chart 3: SLA Achievement (Pie Chart) - 新しいAPIのデータを使用
    const slaCard = createEl('div', { className: 'card-large glass' });
    slaCard.style.padding = '24px';
    slaCard.style.borderRadius = '24px';
    slaCard.style.background = 'white';

    const h3Sla = createEl('h3', { textContent: 'SLA達成状況' });
    h3Sla.style.marginBottom = '16px';
    slaCard.appendChild(h3Sla);

    // SLA概要サマリーを追加
    const slaAchievementData = chartData.slaAchievement || { labels: [], datasets: [], summary: {} };
    if (slaAchievementData.summary) {
      const summaryDiv = createEl('div');
      summaryDiv.style.cssText =
        'display: flex; justify-content: space-around; margin-bottom: 16px; padding: 12px; background: #f8fafc; border-radius: 8px;';

      const summaryItems = [
        { label: '達成', value: slaAchievementData.summary.met, color: '#10b981' },
        { label: 'リスク', value: slaAchievementData.summary.atRisk, color: '#f59e0b' },
        { label: '違反', value: slaAchievementData.summary.violated, color: '#ef4444' }
      ];

      summaryItems.forEach((item) => {
        const itemDiv = createEl('div');
        itemDiv.style.cssText = 'text-align: center;';

        const valueEl = createEl('div');
        valueEl.style.cssText = `font-size: 24px; font-weight: 700; color: ${item.color};`;
        valueEl.textContent = item.value;
        itemDiv.appendChild(valueEl);

        const labelEl = createEl('div');
        labelEl.style.cssText = 'font-size: 12px; color: #64748b;';
        labelEl.textContent = item.label;
        itemDiv.appendChild(labelEl);

        summaryDiv.appendChild(itemDiv);
      });

      slaCard.appendChild(summaryDiv);
    }

    const canvasSla = createEl('canvas');
    canvasSla.style.maxHeight = '250px';
    slaCard.appendChild(canvasSla);

    // eslint-disable-next-line no-new
    new Chart(canvasSla, {
      type: 'doughnut',
      data: {
        labels: slaAchievementData.labels,
        datasets: slaAchievementData.datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        cutout: '50%',
        plugins: {
          legend: {
            position: 'bottom',
            labels: { padding: 16, usePointStyle: true }
          }
        }
      }
    });

    chartsSection.appendChild(slaCard);

    // Chart 4: Incident Status Distribution (Pie Chart) - 新規追加
    const statusCard = createEl('div', { className: 'card-large glass' });
    statusCard.style.padding = '24px';
    statusCard.style.borderRadius = '24px';
    statusCard.style.background = 'white';

    const h3Status = createEl('h3', { textContent: 'インシデントステータス分布' });
    h3Status.style.marginBottom = '16px';
    statusCard.appendChild(h3Status);

    const canvasStatus = createEl('canvas');
    canvasStatus.style.maxHeight = '300px';
    statusCard.appendChild(canvasStatus);

    const statusData = chartData.incidentsByStatus || { labels: [], datasets: [] };

    // eslint-disable-next-line no-new
    new Chart(canvasStatus, {
      type: 'pie',
      data: statusData,
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }
    });

    chartsSection.appendChild(statusCard);

    // Chart 5: Change Request Trend (Line Chart) - 新規追加
    const changeTrendCard = createEl('div', { className: 'card-large glass' });
    changeTrendCard.style.padding = '24px';
    changeTrendCard.style.borderRadius = '24px';
    changeTrendCard.style.background = 'white';

    const h3Change = createEl('h3', { textContent: '変更リクエスト推移（過去7日間）' });
    h3Change.style.marginBottom = '16px';
    changeTrendCard.appendChild(h3Change);

    const canvasChange = createEl('canvas');
    canvasChange.style.maxHeight = '300px';
    changeTrendCard.appendChild(canvasChange);

    const changeTrendData = chartData.changeTrend || { labels: [], datasets: [] };

    // eslint-disable-next-line no-new
    new Chart(canvasChange, {
      type: 'line',
      data: {
        labels: changeTrendData.labels,
        datasets: changeTrendData.datasets.map((ds) => ({
          ...ds,
          pointRadius: 4,
          pointBackgroundColor: ds.borderColor
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            display: true,
            position: 'top'
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });

    chartsSection.appendChild(changeTrendCard);

    // Chart 6: CSF Progress (Radar Chart)
    const csfRadarCard = createEl('div', { className: 'card-large glass' });
    csfRadarCard.style.padding = '24px';
    csfRadarCard.style.borderRadius = '24px';
    csfRadarCard.style.background = 'white';

    const h3Radar = createEl('h3', { textContent: 'NIST CSF 2.0 機能別進捗' });
    h3Radar.style.marginBottom = '16px';
    csfRadarCard.appendChild(h3Radar);

    const canvasRadar = createEl('canvas');
    canvasRadar.style.maxHeight = '300px';
    csfRadarCard.appendChild(canvasRadar);

    // eslint-disable-next-line no-new
    new Chart(canvasRadar, {
      type: 'radar',
      data: {
        labels: ['GOVERN', 'IDENTIFY', 'PROTECT', 'DETECT', 'RESPOND', 'RECOVER'],
        datasets: [
          {
            label: '進捗率 (%)',
            data: [
              dashboardData.csf_progress.govern,
              dashboardData.csf_progress.identify,
              dashboardData.csf_progress.protect,
              dashboardData.csf_progress.detect,
              dashboardData.csf_progress.respond,
              dashboardData.csf_progress.recover
            ],
            backgroundColor: 'rgba(79, 70, 229, 0.2)',
            borderColor: '#4f46e5',
            borderWidth: 2,
            pointBackgroundColor: '#4f46e5',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            pointRadius: 5
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: {
              stepSize: 20,
              callback(value) {
                return `${value}%`;
              }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });

    chartsSection.appendChild(csfRadarCard);

    container.appendChild(chartsSection);

    // SLA Widget Section
    await renderSlaWidget(container);
  } catch (error) {
    console.error('Charts rendering error:', error);
  }
}

// ===== SLA Dashboard Widget =====

async function renderSlaWidget(container) {
  try {
    // Fetch SLA statistics (used for future feature expansion)
    // eslint-disable-next-line no-unused-vars
    const slaStats = await apiCall('/sla-statistics');
    const slaList = await apiCall('/sla-agreements');
    const agreements = slaList.data || slaList || [];

    // SLA Widget Container
    const slaSection = createEl('div', { className: 'sla-widget-section' });
    slaSection.style.marginTop = '24px';
    slaSection.style.display = 'grid';
    slaSection.style.gridTemplateColumns = 'repeat(auto-fit, minmax(400px, 1fr))';
    slaSection.style.gap = '24px';

    // SLA Status Overview Card
    const overviewCard = createEl('div', { className: 'card-large glass' });
    overviewCard.style.padding = '24px';
    overviewCard.style.borderRadius = '24px';
    overviewCard.style.background = 'white';

    const h3Overview = createEl('h3', { textContent: 'SLA達成状況サマリー' });
    h3Overview.style.marginBottom = '16px';
    overviewCard.appendChild(h3Overview);

    // Status counts
    const statusCounts = {
      met: agreements.filter((a) => a.status === 'Met').length,
      atRisk: agreements.filter((a) => a.status === 'At-Risk').length,
      violated: agreements.filter((a) => a.status === 'Violated' || a.status === 'Breached').length
    };
    const total = agreements.length;

    // Status Cards Grid
    const statusGrid = createEl('div');
    statusGrid.style.display = 'grid';
    statusGrid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    statusGrid.style.gap = '16px';
    statusGrid.style.marginBottom = '20px';

    const statusItems = [
      {
        label: '達成',
        value: statusCounts.met,
        color: '#16a34a',
        bgColor: 'rgba(22, 163, 74, 0.1)',
        icon: 'fa-check-circle'
      },
      {
        label: 'リスク',
        value: statusCounts.atRisk,
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.1)',
        icon: 'fa-exclamation-triangle'
      },
      {
        label: '違反',
        value: statusCounts.violated,
        color: '#dc2626',
        bgColor: 'rgba(220, 38, 38, 0.1)',
        icon: 'fa-times-circle'
      }
    ];

    statusItems.forEach((item) => {
      const statusCard = createEl('div');
      statusCard.style.cssText = `
        background: ${item.bgColor};
        border-radius: 12px;
        padding: 16px;
        text-align: center;
        border: 1px solid ${item.color}20;
      `;

      const iconEl = createEl('i', { className: `fas ${item.icon}` });
      iconEl.style.cssText = `font-size: 24px; color: ${item.color}; margin-bottom: 8px;`;
      statusCard.appendChild(iconEl);

      const valueEl = createEl('div');
      valueEl.style.cssText = `font-size: 28px; font-weight: 700; color: ${item.color};`;
      valueEl.textContent = item.value;
      statusCard.appendChild(valueEl);

      const labelEl = createEl('div');
      labelEl.style.cssText = 'font-size: 14px; color: #64748b; font-weight: 500;';
      labelEl.textContent = item.label;
      statusCard.appendChild(labelEl);

      statusGrid.appendChild(statusCard);
    });

    overviewCard.appendChild(statusGrid);

    // Doughnut Chart for Status Distribution
    const chartContainer = createEl('div');
    chartContainer.style.height = '200px';
    chartContainer.style.display = 'flex';
    chartContainer.style.justifyContent = 'center';

    const canvasDoughnut = createEl('canvas');
    canvasDoughnut.style.maxWidth = '200px';
    chartContainer.appendChild(canvasDoughnut);

    if (total > 0) {
      // eslint-disable-next-line no-new
      new Chart(canvasDoughnut, {
        type: 'doughnut',
        data: {
          labels: ['達成', 'リスク', '違反'],
          datasets: [
            {
              data: [statusCounts.met, statusCounts.atRisk, statusCounts.violated],
              backgroundColor: ['#16a34a', '#f59e0b', '#dc2626'],
              borderWidth: 0
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          cutout: '60%',
          plugins: {
            legend: {
              position: 'bottom',
              labels: { padding: 16, usePointStyle: true }
            }
          }
        }
      });
    }

    overviewCard.appendChild(chartContainer);

    // Overall compliance rate
    const complianceRate = total > 0 ? Math.round((statusCounts.met / total) * 100) : 0;
    const complianceDiv = createEl('div');
    complianceDiv.style.cssText =
      'text-align: center; margin-top: 16px; padding-top: 16px; border-top: 1px solid #e2e8f0;';
    complianceDiv.innerHTML = `
      <div style="font-size: 14px; color: #64748b;">全体SLA達成率</div>
      <div style="font-size: 32px; font-weight: 700; color: ${getRateColor(complianceRate)};">${complianceRate}%</div>
    `;
    overviewCard.appendChild(complianceDiv);

    slaSection.appendChild(overviewCard);

    // SLA Details List Card
    const detailsCard = createEl('div', { className: 'card-large glass' });
    detailsCard.style.padding = '24px';
    detailsCard.style.borderRadius = '24px';
    detailsCard.style.background = 'white';
    detailsCard.style.maxHeight = '500px';
    detailsCard.style.overflowY = 'auto';

    const h3Details = createEl('h3', { textContent: 'SLA契約一覧（達成率順）' });
    h3Details.style.marginBottom = '16px';
    detailsCard.appendChild(h3Details);

    // Sort by achievement rate (lowest first to highlight issues)
    const sortedAgreements = [...agreements].sort(
      (a, b) => (a.achievement_rate || 0) - (b.achievement_rate || 0)
    );

    if (sortedAgreements.length === 0) {
      const emptyMsg = createEl('div');
      emptyMsg.style.cssText = 'text-align: center; color: #64748b; padding: 40px;';
      emptyMsg.textContent = 'SLA契約が登録されていません';
      detailsCard.appendChild(emptyMsg);
    } else {
      sortedAgreements.slice(0, 10).forEach((sla) => {
        const slaItem = createEl('div');
        slaItem.style.cssText = `
          padding: 12px 16px;
          border-radius: 8px;
          margin-bottom: 8px;
          background: #f8fafc;
          border-left: 4px solid ${getStatusColor(sla.status)};
        `;

        const headerDiv = createEl('div');
        headerDiv.style.cssText =
          'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;';

        const nameDiv = createEl('div');
        nameDiv.style.cssText = 'font-weight: 600; color: #1e293b;';
        nameDiv.textContent = sla.service_name;

        const statusBadge = createEl('span');
        statusBadge.style.cssText = `
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
          background: ${getStatusBgColor(sla.status)};
          color: ${getStatusTextColor(sla.status)};
        `;
        statusBadge.textContent = getStatusLabel(sla.status);

        headerDiv.appendChild(nameDiv);
        headerDiv.appendChild(statusBadge);
        slaItem.appendChild(headerDiv);

        // Metric and progress
        const metricDiv = createEl('div');
        metricDiv.style.cssText = 'font-size: 13px; color: #64748b; margin-bottom: 8px;';
        metricDiv.textContent = `${sla.metric_name}: 目標 ${sla.target_value} / 実績 ${sla.actual_value || '-'}`;
        slaItem.appendChild(metricDiv);

        // Progress bar
        const progressBg = createEl('div');
        progressBg.style.cssText =
          'width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden;';

        const progressBar = createEl('div');
        const rate = sla.achievement_rate || 0;
        progressBar.style.cssText = `
          width: ${Math.min(rate, 100)}%;
          height: 100%;
          background: ${getRateColor(rate)};
          transition: width 0.3s;
        `;
        progressBg.appendChild(progressBar);
        slaItem.appendChild(progressBg);

        // Achievement rate label
        const rateLabel = createEl('div');
        rateLabel.style.cssText =
          'font-size: 12px; color: #64748b; text-align: right; margin-top: 4px;';
        rateLabel.textContent = `達成率: ${rate}%`;
        slaItem.appendChild(rateLabel);

        detailsCard.appendChild(slaItem);
      });

      // Link to full SLA management
      if (agreements.length > 10) {
        const moreLink = createEl('div');
        moreLink.style.cssText = 'text-align: center; margin-top: 16px;';
        const linkBtn = createEl('button', { className: 'btn-secondary' });
        linkBtn.textContent = `全${agreements.length}件を表示 →`;
        linkBtn.addEventListener('click', () => loadView('sla-management'));
        moreLink.appendChild(linkBtn);
        detailsCard.appendChild(moreLink);
      }
    }

    slaSection.appendChild(detailsCard);
    container.appendChild(slaSection);
  } catch (error) {
    console.error('SLA Widget rendering error:', error);
    // SLA widget is optional, don't block the dashboard
  }
}

// ===== Incidents View =====

async function renderIncidents(container) {
  try {
    const response = await apiCall('/incidents');
    const allIncidents = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
    const section = createEl('div');

    // State management
    let filteredData = allIncidents;
    let sortKey = 'created_at';
    let sortDirection = 'desc';
    const paginator = new Paginator(filteredData, 10);

    // Render table function
    function renderTable() {
      // Clear previous table
      const existingTable = section.querySelector('.table-wrapper');
      if (existingTable) {
        section.removeChild(existingTable);
      }
      const existingPagination = section.querySelector('.pagination-wrapper');
      if (existingPagination) {
        section.removeChild(existingPagination);
      }

      // Table wrapper
      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });

      // Table Header
      const thead = createEl('thead');
      const headerRow = createEl('tr');
      const headers = [
        { text: 'チケットID', key: 'ticket_id' },
        { text: 'タイトル', key: 'title' },
        { text: '優先度', key: 'priority' },
        { text: 'ステータス', key: 'status' },
        { text: 'セキュリティ', key: 'is_security_incident' },
        { text: '作成日時', key: 'created_at' },
        { text: '操作', key: 'actions', sortable: false }
      ];

      headers.forEach((header) => {
        const th = createEl('th', { textContent: header.text });
        if (header.sortable !== false) {
          th.style.cursor = 'pointer';
          th.addEventListener('click', () => {
            sortKey = header.key;
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            filteredData = sortData(filteredData, sortKey, sortDirection);
            paginator.data = filteredData;
            renderTable();
          });
          if (sortKey === header.key) {
            const arrow = createEl('span', { textContent: sortDirection === 'asc' ? ' ▲' : ' ▼' });
            th.appendChild(arrow);
          }
        } else {
          th.style.cursor = 'default';
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Table Body
      const tbody = createEl('tbody');
      const { currentData } = paginator;
      currentData.forEach((inc) => {
        const row = createEl('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => showIncidentDetail(inc));

        row.appendChild(createEl('td', { textContent: inc.ticket_id }));
        row.appendChild(createEl('td', { textContent: inc.title }));

        const priorityBadge = createEl('span', {
          className: `badge badge-${inc.priority.toLowerCase()}`,
          textContent: inc.priority
        });
        const priorityCell = createEl('td');
        priorityCell.appendChild(priorityBadge);
        row.appendChild(priorityCell);

        const statusBadge = createEl('span', {
          className: 'badge badge-info',
          textContent: inc.status
        });
        const statusCell = createEl('td');
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        row.appendChild(createEl('td', { textContent: inc.is_security_incident ? 'Yes' : 'No' }));
        row.appendChild(
          createEl('td', { textContent: new Date(inc.created_at).toLocaleString('ja-JP') })
        );

        const actionCell = createEl('td');
        actionCell.style.cssText = 'display: flex; gap: 8px; align-items: center;';

        const deleteBtn = createEl('button', { className: 'btn-icon' });
        deleteBtn.type = 'button';
        deleteBtn.style.cssText =
          'background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;';
        setText(deleteBtn, '削除');
        deleteBtn.title = '削除';
        deleteBtn.addEventListener('click', (event) => {
          event.stopPropagation();
          showDeleteConfirmDialog('インシデント', inc.ticket_id, inc.title, async () => {
            await deleteIncident(inc.ticket_id);
          });
        });
        actionCell.appendChild(deleteBtn);
        row.appendChild(actionCell);

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);

      // Pagination
      const paginationWrapper = createEl('div');
      paginationWrapper.className = 'pagination-wrapper';
      paginationWrapper.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 16px;';

      const prevBtn = createEl('button', { textContent: '← 前へ', className: 'btn-secondary' });
      prevBtn.disabled = paginator.currentPage === 1;
      prevBtn.addEventListener('click', () => {
        paginator.prevPage();
        renderTable();
      });

      const pageInfo = createEl('span');
      setText(
        pageInfo,
        `${paginator.currentPage} / ${paginator.totalPages} ページ (全 ${filteredData.length} 件)`
      );

      const nextBtn = createEl('button', { textContent: '次へ →', className: 'btn-secondary' });
      nextBtn.disabled = paginator.currentPage === paginator.totalPages;
      nextBtn.addEventListener('click', () => {
        paginator.nextPage();
        renderTable();
      });

      paginationWrapper.appendChild(prevBtn);
      paginationWrapper.appendChild(pageInfo);
      paginationWrapper.appendChild(nextBtn);
      section.appendChild(paginationWrapper);
    }

    // Header
    const header = createEl('div');
    header.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;';

    const h2 = createEl('h2', { textContent: 'インシデント一覧' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.cssText = 'display: flex; gap: 12px;';

    const createBtn = createEl('button', {
      className: 'btn-primary',
      textContent: '新規インシデント作成'
    });
    createBtn.addEventListener('click', () => showCreateIncidentModal());

    const csvBtn = createEl('button', { className: 'btn-export', textContent: 'CSV' });
    csvBtn.addEventListener('click', () => exportToCSV(filteredData, 'incidents.csv'));

    const excelBtn = createEl('button', { className: 'btn-export', textContent: 'Excel' });
    excelBtn.addEventListener('click', () => exportToExcel(filteredData, 'incidents.xlsx'));

    const pdfBtn = createEl('button', { className: 'btn-export', textContent: 'PDF' });
    pdfBtn.addEventListener('click', () =>
      exportToPDF(filteredData, 'incidents.pdf', { title: 'インシデント一覧' })
    );

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(csvBtn);
    btnGroup.appendChild(excelBtn);
    btnGroup.appendChild(pdfBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    // 説明セクション
    const explanation = createExplanationSection(
      'サービス中断や障害など、通常のサービス運用から外れた事象（インシデント）を記録・追跡する機能です。ITILのインシデント管理プロセスに準拠しています。',
      'サービス復旧時間の短縮とユーザー影響の最小化が目的です。インシデントの優先度付け、担当者割り当て、進捗追跡により、組織的な対応が可能になります。過去のインシデント分析により、再発防止策の策定にも貢献します。'
    );
    section.appendChild(explanation);

    // Search and filter row
    const controlRow = createEl('div');
    controlRow.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const searchInput = createEl('input', {
      type: 'text',
      placeholder: '検索... (タイトル、チケットID、ステータス)'
    });
    searchInput.style.cssText =
      'padding: 8px; width: 300px; border: 1px solid #ccc; border-radius: 4px;';
    searchInput.addEventListener('input', (e) => {
      filteredData = searchData(allIncidents, e.target.value, [
        'ticket_id',
        'title',
        'status',
        'priority'
      ]);
      paginator.data = filteredData;
      paginator.currentPage = 1;
      renderTable();
    });

    const pageSizeSelect = createEl('select');
    pageSizeSelect.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
    [10, 20, 50].forEach((size) => {
      const option = createEl('option', { value: String(size), textContent: `${size}件表示` });
      pageSizeSelect.appendChild(option);
    });
    pageSizeSelect.addEventListener('change', (e) => {
      paginator.itemsPerPage = parseInt(e.target.value, 10);
      paginator.currentPage = 1;
      renderTable();
    });

    controlRow.appendChild(searchInput);
    controlRow.appendChild(pageSizeSelect);
    section.appendChild(controlRow);

    // Initial render
    renderTable();
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'インシデントデータの読み込みに失敗しました');
  }
}

function showIncidentDetail(incident) {
  openIncidentDetailModal(incident);
}

function showCreateIncidentModal() {
  openCreateIncidentModal();
}

// ===== Changes View =====

async function renderChanges(container) {
  try {
    const response = await apiCall('/changes');
    const allChanges = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
    const section = createEl('div');

    let filteredData = allChanges;
    let sortKey = 'created_at';
    let sortDirection = 'desc';
    const paginator = new Paginator(filteredData, 10);

    function renderTable() {
      const existingTable = section.querySelector('.table-wrapper');
      if (existingTable) section.removeChild(existingTable);
      const existingPagination = section.querySelector('.pagination-wrapper');
      if (existingPagination) section.removeChild(existingPagination);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });

      const thead = createEl('thead');
      const headerRow = createEl('tr');
      const headers = [
        { text: 'RFC ID', key: 'rfc_id' },
        { text: 'タイトル', key: 'title' },
        { text: 'ステータス', key: 'status' },
        { text: '影響度', key: 'impact_level' },
        { text: '申請者', key: 'requester' },
        { text: '承認者', key: 'approver' },
        { text: '作成日', key: 'created_at' }
      ];

      headers.forEach((header) => {
        const th = createEl('th', { textContent: header.text });
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          sortKey = header.key;
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          filteredData = sortData(filteredData, sortKey, sortDirection);
          paginator.data = filteredData;
          renderTable();
        });
        if (sortKey === header.key) {
          const arrow = createEl('span', { textContent: sortDirection === 'asc' ? ' ▲' : ' ▼' });
          th.appendChild(arrow);
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = createEl('tbody');
      paginator.currentData.forEach((change) => {
        const row = createEl('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => openRFCDetailModal(change));

        row.appendChild(createEl('td', { textContent: change.rfc_id }));
        row.appendChild(createEl('td', { textContent: change.title }));

        const statusBadge = createEl('span', {
          className: `badge badge-${change.status.toLowerCase()}`,
          textContent: change.status
        });
        const statusCell = createEl('td');
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        row.appendChild(createEl('td', { textContent: change.impact_level || 'N/A' }));
        row.appendChild(createEl('td', { textContent: change.requester }));
        row.appendChild(createEl('td', { textContent: change.approver || '-' }));
        row.appendChild(
          createEl('td', { textContent: new Date(change.created_at).toLocaleString('ja-JP') })
        );

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);

      const paginationWrapper = createEl('div');
      paginationWrapper.className = 'pagination-wrapper';
      paginationWrapper.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 16px;';

      const prevBtn = createEl('button', { textContent: '← 前へ', className: 'btn-secondary' });
      prevBtn.disabled = paginator.currentPage === 1;
      prevBtn.addEventListener('click', () => {
        paginator.prevPage();
        renderTable();
      });

      const pageInfo = createEl('span');
      setText(
        pageInfo,
        `${paginator.currentPage} / ${paginator.totalPages} ページ (全 ${filteredData.length} 件)`
      );

      const nextBtn = createEl('button', { textContent: '次へ →', className: 'btn-secondary' });
      nextBtn.disabled = paginator.currentPage === paginator.totalPages;
      nextBtn.addEventListener('click', () => {
        paginator.nextPage();
        renderTable();
      });

      paginationWrapper.appendChild(prevBtn);
      paginationWrapper.appendChild(pageInfo);
      paginationWrapper.appendChild(nextBtn);
      section.appendChild(paginationWrapper);
    }

    const header = createEl('div');
    header.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;';

    const h2 = createEl('h2', { textContent: '変更要求一覧 (RFC)' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.cssText = 'display: flex; gap: 12px;';

    const createBtn = createEl('button', { className: 'btn-primary', textContent: '新規RFC作成' });
    createBtn.addEventListener('click', () => openCreateRFCModal());

    const csvBtn = createEl('button', { className: 'btn-export', textContent: 'CSV' });
    csvBtn.addEventListener('click', () => exportToCSV(filteredData, 'changes.csv'));

    const excelBtn = createEl('button', { className: 'btn-export', textContent: 'Excel' });
    excelBtn.addEventListener('click', () => exportToExcel(filteredData, 'changes.xlsx'));

    const pdfBtn = createEl('button', { className: 'btn-export', textContent: 'PDF' });
    pdfBtn.addEventListener('click', () =>
      exportToPDF(filteredData, 'changes.pdf', { title: '変更管理一覧' })
    );

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(csvBtn);
    btnGroup.appendChild(excelBtn);
    btnGroup.appendChild(pdfBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    // 説明セクション
    const explanation = createExplanationSection(
      'システム構成やサービスに対する変更要求（RFC: Request for Change）を管理し、承認プロセスを実行する機能です。計画的な変更管理を実現します。',
      '無計画な変更によるサービス障害を防止します。変更の影響評価、承認フロー、ロールバック計画により、リスクを最小化しながら必要な改善を実施できます。変更履歴の記録は監査対応やトラブルシューティングにも不可欠です。'
    );
    section.appendChild(explanation);

    const controlRow = createEl('div');
    controlRow.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const searchInput = createEl('input', {
      type: 'text',
      placeholder: '検索... (RFC ID、タイトル、申請者)'
    });
    searchInput.style.cssText =
      'padding: 8px; width: 300px; border: 1px solid #ccc; border-radius: 4px;';
    searchInput.addEventListener('input', (e) => {
      filteredData = searchData(allChanges, e.target.value, [
        'rfc_id',
        'title',
        'requester',
        'status'
      ]);
      paginator.data = filteredData;
      paginator.currentPage = 1;
      renderTable();
    });

    const pageSizeSelect = createEl('select');
    pageSizeSelect.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
    [10, 20, 50].forEach((size) => {
      const option = createEl('option', { value: String(size), textContent: `${size}件表示` });
      pageSizeSelect.appendChild(option);
    });
    pageSizeSelect.addEventListener('change', (e) => {
      paginator.itemsPerPage = parseInt(e.target.value, 10);
      paginator.currentPage = 1;
      renderTable();
    });

    controlRow.appendChild(searchInput);
    controlRow.appendChild(pageSizeSelect);
    section.appendChild(controlRow);

    renderTable();
    container.appendChild(section);
  } catch (error) {
    renderError(container, '変更要求データの読み込みに失敗しました');
  }
}

// ===== CMDB View =====

async function renderCMDB(container) {
  try {
    const response = await apiCall('/assets');
    const allAssets = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
    const section = createEl('div');

    let filteredData = allAssets;
    let sortKey = 'last_updated';
    let sortDirection = 'desc';
    const paginator = new Paginator(filteredData, 10);

    function renderTable() {
      const existingTable = section.querySelector('.table-wrapper');
      if (existingTable) section.removeChild(existingTable);
      const existingPagination = section.querySelector('.pagination-wrapper');
      if (existingPagination) section.removeChild(existingPagination);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });

      const thead = createEl('thead');
      const headerRow = createEl('tr');
      const headers = [
        { text: '資産タグ', key: 'asset_tag' },
        { text: '名称', key: 'name' },
        { text: 'タイプ', key: 'type' },
        { text: '重要度', key: 'criticality' },
        { text: 'ステータス', key: 'status' },
        { text: '最終更新', key: 'last_updated' }
      ];

      headers.forEach((header) => {
        const th = createEl('th', { textContent: header.text });
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          sortKey = header.key;
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          filteredData = sortData(filteredData, sortKey, sortDirection);
          paginator.data = filteredData;
          renderTable();
        });
        if (sortKey === header.key) {
          const arrow = createEl('span', { textContent: sortDirection === 'asc' ? ' ▲' : ' ▼' });
          th.appendChild(arrow);
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = createEl('tbody');
      paginator.currentData.forEach((asset) => {
        const row = createEl('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => openEditAssetModal(asset));

        row.appendChild(createEl('td', { textContent: asset.asset_tag }));
        row.appendChild(createEl('td', { textContent: asset.name }));
        row.appendChild(createEl('td', { textContent: asset.type }));

        const criticalityCell = createEl('td');
        const stars = '★'.repeat(asset.criticality) + '☆'.repeat(5 - asset.criticality);
        criticalityCell.textContent = stars;
        row.appendChild(criticalityCell);

        const statusBadge = createEl('span', {
          className: 'badge badge-success',
          textContent: asset.status
        });
        const statusCell = createEl('td');
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        row.appendChild(
          createEl('td', { textContent: new Date(asset.last_updated).toLocaleString('ja-JP') })
        );

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);

      const paginationWrapper = createEl('div');
      paginationWrapper.className = 'pagination-wrapper';
      paginationWrapper.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 16px;';

      const prevBtn = createEl('button', { textContent: '← 前へ', className: 'btn-secondary' });
      prevBtn.disabled = paginator.currentPage === 1;
      prevBtn.addEventListener('click', () => {
        paginator.prevPage();
        renderTable();
      });

      const pageInfo = createEl('span');
      setText(
        pageInfo,
        `${paginator.currentPage} / ${paginator.totalPages} ページ (全 ${filteredData.length} 件)`
      );

      const nextBtn = createEl('button', { textContent: '次へ →', className: 'btn-secondary' });
      nextBtn.disabled = paginator.currentPage === paginator.totalPages;
      nextBtn.addEventListener('click', () => {
        paginator.nextPage();
        renderTable();
      });

      paginationWrapper.appendChild(prevBtn);
      paginationWrapper.appendChild(pageInfo);
      paginationWrapper.appendChild(nextBtn);
      section.appendChild(paginationWrapper);
    }

    const header = createEl('div');
    header.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;';

    const h2 = createEl('h2', { textContent: '構成管理データベース (CMDB)' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.cssText = 'display: flex; gap: 12px;';

    const createBtn = createEl('button', { className: 'btn-primary', textContent: '新規作成' });
    createBtn.addEventListener('click', openCreateAssetModal);

    const csvBtn = createEl('button', { className: 'btn-export', textContent: 'CSV' });
    csvBtn.addEventListener('click', () => exportToCSV(filteredData, 'cmdb_assets.csv'));

    const excelBtn = createEl('button', { className: 'btn-export', textContent: 'Excel' });
    excelBtn.addEventListener('click', () => exportToExcel(filteredData, 'cmdb_assets.xlsx'));

    const pdfBtn = createEl('button', { className: 'btn-export', textContent: 'PDF' });
    pdfBtn.addEventListener('click', () =>
      exportToPDF(filteredData, 'cmdb_assets.pdf', { title: 'CMDB資産一覧' })
    );

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(csvBtn);
    btnGroup.appendChild(excelBtn);
    btnGroup.appendChild(pdfBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    // 説明セクション
    const explanation = createExplanationSection(
      '構成管理データベース（CMDB）としてIT資産の構成情報を一元管理する機能です。サーバー、ネットワーク機器、エンドポイント、クラウドリソースなどを登録します。',
      'IT資産の全体像把握と変更影響分析の基盤となります。資産の依存関係を理解することで、変更やインシデント発生時の影響範囲を迅速に特定できます。ライセンス管理、コスト配分、セキュリティ管理の土台としても機能します。'
    );
    section.appendChild(explanation);

    const controlRow = createEl('div');
    controlRow.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const searchInput = createEl('input', {
      type: 'text',
      placeholder: '検索... (資産タグ、名称、タイプ)'
    });
    searchInput.style.cssText =
      'padding: 8px; width: 300px; border: 1px solid #ccc; border-radius: 4px;';
    searchInput.addEventListener('input', (e) => {
      filteredData = searchData(allAssets, e.target.value, ['asset_tag', 'name', 'type', 'status']);
      paginator.data = filteredData;
      paginator.currentPage = 1;
      renderTable();
    });

    const pageSizeSelect = createEl('select');
    pageSizeSelect.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
    [10, 20, 50].forEach((size) => {
      const option = createEl('option', { value: String(size), textContent: `${size}件表示` });
      pageSizeSelect.appendChild(option);
    });
    pageSizeSelect.addEventListener('change', (e) => {
      paginator.itemsPerPage = parseInt(e.target.value, 10);
      paginator.currentPage = 1;
      renderTable();
    });

    controlRow.appendChild(searchInput);
    controlRow.appendChild(pageSizeSelect);
    section.appendChild(controlRow);

    renderTable();
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'CMDB データの読み込みに失敗しました');
  }
}

// ===== Security View (NIST CSF 2.0) =====

async function renderSecurity(container) {
  try {
    const response = await apiCall('/vulnerabilities');
    const allVulnerabilities = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
    const section = createEl('div');

    const h2 = createEl('h2', { textContent: '脆弱性管理' });
    h2.style.marginBottom = '24px';
    section.appendChild(h2);

    // Table with pagination
    let filteredData = allVulnerabilities;
    let sortKey = 'detection_date';
    let sortDirection = 'desc';
    const paginator = new Paginator(filteredData, 10);

    function renderTable() {
      const existingTable = section.querySelector('.table-wrapper');
      if (existingTable) section.removeChild(existingTable);
      const existingPagination = section.querySelector('.pagination-wrapper');
      if (existingPagination) section.removeChild(existingPagination);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });

      const thead = createEl('thead');
      const headerRow = createEl('tr');
      const headers = [
        { text: '脆弱性ID', key: 'vulnerability_id' },
        { text: 'タイトル', key: 'title' },
        { text: '深刻度', key: 'severity' },
        { text: 'CVSSスコア', key: 'cvss_score' },
        { text: '影響資産', key: 'affected_asset' },
        { text: 'ステータス', key: 'status' },
        { text: '検出日', key: 'detection_date' },
        { text: '操作', key: null }
      ];

      headers.forEach((header) => {
        const th = createEl('th', { textContent: header.text });
        if (header.key) {
          th.style.cursor = 'pointer';
          th.addEventListener('click', () => {
            sortKey = header.key;
            sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
            filteredData = sortData(filteredData, sortKey, sortDirection);
            paginator.data = filteredData;
            renderTable();
          });
          if (sortKey === header.key) {
            const arrow = createEl('span', { textContent: sortDirection === 'asc' ? ' ▲' : ' ▼' });
            th.appendChild(arrow);
          }
        } else {
          th.style.textAlign = 'center';
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = createEl('tbody');
      paginator.currentData.forEach((vuln) => {
        const row = createEl('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => openEditVulnerabilityModal(vuln));

        row.appendChild(createEl('td', { textContent: vuln.vulnerability_id }));
        row.appendChild(createEl('td', { textContent: vuln.title }));

        const severityBadge = createEl('span', {
          className: `badge badge-${vuln.severity.toLowerCase()}`,
          textContent: vuln.severity
        });
        const severityCell = createEl('td');
        severityCell.appendChild(severityBadge);
        row.appendChild(severityCell);

        row.appendChild(createEl('td', { textContent: vuln.cvss_score.toFixed(1) }));
        row.appendChild(createEl('td', { textContent: vuln.affected_asset }));

        const statusBadge = createEl('span', {
          className: 'badge badge-info',
          textContent: vuln.status
        });
        const statusCell = createEl('td');
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        row.appendChild(
          createEl('td', { textContent: new Date(vuln.detection_date).toLocaleDateString('ja-JP') })
        );

        // Action buttons
        const actionCell = createEl('td');
        actionCell.style.textAlign = 'center';
        const actionButtonsContainer = createEl('div');
        actionButtonsContainer.style.cssText = 'display: flex; gap: 8px; justify-content: center;';

        const editBtn = createEl('button');
        editBtn.type = 'button';
        editBtn.style.cssText = `
          background: #3b82f6;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: background 0.2s;
        `;
        editBtn.addEventListener('mouseenter', () => {
          editBtn.style.background = '#2563eb';
        });
        editBtn.addEventListener('mouseleave', () => {
          editBtn.style.background = '#3b82f6';
        });
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openEditVulnerabilityModal(vuln);
        });
        const editIcon = createEl('i', { className: 'fas fa-edit' });
        const editText = createEl('span');
        setText(editText, '編集');
        editBtn.appendChild(editIcon);
        editBtn.appendChild(editText);

        const deleteBtn = createEl('button');
        deleteBtn.type = 'button';
        deleteBtn.style.cssText = `
          background: #ef4444;
          color: white;
          border: none;
          padding: 6px 12px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: background 0.2s;
        `;
        deleteBtn.addEventListener('mouseenter', () => {
          deleteBtn.style.background = '#dc2626';
        });
        deleteBtn.addEventListener('mouseleave', () => {
          deleteBtn.style.background = '#ef4444';
        });
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          const vulnId = vuln.vulnerability_id || vuln.id;
          showDeleteConfirmDialog('脆弱性', vulnId, vuln.title, async () => {
            await deleteVulnerability(vulnId);
          });
        });
        const deleteIcon = createEl('i', { className: 'fas fa-trash' });
        const deleteText = createEl('span');
        setText(deleteText, '削除');
        deleteBtn.appendChild(deleteIcon);
        deleteBtn.appendChild(deleteText);

        actionButtonsContainer.appendChild(editBtn);
        actionButtonsContainer.appendChild(deleteBtn);
        actionCell.appendChild(actionButtonsContainer);
        row.appendChild(actionCell);

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);

      const paginationWrapper = createEl('div');
      paginationWrapper.className = 'pagination-wrapper';
      paginationWrapper.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 16px;';

      const prevBtn = createEl('button', { textContent: '← 前へ', className: 'btn-secondary' });
      prevBtn.disabled = paginator.currentPage === 1;
      prevBtn.addEventListener('click', () => {
        paginator.prevPage();
        renderTable();
      });

      const pageInfo = createEl('span');
      setText(
        pageInfo,
        `${paginator.currentPage} / ${paginator.totalPages} ページ (全 ${filteredData.length} 件)`
      );

      const nextBtn = createEl('button', { textContent: '次へ →', className: 'btn-secondary' });
      nextBtn.disabled = paginator.currentPage === paginator.totalPages;
      nextBtn.addEventListener('click', () => {
        paginator.nextPage();
        renderTable();
      });

      paginationWrapper.appendChild(prevBtn);
      paginationWrapper.appendChild(pageInfo);
      paginationWrapper.appendChild(nextBtn);
      section.appendChild(paginationWrapper);
    }

    const tableHeader = createEl('div');
    tableHeader.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const btnGroup = createEl('div');
    btnGroup.style.cssText = 'display: flex; gap: 12px;';

    const createBtn = createEl('button', { className: 'btn-primary', textContent: '新規作成' });
    createBtn.addEventListener('click', () => openCreateVulnerabilityModal());

    const csvBtn = createEl('button', { className: 'btn-export', textContent: 'CSV' });
    csvBtn.addEventListener('click', () => exportToCSV(filteredData, 'vulnerabilities.csv'));

    const excelBtn = createEl('button', { className: 'btn-export', textContent: 'Excel' });
    excelBtn.addEventListener('click', () => exportToExcel(filteredData, 'vulnerabilities.xlsx'));

    const pdfBtn = createEl('button', { className: 'btn-export', textContent: 'PDF' });
    pdfBtn.addEventListener('click', () =>
      exportToPDF(filteredData, 'vulnerabilities.pdf', { title: '脆弱性管理一覧' })
    );

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(csvBtn);
    btnGroup.appendChild(excelBtn);
    btnGroup.appendChild(pdfBtn);
    tableHeader.appendChild(btnGroup);
    section.appendChild(tableHeader);

    // 説明セクション
    const explanation = createExplanationSection(
      'システムやアプリケーションの脆弱性を管理し、CVSS評価に基づいて対策の優先順位を決定する機能です。',
      'サイバー攻撃のリスクを最小化します。脆弱性の早期発見、影響範囲の特定、パッチ適用の計画により、セキュリティインシデントを予防します。コンプライアンス対応やセキュリティ監査でも必須の管理項目です。'
    );
    section.appendChild(explanation);

    const controlRow = createEl('div');
    controlRow.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const searchInput = createEl('input', {
      type: 'text',
      placeholder: '検索... (脆弱性ID、タイトル、資産)'
    });
    searchInput.style.cssText =
      'padding: 8px; width: 300px; border: 1px solid #ccc; border-radius: 4px;';
    searchInput.addEventListener('input', (e) => {
      filteredData = searchData(allVulnerabilities, e.target.value, [
        'vulnerability_id',
        'title',
        'affected_asset',
        'severity'
      ]);
      paginator.data = filteredData;
      paginator.currentPage = 1;
      renderTable();
    });

    const pageSizeSelect = createEl('select');
    pageSizeSelect.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
    [10, 20, 50].forEach((size) => {
      const option = createEl('option', { value: String(size), textContent: `${size}件表示` });
      pageSizeSelect.appendChild(option);
    });
    pageSizeSelect.addEventListener('change', (e) => {
      paginator.itemsPerPage = parseInt(e.target.value, 10);
      paginator.currentPage = 1;
      renderTable();
    });

    controlRow.appendChild(searchInput);
    controlRow.appendChild(pageSizeSelect);
    section.appendChild(controlRow);

    renderTable();
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'セキュリティデータの読み込みに失敗しました');
  }
}

// ===== Security Dashboard View =====

async function renderSecurityDashboard(container) {
  let refreshInterval = null;

  async function loadDashboardData() {
    try {
      // Header with refresh button
      const headerRow = createEl('div');
      headerRow.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

      const title = createEl('h2');
      setText(title, 'セキュリティダッシュボード');

      const refreshBtn = createEl('button', { className: 'btn-primary' });
      setText(refreshBtn, '🔄 更新');
      refreshBtn.addEventListener('click', () => {
        clearElement(container);
        loadDashboardData();
      });

      headerRow.appendChild(title);
      headerRow.appendChild(refreshBtn);
      container.appendChild(headerRow);

      // Explanation section
      const explanation = createExplanationSection(
        'セキュリティ状況をリアルタイムで監視し、アラート、監査ログ、ユーザーアクティビティを統合的に表示します。',
        'セキュリティインシデントの早期発見と迅速な対応を可能にします。異常なアクティビティや脅威を検知し、NIST CSF 2.0のDETECT（検知）機能を実現します。'
      );
      container.appendChild(explanation);

      // NIST CSF 2.0 Framework Card
      const nistCard = createEl('div');
      nistCard.style.cssText =
        'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 24px; border-radius: 16px; margin-bottom: 32px; box-shadow: 0 8px 16px rgba(0,0,0,0.1);';

      const nistTitle = createEl('h3');
      nistTitle.style.cssText =
        'color: white; margin: 0 0 12px 0; font-size: 18px; font-weight: 700;';
      setText(nistTitle, '🛡️ NIST CSF 2.0 セキュリティフレームワーク');
      nistCard.appendChild(nistTitle);

      const nistDesc = createEl('p');
      nistDesc.style.cssText =
        'color: rgba(255,255,255,0.95); margin: 0 0 24px 0; font-size: 14px; line-height: 1.6;';
      setText(
        nistDesc,
        'NIST CSF 2.0の6つの機能（GOVERN, IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER）に基づく包括的なセキュリティ管理を実施します。各機能が連携し、組織のサイバーセキュリティ態勢を強化します。'
      );
      nistCard.appendChild(nistDesc);

      const functionsList = createEl('div');
      functionsList.style.cssText =
        'display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;';

      const csfFunctions = [
        {
          name: 'GOVERN',
          desc: '統制',
          icon: '👔',
          meaning: '組織全体の方針・責任・意思決定を定義',
          necessity: '方針が曖昧だと全施策が分散する',
          importance: '継続的な投資判断と監査対応の基盤'
        },
        {
          name: 'IDENTIFY',
          desc: '識別',
          icon: '🔍',
          meaning: '資産・リスク・脅威を可視化して把握',
          necessity: '対象が不明では守る優先度が決められない',
          importance: 'リスク低減計画の起点となる'
        },
        {
          name: 'PROTECT',
          desc: '防御',
          icon: '🛡️',
          meaning: 'アクセス制御や教育で被害を予防',
          necessity: '被害発生前に防げる領域が最大',
          importance: 'インシデント発生率を抑制する'
        },
        {
          name: 'DETECT',
          desc: '検知',
          icon: '🎯',
          meaning: '異常兆候を素早く検出して把握',
          necessity: '早期検知で被害拡大を防止',
          importance: '対応速度と精度を左右する'
        },
        {
          name: 'RESPOND',
          desc: '対応',
          icon: '⚡',
          meaning: '封じ込め・通報・復旧計画を実行',
          necessity: '対応が遅いと損害が増大する',
          importance: '信頼と事業継続性を守る'
        },
        {
          name: 'RECOVER',
          desc: '復旧',
          icon: '🔄',
          meaning: '事業機能を回復し再発防止を実施',
          necessity: '復旧が遅いと事業損失が拡大',
          importance: 'レジリエンスを高める'
        }
      ];

      csfFunctions.forEach((func) => {
        const funcCard = createEl('div');
        funcCard.style.cssText =
          'background: rgba(255,255,255,0.1); padding: 12px; border-radius: 8px; text-align: center;';
        const funcIcon = createEl('div');
        funcIcon.style.cssText = 'font-size: 24px; margin-bottom: 8px;';
        setText(funcIcon, func.icon);
        funcCard.appendChild(funcIcon);
        const funcName = createEl('div');
        funcName.style.cssText =
          'color: white; font-weight: 600; font-size: 13px; margin-bottom: 4px;';
        setText(funcName, func.name);
        funcCard.appendChild(funcName);
        const funcDesc = createEl('div');
        funcDesc.style.cssText = 'color: rgba(255,255,255,0.85); font-size: 11px;';
        setText(funcDesc, func.desc);
        funcCard.appendChild(funcDesc);

        const detailBox = createEl('div');
        detailBox.style.cssText =
          'margin-top: 8px; text-align: left; font-size: 12px; line-height: 1.5; color: rgba(255,255,255,0.9);';
        const meaningLine = createEl('div');
        setText(meaningLine, `・意味: ${func.meaning}`);
        const necessityLine = createEl('div');
        setText(necessityLine, `・必要性: ${func.necessity}`);
        const importanceLine = createEl('div');
        setText(importanceLine, `・重要性: ${func.importance}`);
        detailBox.appendChild(meaningLine);
        detailBox.appendChild(necessityLine);
        detailBox.appendChild(importanceLine);
        funcCard.appendChild(detailBox);
        functionsList.appendChild(funcCard);
      });

      nistCard.appendChild(functionsList);
      container.appendChild(nistCard);

      // Fetch dashboard data
      const dashboardData = await apiCall('/security/dashboard/overview');

      // KPI Cards Section
      const kpiGrid = createEl('div', { className: 'grid' });
      kpiGrid.style.marginBottom = '24px';

      const kpiCards = [
        {
          icon: 'fa-shield-alt',
          value: dashboardData.total_alerts || 0,
          label: '総アラート数',
          color: 'rgba(59, 130, 246, 0.1)',
          iconColor: 'var(--accent-blue)',
          detail: `Critical: ${dashboardData.alerts_by_severity?.critical || 0} | High: ${dashboardData.alerts_by_severity?.high || 0}`
        },
        {
          icon: 'fa-exclamation-triangle',
          value: dashboardData.failed_logins_24h || 0,
          label: 'ログイン失敗（24時間）',
          color: 'rgba(239, 68, 68, 0.1)',
          iconColor: 'var(--accent-red)',
          detail: '過去24時間'
        },
        {
          icon: 'fa-users',
          value: dashboardData.active_users || 0,
          label: 'アクティブユーザー',
          color: 'rgba(16, 185, 129, 0.1)',
          iconColor: 'var(--accent-green)',
          detail: '現在ログイン中'
        },
        {
          icon: 'fa-bell',
          value: dashboardData.open_security_incidents || 0,
          label: '未解決セキュリティインシデント',
          color: 'rgba(245, 158, 11, 0.1)',
          iconColor: 'var(--accent-orange)',
          detail: '対応が必要'
        },
        {
          icon: 'fa-bug',
          value: dashboardData.critical_vulnerabilities || 0,
          label: '重要脆弱性',
          color: 'rgba(244, 63, 94, 0.1)',
          iconColor: 'var(--accent-red)',
          detail: '未対応の重要な問題'
        }
      ];

      kpiCards.forEach((card) => {
        const cardEl = createEl('div', { className: 'stat-card glass' });

        const header = createEl('div', { className: 'stat-header' });
        const iconDiv = createEl('div', { className: 'stat-icon' });
        iconDiv.style.background = card.color;
        iconDiv.style.color = card.iconColor;
        iconDiv.appendChild(createEl('i', { className: `fas ${card.icon}` }));
        header.appendChild(iconDiv);

        cardEl.appendChild(header);
        cardEl.appendChild(
          createEl('div', { className: 'stat-val', textContent: String(card.value) })
        );
        cardEl.appendChild(createEl('div', { className: 'stat-label', textContent: card.label }));

        const detailEl = createEl('div');
        detailEl.style.cssText = 'font-size: 11px; color: #64748b; margin-top: 4px;';
        setText(detailEl, card.detail);
        cardEl.appendChild(detailEl);

        kpiGrid.appendChild(cardEl);
      });

      container.appendChild(kpiGrid);

      // Security Alerts Panel
      await renderSecurityAlertsPanel(container);

      // Charts Section
      await renderSecurityCharts(container, dashboardData);
    } catch (error) {
      renderError(container, 'セキュリティダッシュボードデータの読み込みに失敗しました');
    }
  }

  // Initial load
  clearElement(container);
  await loadDashboardData();

  // Set up auto-refresh every 30 seconds
  refreshInterval = setInterval(async () => {
    try {
      // Only refresh alerts panel to avoid full page reload
      const alertsPanel = container.querySelector('.security-alerts-panel');
      if (alertsPanel) {
        const parent = alertsPanel.parentNode;
        parent.removeChild(alertsPanel);
        await renderSecurityAlertsPanel(parent);
      }
    } catch (error) {
      console.error('Auto-refresh error:', error);
    }
  }, 30000);

  // Cleanup on view change
  const cleanup = () => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
      refreshInterval = null;
    }
  };

  // Store cleanup function
  // eslint-disable-next-line no-param-reassign
  container.dataset.cleanup = 'securityDashboard';
  window.securityDashboardCleanup = cleanup;
}

// ===== Audit Dashboard View =====

async function renderAuditDashboard(container) {
  try {
    const section = createEl('div');

    const headerRow = createEl('div');
    headerRow.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
    const title = createEl('h2', { textContent: '監査ダッシュボード' });
    const actionGroup = createEl('div');
    actionGroup.style.cssText = 'display: flex; gap: 12px; flex-wrap: wrap;';

    const refreshBtn = createEl('button', { className: 'btn-primary', textContent: '🔄 更新' });
    refreshBtn.addEventListener('click', () => loadView('audit-dashboard'));
    const logsBtn = createEl('button', { className: 'btn-secondary', textContent: '監査ログ' });
    logsBtn.addEventListener('click', () => loadView('audit-logs'));
    const complianceBtn = createEl('button', {
      className: 'btn-secondary',
      textContent: 'コンプライアンス管理'
    });
    complianceBtn.addEventListener('click', () => loadView('compliance-management'));

    actionGroup.appendChild(refreshBtn);
    actionGroup.appendChild(logsBtn);
    actionGroup.appendChild(complianceBtn);
    headerRow.appendChild(title);
    headerRow.appendChild(actionGroup);
    section.appendChild(headerRow);

    const explanation = createExplanationSection(
      '監査計画、指摘事項、証跡収集状況を統合して可視化するダッシュボードです。',
      '監査対応の優先度を明確にし、証跡の欠落や是正遅延を早期に検知して対応品質を高めます。'
    );
    section.appendChild(explanation);

    const audits = [
      {
        audit_id: 'AUD-2026-01',
        name: 'ISO 27001 内部監査',
        scope: '情報セキュリティ統制',
        start: '2026-01-15',
        end: '2026-01-20',
        status: '計画中',
        owner: '内部監査室'
      },
      {
        audit_id: 'AUD-2025-12',
        name: '個人情報保護監査',
        scope: '顧客データ管理',
        start: '2025-12-05',
        end: '2025-12-12',
        status: '実施中',
        owner: 'GRCチーム'
      },
      {
        audit_id: 'AUD-2025-11',
        name: 'BCP実効性レビュー',
        scope: '事業継続計画',
        start: '2025-11-10',
        end: '2025-11-12',
        status: '完了',
        owner: 'リスク管理室'
      },
      {
        audit_id: 'AUD-2025-10',
        name: 'サードパーティ監査',
        scope: '委託先評価',
        start: '2025-10-18',
        end: '2025-10-25',
        status: '完了',
        owner: '調達部'
      }
    ];

    const findings = [
      {
        finding_id: 'FND-204',
        title: '特権IDの四半期レビュー未実施',
        severity: 'High',
        status: '対応中',
        owner: 'IT運用部',
        due_date: '2026-01-10'
      },
      {
        finding_id: 'FND-198',
        title: '監査証跡の保持期間不足',
        severity: 'Medium',
        status: '未対応',
        owner: 'セキュリティ運用部',
        due_date: '2026-01-05'
      },
      {
        finding_id: 'FND-173',
        title: 'バックアップ復旧テストの記録不足',
        severity: 'Low',
        status: '対応中',
        owner: 'IT基盤部',
        due_date: '2025-12-30'
      },
      {
        finding_id: 'FND-165',
        title: '外部委託先のセキュリティ評価未更新',
        severity: 'High',
        status: '完了',
        owner: '調達部',
        due_date: '2025-12-01'
      }
    ];

    const evidenceItems = [
      {
        control: 'AC-2',
        evidence: 'アクセス権棚卸し記録',
        status: '承認済み',
        owner: 'IT運用部',
        updated: '2025-12-20'
      },
      {
        control: 'IR-4',
        evidence: 'インシデント対応訓練レポート',
        status: 'レビュー待ち',
        owner: 'セキュリティ運用部',
        updated: '2025-12-10'
      },
      {
        control: 'CP-9',
        evidence: 'バックアップ復旧テスト結果',
        status: '収集中',
        owner: 'IT基盤部',
        updated: '2025-11-28'
      },
      {
        control: 'SA-9',
        evidence: '委託先評価チェックリスト',
        status: '未提出',
        owner: '調達部',
        updated: '2025-11-15'
      }
    ];

    const coverageItems = [
      {
        label: 'ISO 27001',
        value: 82,
        target: 90,
        color: '#2563eb'
      },
      {
        label: 'NIST CSF',
        value: 76,
        target: 85,
        color: '#16a34a'
      },
      {
        label: 'PCI DSS',
        value: 68,
        target: 80,
        color: '#f97316'
      },
      {
        label: '個人情報保護',
        value: 88,
        target: 92,
        color: '#7c3aed'
      }
    ];

    const openFindings = findings.filter((item) => item.status !== '完了');
    const closedFindings = findings.filter((item) => item.status === '完了');
    const remediationRate = Math.round(
      (closedFindings.length / Math.max(findings.length, 1)) * 100
    );

    const evidenceApproved = evidenceItems.filter((item) => item.status === '承認済み');
    const evidenceRate = Math.round(
      (evidenceApproved.length / Math.max(evidenceItems.length, 1)) * 100
    );

    const activeAudits = audits.filter((audit) => audit.status === '実施中');
    const plannedAudits = audits.filter((audit) => audit.status === '計画中');
    const upcomingAudits = audits
      .filter((audit) => audit.status !== '完了')
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    const nextAudit = upcomingAudits[0];
    const daysUntil = nextAudit
      ? Math.max(
          0,
          Math.ceil((new Date(nextAudit.start).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
        )
      : null;

    const kpiGrid = createEl('div', { className: 'grid' });
    const kpiCards = [
      {
        icon: 'fa-clipboard-check',
        value: activeAudits.length,
        label: '進行中の監査',
        color: 'rgba(59, 130, 246, 0.1)',
        iconColor: 'var(--accent-blue)',
        detail: `計画中: ${plannedAudits.length}件`
      },
      {
        icon: 'fa-exclamation-triangle',
        value: openFindings.length,
        label: '未対応指摘事項',
        color: 'rgba(239, 68, 68, 0.1)',
        iconColor: 'var(--accent-red)',
        detail: `全指摘: ${findings.length}件`
      },
      {
        icon: 'fa-folder-open',
        value: `${evidenceRate}%`,
        label: '証跡充足率',
        color: 'rgba(16, 185, 129, 0.1)',
        iconColor: 'var(--accent-green)',
        detail: `承認済み: ${evidenceApproved.length}件`
      },
      {
        icon: 'fa-calendar-alt',
        value: nextAudit ? `${daysUntil}日` : '-',
        label: '次回監査まで',
        color: 'rgba(245, 158, 11, 0.1)',
        iconColor: 'var(--accent-orange)',
        detail: nextAudit ? nextAudit.name : '予定なし'
      },
      {
        icon: 'fa-check-circle',
        value: `${remediationRate}%`,
        label: '是正完了率',
        color: 'rgba(99, 102, 241, 0.1)',
        iconColor: 'var(--accent-blue)',
        detail: `完了: ${closedFindings.length}件`
      }
    ];

    kpiCards.forEach((card) => {
      const cardEl = createEl('div', { className: 'stat-card glass' });

      const header = createEl('div', { className: 'stat-header' });
      const iconDiv = createEl('div', { className: 'stat-icon' });
      iconDiv.style.background = card.color;
      iconDiv.style.color = card.iconColor;
      iconDiv.appendChild(createEl('i', { className: `fas ${card.icon}` }));
      header.appendChild(iconDiv);

      cardEl.appendChild(header);
      cardEl.appendChild(
        createEl('div', { className: 'stat-val', textContent: String(card.value) })
      );
      cardEl.appendChild(createEl('div', { className: 'stat-label', textContent: card.label }));

      const detailEl = createEl('div');
      detailEl.style.cssText = 'font-size: 11px; color: #64748b; margin-top: 4px;';
      setText(detailEl, card.detail);
      cardEl.appendChild(detailEl);

      kpiGrid.appendChild(cardEl);
    });

    section.appendChild(kpiGrid);

    const tabNav = createEl('div');
    tabNav.style.cssText =
      'display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; margin: 8px 0 24px; flex-wrap: wrap;';
    const auditTabs = [
      { id: 'coverage', label: '監査カバレッジ' },
      { id: 'schedule', label: '直近の監査スケジュール' },
      { id: 'findings', label: '重点指摘事項' },
      { id: 'evidence', label: '証跡収集状況' }
    ];
    let activeAuditTab = 'coverage';

    const detailContainer = createEl('div');
    const detailCardStyle = 'padding: 24px; border-radius: 16px; background: white;';

    const scheduleBadgeMap = {
      計画中: 'pending',
      実施中: 'info',
      完了: 'success'
    };
    const evidenceBadgeMap = {
      承認済み: 'success',
      レビュー待ち: 'info',
      収集中: 'warning',
      未提出: 'rejected'
    };

    function buildCoverageCard() {
      const coverageCard = createEl('div', { className: 'card-large glass' });
      coverageCard.style.cssText = detailCardStyle;
      coverageCard.appendChild(createEl('h3', { textContent: '監査カバレッジ' }));
      const coverageList = createEl('div');
      coverageList.style.cssText =
        'display: flex; flex-direction: column; gap: 14px; margin-top: 16px;';

      coverageItems.forEach((item) => {
        const itemRow = createEl('div');
        const header = createEl('div');
        header.style.cssText = 'display: flex; justify-content: space-between; font-size: 13px;';
        header.appendChild(createEl('span', { textContent: item.label }));
        header.appendChild(
          createEl('span', { textContent: `${item.value}% (目標 ${item.target}%)` })
        );
        itemRow.appendChild(header);

        const bar = createEl('div');
        bar.style.cssText =
          'width: 100%; height: 8px; background: #e2e8f0; border-radius: 6px; overflow: hidden; margin-top: 6px;';
        const fill = createEl('div');
        fill.style.cssText = `height: 100%; width: ${item.value}%; background: ${item.color};`;
        bar.appendChild(fill);
        itemRow.appendChild(bar);
        coverageList.appendChild(itemRow);
      });

      coverageCard.appendChild(coverageList);
      return coverageCard;
    }

    function buildScheduleCard() {
      const scheduleCard = createEl('div', { className: 'card-large glass' });
      scheduleCard.style.cssText = detailCardStyle;
      scheduleCard.appendChild(createEl('h3', { textContent: '直近の監査スケジュール' }));
      const scheduleTableWrapper = createEl('div');
      scheduleTableWrapper.className = 'table-wrapper';
      scheduleTableWrapper.style.marginTop = '12px';
      const scheduleTable = createEl('table', { className: 'data-table' });
      const scheduleHead = createEl('thead');
      const scheduleHeadRow = createEl('tr');
      ['監査ID', '監査名', '期間', '状況'].forEach((text) => {
        scheduleHeadRow.appendChild(createEl('th', { textContent: text }));
      });
      scheduleHead.appendChild(scheduleHeadRow);
      scheduleTable.appendChild(scheduleHead);
      const scheduleBody = createEl('tbody');

      audits.forEach((audit) => {
        const row = createEl('tr');
        row.appendChild(createEl('td', { textContent: audit.audit_id }));
        row.appendChild(createEl('td', { textContent: audit.name }));
        row.appendChild(createEl('td', { textContent: `${audit.start} 〜 ${audit.end}` }));
        const statusCell = createEl('td');
        statusCell.appendChild(createBadge(audit.status, scheduleBadgeMap[audit.status] || 'info'));
        row.appendChild(statusCell);
        scheduleBody.appendChild(row);
      });

      scheduleTable.appendChild(scheduleBody);
      scheduleTableWrapper.appendChild(scheduleTable);
      scheduleCard.appendChild(scheduleTableWrapper);
      return scheduleCard;
    }

    function buildFindingsCard() {
      const findingsCard = createEl('div', { className: 'card-large glass' });
      findingsCard.style.cssText = detailCardStyle;
      findingsCard.appendChild(createEl('h3', { textContent: '重点指摘事項' }));
      const findingsTableWrapper = createEl('div');
      findingsTableWrapper.className = 'table-wrapper';
      findingsTableWrapper.style.marginTop = '12px';
      const findingsTable = createEl('table', { className: 'data-table' });
      const findingsHead = createEl('thead');
      const findingsHeadRow = createEl('tr');
      ['ID', '指摘内容', '重要度', '期限'].forEach((text) => {
        findingsHeadRow.appendChild(createEl('th', { textContent: text }));
      });
      findingsHead.appendChild(findingsHeadRow);
      findingsTable.appendChild(findingsHead);
      const findingsBody = createEl('tbody');
      findings.forEach((finding) => {
        const row = createEl('tr');
        row.appendChild(createEl('td', { textContent: finding.finding_id }));
        row.appendChild(createEl('td', { textContent: finding.title }));
        const severityCell = createEl('td');
        const severityClass = `badge-${finding.severity.toLowerCase()}`;
        severityCell.appendChild(
          createEl('span', { className: `badge ${severityClass}`, textContent: finding.severity })
        );
        row.appendChild(severityCell);
        row.appendChild(createEl('td', { textContent: finding.due_date }));
        findingsBody.appendChild(row);
      });
      findingsTable.appendChild(findingsBody);
      findingsTableWrapper.appendChild(findingsTable);
      findingsCard.appendChild(findingsTableWrapper);
      return findingsCard;
    }

    function buildEvidenceCard() {
      const evidenceCard = createEl('div', { className: 'card-large glass' });
      evidenceCard.style.cssText = detailCardStyle;
      evidenceCard.appendChild(createEl('h3', { textContent: '証跡収集状況' }));
      const evidenceSummary = createEl('p');
      evidenceSummary.style.cssText = 'margin: 8px 0 16px; color: #475569;';
      setText(
        evidenceSummary,
        `最新の証跡レビューで ${evidenceApproved.length}/${evidenceItems.length} 件が承認済みです。`
      );
      evidenceCard.appendChild(evidenceSummary);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });
      const thead = createEl('thead');
      const evidenceHeaderRow = createEl('tr');
      ['管理項目', '証跡', '更新日', '担当', 'ステータス'].forEach((text) => {
        evidenceHeaderRow.appendChild(createEl('th', { textContent: text }));
      });
      thead.appendChild(evidenceHeaderRow);
      table.appendChild(thead);

      const tbody = createEl('tbody');
      evidenceItems.forEach((item) => {
        const row = createEl('tr');
        row.appendChild(createEl('td', { textContent: item.control }));
        row.appendChild(createEl('td', { textContent: item.evidence }));
        row.appendChild(createEl('td', { textContent: item.updated }));
        row.appendChild(createEl('td', { textContent: item.owner }));
        const statusCell = createEl('td');
        statusCell.appendChild(createBadge(item.status, evidenceBadgeMap[item.status] || 'info'));
        row.appendChild(statusCell);
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      evidenceCard.appendChild(tableWrapper);
      return evidenceCard;
    }

    function renderAuditTabContent() {
      clearElement(detailContainer);
      let card = null;
      if (activeAuditTab === 'coverage') {
        card = buildCoverageCard();
      } else if (activeAuditTab === 'schedule') {
        card = buildScheduleCard();
      } else if (activeAuditTab === 'findings') {
        card = buildFindingsCard();
      } else if (activeAuditTab === 'evidence') {
        card = buildEvidenceCard();
      }
      if (card) {
        detailContainer.appendChild(card);
      }
    }

    auditTabs.forEach((tab) => {
      const tabBtn = createEl('button');
      tabBtn.textContent = tab.label;
      tabBtn.style.cssText =
        'padding: 12px 20px; background: none; border: none; cursor: pointer; font-size: 14px; font-weight: 600; color: #64748b; border-bottom: 2px solid transparent; transition: all 0.2s;';
      if (tab.id === activeAuditTab) {
        tabBtn.style.color = '#3b82f6';
        tabBtn.style.borderBottomColor = '#3b82f6';
      }
      tabBtn.addEventListener('click', () => {
        activeAuditTab = tab.id;
        Array.from(tabNav.children).forEach((btn) => {
          // eslint-disable-next-line no-param-reassign
          btn.style.color = '#64748b';
          // eslint-disable-next-line no-param-reassign
          btn.style.borderBottomColor = 'transparent';
        });
        tabBtn.style.color = '#3b82f6';
        tabBtn.style.borderBottomColor = '#3b82f6';
        renderAuditTabContent();
      });
      tabNav.appendChild(tabBtn);
    });

    section.appendChild(tabNav);
    renderAuditTabContent();
    section.appendChild(detailContainer);
    container.appendChild(section);
  } catch (error) {
    renderError(container, '監査ダッシュボードデータの読み込みに失敗しました');
  }
}

// Audit Logs View (Enhanced)
async function renderAuditLogs(container) {
  try {
    const section = createEl('div');

    // State management
    let currentPage = 1;
    const itemsPerPage = 20;
    const filters = {
      user: '',
      action: '',
      resource_type: '',
      security_only: '',
      from_date: '',
      to_date: '',
      ip_address: ''
    };

    // Show audit log detail modal
    async function showAuditLogDetail(logId) {
      try {
        const log = await apiCall(`/audit-logs/${logId}`);

        // Create modal backdrop
        const backdrop = createEl('div');
        backdrop.style.cssText =
          'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 1000;';

        // Create modal content
        const modal = createEl('div');
        modal.style.cssText =
          'background: white; border-radius: 12px; padding: 24px; max-width: 800px; width: 90%; max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);';

        // Modal header
        const modalHeader = createEl('div');
        modalHeader.style.cssText =
          'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #e2e8f0;';

        const modalTitle = createEl('h3', { textContent: '監査ログ詳細' });
        modalTitle.style.cssText = 'margin: 0; font-size: 20px; font-weight: 600;';

        const closeBtn = createEl('button', { textContent: 'X' });
        closeBtn.style.cssText =
          'background: none; border: none; font-size: 24px; cursor: pointer; color: #64748b;';
        closeBtn.addEventListener('click', () => {
          document.body.removeChild(backdrop);
        });

        modalHeader.appendChild(modalTitle);
        modalHeader.appendChild(closeBtn);
        modal.appendChild(modalHeader);

        // Basic info section
        const basicInfo = createEl('div');
        basicInfo.style.cssText =
          'display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-bottom: 24px;';

        const infoItems = [
          { label: 'ID', value: log.id },
          {
            label: 'タイムスタンプ',
            value: log.created_at ? new Date(log.created_at).toLocaleString('ja-JP') : '-'
          },
          { label: 'ユーザー', value: log.username || log.user_full_name || 'System' },
          { label: 'ユーザーEmail', value: log.user_email || '-' },
          { label: 'アクション', value: log.action },
          { label: 'リソースタイプ', value: log.resource_type },
          { label: 'リソースID', value: log.resource_id || '-' },
          { label: 'IPアドレス', value: log.ip_address || '-' },
          { label: 'セキュリティアクション', value: log.is_security_action ? 'はい' : 'いいえ' }
        ];

        infoItems.forEach((item) => {
          const infoItem = createEl('div');
          const label = createEl('div', { textContent: item.label });
          label.style.cssText = 'font-size: 12px; color: #64748b; margin-bottom: 4px;';
          const value = createEl('div', { textContent: String(item.value) });
          value.style.cssText = 'font-size: 14px; font-weight: 500;';
          if (item.label === 'セキュリティアクション' && log.is_security_action) {
            value.style.color = '#dc2626';
          }
          infoItem.appendChild(label);
          infoItem.appendChild(value);
          basicInfo.appendChild(infoItem);
        });

        modal.appendChild(basicInfo);

        // User Agent
        if (log.user_agent) {
          const uaSection = createEl('div');
          uaSection.style.cssText = 'margin-bottom: 24px;';
          const uaLabel = createEl('div', { textContent: 'User Agent' });
          uaLabel.style.cssText = 'font-size: 12px; color: #64748b; margin-bottom: 4px;';
          const uaValue = createEl('div', { textContent: log.user_agent });
          uaValue.style.cssText =
            'font-size: 12px; background: #f1f5f9; padding: 8px; border-radius: 4px; word-break: break-all;';
          uaSection.appendChild(uaLabel);
          uaSection.appendChild(uaValue);
          modal.appendChild(uaSection);
        }

        // Change diff section (if available)
        if (log.diff) {
          const diffSection = createEl('div');
          diffSection.style.cssText = 'margin-bottom: 24px;';

          const diffTitle = createEl('h4', { textContent: '変更差分' });
          diffTitle.style.cssText = 'margin: 0 0 12px 0; font-size: 16px; color: #1e40af;';
          diffSection.appendChild(diffTitle);

          // Changed fields
          if (log.diff.changed && Object.keys(log.diff.changed).length > 0) {
            const changedSection = createEl('div');
            changedSection.style.marginBottom = '12px';
            const changedTitle = createEl('div', { textContent: '変更されたフィールド' });
            changedTitle.style.cssText =
              'font-size: 12px; color: #f59e0b; font-weight: 600; margin-bottom: 8px;';
            changedSection.appendChild(changedTitle);

            Object.entries(log.diff.changed).forEach(([key, change]) => {
              const changeItem = createEl('div');
              changeItem.style.cssText =
                'background: #fffbeb; border: 1px solid #fcd34d; border-radius: 4px; padding: 8px; margin-bottom: 8px;';

              const fieldName = createEl('div', { textContent: key });
              fieldName.style.cssText = 'font-weight: 600; font-size: 13px; margin-bottom: 4px;';
              changeItem.appendChild(fieldName);

              const fromValue = createEl('div');
              fromValue.style.cssText = 'font-size: 12px; color: #dc2626;';
              setText(fromValue, `- ${JSON.stringify(change.from)}`);
              changeItem.appendChild(fromValue);

              const toValue = createEl('div');
              toValue.style.cssText = 'font-size: 12px; color: #16a34a;';
              setText(toValue, `+ ${JSON.stringify(change.to)}`);
              changeItem.appendChild(toValue);

              changedSection.appendChild(changeItem);
            });

            diffSection.appendChild(changedSection);
          }

          // Added fields
          if (log.diff.added && Object.keys(log.diff.added).length > 0) {
            const addedSection = createEl('div');
            addedSection.style.marginBottom = '12px';
            const addedTitle = createEl('div', { textContent: '追加されたフィールド' });
            addedTitle.style.cssText =
              'font-size: 12px; color: #16a34a; font-weight: 600; margin-bottom: 8px;';
            addedSection.appendChild(addedTitle);

            const addedContent = createEl('pre');
            addedContent.style.cssText =
              'background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 8px; font-size: 12px; overflow-x: auto;';
            setText(addedContent, JSON.stringify(log.diff.added, null, 2));
            addedSection.appendChild(addedContent);
            diffSection.appendChild(addedSection);
          }

          // Removed fields
          if (log.diff.removed && Object.keys(log.diff.removed).length > 0) {
            const removedSection = createEl('div');
            const removedTitle = createEl('div', { textContent: '削除されたフィールド' });
            removedTitle.style.cssText =
              'font-size: 12px; color: #dc2626; font-weight: 600; margin-bottom: 8px;';
            removedSection.appendChild(removedTitle);

            const removedContent = createEl('pre');
            removedContent.style.cssText =
              'background: #fef2f2; border: 1px solid #fca5a5; border-radius: 4px; padding: 8px; font-size: 12px; overflow-x: auto;';
            setText(removedContent, JSON.stringify(log.diff.removed, null, 2));
            removedSection.appendChild(removedContent);
            diffSection.appendChild(removedSection);
          }

          modal.appendChild(diffSection);
        }

        // Previous values section
        if (log.previous_values || log.old_values) {
          const prevSection = createEl('div');
          prevSection.style.cssText = 'margin-bottom: 24px;';

          const prevTitle = createEl('h4', { textContent: '変更前の値' });
          prevTitle.style.cssText = 'margin: 0 0 12px 0; font-size: 16px; color: #64748b;';
          prevSection.appendChild(prevTitle);

          const prevContent = createEl('pre');
          prevContent.style.cssText =
            'background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px; padding: 12px; font-size: 12px; overflow-x: auto; max-height: 200px;';
          const prevData = log.previous_values || log.old_values;
          setText(prevContent, JSON.stringify(prevData, null, 2));
          prevSection.appendChild(prevContent);
          modal.appendChild(prevSection);
        }

        // New values section
        if (log.new_values) {
          const newSection = createEl('div');
          newSection.style.cssText = 'margin-bottom: 24px;';

          const newTitle = createEl('h4', { textContent: '新しい値' });
          newTitle.style.cssText = 'margin: 0 0 12px 0; font-size: 16px; color: #16a34a;';
          newSection.appendChild(newTitle);

          const newContent = createEl('pre');
          newContent.style.cssText =
            'background: #f0fdf4; border: 1px solid #86efac; border-radius: 4px; padding: 12px; font-size: 12px; overflow-x: auto; max-height: 200px;';
          setText(newContent, JSON.stringify(log.new_values, null, 2));
          newSection.appendChild(newContent);
          modal.appendChild(newSection);
        }

        backdrop.appendChild(modal);
        document.body.appendChild(backdrop);

        // Close on backdrop click
        backdrop.addEventListener('click', (e) => {
          if (e.target === backdrop) {
            document.body.removeChild(backdrop);
          }
        });
      } catch (err) {
        Toast.error('監査ログ詳細の取得に失敗しました');
      }
    }

    // Export to CSV
    async function exportAuditLogsToCSV() {
      try {
        const params = new URLSearchParams();
        if (filters.from_date) params.append('from_date', filters.from_date);
        if (filters.to_date) params.append('to_date', filters.to_date);
        if (filters.action) params.append('action', filters.action);
        if (filters.resource_type) params.append('resource_type', filters.resource_type);
        if (filters.security_only) params.append('security_only', filters.security_only);

        const url = `${API_BASE}/audit-logs/export?${params.toString()}`;

        // Add auth header via fetch and create blob
        const response = await fetch(url, {
          headers: {
            Authorization: `Bearer ${authToken}`
          }
        });

        if (!response.ok) {
          throw new Error('Export failed');
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(downloadUrl);

        Toast.success('CSVエクスポートが完了しました');
      } catch (err) {
        Toast.error('CSVエクスポートに失敗しました');
      }
    }

    // Render table function
    async function renderTable() {
      // Build query params
      const params = new URLSearchParams({
        page: String(currentPage),
        limit: String(itemsPerPage)
      });

      if (filters.user) params.append('user', filters.user);
      if (filters.action) params.append('action', filters.action);
      if (filters.resource_type) params.append('resource_type', filters.resource_type);
      if (filters.security_only) params.append('security_only', filters.security_only);
      if (filters.from_date) params.append('from_date', filters.from_date);
      if (filters.to_date) params.append('to_date', filters.to_date);
      if (filters.ip_address) params.append('ip_address', filters.ip_address);

      // Fetch data from new API endpoint
      const response = await apiCall(`/audit-logs?${params.toString()}`);
      const logs = Array.isArray(response) ? response : response.data || [];
      const pagination = Array.isArray(response)
        ? {
            total: logs.length,
            page: currentPage,
            totalPages: 1
          }
        : response.pagination || {
            total: 0,
            page: 1,
            totalPages: 1
          };
      const totalPages = pagination.totalPages || 1;

      // Clear previous table and pagination
      const existingTable = section.querySelector('.table-wrapper');
      if (existingTable) section.removeChild(existingTable);
      const existingPagination = section.querySelector('.pagination-wrapper');
      if (existingPagination) section.removeChild(existingPagination);

      // Table wrapper
      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });

      // Table Header
      const thead = createEl('thead');
      const headerRow = createEl('tr');
      [
        'タイムスタンプ',
        'ユーザー',
        'アクション',
        'リソースタイプ',
        'リソースID',
        'IPアドレス',
        'セキュリティ',
        '操作'
      ].forEach((headerText) => {
        headerRow.appendChild(createEl('th', { textContent: headerText }));
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      // Table Body
      const tbody = createEl('tbody');
      if (logs.length === 0) {
        const emptyRow = createEl('tr');
        const emptyCell = createEl('td', { textContent: '監査ログがありません' });
        emptyCell.colSpan = 8;
        emptyCell.style.textAlign = 'center';
        emptyCell.style.padding = '32px';
        emptyCell.style.color = '#64748b';
        emptyRow.appendChild(emptyCell);
        tbody.appendChild(emptyRow);
      } else {
        logs.forEach((log) => {
          const row = createEl('tr');
          row.style.cursor = 'pointer';

          // Highlight security-related actions
          if (log.is_security_action) {
            row.style.background = '#fef2f2';
          }

          // Timestamp
          const timestampValue = log.timestamp || log.created_at;
          row.appendChild(
            createEl('td', {
              textContent: timestampValue ? new Date(timestampValue).toLocaleString('ja-JP') : '-'
            })
          );

          // User
          const userLabel =
            log.user ||
            log.username ||
            log.user_full_name ||
            (log.user_id ? String(log.user_id) : 'System');
          row.appendChild(createEl('td', { textContent: userLabel }));

          // Action
          const actionCell = createEl('td');
          const actionBadge = createEl('span', { textContent: log.action || '-' });
          const actionColors = {
            create: { bg: '#dcfce7', color: '#16a34a' },
            update: { bg: '#fef3c7', color: '#d97706' },
            delete: { bg: '#fee2e2', color: '#dc2626' }
          };
          const colors = actionColors[log.action] || { bg: '#e2e8f0', color: '#475569' };
          actionBadge.style.cssText = `background: ${colors.bg}; color: ${colors.color}; padding: 2px 8px; border-radius: 4px; font-size: 12px; font-weight: 500;`;
          actionCell.appendChild(actionBadge);
          row.appendChild(actionCell);

          // Resource Type
          row.appendChild(createEl('td', { textContent: log.resource_type || '-' }));

          // Resource ID
          row.appendChild(createEl('td', { textContent: log.resource_id || '-' }));

          // IP Address
          row.appendChild(createEl('td', { textContent: log.ip_address || '-' }));

          // Security Action Flag
          const securityCell = createEl('td');
          if (log.is_security_action) {
            const badge = createEl('span', { textContent: 'Yes' });
            badge.style.cssText =
              'background: #dc2626; color: white; padding: 2px 8px; border-radius: 4px; font-size: 12px;';
            securityCell.appendChild(badge);
          } else {
            setText(securityCell, 'No');
          }
          row.appendChild(securityCell);

          // Action button
          const actionBtnCell = createEl('td');
          const detailBtn = createEl('button', { textContent: '詳細', className: 'btn-secondary' });
          detailBtn.style.cssText = 'padding: 4px 12px; font-size: 12px;';
          detailBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            showAuditLogDetail(log.id);
          });
          actionBtnCell.appendChild(detailBtn);
          row.appendChild(actionBtnCell);

          // Row click to show detail
          row.addEventListener('click', () => {
            showAuditLogDetail(log.id);
          });

          tbody.appendChild(row);
        });
      }
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);

      // Pagination
      const paginationWrapper = createEl('div');
      paginationWrapper.className = 'pagination-wrapper';
      paginationWrapper.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 16px;';

      const prevBtn = createEl('button', { textContent: '前へ', className: 'btn-secondary' });
      prevBtn.disabled = currentPage === 1;
      prevBtn.addEventListener('click', async () => {
        currentPage -= 1;
        await renderTable();
      });

      const pageInfo = createEl('span');
      const totalCount = typeof pagination.total === 'number' ? pagination.total : logs.length;
      setText(pageInfo, `${currentPage} / ${totalPages} ページ (全 ${totalCount} 件)`);

      const nextBtn = createEl('button', { textContent: '次へ', className: 'btn-secondary' });
      nextBtn.disabled = currentPage >= totalPages;
      nextBtn.addEventListener('click', async () => {
        currentPage += 1;
        await renderTable();
      });

      paginationWrapper.appendChild(prevBtn);
      paginationWrapper.appendChild(pageInfo);
      paginationWrapper.appendChild(nextBtn);
      section.appendChild(paginationWrapper);
    }

    // Header
    const header = createEl('div');
    header.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;';

    const h2 = createEl('h2', { textContent: '監査ログ' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.cssText = 'display: flex; gap: 12px;';

    const exportBtn = createEl('button', {
      className: 'btn-secondary',
      textContent: 'CSVエクスポート'
    });
    exportBtn.addEventListener('click', exportAuditLogsToCSV);

    const refreshBtn = createEl('button', { className: 'btn-primary', textContent: '更新' });
    refreshBtn.addEventListener('click', async () => {
      currentPage = 1;
      await renderTable();
    });

    btnGroup.appendChild(exportBtn);
    btnGroup.appendChild(refreshBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    // Explanation section
    const explanation = createExplanationSection(
      'システム内のすべての操作を記録した監査ログを表示します。セキュリティ関連のアクションは赤色でハイライトされます。各行をクリックすると変更差分を含む詳細情報が表示されます。',
      'ユーザーアクティビティの追跡、セキュリティインシデントの調査、コンプライアンス要件への対応に活用できます。CSVエクスポート機能で監査レポートの作成も可能です。'
    );
    section.appendChild(explanation);

    // Filters row 1
    const filtersRow1 = createEl('div');
    filtersRow1.style.cssText =
      'display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 12px;';

    // User filter
    const userFilter = createEl('input', {
      type: 'text',
      placeholder: 'ユーザーでフィルタ'
    });
    userFilter.style.cssText = 'padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;';
    userFilter.addEventListener('input', async (e) => {
      filters.user = e.target.value;
      currentPage = 1;
      await renderTable();
    });
    filtersRow1.appendChild(userFilter);

    // Action filter
    const actionFilter = createEl('select');
    actionFilter.style.cssText = 'padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;';
    const actionOptions = ['すべてのアクション', 'create', 'update', 'delete'];
    actionOptions.forEach((opt) => {
      const option = createEl('option', {
        value: opt === 'すべてのアクション' ? '' : opt,
        textContent: opt
      });
      actionFilter.appendChild(option);
    });
    actionFilter.addEventListener('change', async (e) => {
      filters.action = e.target.value;
      currentPage = 1;
      await renderTable();
    });
    filtersRow1.appendChild(actionFilter);

    // Resource Type filter
    const resourceTypeFilter = createEl('input', {
      type: 'text',
      placeholder: 'リソースタイプでフィルタ'
    });
    resourceTypeFilter.style.cssText =
      'padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;';
    resourceTypeFilter.addEventListener('input', async (e) => {
      filters.resource_type = e.target.value;
      currentPage = 1;
      await renderTable();
    });
    filtersRow1.appendChild(resourceTypeFilter);

    // Security Action filter
    const securityActionFilter = createEl('select');
    securityActionFilter.style.cssText =
      'padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;';
    const securityOptions = ['すべて', 'セキュリティアクションのみ', '通常アクションのみ'];
    securityOptions.forEach((opt) => {
      let value = '';
      if (opt === 'セキュリティアクションのみ') {
        value = 'true';
      } else if (opt === '通常アクションのみ') {
        value = 'false';
      }
      const option = createEl('option', {
        value,
        textContent: opt
      });
      securityActionFilter.appendChild(option);
    });
    securityActionFilter.addEventListener('change', async (e) => {
      filters.security_only = e.target.value;
      currentPage = 1;
      await renderTable();
    });
    filtersRow1.appendChild(securityActionFilter);

    section.appendChild(filtersRow1);

    // Filters row 2 (Date range and IP)
    const filtersRow2 = createEl('div');
    filtersRow2.style.cssText =
      'display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 16px;';

    // From date filter
    const fromDateLabel = createEl('div');
    fromDateLabel.style.cssText = 'display: flex; flex-direction: column;';
    const fromDateText = createEl('span', { textContent: '開始日' });
    fromDateText.style.cssText = 'font-size: 11px; color: #64748b; margin-bottom: 4px;';
    const fromDateInput = createEl('input', { type: 'date' });
    fromDateInput.style.cssText = 'padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;';
    fromDateInput.addEventListener('change', async (e) => {
      filters.from_date = e.target.value;
      currentPage = 1;
      await renderTable();
    });
    fromDateLabel.appendChild(fromDateText);
    fromDateLabel.appendChild(fromDateInput);
    filtersRow2.appendChild(fromDateLabel);

    // To date filter
    const toDateLabel = createEl('div');
    toDateLabel.style.cssText = 'display: flex; flex-direction: column;';
    const toDateText = createEl('span', { textContent: '終了日' });
    toDateText.style.cssText = 'font-size: 11px; color: #64748b; margin-bottom: 4px;';
    const toDateInput = createEl('input', { type: 'date' });
    toDateInput.style.cssText = 'padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;';
    toDateInput.addEventListener('change', async (e) => {
      filters.to_date = e.target.value;
      currentPage = 1;
      await renderTable();
    });
    toDateLabel.appendChild(toDateText);
    toDateLabel.appendChild(toDateInput);
    filtersRow2.appendChild(toDateLabel);

    // IP address filter
    const ipFilter = createEl('input', {
      type: 'text',
      placeholder: 'IPアドレスでフィルタ'
    });
    ipFilter.style.cssText =
      'padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px; margin-top: 18px;';
    ipFilter.addEventListener('input', async (e) => {
      filters.ip_address = e.target.value;
      currentPage = 1;
      await renderTable();
    });
    filtersRow2.appendChild(ipFilter);

    // Clear filters button
    const clearFiltersBtn = createEl('button', {
      textContent: 'フィルタをクリア',
      className: 'btn-secondary'
    });
    clearFiltersBtn.style.cssText = 'margin-top: 18px;';
    clearFiltersBtn.addEventListener('click', async () => {
      // Reset all filters
      filters.user = '';
      filters.action = '';
      filters.resource_type = '';
      filters.security_only = '';
      filters.from_date = '';
      filters.to_date = '';
      filters.ip_address = '';
      currentPage = 1;

      // Reset form elements
      userFilter.value = '';
      actionFilter.value = '';
      resourceTypeFilter.value = '';
      securityActionFilter.value = '';
      fromDateInput.value = '';
      toDateInput.value = '';
      ipFilter.value = '';

      await renderTable();
    });
    filtersRow2.appendChild(clearFiltersBtn);

    section.appendChild(filtersRow2);

    // Initial render
    await renderTable();
    container.appendChild(section);
  } catch (error) {
    renderError(container, '監査ログの読み込みに失敗しました');
  }
}

// ===== Security Management View =====

async function renderSecurityManagement(container) {
  try {
    securityManagementState = loadSecurityManagementState();
    const section = createEl('div');

    // Header
    const header = createEl('div');
    header.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;';

    const title = createEl('h2');
    setText(title, 'セキュリティ管理');
    title.style.cssText = 'margin: 0; font-size: 28px; font-weight: 600;';

    header.appendChild(title);
    section.appendChild(header);

    // Explanation section
    const explanation = createExplanationSection(
      'セキュリティポリシー、リスク評価、セキュリティイベント、アクセス制御を一元管理します。NIST CSF 2.0の全機能（GOVERN, IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER）をカバーします。',
      '包括的なセキュリティ管理により、組織のセキュリティ態勢を可視化し、脅威に対する防御力を強化します。ポリシー遵守、リスク低減、インシデント対応の効率化を実現します。'
    );
    section.appendChild(explanation);

    // Render all sections simultaneously
    const policiesSection = createEl('div');
    policiesSection.style.marginBottom = '32px';
    await renderPoliciesSection(policiesSection);
    section.appendChild(policiesSection);

    const riskSection = createEl('div');
    riskSection.style.marginBottom = '32px';
    await renderRiskAssessmentSection(riskSection);
    section.appendChild(riskSection);

    const eventsSection = createEl('div');
    eventsSection.style.marginBottom = '32px';
    await renderSecurityEventsSection(eventsSection);
    section.appendChild(eventsSection);

    const accessSection = createEl('div');
    accessSection.style.marginBottom = '32px';
    await renderAccessControlSection(accessSection);
    section.appendChild(accessSection);

    container.appendChild(section);
  } catch (error) {
    renderError(container, 'セキュリティ管理の読み込みに失敗しました');
  }

  // Helper function for NIST function colors
  function getNistFunctionColor(func) {
    const colors = {
      GV: '#8b5cf6',
      ID: '#06b6d4',
      PR: '#10b981',
      DE: '#f59e0b',
      RS: '#ef4444',
      RC: '#ec4899'
    };
    return colors[func] || '#64748b';
  }

  // ===== Policies Section =====
  async function renderPoliciesSection(contentContainer) {
    console.log('[Security] Rendering Policies Section - Starting');
    const card = createEl('div', { className: 'card glass' });
    card.style.padding = '24px';
    card.style.marginBottom = '24px';

    // Header with title and new button
    const policiesHeaderWrapper = createEl('div');
    policiesHeaderWrapper.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';

    const sectionTitle = createEl('h3', { textContent: '📋 セキュリティポリシー管理' });
    sectionTitle.style.margin = '0';

    const newBtn = createEl('button', { className: 'btn-primary' });
    newBtn.style.cssText = 'padding: 8px 16px; display: flex; align-items: center; gap: 8px;';
    const plusIcon = createEl('i', { className: 'fas fa-plus' });
    const btnText = createEl('span');
    setText(btnText, '新規ポリシー作成');
    newBtn.appendChild(plusIcon);
    newBtn.appendChild(btnText);
    newBtn.addEventListener('click', () => {
      openSecurityPolicyModal('create');
    });

    policiesHeaderWrapper.appendChild(sectionTitle);
    policiesHeaderWrapper.appendChild(newBtn);
    card.appendChild(policiesHeaderWrapper);

    const { policies } = securityManagementState;

    // Table container
    const tableContainer = createEl('div');
    tableContainer.style.cssText =
      'background: rgba(255, 255, 255, 0.03); border-radius: 12px; overflow: hidden; border: 1px solid rgba(255, 255, 255, 0.05);';

    // Table
    const table = createEl('table');
    table.style.cssText = 'width: 100%; border-collapse: collapse;';

    // Table header
    const thead = createEl('thead');
    const policiesHeaderRow = createEl('tr');
    policiesHeaderRow.style.background = 'rgba(255, 255, 255, 0.05)';

    const headers = ['ポリシー名', 'NIST機能', 'カテゴリ', 'ステータス', 'レビュー日', '操作'];

    headers.forEach((headerText) => {
      const th = createEl('th');
      setText(th, headerText);
      th.style.cssText = `
      padding: 16px;
      text-align: ${headerText === '操作' ? 'center' : 'left'};
      font-size: 13px;
      font-weight: 600;
      color: #1e293b;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    `;
      policiesHeaderRow.appendChild(th);
    });

    thead.appendChild(policiesHeaderRow);
    table.appendChild(thead);

    // Table body
    const tbody = createEl('tbody');

    if (policies.length === 0) {
      const emptyRow = createEl('tr');
      const emptyCell = createEl('td');
      emptyCell.colSpan = headers.length;
      emptyCell.style.cssText =
        'padding: 16px; text-align: center; color: #64748b; font-size: 14px;';
      setText(emptyCell, 'ポリシーがありません');
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    }

    policies.forEach((policy) => {
      const row = createEl('tr');
      row.style.cssText = 'transition: background 0.2s;';
      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(255, 255, 255, 0.03)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent';
      });

      // Policy name
      const nameCell = createEl('td');
      nameCell.style.cssText = 'padding: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);';
      const nameText = createEl('div');
      setText(nameText, policy.name);
      nameText.style.cssText = 'font-weight: 500; color: #1e293b;';
      nameCell.appendChild(nameText);
      row.appendChild(nameCell);

      // NIST function
      const nistCell = createEl('td');
      nistCell.style.cssText = 'padding: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);';
      const nistBadge = createEl('span');
      setText(nistBadge, policy.nist_function);
      nistBadge.style.cssText = `
      display: inline-block;
      padding: 4px 12px;
      background: ${getNistFunctionColor(policy.nist_function)};
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      color: white;
    `;
      nistCell.appendChild(nistBadge);
      row.appendChild(nistCell);

      // Category
      const categoryCell = createEl('td');
      categoryCell.style.cssText =
        'padding: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #64748b; font-size: 14px;';
      setText(categoryCell, policy.category);
      row.appendChild(categoryCell);

      // Status
      const statusCell = createEl('td');
      statusCell.style.cssText =
        'padding: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05);';
      const statusBadge = createEl('span');
      const statusText = policy.status === 'active' ? '有効' : '草案';
      const statusColor = policy.status === 'active' ? '#10b981' : '#f59e0b';
      setText(statusBadge, statusText);
      statusBadge.style.cssText = `
      display: inline-block;
      padding: 4px 12px;
      background: ${statusColor}20;
      border: 1px solid ${statusColor}40;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
      color: ${statusColor};
    `;
      statusCell.appendChild(statusBadge);
      row.appendChild(statusCell);

      // Review date
      const reviewCell = createEl('td');
      reviewCell.style.cssText =
        'padding: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); color: #64748b; font-size: 14px;';
      setText(reviewCell, policy.review_date);
      row.appendChild(reviewCell);

      // Action buttons
      const actionCell = createEl('td');
      actionCell.style.cssText =
        'padding: 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.05); text-align: center;';
      const actionButtonsContainer = createEl('div');
      actionButtonsContainer.style.cssText = 'display: flex; gap: 8px; justify-content: center;';

      const editBtn = createEl('button');
      editBtn.style.cssText = `
      background: #3b82f6;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.2s;
    `;
      editBtn.addEventListener('mouseenter', () => {
        editBtn.style.background = '#2563eb';
      });
      editBtn.addEventListener('mouseleave', () => {
        editBtn.style.background = '#3b82f6';
      });
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSecurityPolicyModal('edit', policy);
      });
      const editIcon = createEl('i', { className: 'fas fa-edit' });
      const editText = createEl('span');
      setText(editText, '編集');
      editBtn.appendChild(editIcon);
      editBtn.appendChild(editText);

      const deleteBtn = createEl('button');
      deleteBtn.style.cssText = `
      background: #ef4444;
      color: white;
      border: none;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      display: flex;
      align-items: center;
      gap: 4px;
      transition: background 0.2s;
    `;
      deleteBtn.addEventListener('mouseenter', () => {
        deleteBtn.style.background = '#dc2626';
      });
      deleteBtn.addEventListener('mouseleave', () => {
        deleteBtn.style.background = '#ef4444';
      });
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirmDialog('セキュリティポリシー', policy.id, policy.name, async () => {
          securityManagementState.policies = securityManagementState.policies.filter(
            (item) => item.id !== policy.id
          );
          Toast.success(`削除しました: ${policy.name}`);
          refreshSecurityManagementView();
        });
      });
      const deleteIcon = createEl('i', { className: 'fas fa-trash' });
      const deleteText = createEl('span');
      setText(deleteText, '削除');
      deleteBtn.appendChild(deleteIcon);
      deleteBtn.appendChild(deleteText);

      actionButtonsContainer.appendChild(editBtn);
      actionButtonsContainer.appendChild(deleteBtn);
      actionCell.appendChild(actionButtonsContainer);
      row.appendChild(actionCell);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    card.appendChild(tableContainer);

    contentContainer.appendChild(card);
    console.log(`[Security] Policies Section rendered with ${policies.length} items`);
  }

  // ===== Risk Assessment Section =====
  async function renderRiskAssessmentSection(contentContainer) {
    const card = createEl('div', { className: 'card glass' });
    card.style.padding = '24px';
    const headerWrapper = createEl('div');
    headerWrapper.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
    const h3 = createEl('h3', { textContent: '📊 リスクアセスメント' });
    h3.style.margin = '0';
    const newBtn = createEl('button', { className: 'btn-primary' });
    newBtn.style.cssText = 'padding: 8px 16px; display: flex; align-items: center; gap: 8px;';
    const plusIcon = createEl('i', { className: 'fas fa-plus' });
    const btnText = createEl('span');
    setText(btnText, '新規リスク登録');
    newBtn.appendChild(plusIcon);
    newBtn.appendChild(btnText);
    newBtn.addEventListener('click', () => {
      openRiskAssessmentModal('create');
    });
    headerWrapper.appendChild(h3);
    headerWrapper.appendChild(newBtn);
    card.appendChild(headerWrapper);

    const riskData = securityManagementState.risks;

    // テーブル作成
    const tableContainer = createEl('div');
    tableContainer.style.cssText = 'overflow-x: auto; margin-top: 16px;';

    const table = createEl('table', { className: 'data-table' });
    table.style.cssText = 'width: 100%; border-collapse: collapse;';

    // テーブルヘッダー
    const thead = createEl('thead');
    const headerRow = createEl('tr');
    const headers = [
      'リスク名',
      'リスクレベル',
      '影響度',
      '発生可能性',
      '対策状況',
      '担当者',
      '操作'
    ];

    headers.forEach((headerText) => {
      const th = createEl('th', { textContent: headerText });
      th.style.cssText = `
        padding: 12px;
        text-align: ${headerText === '操作' ? 'center' : 'left'};
        background-color: #f1f5f9;
        border-bottom: 2px solid #cbd5e1;
        font-weight: 600;
      `;
      headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // テーブルボディ
    const tbody = createEl('tbody');

    if (riskData.length === 0) {
      const emptyRow = createEl('tr');
      const emptyCell = createEl('td');
      emptyCell.colSpan = headers.length;
      emptyCell.style.cssText =
        'padding: 16px; text-align: center; color: #64748b; font-size: 14px;';
      setText(emptyCell, 'リスク項目がありません');
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    }

    riskData.forEach((risk, index) => {
      const row = createEl('tr');
      row.style.cssText =
        index % 2 === 0 ? 'background-color: #ffffff;' : 'background-color: #f8fafc;';
      row.onmouseover = () => {
        row.style.backgroundColor = '#e0f2fe';
      };
      row.onmouseout = () => {
        row.style.backgroundColor = index % 2 === 0 ? '#ffffff' : '#f8fafc';
      };

      // リスク名
      const nameCell = createEl('td', { textContent: risk.name });
      nameCell.style.cssText = 'padding: 12px; border-bottom: 1px solid #e2e8f0;';
      row.appendChild(nameCell);

      // リスクレベル
      const levelCell = createEl('td');
      levelCell.style.cssText = 'padding: 12px; border-bottom: 1px solid #e2e8f0;';
      const levelBadge = createEl('span', { textContent: risk.level });
      const levelColors = {
        Critical: 'background-color: #dc2626; color: white;',
        High: 'background-color: #f59e0b; color: white;',
        Medium: 'background-color: #3b82f6; color: white;',
        Low: 'background-color: #10b981; color: white;'
      };
      levelBadge.style.cssText = `padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; ${levelColors[risk.level] || ''}`;
      levelCell.appendChild(levelBadge);
      row.appendChild(levelCell);

      // 影響度
      const impactCell = createEl('td');
      impactCell.style.cssText = 'padding: 12px; border-bottom: 1px solid #e2e8f0;';
      const impactBadge = createEl('span', { textContent: risk.impact });
      const impactColors = {
        High: 'background-color: #fef3c7; color: #92400e;',
        Medium: 'background-color: #dbeafe; color: #1e40af;',
        Low: 'background-color: #d1fae5; color: #065f46;'
      };
      impactBadge.style.cssText = `padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; ${impactColors[risk.impact] || ''}`;
      impactCell.appendChild(impactBadge);
      row.appendChild(impactCell);

      // 発生可能性
      const probabilityCell = createEl('td');
      probabilityCell.style.cssText = 'padding: 12px; border-bottom: 1px solid #e2e8f0;';
      const probabilityBadge = createEl('span', { textContent: risk.probability });
      probabilityBadge.style.cssText = `padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; ${impactColors[risk.probability] || ''}`;
      probabilityCell.appendChild(probabilityBadge);
      row.appendChild(probabilityCell);

      // 対策状況
      const statusCell = createEl('td');
      statusCell.style.cssText = 'padding: 12px; border-bottom: 1px solid #e2e8f0;';
      const statusBadge = createEl('span', { textContent: risk.status });
      const statusColors = {
        対策済: 'background-color: #10b981; color: white;',
        対策中: 'background-color: #f59e0b; color: white;',
        未対応: 'background-color: #64748b; color: white;'
      };
      statusBadge.style.cssText = `padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 600; ${statusColors[risk.status] || ''}`;
      statusCell.appendChild(statusBadge);
      row.appendChild(statusCell);

      // 担当者
      const assigneeCell = createEl('td', { textContent: risk.assignee });
      assigneeCell.style.cssText = 'padding: 12px; border-bottom: 1px solid #e2e8f0;';
      row.appendChild(assigneeCell);

      // 操作
      const actionCell = createEl('td');
      actionCell.style.cssText =
        'padding: 12px; border-bottom: 1px solid #e2e8f0; text-align: center;';
      const actionButtonsContainer = createEl('div');
      actionButtonsContainer.style.cssText = 'display: flex; gap: 8px; justify-content: center;';

      const editBtn = createEl('button');
      editBtn.style.cssText = `
        background: #3b82f6;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: background 0.2s;
      `;
      editBtn.addEventListener('mouseenter', () => {
        editBtn.style.background = '#2563eb';
      });
      editBtn.addEventListener('mouseleave', () => {
        editBtn.style.background = '#3b82f6';
      });
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openRiskAssessmentModal('edit', risk);
      });
      const editIcon = createEl('i', { className: 'fas fa-edit' });
      const editText = createEl('span');
      setText(editText, '編集');
      editBtn.appendChild(editIcon);
      editBtn.appendChild(editText);

      const deleteBtn = createEl('button');
      deleteBtn.style.cssText = `
        background: #ef4444;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: background 0.2s;
      `;
      deleteBtn.addEventListener('mouseenter', () => {
        deleteBtn.style.background = '#dc2626';
      });
      deleteBtn.addEventListener('mouseleave', () => {
        deleteBtn.style.background = '#ef4444';
      });
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirmDialog('リスクアセスメント', risk.id, risk.name, async () => {
          securityManagementState.risks = securityManagementState.risks.filter(
            (item) => item.id !== risk.id
          );
          Toast.success(`削除しました: ${risk.name}`);
          refreshSecurityManagementView();
        });
      });
      const deleteIcon = createEl('i', { className: 'fas fa-trash' });
      const deleteText = createEl('span');
      setText(deleteText, '削除');
      deleteBtn.appendChild(deleteIcon);
      deleteBtn.appendChild(deleteText);

      actionButtonsContainer.appendChild(editBtn);
      actionButtonsContainer.appendChild(deleteBtn);
      actionCell.appendChild(actionButtonsContainer);
      row.appendChild(actionCell);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    tableContainer.appendChild(table);
    card.appendChild(tableContainer);
    contentContainer.appendChild(card);
  }

  // ===== Security Events Section =====
  async function renderSecurityEventsSection(contentContainer) {
    const card = createEl('div', { className: 'card glass' });
    card.style.padding = '24px';

    // Header with title and new button
    const eventsHeaderWrapper = createEl('div');
    eventsHeaderWrapper.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const h3 = createEl('h3', { textContent: '🚨 セキュリティイベント' });
    h3.style.margin = '0';

    const newBtn = createEl('button', { className: 'btn-primary' });
    newBtn.style.cssText = 'padding: 8px 16px; display: flex; align-items: center; gap: 8px;';
    const plusIcon = createEl('i', { className: 'fas fa-plus' });
    const btnText = createEl('span');
    setText(btnText, '新規イベント登録');
    newBtn.appendChild(plusIcon);
    newBtn.appendChild(btnText);
    newBtn.addEventListener('click', () => {
      openSecurityEventModal('create');
    });

    eventsHeaderWrapper.appendChild(h3);
    eventsHeaderWrapper.appendChild(newBtn);
    card.appendChild(eventsHeaderWrapper);

    const securityEvents = securityManagementState.events;

    // テーブルコンテナ
    const tableContainer = createEl('div');
    tableContainer.style.cssText = 'overflow-x: auto; margin-top: 16px;';

    // テーブル作成
    const table = createEl('table');
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;
      overflow: hidden;
    `;

    // テーブルヘッダー
    const thead = createEl('thead');
    const eventsHeaderRow = createEl('tr');
    eventsHeaderRow.style.cssText = 'background: rgba(255, 255, 255, 0.05);';

    const headers = ['イベント名', '重要度', '検知日時', '検知元', 'ステータス', '担当者', '操作'];
    headers.forEach((headerText) => {
      const th = createEl('th');
      setText(th, headerText);
      th.style.cssText = `
        padding: 12px 16px;
        text-align: ${headerText === '操作' ? 'center' : 'left'};
        font-weight: 600;
        color: #1e293b;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        white-space: nowrap;
      `;
      eventsHeaderRow.appendChild(th);
    });
    thead.appendChild(eventsHeaderRow);
    table.appendChild(thead);

    // テーブルボディ
    const tbody = createEl('tbody');

    if (securityEvents.length === 0) {
      const emptyRow = createEl('tr');
      const emptyCell = createEl('td');
      emptyCell.colSpan = headers.length;
      emptyCell.style.cssText =
        'padding: 16px; text-align: center; color: #64748b; font-size: 14px;';
      setText(emptyCell, 'イベントがありません');
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    }

    securityEvents.forEach((event) => {
      const row = createEl('tr');
      row.style.cssText = 'border-bottom: 1px solid rgba(255, 255, 255, 0.05);';
      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(255, 255, 255, 0.03)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent';
      });

      // イベント名
      const nameCell = createEl('td');
      setText(nameCell, event.name);
      nameCell.style.cssText = `
        padding: 12px 16px;
        color: #1e293b;
        font-weight: 500;
      `;
      row.appendChild(nameCell);

      // 重要度
      const severityCell = createEl('td');
      const severityBadge = createEl('span');
      setText(severityBadge, event.severity);
      const severityColors = {
        Critical: '#ef4444',
        High: '#f59e0b',
        Medium: '#3b82f6',
        Low: '#10b981'
      };
      severityBadge.style.cssText = `
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        background: ${severityColors[event.severity] || '#64748b'}22;
        color: ${severityColors[event.severity] || '#64748b'};
        border: 1px solid ${severityColors[event.severity] || '#64748b'}44;
      `;
      severityCell.style.padding = '12px 16px';
      severityCell.appendChild(severityBadge);
      row.appendChild(severityCell);

      // 検知日時
      const detectedAtCell = createEl('td');
      setText(detectedAtCell, event.detectedAt);
      detectedAtCell.style.cssText = `
        padding: 12px 16px;
        color: #64748b;
        font-size: 14px;
        white-space: nowrap;
      `;
      row.appendChild(detectedAtCell);

      // 検知元
      const sourceCell = createEl('td');
      setText(sourceCell, event.source);
      sourceCell.style.cssText = `
        padding: 12px 16px;
        color: #475569;
        font-weight: 500;
      `;
      row.appendChild(sourceCell);

      // ステータス
      const statusCell = createEl('td');
      const statusBadge = createEl('span');
      setText(statusBadge, event.status);
      const statusColors = {
        対応中: '#f59e0b',
        調査中: '#3b82f6',
        対応完了: '#10b981',
        監視中: '#64748b'
      };
      statusBadge.style.cssText = `
        display: inline-block;
        padding: 4px 12px;
        border-radius: 12px;
        font-size: 12px;
        font-weight: 600;
        background: ${statusColors[event.status] || '#64748b'}22;
        color: ${statusColors[event.status] || '#64748b'};
        border: 1px solid ${statusColors[event.status] || '#64748b'}44;
      `;
      statusCell.style.padding = '12px 16px';
      statusCell.appendChild(statusBadge);
      row.appendChild(statusCell);

      // 担当者
      const assigneeCell = createEl('td');
      setText(assigneeCell, event.assignee);
      assigneeCell.style.cssText = `
        padding: 12px 16px;
        color: #475569;
        white-space: nowrap;
      `;
      row.appendChild(assigneeCell);

      // Action buttons
      const actionCell = createEl('td');
      actionCell.style.cssText = 'padding: 12px 16px; text-align: center;';
      const actionButtonsContainer = createEl('div');
      actionButtonsContainer.style.cssText = 'display: flex; gap: 8px; justify-content: center;';

      const editBtn = createEl('button');
      editBtn.style.cssText = `
        background: #3b82f6;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: background 0.2s;
      `;
      editBtn.addEventListener('mouseenter', () => {
        editBtn.style.background = '#2563eb';
      });
      editBtn.addEventListener('mouseleave', () => {
        editBtn.style.background = '#3b82f6';
      });
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSecurityEventModal('edit', event);
      });
      const editIcon = createEl('i', { className: 'fas fa-edit' });
      const editText = createEl('span');
      setText(editText, '編集');
      editBtn.appendChild(editIcon);
      editBtn.appendChild(editText);

      const deleteBtn = createEl('button');
      deleteBtn.style.cssText = `
        background: #ef4444;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: background 0.2s;
      `;
      deleteBtn.addEventListener('mouseenter', () => {
        deleteBtn.style.background = '#dc2626';
      });
      deleteBtn.addEventListener('mouseleave', () => {
        deleteBtn.style.background = '#ef4444';
      });
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirmDialog('セキュリティイベント', event.id, event.name, async () => {
          securityManagementState.events = securityManagementState.events.filter(
            (item) => item.id !== event.id
          );
          Toast.success(`削除しました: ${event.name}`);
          refreshSecurityManagementView();
        });
      });
      const deleteIcon = createEl('i', { className: 'fas fa-trash' });
      const deleteText = createEl('span');
      setText(deleteText, '削除');
      deleteBtn.appendChild(deleteIcon);
      deleteBtn.appendChild(deleteText);

      actionButtonsContainer.appendChild(editBtn);
      actionButtonsContainer.appendChild(deleteBtn);
      actionCell.appendChild(actionButtonsContainer);
      row.appendChild(actionCell);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    tableContainer.appendChild(table);
    card.appendChild(tableContainer);
    contentContainer.appendChild(card);
  }

  // ===== Access Control Section =====
  async function renderAccessControlSection(contentContainer) {
    const card = createEl('div', { className: 'card glass' });
    card.style.padding = '24px';
    card.style.marginBottom = '24px';

    // Header with title and new button
    const headerRow = createEl('div');
    headerRow.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;';

    const sectionTitle = createEl('h3', { textContent: '🔐 アクセス制御設定' });
    sectionTitle.style.margin = '0';

    const newBtn = createEl('button', { className: 'btn-primary' });
    newBtn.style.cssText = 'padding: 8px 16px; display: flex; align-items: center; gap: 8px;';
    const plusIcon = createEl('i', { className: 'fas fa-plus' });
    const btnText = createEl('span');
    setText(btnText, '新規ルール作成');
    newBtn.appendChild(plusIcon);
    newBtn.appendChild(btnText);
    newBtn.addEventListener('click', () => {
      openAccessControlModal('create');
    });

    headerRow.appendChild(sectionTitle);
    headerRow.appendChild(newBtn);
    card.appendChild(headerRow);

    const accessControlRules = securityManagementState.accessRules;

    // Create table
    const tableContainer = createEl('div');
    tableContainer.style.cssText = 'margin-top: 20px; overflow-x: auto;';

    const table = createEl('table');
    table.style.cssText = `
      width: 100%;
      border-collapse: collapse;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;
      overflow: hidden;
    `;

    // Table header
    const thead = createEl('thead');
    const accessHeaderRow = createEl('tr');
    accessHeaderRow.style.cssText = 'background: rgba(255, 255, 255, 0.05);';

    const headers = [
      'ルール名',
      'リソース種別',
      'リソース名',
      'プリンシパル',
      '権限',
      'ステータス',
      '操作'
    ];
    headers.forEach((headerText) => {
      const th = createEl('th');
      setText(th, headerText);
      th.style.cssText = `
        padding: 12px 16px;
        text-align: ${headerText === '操作' ? 'center' : 'left'};
        font-size: 13px;
        font-weight: 600;
        color: #1e293b;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      `;
      accessHeaderRow.appendChild(th);
    });
    thead.appendChild(accessHeaderRow);
    table.appendChild(thead);

    // Table body
    const tbody = createEl('tbody');

    if (accessControlRules.length === 0) {
      const emptyRow = createEl('tr');
      const emptyCell = createEl('td');
      emptyCell.colSpan = headers.length;
      emptyCell.style.cssText =
        'padding: 16px; text-align: center; color: #64748b; font-size: 14px;';
      setText(emptyCell, 'アクセス制御ルールがありません');
      emptyRow.appendChild(emptyCell);
      tbody.appendChild(emptyRow);
    }

    accessControlRules.forEach((rule) => {
      const row = createEl('tr');
      row.style.cssText = `
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
        transition: background 0.2s;
      `;
      row.addEventListener('mouseenter', () => {
        row.style.background = 'rgba(255, 255, 255, 0.03)';
      });
      row.addEventListener('mouseleave', () => {
        row.style.background = 'transparent';
      });

      // Rule Name
      const nameCell = createEl('td');
      setText(nameCell, rule.ruleName);
      nameCell.style.cssText = `
        padding: 12px 16px;
        font-size: 14px;
        color: #1e293b;
        font-weight: 500;
      `;
      row.appendChild(nameCell);

      // Resource Type
      const typeCell = createEl('td');
      const typeBadge = createEl('span');
      setText(typeBadge, rule.resourceType);
      typeBadge.style.cssText = `
        padding: 4px 8px;
        background: rgba(99, 102, 241, 0.2);
        border: 1px solid rgba(99, 102, 241, 0.3);
        border-radius: 6px;
        font-size: 12px;
        color: #818cf8;
        font-weight: 500;
      `;
      typeCell.appendChild(typeBadge);
      typeCell.style.cssText = 'padding: 12px 16px;';
      row.appendChild(typeCell);

      // Resource Name
      const resourceCell = createEl('td');
      setText(resourceCell, rule.resourceName);
      resourceCell.style.cssText = `
        padding: 12px 16px;
        font-size: 14px;
        color: #475569;
      `;
      row.appendChild(resourceCell);

      // Principal
      const principalCell = createEl('td');
      setText(principalCell, rule.principal);
      principalCell.style.cssText = `
        padding: 12px 16px;
        font-size: 14px;
        color: #475569;
      `;
      row.appendChild(principalCell);

      // Permissions
      const permCell = createEl('td');
      const permBadge = createEl('span');
      setText(permBadge, rule.permissions);
      permBadge.style.cssText = `
        padding: 4px 8px;
        background: rgba(16, 185, 129, 0.2);
        border: 1px solid rgba(16, 185, 129, 0.3);
        border-radius: 6px;
        font-size: 12px;
        color: #34d399;
        font-weight: 500;
      `;
      permCell.appendChild(permBadge);
      permCell.style.cssText = 'padding: 12px 16px;';
      row.appendChild(permCell);

      // Status
      const statusCell = createEl('td');
      const statusBadge = createEl('span');
      setText(statusBadge, rule.status);
      const statusColor =
        rule.status === 'Active'
          ? { bg: 'rgba(34, 197, 94, 0.2)', border: 'rgba(34, 197, 94, 0.3)', text: '#4ade80' }
          : { bg: 'rgba(107, 114, 128, 0.2)', border: 'rgba(107, 114, 128, 0.3)', text: '#9ca3af' };
      statusBadge.style.cssText = `
        padding: 4px 8px;
        background: ${statusColor.bg};
        border: 1px solid ${statusColor.border};
        border-radius: 6px;
        font-size: 12px;
        color: ${statusColor.text};
        font-weight: 500;
      `;
      statusCell.appendChild(statusBadge);
      statusCell.style.cssText = 'padding: 12px 16px;';
      row.appendChild(statusCell);

      // Actions column
      const actionsCell = createEl('td');
      actionsCell.style.cssText = 'padding: 12px 16px; text-align: center;';

      const actionsDiv = createEl('div');
      actionsDiv.style.cssText = 'display: flex; gap: 8px; justify-content: center;';

      // Edit button (blue)
      const editBtn = createEl('button');
      editBtn.style.cssText =
        'background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px; transition: background 0.2s;';
      editBtn.title = '編集';
      const editIcon = createEl('i', { className: 'fas fa-edit' });
      editBtn.appendChild(editIcon);
      editBtn.addEventListener('mouseenter', () => {
        editBtn.style.background = '#2563eb';
      });
      editBtn.addEventListener('mouseleave', () => {
        editBtn.style.background = '#3b82f6';
      });
      editBtn.addEventListener('click', () => {
        openAccessControlModal('edit', rule);
      });

      // Delete button (red)
      const deleteBtn = createEl('button');
      deleteBtn.style.cssText =
        'background: #ef4444; color: white; border: none; padding: 6px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 4px; transition: background 0.2s;';
      deleteBtn.title = '削除';
      const deleteIcon = createEl('i', { className: 'fas fa-trash' });
      deleteBtn.appendChild(deleteIcon);
      deleteBtn.addEventListener('mouseenter', () => {
        deleteBtn.style.background = '#dc2626';
      });
      deleteBtn.addEventListener('mouseleave', () => {
        deleteBtn.style.background = '#ef4444';
      });
      deleteBtn.addEventListener('click', () => {
        showDeleteConfirmDialog('アクセス制御ルール', rule.id, rule.ruleName, async () => {
          securityManagementState.accessRules = securityManagementState.accessRules.filter(
            (item) => item.id !== rule.id
          );
          Toast.success(`削除しました: ${rule.ruleName}`);
          refreshSecurityManagementView();
        });
      });

      actionsDiv.appendChild(editBtn);
      actionsDiv.appendChild(deleteBtn);
      actionsCell.appendChild(actionsDiv);
      row.appendChild(actionsCell);

      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    tableContainer.appendChild(table);
    card.appendChild(tableContainer);
    contentContainer.appendChild(card);
  }
}

function openSecurityPolicyModal(mode, policy = {}) {
  const isEdit = mode === 'edit';
  openModal(isEdit ? 'ポリシー編集' : '新規ポリシー作成');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  const nameGroup = createEl('div', { className: 'modal-form-group' });
  nameGroup.appendChild(createEl('label', { textContent: 'ポリシー名' }));
  const nameInput = createEl('input', {
    type: 'text',
    id: 'security-policy-name',
    value: policy.name || ''
  });
  nameGroup.appendChild(nameInput);
  modalBody.appendChild(nameGroup);

  const nistGroup = createEl('div', { className: 'modal-form-group' });
  nistGroup.appendChild(createEl('label', { textContent: 'NIST機能' }));
  const nistSelect = createEl('select', { id: 'security-policy-nist' });
  ['GV', 'ID', 'PR', 'DE', 'RS', 'RC'].forEach((func) => {
    const option = createEl('option', { value: func, textContent: func });
    if (func === policy.nist_function) option.selected = true;
    nistSelect.appendChild(option);
  });
  nistGroup.appendChild(nistSelect);
  modalBody.appendChild(nistGroup);

  const categoryGroup = createEl('div', { className: 'modal-form-group' });
  categoryGroup.appendChild(createEl('label', { textContent: 'カテゴリ' }));
  const categoryInput = createEl('input', {
    type: 'text',
    id: 'security-policy-category',
    value: policy.category || ''
  });
  categoryGroup.appendChild(categoryInput);
  modalBody.appendChild(categoryGroup);

  const statusGroup = createEl('div', { className: 'modal-form-group' });
  statusGroup.appendChild(createEl('label', { textContent: 'ステータス' }));
  const statusSelect = createEl('select', { id: 'security-policy-status' });
  const statusOptions = [
    { value: 'active', label: '有効' },
    { value: 'draft', label: '草案' }
  ];
  statusOptions.forEach((opt) => {
    const option = createEl('option', { value: opt.value, textContent: opt.label });
    if (opt.value === (policy.status || 'draft')) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  const reviewGroup = createEl('div', { className: 'modal-form-group' });
  reviewGroup.appendChild(createEl('label', { textContent: 'レビュー日' }));
  const reviewInput = createEl('input', {
    type: 'date',
    id: 'security-policy-review',
    value: policy.review_date || getTodayDate()
  });
  reviewGroup.appendChild(reviewInput);
  modalBody.appendChild(reviewGroup);

  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  const saveBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: isEdit ? '更新' : '作成'
  });
  saveBtn.addEventListener('click', () => {
    const payload = {
      name: document.getElementById('security-policy-name').value.trim(),
      nist_function: document.getElementById('security-policy-nist').value,
      category: document.getElementById('security-policy-category').value.trim(),
      status: document.getElementById('security-policy-status').value,
      review_date: document.getElementById('security-policy-review').value
    };

    if (!payload.name || !payload.category || !payload.review_date) {
      Toast.warning('ポリシー名、カテゴリ、レビュー日は必須です');
      return;
    }

    if (isEdit) {
      const index = securityManagementState.policies.findIndex((item) => item.id === policy.id);
      if (index === -1) {
        Toast.error('対象のポリシーが見つかりません');
        return;
      }
      securityManagementState.policies[index] = {
        ...securityManagementState.policies[index],
        ...payload
      };
      Toast.success('ポリシーを更新しました');
    } else {
      securityManagementState.policies.unshift({
        id: generateSecurityManagementId('POL'),
        ...payload
      });
      Toast.success('ポリシーを作成しました');
    }

    closeModal();
    refreshSecurityManagementView();
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
}

function openRiskAssessmentModal(mode, risk = {}) {
  const isEdit = mode === 'edit';
  openModal(isEdit ? 'リスク編集' : '新規リスク登録');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  const nameGroup = createEl('div', { className: 'modal-form-group' });
  nameGroup.appendChild(createEl('label', { textContent: 'リスク名' }));
  const nameInput = createEl('input', {
    type: 'text',
    id: 'security-risk-name',
    value: risk.name || ''
  });
  nameGroup.appendChild(nameInput);
  modalBody.appendChild(nameGroup);

  const levelGroup = createEl('div', { className: 'modal-form-group' });
  levelGroup.appendChild(createEl('label', { textContent: 'リスクレベル' }));
  const levelSelect = createEl('select', { id: 'security-risk-level' });
  ['Critical', 'High', 'Medium', 'Low'].forEach((level) => {
    const option = createEl('option', { value: level, textContent: level });
    if (level === (risk.level || 'Medium')) option.selected = true;
    levelSelect.appendChild(option);
  });
  levelGroup.appendChild(levelSelect);
  modalBody.appendChild(levelGroup);

  const impactGroup = createEl('div', { className: 'modal-form-group' });
  impactGroup.appendChild(createEl('label', { textContent: '影響度' }));
  const impactSelect = createEl('select', { id: 'security-risk-impact' });
  ['High', 'Medium', 'Low'].forEach((impact) => {
    const option = createEl('option', { value: impact, textContent: impact });
    if (impact === (risk.impact || 'Medium')) option.selected = true;
    impactSelect.appendChild(option);
  });
  impactGroup.appendChild(impactSelect);
  modalBody.appendChild(impactGroup);

  const probabilityGroup = createEl('div', { className: 'modal-form-group' });
  probabilityGroup.appendChild(createEl('label', { textContent: '発生可能性' }));
  const probabilitySelect = createEl('select', { id: 'security-risk-probability' });
  ['High', 'Medium', 'Low'].forEach((probability) => {
    const option = createEl('option', { value: probability, textContent: probability });
    if (probability === (risk.probability || 'Medium')) option.selected = true;
    probabilitySelect.appendChild(option);
  });
  probabilityGroup.appendChild(probabilitySelect);
  modalBody.appendChild(probabilityGroup);

  const statusGroup = createEl('div', { className: 'modal-form-group' });
  statusGroup.appendChild(createEl('label', { textContent: '対策状況' }));
  const statusSelect = createEl('select', { id: 'security-risk-status' });
  ['未対応', '対策中', '対策済'].forEach((status) => {
    const option = createEl('option', { value: status, textContent: status });
    if (status === (risk.status || '未対応')) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  const assigneeGroup = createEl('div', { className: 'modal-form-group' });
  assigneeGroup.appendChild(createEl('label', { textContent: '担当者' }));
  const assigneeInput = createEl('input', {
    type: 'text',
    id: 'security-risk-assignee',
    value: risk.assignee || ''
  });
  assigneeGroup.appendChild(assigneeInput);
  modalBody.appendChild(assigneeGroup);

  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  const saveBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: isEdit ? '更新' : '作成'
  });
  saveBtn.addEventListener('click', () => {
    const payload = {
      name: document.getElementById('security-risk-name').value.trim(),
      level: document.getElementById('security-risk-level').value,
      impact: document.getElementById('security-risk-impact').value,
      probability: document.getElementById('security-risk-probability').value,
      status: document.getElementById('security-risk-status').value,
      assignee: document.getElementById('security-risk-assignee').value.trim()
    };

    if (!payload.name) {
      Toast.warning('リスク名は必須です');
      return;
    }

    if (isEdit) {
      const index = securityManagementState.risks.findIndex((item) => item.id === risk.id);
      if (index === -1) {
        Toast.error('対象のリスクが見つかりません');
        return;
      }
      securityManagementState.risks[index] = {
        ...securityManagementState.risks[index],
        ...payload
      };
      Toast.success('リスクを更新しました');
    } else {
      securityManagementState.risks.unshift({
        id: generateSecurityManagementId('RISK'),
        ...payload
      });
      Toast.success('リスクを登録しました');
    }

    closeModal();
    refreshSecurityManagementView();
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
}

function openSecurityEventModal(mode, event = {}) {
  const isEdit = mode === 'edit';
  openModal(isEdit ? 'イベント編集' : '新規イベント登録');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  const nameGroup = createEl('div', { className: 'modal-form-group' });
  nameGroup.appendChild(createEl('label', { textContent: 'イベント名' }));
  const nameInput = createEl('input', {
    type: 'text',
    id: 'security-event-name',
    value: event.name || ''
  });
  nameGroup.appendChild(nameInput);
  modalBody.appendChild(nameGroup);

  const severityGroup = createEl('div', { className: 'modal-form-group' });
  severityGroup.appendChild(createEl('label', { textContent: '重要度' }));
  const severitySelect = createEl('select', { id: 'security-event-severity' });
  ['Critical', 'High', 'Medium', 'Low'].forEach((severity) => {
    const option = createEl('option', { value: severity, textContent: severity });
    if (severity === (event.severity || 'Medium')) option.selected = true;
    severitySelect.appendChild(option);
  });
  severityGroup.appendChild(severitySelect);
  modalBody.appendChild(severityGroup);

  const detectedGroup = createEl('div', { className: 'modal-form-group' });
  detectedGroup.appendChild(createEl('label', { textContent: '検知日時' }));
  const detectedInput = createEl('input', {
    type: 'datetime-local',
    id: 'security-event-detected',
    value: toDateTimeLocalValue(event.detectedAt) || getCurrentDateTimeLocal()
  });
  detectedGroup.appendChild(detectedInput);
  modalBody.appendChild(detectedGroup);

  const sourceGroup = createEl('div', { className: 'modal-form-group' });
  sourceGroup.appendChild(createEl('label', { textContent: '検知元' }));
  const sourceInput = createEl('input', {
    type: 'text',
    id: 'security-event-source',
    value: event.source || ''
  });
  sourceGroup.appendChild(sourceInput);
  modalBody.appendChild(sourceGroup);

  const statusGroup = createEl('div', { className: 'modal-form-group' });
  statusGroup.appendChild(createEl('label', { textContent: 'ステータス' }));
  const statusSelect = createEl('select', { id: 'security-event-status' });
  ['対応中', '調査中', '対応完了', '監視中'].forEach((status) => {
    const option = createEl('option', { value: status, textContent: status });
    if (status === (event.status || '対応中')) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  const assigneeGroup = createEl('div', { className: 'modal-form-group' });
  assigneeGroup.appendChild(createEl('label', { textContent: '担当者' }));
  const assigneeInput = createEl('input', {
    type: 'text',
    id: 'security-event-assignee',
    value: event.assignee || ''
  });
  assigneeGroup.appendChild(assigneeInput);
  modalBody.appendChild(assigneeGroup);

  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  const saveBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: isEdit ? '更新' : '作成'
  });
  saveBtn.addEventListener('click', () => {
    const detectedAt = document.getElementById('security-event-detected').value;
    const payload = {
      name: document.getElementById('security-event-name').value.trim(),
      severity: document.getElementById('security-event-severity').value,
      detectedAt: formatDateTimeLocal(detectedAt),
      source: document.getElementById('security-event-source').value.trim(),
      status: document.getElementById('security-event-status').value,
      assignee: document.getElementById('security-event-assignee').value.trim()
    };

    if (!payload.name || !payload.detectedAt) {
      Toast.warning('イベント名と検知日時は必須です');
      return;
    }

    if (isEdit) {
      const index = securityManagementState.events.findIndex((item) => item.id === event.id);
      if (index === -1) {
        Toast.error('対象のイベントが見つかりません');
        return;
      }
      securityManagementState.events[index] = {
        ...securityManagementState.events[index],
        ...payload
      };
      Toast.success('イベントを更新しました');
    } else {
      securityManagementState.events.unshift({
        id: generateSecurityManagementId('EVT'),
        ...payload
      });
      Toast.success('イベントを登録しました');
    }

    closeModal();
    refreshSecurityManagementView();
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
}

function openAccessControlModal(mode, rule = {}) {
  const isEdit = mode === 'edit';
  openModal(isEdit ? 'アクセス制御ルール編集' : '新規ルール作成');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  const nameGroup = createEl('div', { className: 'modal-form-group' });
  nameGroup.appendChild(createEl('label', { textContent: 'ルール名' }));
  const nameInput = createEl('input', {
    type: 'text',
    id: 'access-rule-name',
    value: rule.ruleName || ''
  });
  nameGroup.appendChild(nameInput);
  modalBody.appendChild(nameGroup);

  const typeGroup = createEl('div', { className: 'modal-form-group' });
  typeGroup.appendChild(createEl('label', { textContent: 'リソース種別' }));
  const typeInput = createEl('input', {
    type: 'text',
    id: 'access-rule-type',
    value: rule.resourceType || ''
  });
  typeGroup.appendChild(typeInput);
  modalBody.appendChild(typeGroup);

  const resourceGroup = createEl('div', { className: 'modal-form-group' });
  resourceGroup.appendChild(createEl('label', { textContent: 'リソース名' }));
  const resourceInput = createEl('input', {
    type: 'text',
    id: 'access-rule-resource',
    value: rule.resourceName || ''
  });
  resourceGroup.appendChild(resourceInput);
  modalBody.appendChild(resourceGroup);

  const principalGroup = createEl('div', { className: 'modal-form-group' });
  principalGroup.appendChild(createEl('label', { textContent: 'プリンシパル' }));
  const principalInput = createEl('input', {
    type: 'text',
    id: 'access-rule-principal',
    value: rule.principal || ''
  });
  principalGroup.appendChild(principalInput);
  modalBody.appendChild(principalGroup);

  const permGroup = createEl('div', { className: 'modal-form-group' });
  permGroup.appendChild(createEl('label', { textContent: '権限' }));
  const permInput = createEl('input', {
    type: 'text',
    id: 'access-rule-permissions',
    value: rule.permissions || ''
  });
  permGroup.appendChild(permInput);
  modalBody.appendChild(permGroup);

  const statusGroup = createEl('div', { className: 'modal-form-group' });
  statusGroup.appendChild(createEl('label', { textContent: 'ステータス' }));
  const statusSelect = createEl('select', { id: 'access-rule-status' });
  ['Active', 'Inactive'].forEach((status) => {
    const option = createEl('option', { value: status, textContent: status });
    if (status === (rule.status || 'Active')) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  const saveBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: isEdit ? '更新' : '作成'
  });
  saveBtn.addEventListener('click', () => {
    const payload = {
      ruleName: document.getElementById('access-rule-name').value.trim(),
      resourceType: document.getElementById('access-rule-type').value.trim(),
      resourceName: document.getElementById('access-rule-resource').value.trim(),
      principal: document.getElementById('access-rule-principal').value.trim(),
      permissions: document.getElementById('access-rule-permissions').value.trim(),
      status: document.getElementById('access-rule-status').value
    };

    if (!payload.ruleName || !payload.resourceType || !payload.resourceName || !payload.principal) {
      Toast.warning('ルール名、リソース種別、リソース名、プリンシパルは必須です');
      return;
    }

    if (isEdit) {
      const index = securityManagementState.accessRules.findIndex((item) => item.id === rule.id);
      if (index === -1) {
        Toast.error('対象のルールが見つかりません');
        return;
      }
      securityManagementState.accessRules[index] = {
        ...securityManagementState.accessRules[index],
        ...payload
      };
      Toast.success('アクセス制御ルールを更新しました');
    } else {
      securityManagementState.accessRules.unshift({
        id: generateSecurityManagementId('AC'),
        ...payload
      });
      Toast.success('アクセス制御ルールを作成しました');
    }

    closeModal();
    refreshSecurityManagementView();
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
}

// Security Alerts Panel
async function renderSecurityAlertsPanel(container) {
  const panel = createEl('div', { className: 'card-large glass security-alerts-panel' });
  panel.style.cssText = 'margin-bottom: 24px; padding: 24px; border-radius: 16px;';

  const panelHeader = createEl('div');
  panelHeader.style.cssText =
    'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

  const h3 = createEl('h3');
  setText(h3, '🚨 セキュリティアラート（リアルタイム）');
  panelHeader.appendChild(h3);

  const filterBtns = createEl('div');
  filterBtns.style.cssText = 'display: flex; gap: 8px;';

  let currentFilter = 'all';
  let currentAcknowledged = 'unacknowledged';

  async function refreshAlerts() {
    const response = await apiCall(
      `/security/alerts?severity=${currentFilter}&acknowledged=${currentAcknowledged}`
    );
    const alertsData = response.data || response;
    renderAlertsList(alertsData);
  }

  function renderAlertsList(alerts) {
    const existingList = panel.querySelector('.alerts-list');
    if (existingList) panel.removeChild(existingList);

    const alertsList = createEl('div');
    alertsList.className = 'alerts-list';

    if (alerts.length === 0) {
      const emptyMsg = createEl('div');
      emptyMsg.style.cssText =
        'text-align: center; padding: 32px; color: #64748b; font-size: 14px;';
      setText(emptyMsg, 'アラートはありません');
      alertsList.appendChild(emptyMsg);
    } else {
      alerts.forEach((alert) => {
        const alertCard = createEl('div');
        alertCard.style.cssText = `background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px; border-left: 4px solid ${getSeverityColor(alert.severity)}; box-shadow: 0 1px 3px rgba(0,0,0,0.1);`;

        const alertHeader = createEl('div');
        alertHeader.style.cssText =
          'display: flex; justify-content: space-between; align-items: start; margin-bottom: 8px;';

        const alertTitle = createEl('div');
        alertTitle.style.cssText = 'font-weight: 600; font-size: 14px; color: #1e293b;';
        setText(alertTitle, alert.title || 'Untitled Alert');
        alertHeader.appendChild(alertTitle);

        const severityBadge = createEl('span');
        severityBadge.className = `badge badge-${alert.severity.toLowerCase()}`;
        setText(severityBadge, alert.severity);
        alertHeader.appendChild(severityBadge);

        alertCard.appendChild(alertHeader);

        const alertDesc = createEl('div');
        alertDesc.style.cssText = 'font-size: 13px; color: #475569; margin-bottom: 8px;';
        setText(alertDesc, alert.description || 'No description');
        alertCard.appendChild(alertDesc);

        const alertMeta = createEl('div');
        alertMeta.style.cssText =
          'display: flex; justify-content: space-between; align-items: center; font-size: 12px; color: #64748b;';

        const timeEl = createEl('span');
        setText(timeEl, new Date(alert.created_at).toLocaleString('ja-JP'));
        alertMeta.appendChild(timeEl);

        if (!alert.acknowledged) {
          const ackBtn = createEl('button', { className: 'btn-secondary' });
          ackBtn.style.fontSize = '12px';
          ackBtn.style.padding = '4px 12px';
          setText(ackBtn, '確認済みにする');
          ackBtn.addEventListener('click', async () => {
            await acknowledgeAlert(alert.id);
            await refreshAlerts();
          });
          alertMeta.appendChild(ackBtn);
        } else {
          const ackLabel = createEl('span');
          ackLabel.style.color = '#10b981';
          setText(ackLabel, '✓ 確認済み');
          alertMeta.appendChild(ackLabel);
        }

        alertCard.appendChild(alertMeta);
        alertsList.appendChild(alertCard);
      });
    }

    panel.appendChild(alertsList);
  }

  const severityFilters = ['all', 'critical', 'high', 'medium', 'low'];
  severityFilters.forEach((severity) => {
    const btn = createEl('button', { className: 'btn-secondary' });
    btn.style.fontSize = '12px';
    btn.style.padding = '6px 12px';
    setText(btn, severity === 'all' ? 'すべて' : severity.toUpperCase());

    if (severity === currentFilter) {
      btn.style.background = '#3b82f6';
      btn.style.color = 'white';
    }

    btn.addEventListener('click', async () => {
      currentFilter = severity;
      filterBtns.childNodes.forEach((b) => {
        // eslint-disable-next-line no-param-reassign
        b.style.background = '';
        // eslint-disable-next-line no-param-reassign
        b.style.color = '';
      });
      btn.style.background = '#3b82f6';
      btn.style.color = 'white';
      await refreshAlerts();
    });

    filterBtns.appendChild(btn);
  });

  panelHeader.appendChild(filterBtns);
  panel.appendChild(panelHeader);

  // Acknowledged filter
  const ackFilterRow = createEl('div');
  ackFilterRow.style.cssText = 'margin-bottom: 16px;';

  const ackLabel = createEl('label');
  ackLabel.style.cssText = 'display: flex; align-items: center; gap: 8px; font-size: 14px;';

  const ackCheckbox = createEl('input', { type: 'checkbox' });
  ackCheckbox.addEventListener('change', async () => {
    currentAcknowledged = ackCheckbox.checked ? 'all' : 'unacknowledged';
    await refreshAlerts();
  });

  ackLabel.appendChild(ackCheckbox);
  ackLabel.appendChild(document.createTextNode('確認済みアラートを表示'));
  ackFilterRow.appendChild(ackLabel);
  panel.appendChild(ackFilterRow);

  // Initial load
  await refreshAlerts();

  container.appendChild(panel);
}

async function acknowledgeAlert(alertId) {
  try {
    await apiCall(`/security/alerts/${alertId}/acknowledge`, {
      method: 'PUT'
    });
    Toast.success('アラートを確認済みにしました');
  } catch (error) {
    Toast.error(`エラー: ${error.message}`);
  }
}

function getSeverityColor(severity) {
  const colors = {
    critical: '#dc2626',
    high: '#ea580c',
    medium: '#f59e0b',
    low: '#3b82f6',
    info: '#64748b'
  };
  return colors[severity.toLowerCase()] || '#64748b';
}

// Audit Logs Section
// eslint-disable-next-line no-unused-vars
async function renderAuditLogsSection(container) {
  const section = createEl('div', { className: 'card-large glass' });
  section.style.cssText = 'margin-bottom: 24px; padding: 24px; border-radius: 16px;';

  const h3 = createEl('h3');
  h3.style.marginBottom = '16px';
  setText(h3, '📋 監査ログ');
  section.appendChild(h3);

  try {
    const response = await apiCall('/security/audit-logs?limit=20');
    const logsData = Array.isArray(response) ? response : response.data || [];

    const tableWrapper = createEl('div');
    tableWrapper.className = 'table-wrapper';
    tableWrapper.style.maxHeight = '400px';
    tableWrapper.style.overflowY = 'auto';

    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    ['タイムスタンプ', 'ユーザー', 'アクション', 'リソース', 'IPアドレス'].forEach((headerText) => {
      headerRow.appendChild(createEl('th', { textContent: headerText }));
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    logsData.forEach((log) => {
      const row = createEl('tr');

      // Highlight security-related actions
      const securityActions = [
        'login_failed',
        'permission_denied',
        'security_alert',
        'access_denied'
      ];
      if (securityActions.includes(log.action)) {
        row.style.background = '#fef2f2';
      }

      const timestampValue = log.timestamp || log.created_at;
      row.appendChild(
        createEl('td', {
          textContent: timestampValue ? new Date(timestampValue).toLocaleString('ja-JP') : '-'
        })
      );
      const userLabel = log.user || log.username || (log.user_id ? String(log.user_id) : 'System');
      row.appendChild(createEl('td', { textContent: userLabel }));

      const actionCell = createEl('td');
      const actionText = createEl('span');
      setText(actionText, log.action);
      if (securityActions.includes(log.action)) {
        actionText.style.color = '#dc2626';
        actionText.style.fontWeight = '600';
      }
      actionCell.appendChild(actionText);
      row.appendChild(actionCell);

      const resourceLabel =
        log.resource ||
        (log.resource_type
          ? `${log.resource_type}${log.resource_id ? ` #${log.resource_id}` : ''}`
          : '-');
      row.appendChild(createEl('td', { textContent: resourceLabel }));
      row.appendChild(createEl('td', { textContent: log.ip_address || '-' }));

      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    tableWrapper.appendChild(table);
    section.appendChild(tableWrapper);
  } catch (error) {
    const errorMsg = createEl('div');
    errorMsg.style.cssText = 'color: #dc2626; padding: 16px;';
    setText(errorMsg, '監査ログの読み込みに失敗しました');
    section.appendChild(errorMsg);
  }

  container.appendChild(section);
}

// User Activity Section
// eslint-disable-next-line no-unused-vars
async function renderUserActivitySection(container) {
  const section = createEl('div', { className: 'card-large glass' });
  section.style.cssText = 'margin-bottom: 24px; padding: 24px; border-radius: 16px;';

  const h3 = createEl('h3');
  h3.style.marginBottom = '16px';
  setText(h3, '👤 ユーザーアクティビティ分析');
  section.appendChild(h3);

  // User selection dropdown
  const userSelectRow = createEl('div');
  userSelectRow.style.cssText = 'margin-bottom: 16px;';

  const userSelectLabel = createEl('label');
  userSelectLabel.style.cssText =
    'display: flex; flex-direction: column; gap: 8px; font-size: 14px;';
  setText(userSelectLabel, 'ユーザーを選択:');

  const userSelect = createEl('select');
  userSelect.style.cssText = 'padding: 8px; border: 1px solid #cbd5e1; border-radius: 4px;';

  try {
    // Fetch users list
    const response = await apiCall('/users');
    const usersData = response.data || response;
    usersData.forEach((user) => {
      const option = createEl('option', { value: String(user.id) });
      setText(option, `${user.username} (${user.email})`);
      userSelect.appendChild(option);
    });

    userSelect.addEventListener('change', async () => {
      const userId = userSelect.value;
      await loadUserActivity(userId, section);
    });

    userSelectLabel.appendChild(userSelect);
    userSelectRow.appendChild(userSelectLabel);
    section.appendChild(userSelectRow);

    // Load initial user activity
    if (usersData.length > 0) {
      await loadUserActivity(usersData[0].id, section);
    }
  } catch (error) {
    const errorMsg = createEl('div');
    errorMsg.style.cssText = 'color: #dc2626; padding: 16px;';
    setText(errorMsg, 'ユーザーデータの読み込みに失敗しました');
    section.appendChild(errorMsg);
  }

  container.appendChild(section);
}

async function loadUserActivity(userId, section) {
  const existingActivity = section.querySelector('.user-activity-content');
  if (existingActivity) section.removeChild(existingActivity);

  const activityContent = createEl('div');
  activityContent.className = 'user-activity-content';

  try {
    const activityData = await apiCall(`/security/user-activity/${userId}`);

    // Login/Logout history
    const historyDiv = createEl('div');
    historyDiv.style.marginBottom = '16px';

    const historyTitle = createEl('h4');
    historyTitle.style.cssText = 'font-size: 14px; margin-bottom: 8px;';
    setText(historyTitle, 'ログイン/ログアウト履歴（直近10件）');
    historyDiv.appendChild(historyTitle);

    if (activityData.login_history && activityData.login_history.length > 0) {
      const historyList = createEl('ul');
      historyList.style.cssText = 'list-style: none; padding: 0; font-size: 13px;';

      activityData.login_history.slice(0, 10).forEach((entry) => {
        const li = createEl('li');
        li.style.cssText =
          'padding: 8px; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between;';

        const actionSpan = createEl('span');
        setText(actionSpan, `${entry.action === 'login' ? '🟢 ログイン' : '🔴 ログアウト'}`);

        const timeSpan = createEl('span');
        timeSpan.style.color = '#64748b';
        setText(timeSpan, new Date(entry.timestamp).toLocaleString('ja-JP'));

        li.appendChild(actionSpan);
        li.appendChild(timeSpan);
        historyList.appendChild(li);
      });

      historyDiv.appendChild(historyList);
    } else {
      const noDataMsg = createEl('div');
      noDataMsg.style.cssText = 'color: #64748b; font-size: 13px;';
      setText(noDataMsg, 'ログイン履歴がありません');
      historyDiv.appendChild(noDataMsg);
    }

    activityContent.appendChild(historyDiv);

    // Anomaly warnings
    if (activityData.anomalies && activityData.anomalies.length > 0) {
      const anomalyDiv = createEl('div');
      anomalyDiv.style.cssText =
        'background: #fef2f2; border-left: 4px solid #dc2626; padding: 12px; border-radius: 4px;';

      const anomalyTitle = createEl('h4');
      anomalyTitle.style.cssText = 'font-size: 14px; color: #dc2626; margin-bottom: 8px;';
      setText(anomalyTitle, '⚠️ 異常なアクティビティ検出');
      anomalyDiv.appendChild(anomalyTitle);

      const anomalyList = createEl('ul');
      anomalyList.style.cssText =
        'list-style: disc; padding-left: 20px; font-size: 13px; color: #7f1d1d;';

      activityData.anomalies.forEach((anomaly) => {
        const li = createEl('li');
        setText(li, anomaly.description);
        anomalyList.appendChild(li);
      });

      anomalyDiv.appendChild(anomalyList);
      activityContent.appendChild(anomalyDiv);
    }
  } catch (error) {
    const errorMsg = createEl('div');
    errorMsg.style.cssText = 'color: #dc2626; padding: 16px;';
    setText(errorMsg, 'ユーザーアクティビティの読み込みに失敗しました');
    activityContent.appendChild(errorMsg);
  }

  section.appendChild(activityContent);
}

// Security Charts
async function renderSecurityCharts(container, dashboardData) {
  const chartsSection = createEl('div', { className: 'card-large glass' });
  chartsSection.style.cssText = 'margin-bottom: 24px; padding: 24px; border-radius: 16px;';

  const h3 = createEl('h3');
  h3.style.marginBottom = '24px';
  setText(h3, '📊 セキュリティ分析チャート');
  chartsSection.appendChild(h3);

  const chartsGrid = createEl('div');
  chartsGrid.style.cssText =
    'display: grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap: 24px;';

  // Chart 1: Login Attempts Timeline
  const loginChart = createEl('div');
  const loginCanvas = createEl('canvas', { id: 'security-login-chart' });
  loginCanvas.style.maxHeight = '300px';
  loginChart.appendChild(loginCanvas);
  chartsGrid.appendChild(loginChart);

  // Chart 2: Failed Logins by IP
  const ipChart = createEl('div');
  const ipCanvas = createEl('canvas', { id: 'security-ip-chart' });
  ipCanvas.style.maxHeight = '300px';
  ipChart.appendChild(ipCanvas);
  chartsGrid.appendChild(ipChart);

  // Chart 3: User Activity Distribution
  const activityChart = createEl('div');
  const activityCanvas = createEl('canvas', { id: 'security-activity-chart' });
  activityCanvas.style.maxHeight = '300px';
  activityChart.appendChild(activityCanvas);
  chartsGrid.appendChild(activityChart);

  chartsSection.appendChild(chartsGrid);
  container.appendChild(chartsSection);

  // Wait for DOM to be ready before rendering charts
  setTimeout(() => {
    // Chart 1: Login Attempts
    if (dashboardData.login_timeline) {
      // eslint-disable-next-line no-new
      new Chart(document.getElementById('security-login-chart'), {
        type: 'line',
        data: {
          labels: dashboardData.login_timeline.labels || [],
          datasets: [
            {
              label: '成功',
              data: dashboardData.login_timeline.successful || [],
              borderColor: '#10b981',
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              tension: 0.4
            },
            {
              label: '失敗',
              data: dashboardData.login_timeline.failed || [],
              borderColor: '#dc2626',
              backgroundColor: 'rgba(220, 38, 38, 0.1)',
              tension: 0.4
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'ログイン試行の時系列グラフ（24時間）'
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }

    // Chart 2: Failed Logins by IP
    if (dashboardData.failed_logins_by_ip) {
      // eslint-disable-next-line no-new
      new Chart(document.getElementById('security-ip-chart'), {
        type: 'bar',
        data: {
          labels: dashboardData.failed_logins_by_ip.ips || [],
          datasets: [
            {
              label: '失敗回数',
              data: dashboardData.failed_logins_by_ip.counts || [],
              backgroundColor: '#dc2626'
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: '失敗ログインのIP別分布（上位10件）'
            }
          },
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
    }

    // Chart 3: User Activity
    if (dashboardData.user_activity) {
      // eslint-disable-next-line no-new
      new Chart(document.getElementById('security-activity-chart'), {
        type: 'doughnut',
        data: {
          labels: dashboardData.user_activity.users || [],
          datasets: [
            {
              label: 'アクティビティ数',
              data: dashboardData.user_activity.counts || [],
              backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: 'ユーザー別アクティビティ度（上位6名）'
            }
          }
        }
      });
    }
  }, 100);
}

// ===== Placeholder View =====

function renderPlaceholder(container, viewName) {
  const placeholder = createEl('div', { className: 'placeholder-view' });
  placeholder.style.textAlign = 'center';
  placeholder.style.padding = '64px';

  placeholder.appendChild(createEl('i', { className: 'fas fa-tools' })).style.fontSize = '4rem';
  placeholder.appendChild(createEl('h2', { textContent: `${viewName}` }));
  placeholder.appendChild(createEl('p', { textContent: 'この機能は現在開発中です' }));

  container.appendChild(placeholder);
}

// ===== Error View =====

function renderError(container, message) {
  if (!container) return; // Null check
  clearElement(container);

  const errorDiv = createEl('div', { className: 'error-view' });
  errorDiv.style.padding = '32px';
  errorDiv.style.background = '#fee2e2';
  errorDiv.style.borderRadius = '12px';
  errorDiv.style.color = '#991b1b';

  errorDiv.appendChild(createEl('i', { className: 'fas fa-exclamation-triangle' }));
  errorDiv.appendChild(createEl('h3', { textContent: 'エラー' }));
  errorDiv.appendChild(createEl('p', { textContent: message }));

  container.appendChild(errorDiv);
}

// ===== Event Listeners =====

// ===== Mobile Navigation Functions =====

/**
 * モバイルナビゲーションの初期化
 * サイドバーのトグル、オーバーレイクリック、ナビゲーションアイテムクリック時の処理
 */
function initMobileNavigation() {
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.querySelector('.sidebar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');
  const navItems = document.querySelectorAll('.nav-item');

  // サイドバートグルボタンクリック
  if (sidebarToggle) {
    sidebarToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
      sidebarOverlay.classList.toggle('active');
    });
  }

  // オーバーレイクリックでサイドバーを閉じる
  if (sidebarOverlay) {
    sidebarOverlay.addEventListener('click', () => {
      sidebar.classList.remove('active');
      sidebarOverlay.classList.remove('active');
    });
  }

  // ナビゲーションアイテムクリック時にサイドバーを閉じる（モバイルのみ）
  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      // ウィンドウ幅が768px以下の場合のみサイドバーを閉じる
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
      }
    });
  });

  // ウィンドウリサイズ時の処理
  window.addEventListener('resize', () => {
    // デスクトップサイズに戻った場合はサイドバーとオーバーレイをリセット
    if (window.innerWidth > 768) {
      sidebar.classList.remove('active');
      sidebarOverlay.classList.remove('active');
    }
  });
}

// ===== Event Listeners =====

document.addEventListener('DOMContentLoaded', async () => {
  // Initialize i18n
  try {
    await window.i18nInit();
    console.log('[i18n] Internationalization initialized');
  } catch (error) {
    console.error('[i18n] Failed to initialize i18n:', error);
  }

  // Check for URL parameters (auto-login support)
  const urlParams = new URLSearchParams(window.location.search);
  const urlUsername = urlParams.get('username');
  const urlPassword = urlParams.get('password');

  if (urlUsername && urlPassword) {
    // Auto-login from URL parameters
    console.log('[Auto-Login] Attempting login from URL parameters...');
    const result = await login(urlUsername, urlPassword);

    if (result.success) {
      console.log('[Auto-Login] Success');
      // Remove credentials from URL for security
      window.history.replaceState({}, document.title, window.location.pathname);
    } else {
      console.error('[Auto-Login] Failed:', result.error);
    }
  }

  // Check authentication
  const isAuthenticated = await checkAuth();

  // Load default view if authenticated
  if (isAuthenticated) {
    loadView('dash');
  }

  // Initialize Mobile Navigation
  initMobileNavigation();

  // Login Form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('username').value;
      const password = document.getElementById('password').value;
      const errorEl = document.getElementById('login-error');

      const result = await login(username, password);

      if (!result.success) {
        if (result.requires2FA) {
          // Show 2FA modal
          errorEl.style.display = 'none';
          show2FALoginModal(result.username, result.password);
        } else {
          errorEl.style.display = 'block';
          setText(errorEl, result.error || 'ログインに失敗しました');
        }
      } else {
        errorEl.style.display = 'none';
        loginForm.reset();
      }
    });
  }

  // Logout Button
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      if (confirm('ログアウトしますか？')) {
        logout();
      }
    });
  }

  // Navigation Items
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const viewId = item.getAttribute('data-view');

      navItems.forEach((i) => i.classList.remove('active'));
      item.classList.add('active');

      loadView(viewId);
    });
  });

  // Modal Close Handlers
  const modalOverlay = document.getElementById('modal-overlay');
  const modalCloseBtn = document.getElementById('modal-close');

  if (modalCloseBtn) {
    modalCloseBtn.addEventListener('click', closeModal);
  }

  if (modalOverlay) {
    modalOverlay.addEventListener('click', (e) => {
      if (e.target === modalOverlay) {
        closeModal();
      }
    });
  }

  // ESC key to close modal
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeModal();
    }
  });
});

// ===== Modal Functions =====

function openModal(title) {
  const overlay = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, title);
  clearElement(modalBody);
  clearElement(modalFooter);

  overlay.style.display = 'flex';
  overlay.classList.remove('closing');
}

function closeModal() {
  const overlay = document.getElementById('modal-overlay');
  overlay.classList.add('closing');

  setTimeout(() => {
    overlay.style.display = 'none';
    overlay.classList.remove('closing');
  }, 200);
}

// ===== Incident Detail Modal =====

async function openIncidentDetailModal(incident) {
  openModal('インシデント詳細');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  // Create form for editing
  const form = createEl('form', { id: 'incident-detail-form' });

  // Ticket ID (Read-only)
  const ticketGroup = createEl('div', { className: 'modal-form-group' });
  ticketGroup.appendChild(createEl('label', { textContent: 'チケットID' }));
  const ticketInput = createEl('input', {
    type: 'text',
    value: incident.ticket_id,
    disabled: true
  });
  ticketGroup.appendChild(ticketInput);
  form.appendChild(ticketGroup);

  // Title
  const titleGroup = createEl('div', { className: 'modal-form-group' });
  titleGroup.appendChild(createEl('label', { textContent: 'タイトル' }));
  const titleInput = createEl('input', {
    type: 'text',
    id: 'incident-title',
    value: incident.title,
    required: true
  });
  titleGroup.appendChild(titleInput);
  form.appendChild(titleGroup);

  // Priority
  const priorityGroup = createEl('div', { className: 'modal-form-group' });
  priorityGroup.appendChild(createEl('label', { textContent: '優先度' }));
  const prioritySelect = createEl('select', { id: 'incident-priority' });
  ['Critical', 'High', 'Medium', 'Low'].forEach((p) => {
    const option = createEl('option', { value: p, textContent: p });
    if (p === incident.priority) {
      option.selected = true;
    }
    prioritySelect.appendChild(option);
  });
  priorityGroup.appendChild(prioritySelect);
  form.appendChild(priorityGroup);

  // Status
  const statusGroup = createEl('div', { className: 'modal-form-group' });
  statusGroup.appendChild(createEl('label', { textContent: 'ステータス' }));
  const statusSelect = createEl('select', { id: 'incident-status' });
  ['Open', 'In Progress', 'Resolved', 'Closed'].forEach((s) => {
    const option = createEl('option', { value: s, textContent: s });
    if (s === incident.status) {
      option.selected = true;
    }
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusSelect);
  form.appendChild(statusGroup);

  // Description
  const descGroup = createEl('div', { className: 'modal-form-group' });
  descGroup.appendChild(createEl('label', { textContent: '説明' }));
  const descTextarea = createEl('textarea', { id: 'incident-description' });
  descTextarea.value = incident.description || '';
  descGroup.appendChild(descTextarea);
  form.appendChild(descGroup);

  // Created At (Read-only)
  const createdGroup = createEl('div', { className: 'modal-form-group' });
  createdGroup.appendChild(createEl('label', { textContent: '作成日時' }));
  const createdInput = createEl('input', {
    type: 'text',
    value: new Date(incident.created_at).toLocaleString('ja-JP'),
    disabled: true
  });
  createdGroup.appendChild(createdInput);
  form.appendChild(createdGroup);

  modalBody.appendChild(form);

  // Footer buttons
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);
  modalFooter.appendChild(cancelBtn);

  const saveBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: '保存'
  });
  saveBtn.addEventListener('click', async () => {
    await saveIncidentChanges(incident.id);
  });
  modalFooter.appendChild(saveBtn);
}

async function saveIncidentChanges(incidentId) {
  const title = document.getElementById('incident-title').value.trim();
  const priority = document.getElementById('incident-priority').value;
  const status = document.getElementById('incident-status').value;
  const description = document.getElementById('incident-description').value.trim();

  if (!title) {
    Toast.warning('タイトルを入力してください');
    return;
  }

  try {
    await apiCall(`/incidents/${incidentId}`, {
      method: 'PUT',
      body: JSON.stringify({
        title,
        priority,
        status,
        description
      })
    });

    Toast.success('インシデントを更新しました');
    closeModal();
    loadView('incidents');
  } catch (error) {
    Toast.error(`エラー: ${error.message}`);
  }
}

// ===== Create Incident Modal =====

function openCreateIncidentModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'インシデント新規作成');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Title
  const titleGroup = createEl('div', { className: 'modal-form-group' });
  const titleLabel = createEl('label', { textContent: 'タイトル' });
  const titleInput = createEl('input', { type: 'text', id: 'incident-title' });
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  modalBody.appendChild(titleGroup);

  // Priority
  const priorityGroup = createEl('div', { className: 'modal-form-group' });
  const priorityLabel = createEl('label', { textContent: '優先度' });
  const prioritySelect = createEl('select', { id: 'incident-priority' });
  ['Critical', 'High', 'Medium', 'Low'].forEach((p) => {
    prioritySelect.appendChild(createEl('option', { value: p, textContent: p }));
  });
  priorityGroup.appendChild(priorityLabel);
  priorityGroup.appendChild(prioritySelect);
  modalBody.appendChild(priorityGroup);

  // Description
  const descGroup = createEl('div', { className: 'modal-form-group' });
  const descLabel = createEl('label', { textContent: '説明' });
  const descTextarea = createEl('textarea', { id: 'incident-description' });
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);
  modalBody.appendChild(descGroup);

  // Security Incident
  const securityGroup = createEl('div', { className: 'modal-form-group' });
  const securityLabel = createEl('label', { className: 'checkbox-label' });
  const securityCheckbox = createEl('input', { type: 'checkbox', id: 'incident-security' });
  securityLabel.appendChild(securityCheckbox);
  securityLabel.appendChild(document.createTextNode(' セキュリティインシデント'));
  securityGroup.appendChild(securityLabel);
  modalBody.appendChild(securityGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: '保存'
  });
  saveBtn.addEventListener('click', saveNewIncident);

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);

  modal.style.display = 'flex';
}

async function saveNewIncident() {
  const data = {
    title: document.getElementById('incident-title').value,
    priority: document.getElementById('incident-priority').value,
    description: document.getElementById('incident-description').value,
    is_security_incident: document.getElementById('incident-security').checked
  };

  if (!data.title || !data.description) {
    Toast.warning('タイトルと説明を入力してください');
    return;
  }

  try {
    await apiCall('/incidents', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    Toast.success('インシデントを作成しました');
    closeModal();
    loadView('incidents');
  } catch (error) {
    Toast.error(`エラー: ${error.message}`);
  }
}

// ===== Create Problem Modal =====

function openCreateProblemModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, '問題新規作成');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Title
  const titleGroup = createEl('div', { className: 'modal-form-group' });
  const titleLabel = createEl('label', { textContent: 'タイトル' });
  const titleInput = createEl('input', { type: 'text', id: 'problem-title' });
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  modalBody.appendChild(titleGroup);

  // Description
  const descGroup = createEl('div', { className: 'modal-form-group' });
  const descLabel = createEl('label', { textContent: '説明' });
  const descTextarea = createEl('textarea', { id: 'problem-description' });
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);
  modalBody.appendChild(descGroup);

  // Priority
  const priorityGroup = createEl('div', { className: 'modal-form-group' });
  const priorityLabel = createEl('label', { textContent: '優先度' });
  const prioritySelect = createEl('select', { id: 'problem-priority' });
  ['Critical', 'High', 'Medium', 'Low'].forEach((p) => {
    prioritySelect.appendChild(createEl('option', { value: p, textContent: p }));
  });
  priorityGroup.appendChild(priorityLabel);
  priorityGroup.appendChild(prioritySelect);
  modalBody.appendChild(priorityGroup);

  // Related Incidents
  const incidentsGroup = createEl('div', { className: 'modal-form-group' });
  const incidentsLabel = createEl('label', { textContent: '関連インシデント数' });
  const incidentsInput = createEl('input', {
    type: 'number',
    id: 'problem-incidents',
    value: '0',
    min: '0'
  });
  incidentsGroup.appendChild(incidentsLabel);
  incidentsGroup.appendChild(incidentsInput);
  modalBody.appendChild(incidentsGroup);

  // Assignee
  const assigneeGroup = createEl('div', { className: 'modal-form-group' });
  const assigneeLabel = createEl('label', { textContent: '担当者' });
  const assigneeInput = createEl('input', { type: 'text', id: 'problem-assignee' });
  assigneeGroup.appendChild(assigneeLabel);
  assigneeGroup.appendChild(assigneeInput);
  modalBody.appendChild(assigneeGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: '保存'
  });
  saveBtn.addEventListener('click', saveNewProblem);

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);

  modal.style.display = 'flex';
}

async function saveNewProblem() {
  const data = {
    title: document.getElementById('problem-title').value,
    description: document.getElementById('problem-description').value,
    priority: document.getElementById('problem-priority').value,
    related_incidents: parseInt(document.getElementById('problem-incidents').value, 10) || 0,
    assignee: document.getElementById('problem-assignee').value
  };

  if (!data.title) {
    Toast.warning('タイトルを入力してください');
    return;
  }

  Toast.info(
    `問題管理APIは未実装です。以下のデータが送信される予定です:\n\n${JSON.stringify(data, null, 2)}`
  );
}

// ===== Create RFC Modal =====

async function openCreateRFCModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  // Assets array will be populated after modal setup
  let assets = [];

  setText(modalTitle, 'RFC新規作成');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Title
  const titleGroup = createEl('div', { className: 'modal-form-group' });
  const titleLabel = createEl('label', { textContent: 'タイトル' });
  const titleInput = createEl('input', { type: 'text', id: 'rfc-title' });
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  modalBody.appendChild(titleGroup);

  // Description
  const descGroup = createEl('div', { className: 'modal-form-group' });
  const descLabel = createEl('label', { textContent: '説明' });
  const descTextarea = createEl('textarea', { id: 'rfc-description' });
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);
  modalBody.appendChild(descGroup);

  // Target Asset
  const assetGroup = createEl('div', { className: 'modal-form-group' });
  const assetLabel = createEl('label', { textContent: '対象資産' });
  const assetSelect = createEl('select', { id: 'rfc-asset' });
  assetSelect.appendChild(createEl('option', { value: '', textContent: '選択してください' }));
  // Assets will be populated after modal opens
  assetGroup.appendChild(assetLabel);
  assetGroup.appendChild(assetSelect);
  modalBody.appendChild(assetGroup);

  // Impact Level
  const impactGroup = createEl('div', { className: 'modal-form-group' });
  const impactLabel = createEl('label', { textContent: '影響度' });
  const impactSelect = createEl('select', { id: 'rfc-impact' });
  ['Low', 'Medium', 'High'].forEach((i) => {
    impactSelect.appendChild(createEl('option', { value: i, textContent: i }));
  });
  impactGroup.appendChild(impactLabel);
  impactGroup.appendChild(impactSelect);
  modalBody.appendChild(impactGroup);

  // Requester
  const requesterGroup = createEl('div', { className: 'modal-form-group' });
  const requesterLabel = createEl('label', { textContent: '申請者' });
  const requesterInput = createEl('input', {
    type: 'text',
    id: 'rfc-requester',
    value: currentUser ? currentUser.username : ''
  });
  requesterGroup.appendChild(requesterLabel);
  requesterGroup.appendChild(requesterInput);
  modalBody.appendChild(requesterGroup);

  // Security Change
  const securityGroup = createEl('div', { className: 'modal-form-group' });
  const securityLabel = createEl('label', { className: 'checkbox-label' });
  const securityCheckbox = createEl('input', { type: 'checkbox', id: 'rfc-security' });
  securityLabel.appendChild(securityCheckbox);
  securityLabel.appendChild(document.createTextNode(' セキュリティ変更'));
  securityGroup.appendChild(securityLabel);
  modalBody.appendChild(securityGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: '保存'
  });
  saveBtn.addEventListener('click', saveNewRFC);

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);

  modal.style.display = 'flex';

  // Fetch assets after modal opens
  try {
    const assetsResponse = await apiCall('/assets');
    const resolvedAssets = assetsResponse.data || assetsResponse || [];
    assets = Array.isArray(resolvedAssets) ? resolvedAssets : [];
    clearElement(assetSelect);
    assetSelect.appendChild(createEl('option', { value: '', textContent: '選択してください' }));
    assets.forEach((asset) => {
      assetSelect.appendChild(
        createEl('option', { value: asset.id, textContent: `${asset.asset_tag} - ${asset.name}` })
      );
    });
  } catch (error) {
    console.error('Failed to load assets:', error);
    clearElement(assetSelect);
    assetSelect.appendChild(createEl('option', { value: '', textContent: '資産の読み込みに失敗' }));
  }
}

async function saveNewRFC() {
  const title = document.getElementById('rfc-title').value.trim();
  const description = document.getElementById('rfc-description').value.trim();
  const assetId = document.getElementById('rfc-asset').value;
  const impactLevel = document.getElementById('rfc-impact').value;
  const requester = document.getElementById('rfc-requester').value.trim();
  const isSecurityChange = document.getElementById('rfc-security').checked;

  if (!title || !description) {
    Toast.warning('タイトルと説明を入力してください');
    return;
  }

  try {
    const payload = {
      title,
      description,
      impact_level: impactLevel,
      requester: requester || (currentUser ? currentUser.username : 'Unknown'),
      is_security_change: isSecurityChange
    };

    if (assetId) {
      payload.affected_asset_id = parseInt(assetId, 10);
    }

    await apiCall('/changes', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    Toast.success('RFCを作成しました');
    closeModal();
    loadView('changes');
  } catch (error) {
    Toast.error(`エラー: ${error.message}`);
  }
}

// ===== Create Vulnerability Modal =====

async function openCreateVulnerabilityModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, '脆弱性新規作成');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Fetch assets for selection
  let assets = [];
  try {
    const assetsResponse = await apiCall('/assets');
    const resolvedAssets = assetsResponse.data || assetsResponse || [];
    assets = Array.isArray(resolvedAssets) ? resolvedAssets : [];
  } catch (error) {
    console.error('Failed to load assets:', error);
  }

  // Title
  const titleGroup = createEl('div', { className: 'modal-form-group' });
  const titleLabel = createEl('label', { textContent: 'タイトル' });
  const titleInput = createEl('input', { type: 'text', id: 'vuln-title' });
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  modalBody.appendChild(titleGroup);

  // Description
  const descGroup = createEl('div', { className: 'modal-form-group' });
  const descLabel = createEl('label', { textContent: '説明' });
  const descTextarea = createEl('textarea', { id: 'vuln-description' });
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);
  modalBody.appendChild(descGroup);

  // Severity
  const severityGroup = createEl('div', { className: 'modal-form-group' });
  const severityLabel = createEl('label', { textContent: '深刻度' });
  const severitySelect = createEl('select', { id: 'vuln-severity' });
  ['Critical', 'High', 'Medium', 'Low', 'Info'].forEach((s) => {
    severitySelect.appendChild(createEl('option', { value: s, textContent: s }));
  });
  severityGroup.appendChild(severityLabel);
  severityGroup.appendChild(severitySelect);
  modalBody.appendChild(severityGroup);

  // CVSS Score
  const cvssGroup = createEl('div', { className: 'modal-form-group' });
  const cvssLabel = createEl('label', { textContent: 'CVSSスコア' });
  const cvssInput = createEl('input', {
    type: 'number',
    id: 'vuln-cvss',
    min: '0',
    max: '10',
    step: '0.1',
    value: '0.0'
  });
  cvssGroup.appendChild(cvssLabel);
  cvssGroup.appendChild(cvssInput);
  modalBody.appendChild(cvssGroup);

  // Affected Asset
  const assetGroup = createEl('div', { className: 'modal-form-group' });
  const assetLabel = createEl('label', { textContent: '影響を受ける資産' });
  const assetSelect = createEl('select', { id: 'vuln-asset' });
  assetSelect.appendChild(createEl('option', { value: '', textContent: '読み込み中...' }));
  assetGroup.appendChild(assetLabel);
  assetGroup.appendChild(assetSelect);
  modalBody.appendChild(assetGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: '保存'
  });
  saveBtn.addEventListener('click', saveNewVulnerability);

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);

  modal.style.display = 'flex';

  // Fetch assets after modal opens
  try {
    const assetsResponse = await apiCall('/assets');
    const resolvedAssets = assetsResponse.data || assetsResponse || [];
    assets = Array.isArray(resolvedAssets) ? resolvedAssets : [];
    clearElement(assetSelect);
    assetSelect.appendChild(createEl('option', { value: '', textContent: '選択してください' }));
    assets.forEach((asset) => {
      assetSelect.appendChild(
        createEl('option', {
          value: asset.asset_tag,
          textContent: `${asset.asset_tag} - ${asset.name}`
        })
      );
    });
  } catch (error) {
    console.error('Failed to load assets:', error);
    clearElement(assetSelect);
    assetSelect.appendChild(createEl('option', { value: '', textContent: '取得に失敗しました' }));
  }
}

async function saveNewVulnerability() {
  const data = {
    title: document.getElementById('vuln-title').value,
    description: document.getElementById('vuln-description').value,
    severity: document.getElementById('vuln-severity').value,
    cvss_score: parseFloat(document.getElementById('vuln-cvss').value) || 0.0,
    affected_asset: document.getElementById('vuln-asset').value
  };

  if (!data.title) {
    Toast.warning('タイトルを入力してください');
    return;
  }

  Toast.info(
    `脆弱性管理APIは未実装です。以下のデータが送信される予定です:\n\n${JSON.stringify(data, null, 2)}`
  );
}

// ===== Create Release Modal =====

function openCreateReleaseModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'リリース新規作成');
  clearElement(modalBody);
  clearElement(modalFooter);

  // リリース名（必須）
  const nameGroup = createEl('div', { className: 'modal-form-group' });
  const nameLabel = createEl('label', { textContent: 'リリース名' });
  const nameInput = createEl('input', { type: 'text', id: 'release-name' });
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  modalBody.appendChild(nameGroup);

  // バージョン（必須）
  const versionGroup = createEl('div', { className: 'modal-form-group' });
  const versionLabel = createEl('label', { textContent: 'バージョン' });
  const versionInput = createEl('input', {
    type: 'text',
    id: 'release-version',
    placeholder: 'v1.2.0'
  });
  versionGroup.appendChild(versionLabel);
  versionGroup.appendChild(versionInput);
  modalBody.appendChild(versionGroup);

  // 説明
  const descGroup = createEl('div', { className: 'modal-form-group' });
  const descLabel = createEl('label', { textContent: '説明' });
  const descTextarea = createEl('textarea', { id: 'release-description' });
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);
  modalBody.appendChild(descGroup);

  // 対象環境
  const envGroup = createEl('div', { className: 'modal-form-group' });
  const envLabel = createEl('label', { textContent: '対象環境' });
  const envSelect = createEl('select', { id: 'release-environment' });
  ['Development', 'Staging', 'Production'].forEach((env) => {
    envSelect.appendChild(createEl('option', { value: env, textContent: env }));
  });
  envGroup.appendChild(envLabel);
  envGroup.appendChild(envSelect);
  modalBody.appendChild(envGroup);

  // リリース予定日
  const dateGroup = createEl('div', { className: 'modal-form-group' });
  const dateLabel = createEl('label', { textContent: 'リリース予定日' });
  const dateInput = createEl('input', { type: 'date', id: 'release-date' });
  dateGroup.appendChild(dateLabel);
  dateGroup.appendChild(dateInput);
  modalBody.appendChild(dateGroup);

  // 含まれる変更数
  const changeCountGroup = createEl('div', { className: 'modal-form-group' });
  const changeCountLabel = createEl('label', { textContent: '含まれる変更数' });
  const changeCountInput = createEl('input', {
    type: 'number',
    id: 'release-change-count',
    value: '0',
    min: '0'
  });
  changeCountGroup.appendChild(changeCountLabel);
  changeCountGroup.appendChild(changeCountInput);
  modalBody.appendChild(changeCountGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: '保存'
  });
  saveBtn.addEventListener('click', saveNewRelease);

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);

  modal.style.display = 'flex';
}

async function saveNewRelease() {
  const data = {
    name: document.getElementById('release-name').value,
    version: document.getElementById('release-version').value,
    description: document.getElementById('release-description').value,
    target_environment: document.getElementById('release-environment').value,
    release_date: document.getElementById('release-date').value,
    change_count: parseInt(document.getElementById('release-change-count').value, 10) || 0
  };

  if (!data.name || !data.version) {
    Toast.warning('リリース名とバージョンを入力してください');
    return;
  }

  try {
    await apiCall('/releases', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    Toast.success('リリースを作成しました');
    closeModal();
    loadView('releases');
  } catch (error) {
    Toast.error(`エラー: ${error.message}`);
  }
}

// ===== Create Service Request Modal =====

function openCreateServiceRequestModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'サービス要求新規作成');
  clearElement(modalBody);
  clearElement(modalFooter);

  // 要求タイプ
  const typeGroup = createEl('div', { className: 'modal-form-group' });
  const typeLabel = createEl('label', { textContent: '要求タイプ' });
  const typeSelect = createEl('select', { id: 'service-request-type' });
  ['アカウント作成', 'アクセス権限', 'ソフトウェアインストール', 'その他'].forEach((type) => {
    typeSelect.appendChild(createEl('option', { value: type, textContent: type }));
  });
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeSelect);
  modalBody.appendChild(typeGroup);

  // タイトル（必須）
  const titleGroup = createEl('div', { className: 'modal-form-group' });
  const titleLabel = createEl('label', { textContent: 'タイトル' });
  const titleInput = createEl('input', { type: 'text', id: 'service-request-title' });
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  modalBody.appendChild(titleGroup);

  // 説明（必須）
  const descGroup = createEl('div', { className: 'modal-form-group' });
  const descLabel = createEl('label', { textContent: '説明' });
  const descTextarea = createEl('textarea', { id: 'service-request-description' });
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);
  modalBody.appendChild(descGroup);

  // 優先度
  const priorityGroup = createEl('div', { className: 'modal-form-group' });
  const priorityLabel = createEl('label', { textContent: '優先度' });
  const prioritySelect = createEl('select', { id: 'service-request-priority' });
  ['Critical', 'High', 'Medium', 'Low'].forEach((p) => {
    const option = createEl('option', { value: p, textContent: p });
    if (p === 'Medium') {
      option.selected = true;
    }
    prioritySelect.appendChild(option);
  });
  priorityGroup.appendChild(priorityLabel);
  priorityGroup.appendChild(prioritySelect);
  modalBody.appendChild(priorityGroup);

  // 申請者
  const requesterGroup = createEl('div', { className: 'modal-form-group' });
  const requesterLabel = createEl('label', { textContent: '申請者' });
  const requesterInput = createEl('input', {
    type: 'text',
    id: 'service-request-requester',
    value: currentUser ? currentUser.username : ''
  });
  requesterGroup.appendChild(requesterLabel);
  requesterGroup.appendChild(requesterInput);
  modalBody.appendChild(requesterGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: '保存'
  });
  saveBtn.addEventListener('click', saveNewServiceRequest);

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);

  modal.style.display = 'flex';
}

async function saveNewServiceRequest() {
  const data = {
    request_type: document.getElementById('service-request-type').value,
    title: document.getElementById('service-request-title').value,
    description: document.getElementById('service-request-description').value,
    priority: document.getElementById('service-request-priority').value,
    requester: document.getElementById('service-request-requester').value
  };

  if (!data.title || !data.description) {
    Toast.warning('タイトルと説明を入力してください');
    return;
  }

  try {
    await apiCall('/service-requests', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    Toast.success('サービス要求を作成しました');
    closeModal();
    loadView('service-requests');
  } catch (error) {
    Toast.error(`エラー: ${error.message}`);
  }
}

// ===== Create Asset Modal (CMDB) =====

function openCreateAssetModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, '資産新規登録 (CMDB)');
  clearElement(modalBody);
  clearElement(modalFooter);

  // 資産タグ（必須）
  const tagGroup = createEl('div', { className: 'modal-form-group' });
  const tagLabel = createEl('label', { textContent: '資産タグ' });
  const tagInput = createEl('input', { type: 'text', id: 'asset-tag', placeholder: 'SRV-003' });
  tagGroup.appendChild(tagLabel);
  tagGroup.appendChild(tagInput);
  modalBody.appendChild(tagGroup);

  // 名称（必須）
  const nameGroup = createEl('div', { className: 'modal-form-group' });
  const nameLabel = createEl('label', { textContent: '名称' });
  const nameInput = createEl('input', { type: 'text', id: 'asset-name' });
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  modalBody.appendChild(nameGroup);

  // タイプ
  const typeGroup = createEl('div', { className: 'modal-form-group' });
  const typeLabel = createEl('label', { textContent: 'タイプ' });
  const typeSelect = createEl('select', { id: 'asset-type' });
  ['Server', 'Network', 'Endpoint', 'Cloud', 'Software'].forEach((type) => {
    typeSelect.appendChild(createEl('option', { value: type, textContent: type }));
  });
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeSelect);
  modalBody.appendChild(typeGroup);

  // 重要度（1-5、星で表示）
  const criticalityGroup = createEl('div', { className: 'modal-form-group' });
  const criticalityLabel = createEl('label', { textContent: '重要度' });
  const criticalitySelect = createEl('select', { id: 'asset-criticality' });
  for (let i = 1; i <= 5; i += 1) {
    const stars = '★'.repeat(i) + '☆'.repeat(5 - i);
    const option = createEl('option', { value: i.toString(), textContent: `${stars} (${i})` });
    if (i === 3) {
      option.selected = true;
    }
    criticalitySelect.appendChild(option);
  }
  criticalityGroup.appendChild(criticalityLabel);
  criticalityGroup.appendChild(criticalitySelect);
  modalBody.appendChild(criticalityGroup);

  // ステータス
  const statusGroup = createEl('div', { className: 'modal-form-group' });
  const statusLabel = createEl('label', { textContent: 'ステータス' });
  const statusSelect = createEl('select', { id: 'asset-status' });
  ['Operational', 'Maintenance', 'Retired'].forEach((status) => {
    const option = createEl('option', { value: status, textContent: status });
    if (status === 'Operational') {
      option.selected = true;
    }
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: '保存'
  });
  saveBtn.addEventListener('click', saveNewAsset);

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);

  modal.style.display = 'flex';
}

async function saveNewAsset() {
  const data = {
    asset_tag: document.getElementById('asset-tag').value,
    name: document.getElementById('asset-name').value,
    type: document.getElementById('asset-type').value,
    criticality: parseInt(document.getElementById('asset-criticality').value, 10),
    status: document.getElementById('asset-status').value
  };

  if (!data.asset_tag || !data.name) {
    Toast.warning('資産タグと名称を入力してください');
    return;
  }

  try {
    await apiCall('/assets', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    Toast.success('資産を登録しました');
    closeModal();
    loadView('cmdb');
  } catch (error) {
    Toast.error(`エラー: ${error.message}`);
  }
}

// ===== RFC Detail Modal =====

async function openRFCDetailModal(change) {
  openModal('RFC詳細 / 承認');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  // Display RFC Details
  const detailsContainer = createEl('div');

  const details = [
    { label: 'RFC ID', value: change.rfc_id },
    { label: 'タイトル', value: change.title },
    { label: 'ステータス', value: change.status },
    { label: '影響度', value: change.impact_level || 'N/A' },
    { label: '申請者', value: change.requester },
    { label: '承認者', value: change.approver || '未承認' },
    { label: '作成日', value: new Date(change.created_at).toLocaleString('ja-JP') }
  ];

  details.forEach((detail) => {
    const row = createEl('div', { className: 'modal-detail-row' });
    row.appendChild(
      createEl('div', { className: 'modal-detail-label', textContent: detail.label })
    );
    row.appendChild(
      createEl('div', { className: 'modal-detail-value', textContent: detail.value })
    );
    detailsContainer.appendChild(row);
  });

  // Description
  const descRow = createEl('div', { className: 'modal-detail-row' });
  descRow.appendChild(createEl('div', { className: 'modal-detail-label', textContent: '説明' }));
  descRow.appendChild(
    createEl('div', { className: 'modal-detail-value', textContent: change.description })
  );
  detailsContainer.appendChild(descRow);

  modalBody.appendChild(detailsContainer);

  // Footer buttons
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: '閉じる'
  });
  cancelBtn.addEventListener('click', closeModal);
  modalFooter.appendChild(cancelBtn);

  // Show approve/reject buttons only if status is Pending
  if (change.status === 'Pending') {
    const rejectBtn = createEl('button', {
      className: 'btn-modal-danger',
      textContent: '却下'
    });
    rejectBtn.addEventListener('click', async () => {
      await updateRFCStatus(change.id, 'Rejected');
    });
    modalFooter.appendChild(rejectBtn);

    const approveBtn = createEl('button', {
      className: 'btn-modal-success',
      textContent: '承認'
    });
    approveBtn.addEventListener('click', async () => {
      await updateRFCStatus(change.id, 'Approved');
    });
    modalFooter.appendChild(approveBtn);
  }
}

async function updateRFCStatus(changeId, status) {
  try {
    await apiCall(`/changes/${changeId}`, {
      method: 'PUT',
      body: JSON.stringify({
        status,
        approver: currentUser.username
      })
    });

    Toast.success(`RFCを${status === 'Approved' ? '承認' : '却下'}しました`);
    closeModal();
    loadView('changes');
  } catch (error) {
    Toast.error(`エラー: ${error.message}`);
  }
}

// ===== Problems View =====

async function renderProblems(container) {
  try {
    const response = await apiCall('/problems');
    const allProblems = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
    const section = createEl('div');

    let filteredData = allProblems;
    let sortKey = 'created_at';
    let sortDirection = 'desc';
    const paginator = new Paginator(filteredData, 10);

    function renderTable() {
      const existingTable = section.querySelector('.table-wrapper');
      if (existingTable) section.removeChild(existingTable);
      const existingPagination = section.querySelector('.pagination-wrapper');
      if (existingPagination) section.removeChild(existingPagination);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });

      const thead = createEl('thead');
      const headerRow = createEl('tr');
      const headers = [
        { text: '問題ID', key: 'problem_id' },
        { text: 'タイトル', key: 'title' },
        { text: '関連インシデント', key: 'related_incidents' },
        { text: 'ステータス', key: 'status' },
        { text: '優先度', key: 'priority' },
        { text: '担当者', key: 'assignee' },
        { text: '作成日', key: 'created_at' }
      ];

      headers.forEach((header) => {
        const th = createEl('th', { textContent: header.text });
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          sortKey = header.key;
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          filteredData = sortData(filteredData, sortKey, sortDirection);
          paginator.data = filteredData;
          renderTable();
        });
        if (sortKey === header.key) {
          const arrow = createEl('span', { textContent: sortDirection === 'asc' ? ' ▲' : ' ▼' });
          th.appendChild(arrow);
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = createEl('tbody');
      paginator.currentData.forEach((problem) => {
        const row = createEl('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => openEditProblemModal(problem));

        row.appendChild(createEl('td', { textContent: problem.problem_id }));
        row.appendChild(createEl('td', { textContent: problem.title }));
        row.appendChild(createEl('td', { textContent: problem.related_incidents }));

        const statusBadge = createEl('span', {
          className: 'badge badge-info',
          textContent: problem.status
        });
        const statusCell = createEl('td');
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        const priorityBadge = createEl('span', {
          className: `badge badge-${problem.priority.toLowerCase()}`,
          textContent: problem.priority
        });
        const priorityCell = createEl('td');
        priorityCell.appendChild(priorityBadge);
        row.appendChild(priorityCell);

        row.appendChild(createEl('td', { textContent: problem.assignee }));
        row.appendChild(
          createEl('td', { textContent: new Date(problem.created_at).toLocaleDateString('ja-JP') })
        );

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);

      const paginationWrapper = createEl('div');
      paginationWrapper.className = 'pagination-wrapper';
      paginationWrapper.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 16px;';

      const prevBtn = createEl('button', { textContent: '← 前へ', className: 'btn-secondary' });
      prevBtn.disabled = paginator.currentPage === 1;
      prevBtn.addEventListener('click', () => {
        paginator.prevPage();
        renderTable();
      });

      const pageInfo = createEl('span');
      setText(
        pageInfo,
        `${paginator.currentPage} / ${paginator.totalPages} ページ (全 ${filteredData.length} 件)`
      );

      const nextBtn = createEl('button', { textContent: '次へ →', className: 'btn-secondary' });
      nextBtn.disabled = paginator.currentPage === paginator.totalPages;
      nextBtn.addEventListener('click', () => {
        paginator.nextPage();
        renderTable();
      });

      paginationWrapper.appendChild(prevBtn);
      paginationWrapper.appendChild(pageInfo);
      paginationWrapper.appendChild(nextBtn);
      section.appendChild(paginationWrapper);
    }

    const header = createEl('div');
    header.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;';

    const h2 = createEl('h2', { textContent: '問題管理・根本原因分析' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.cssText = 'display: flex; gap: 12px;';

    const createBtn = createEl('button', { className: 'btn-primary', textContent: '新規作成' });
    createBtn.addEventListener('click', () => openCreateProblemModal());

    const csvBtn = createEl('button', { className: 'btn-export', textContent: 'CSV' });
    csvBtn.addEventListener('click', () => exportToCSV(filteredData, 'problems.csv'));

    const excelBtn = createEl('button', { className: 'btn-export', textContent: 'Excel' });
    excelBtn.addEventListener('click', () => exportToExcel(filteredData, 'problems.xlsx'));

    const pdfBtn = createEl('button', { className: 'btn-export', textContent: 'PDF' });
    pdfBtn.addEventListener('click', () =>
      exportToPDF(filteredData, 'problems.pdf', { title: '問題管理一覧' })
    );

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(csvBtn);
    btnGroup.appendChild(excelBtn);
    btnGroup.appendChild(pdfBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    // 説明セクション
    const explanation = createExplanationSection(
      '複数のインシデントの根本原因を特定し、恒久的な解決策を策定する機能です。インシデントが「症状」なら、問題は「病気」に相当します。',
      '同じインシデントの繰り返し発生を防止します。根本原因分析により、一時対応ではなく本質的な解決を目指します。関連インシデント数の追跡により、問題の影響範囲と重要度を可視化できます。'
    );
    section.appendChild(explanation);

    const controlRow = createEl('div');
    controlRow.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const searchInput = createEl('input', {
      type: 'text',
      placeholder: '検索... (問題ID、タイトル、担当者)'
    });
    searchInput.style.cssText =
      'padding: 8px; width: 300px; border: 1px solid #ccc; border-radius: 4px;';
    searchInput.addEventListener('input', (e) => {
      filteredData = searchData(allProblems, e.target.value, [
        'problem_id',
        'title',
        'assignee',
        'status'
      ]);
      paginator.data = filteredData;
      paginator.currentPage = 1;
      renderTable();
    });

    const pageSizeSelect = createEl('select');
    pageSizeSelect.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
    [10, 20, 50].forEach((size) => {
      const option = createEl('option', { value: String(size), textContent: `${size}件表示` });
      pageSizeSelect.appendChild(option);
    });
    pageSizeSelect.addEventListener('change', (e) => {
      paginator.itemsPerPage = parseInt(e.target.value, 10);
      paginator.currentPage = 1;
      renderTable();
    });

    controlRow.appendChild(searchInput);
    controlRow.appendChild(pageSizeSelect);
    section.appendChild(controlRow);

    renderTable();
    container.appendChild(section);
  } catch (error) {
    renderError(container, '問題管理データの読み込みに失敗しました');
  }
}

// ===== Releases View =====

async function renderReleases(container) {
  try {
    const response = await apiCall('/releases');
    const allReleases = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
    const section = createEl('div');

    let filteredData = allReleases;
    let sortKey = 'release_date';
    let sortDirection = 'desc';
    const paginator = new Paginator(filteredData, 10);

    function renderTable() {
      const existingTable = section.querySelector('.table-wrapper');
      if (existingTable) section.removeChild(existingTable);
      const existingPagination = section.querySelector('.pagination-wrapper');
      if (existingPagination) section.removeChild(existingPagination);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });

      const thead = createEl('thead');
      const headerRow = createEl('tr');
      const headers = [
        { text: 'リリースID', key: 'release_id' },
        { text: 'リリース名', key: 'name' },
        { text: 'バージョン', key: 'version' },
        { text: 'ステータス', key: 'status' },
        { text: '変更数', key: 'change_count' },
        { text: '対象環境', key: 'target_environment' },
        { text: 'リリース日', key: 'release_date' },
        { text: '進捗', key: 'progress' }
      ];

      headers.forEach((header) => {
        const th = createEl('th', { textContent: header.text });
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          sortKey = header.key;
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          filteredData = sortData(filteredData, sortKey, sortDirection);
          paginator.data = filteredData;
          renderTable();
        });
        if (sortKey === header.key) {
          const arrow = createEl('span', { textContent: sortDirection === 'asc' ? ' ▲' : ' ▼' });
          th.appendChild(arrow);
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = createEl('tbody');
      paginator.currentData.forEach((release) => {
        const row = createEl('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => openEditReleaseModal(release));

        row.appendChild(createEl('td', { textContent: release.release_id }));
        row.appendChild(createEl('td', { textContent: release.name }));
        row.appendChild(createEl('td', { textContent: release.version }));

        const statusBadge = createEl('span', {
          className: 'badge badge-info',
          textContent: release.status
        });
        const statusCell = createEl('td');
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        row.appendChild(createEl('td', { textContent: `${release.change_count}件` }));
        row.appendChild(createEl('td', { textContent: release.target_environment }));
        row.appendChild(
          createEl('td', {
            textContent: new Date(release.release_date).toLocaleDateString('ja-JP')
          })
        );
        row.appendChild(createEl('td', { textContent: `${release.progress}%` }));

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);

      const paginationWrapper = createEl('div');
      paginationWrapper.className = 'pagination-wrapper';
      paginationWrapper.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 16px;';

      const prevBtn = createEl('button', { textContent: '← 前へ', className: 'btn-secondary' });
      prevBtn.disabled = paginator.currentPage === 1;
      prevBtn.addEventListener('click', () => {
        paginator.prevPage();
        renderTable();
      });

      const pageInfo = createEl('span');
      setText(
        pageInfo,
        `${paginator.currentPage} / ${paginator.totalPages} ページ (全 ${filteredData.length} 件)`
      );

      const nextBtn = createEl('button', { textContent: '次へ →', className: 'btn-secondary' });
      nextBtn.disabled = paginator.currentPage === paginator.totalPages;
      nextBtn.addEventListener('click', () => {
        paginator.nextPage();
        renderTable();
      });

      paginationWrapper.appendChild(prevBtn);
      paginationWrapper.appendChild(pageInfo);
      paginationWrapper.appendChild(nextBtn);
      section.appendChild(paginationWrapper);
    }

    const header = createEl('div');
    header.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;';

    const h2 = createEl('h2', { textContent: 'リリースパッケージ・展開状況' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.cssText = 'display: flex; gap: 12px;';

    const createBtn = createEl('button', { className: 'btn-primary', textContent: '新規作成' });
    createBtn.addEventListener('click', openCreateReleaseModal);

    const csvBtn = createEl('button', { className: 'btn-export', textContent: 'CSV' });
    csvBtn.addEventListener('click', () => exportToCSV(filteredData, 'releases.csv'));

    const excelBtn = createEl('button', { className: 'btn-export', textContent: 'Excel' });
    excelBtn.addEventListener('click', () => exportToExcel(filteredData, 'releases.xlsx'));

    const pdfBtn = createEl('button', { className: 'btn-export', textContent: 'PDF' });
    pdfBtn.addEventListener('click', () =>
      exportToPDF(filteredData, 'releases.pdf', { title: 'リリース管理一覧' })
    );

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(csvBtn);
    btnGroup.appendChild(excelBtn);
    btnGroup.appendChild(pdfBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    // 説明セクション
    const explanation = createExplanationSection(
      '複数の変更要求をまとめて本番環境に展開する計画・実行を管理する機能です。リリースのバージョン管理とデプロイ進捗を追跡します。',
      '大規模な変更を安全かつ計画的に実施するために必要です。テスト環境での検証、リリースウィンドウの設定、ロールバック手順の準備により、本番環境への影響を最小化します。'
    );
    section.appendChild(explanation);

    const controlRow = createEl('div');
    controlRow.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const searchInput = createEl('input', {
      type: 'text',
      placeholder: '検索... (リリースID、名称、バージョン)'
    });
    searchInput.style.cssText =
      'padding: 8px; width: 300px; border: 1px solid #ccc; border-radius: 4px;';
    searchInput.addEventListener('input', (e) => {
      filteredData = searchData(allReleases, e.target.value, [
        'release_id',
        'name',
        'version',
        'status'
      ]);
      paginator.data = filteredData;
      paginator.currentPage = 1;
      renderTable();
    });

    const pageSizeSelect = createEl('select');
    pageSizeSelect.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
    [10, 20, 50].forEach((size) => {
      const option = createEl('option', { value: String(size), textContent: `${size}件表示` });
      pageSizeSelect.appendChild(option);
    });
    pageSizeSelect.addEventListener('change', (e) => {
      paginator.itemsPerPage = parseInt(e.target.value, 10);
      paginator.currentPage = 1;
      renderTable();
    });

    controlRow.appendChild(searchInput);
    controlRow.appendChild(pageSizeSelect);
    section.appendChild(controlRow);

    renderTable();
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'リリース管理データの読み込みに失敗しました');
  }
}

// ===== Service Requests View =====

async function renderServiceRequests(container) {
  try {
    const response = await apiCall('/service-requests');
    const allRequests = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
    const section = createEl('div');

    let filteredData = allRequests;
    let sortKey = 'created_at';
    let sortDirection = 'desc';
    const paginator = new Paginator(filteredData, 10);

    function renderTable() {
      const existingTable = section.querySelector('.table-wrapper');
      if (existingTable) section.removeChild(existingTable);
      const existingPagination = section.querySelector('.pagination-wrapper');
      if (existingPagination) section.removeChild(existingPagination);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });

      const thead = createEl('thead');
      const headerRow = createEl('tr');
      const headers = [
        { text: '要求ID', key: 'request_id' },
        { text: '要求タイプ', key: 'request_type' },
        { text: 'タイトル', key: 'title' },
        { text: '申請者', key: 'requester' },
        { text: 'ステータス', key: 'status' },
        { text: '優先度', key: 'priority' },
        { text: '申請日', key: 'created_at' }
      ];

      headers.forEach((header) => {
        const th = createEl('th', { textContent: header.text });
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          sortKey = header.key;
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          filteredData = sortData(filteredData, sortKey, sortDirection);
          paginator.data = filteredData;
          renderTable();
        });
        if (sortKey === header.key) {
          const arrow = createEl('span', { textContent: sortDirection === 'asc' ? ' ▲' : ' ▼' });
          th.appendChild(arrow);
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = createEl('tbody');
      paginator.currentData.forEach((request) => {
        const row = createEl('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => openEditServiceRequestModal(request));

        row.appendChild(createEl('td', { textContent: request.request_id }));
        row.appendChild(createEl('td', { textContent: request.request_type }));
        row.appendChild(createEl('td', { textContent: request.title }));
        row.appendChild(createEl('td', { textContent: request.requester }));

        const statusBadge = createEl('span', {
          className: 'badge badge-info',
          textContent: request.status
        });
        const statusCell = createEl('td');
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        const priorityBadge = createEl('span', {
          className: `badge badge-${request.priority.toLowerCase()}`,
          textContent: request.priority
        });
        const priorityCell = createEl('td');
        priorityCell.appendChild(priorityBadge);
        row.appendChild(priorityCell);

        row.appendChild(
          createEl('td', { textContent: new Date(request.created_at).toLocaleDateString('ja-JP') })
        );

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);

      const paginationWrapper = createEl('div');
      paginationWrapper.className = 'pagination-wrapper';
      paginationWrapper.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 16px;';

      const prevBtn = createEl('button', { textContent: '← 前へ', className: 'btn-secondary' });
      prevBtn.disabled = paginator.currentPage === 1;
      prevBtn.addEventListener('click', () => {
        paginator.prevPage();
        renderTable();
      });

      const pageInfo = createEl('span');
      setText(
        pageInfo,
        `${paginator.currentPage} / ${paginator.totalPages} ページ (全 ${filteredData.length} 件)`
      );

      const nextBtn = createEl('button', { textContent: '次へ →', className: 'btn-secondary' });
      nextBtn.disabled = paginator.currentPage === paginator.totalPages;
      nextBtn.addEventListener('click', () => {
        paginator.nextPage();
        renderTable();
      });

      paginationWrapper.appendChild(prevBtn);
      paginationWrapper.appendChild(pageInfo);
      paginationWrapper.appendChild(nextBtn);
      section.appendChild(paginationWrapper);
    }

    const header = createEl('div');
    header.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;';

    const h2 = createEl('h2', { textContent: 'サービス要求・申請一覧' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.cssText = 'display: flex; gap: 12px;';

    const createBtn = createEl('button', { className: 'btn-primary', textContent: '新規作成' });
    createBtn.addEventListener('click', openCreateServiceRequestModal);

    const csvBtn = createEl('button', { className: 'btn-export', textContent: 'CSV' });
    csvBtn.addEventListener('click', () => exportToCSV(filteredData, 'service_requests.csv'));

    const excelBtn = createEl('button', { className: 'btn-export', textContent: 'Excel' });
    excelBtn.addEventListener('click', () => exportToExcel(filteredData, 'service_requests.xlsx'));

    const pdfBtn = createEl('button', { className: 'btn-export', textContent: 'PDF' });
    pdfBtn.addEventListener('click', () =>
      exportToPDF(filteredData, 'service_requests.pdf', { title: 'サービス要求一覧' })
    );

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(csvBtn);
    btnGroup.appendChild(excelBtn);
    btnGroup.appendChild(pdfBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    // 説明セクション
    const explanation = createExplanationSection(
      'ユーザーからのサービス要求（アカウント作成、アクセス権限付与、ソフトウェアインストールなど）を受付・処理する機能です。',
      '標準的なサービス提供を効率化します。要求の優先度管理、承認フロー、処理状況の可視化により、ユーザー満足度の向上とサービスデスクの業務効率化を実現します。SLA遵守の基盤となります。'
    );
    section.appendChild(explanation);

    const controlRow = createEl('div');
    controlRow.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const searchInput = createEl('input', {
      type: 'text',
      placeholder: '検索... (要求ID、タイトル、申請者)'
    });
    searchInput.style.cssText =
      'padding: 8px; width: 300px; border: 1px solid #ccc; border-radius: 4px;';
    searchInput.addEventListener('input', (e) => {
      filteredData = searchData(allRequests, e.target.value, [
        'request_id',
        'title',
        'requester',
        'request_type'
      ]);
      paginator.data = filteredData;
      paginator.currentPage = 1;
      renderTable();
    });

    const pageSizeSelect = createEl('select');
    pageSizeSelect.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
    [10, 20, 50].forEach((size) => {
      const option = createEl('option', { value: String(size), textContent: `${size}件表示` });
      pageSizeSelect.appendChild(option);
    });
    pageSizeSelect.addEventListener('change', (e) => {
      paginator.itemsPerPage = parseInt(e.target.value, 10);
      paginator.currentPage = 1;
      renderTable();
    });

    controlRow.appendChild(searchInput);
    controlRow.appendChild(pageSizeSelect);
    section.appendChild(controlRow);

    renderTable();
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'サービス要求データの読み込みに失敗しました');
  }
}

// ===== SLA Management View =====

async function renderSLAManagement(container) {
  try {
    const response = await apiCall('/sla-agreements');
    const allSLAs = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
    const section = createEl('div');

    let filteredData = allSLAs;
    let sortKey = 'achievement_rate';
    let sortDirection = 'desc';
    const paginator = new Paginator(filteredData, 10);

    function renderTable() {
      const existingTable = section.querySelector('.table-wrapper');
      if (existingTable) section.removeChild(existingTable);
      const existingPagination = section.querySelector('.pagination-wrapper');
      if (existingPagination) section.removeChild(existingPagination);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });

      const thead = createEl('thead');
      const headerRow = createEl('tr');
      const headers = [
        { text: 'SLA ID', key: 'sla_id' },
        { text: 'サービス名', key: 'service_name' },
        { text: 'メトリクス', key: 'metric_name' },
        { text: '目標値', key: 'target_value' },
        { text: '実績値', key: 'actual_value' },
        { text: '達成率', key: 'achievement_rate' },
        { text: '測定期間', key: 'measurement_period' },
        { text: 'ステータス', key: 'status' }
      ];

      headers.forEach((header) => {
        const th = createEl('th', { textContent: header.text });
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          sortKey = header.key;
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          filteredData = sortData(filteredData, sortKey, sortDirection);
          paginator.data = filteredData;
          renderTable();
        });
        if (sortKey === header.key) {
          const arrow = createEl('span', { textContent: sortDirection === 'asc' ? ' ▲' : ' ▼' });
          th.appendChild(arrow);
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = createEl('tbody');
      paginator.currentData.forEach((sla) => {
        const row = createEl('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => openEditSLAModal(sla));

        row.appendChild(createEl('td', { textContent: sla.sla_id }));
        row.appendChild(createEl('td', { textContent: sla.service_name }));
        row.appendChild(createEl('td', { textContent: sla.metric_name }));
        row.appendChild(createEl('td', { textContent: sla.target_value }));
        row.appendChild(createEl('td', { textContent: sla.actual_value }));
        row.appendChild(createEl('td', { textContent: `${sla.achievement_rate.toFixed(1)}%` }));
        row.appendChild(createEl('td', { textContent: sla.measurement_period }));

        const statusBadge = createEl('span', {
          className: `badge badge-${sla.status === 'Met' ? 'success' : 'warning'}`,
          textContent: sla.status === 'Met' ? '達成' : sla.status
        });
        const statusCell = createEl('td');
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);

      const paginationWrapper = createEl('div');
      paginationWrapper.className = 'pagination-wrapper';
      paginationWrapper.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 16px;';

      const prevBtn = createEl('button', { textContent: '← 前へ', className: 'btn-secondary' });
      prevBtn.disabled = !paginator.hasPrev;
      prevBtn.addEventListener('click', () => {
        paginator.prev();
        renderTable();
      });

      const pageInfo = createEl('span', {
        textContent: `${paginator.currentPage} / ${paginator.totalPages} ページ (全 ${filteredData.length} 件)`
      });

      const nextBtn = createEl('button', { textContent: '次へ →', className: 'btn-secondary' });
      nextBtn.disabled = !paginator.hasNext;
      nextBtn.addEventListener('click', () => {
        paginator.next();
        renderTable();
      });

      paginationWrapper.appendChild(prevBtn);
      paginationWrapper.appendChild(pageInfo);
      paginationWrapper.appendChild(nextBtn);
      section.appendChild(paginationWrapper);
    }

    const header = createEl('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: 'SLA達成状況' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '12px';

    const createBtn = createEl('button', {
      className: 'btn-primary',
      textContent: '新規作成'
    });
    createBtn.addEventListener('click', () => {
      openCreateSLAModal();
    });

    const csvBtn = createEl('button', { className: 'btn-export' });
    const csvIcon = createEl('i', { className: 'fas fa-download' });
    csvBtn.appendChild(csvIcon);
    setText(csvBtn, ' CSVエクスポート', true);
    csvBtn.addEventListener('click', () => {
      exportToCSV(filteredData, 'sla_agreements.csv');
    });

    const excelBtn = createEl('button', { className: 'btn-export' });
    const excelIcon = createEl('i', { className: 'fas fa-file-excel' });
    excelBtn.appendChild(excelIcon);
    setText(excelBtn, ' Excelエクスポート', true);
    excelBtn.addEventListener('click', () => {
      exportToExcel(filteredData, 'sla_agreements.xlsx');
    });

    const pdfBtn = createEl('button', { className: 'btn-export' });
    const pdfIcon = createEl('i', { className: 'fas fa-file-pdf' });
    pdfBtn.appendChild(pdfIcon);
    setText(pdfBtn, ' PDFエクスポート', true);
    pdfBtn.addEventListener('click', () => {
      exportToPDF(filteredData, 'sla_agreements.pdf', { title: 'SLA合意一覧' });
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(csvBtn);
    btnGroup.appendChild(excelBtn);
    btnGroup.appendChild(pdfBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    // 説明セクション
    const explanation = createExplanationSection(
      'サービスレベル合意（SLA: Service Level Agreement）の目標値と実績値を管理し、サービス品質を定量的に測定する機能です。',
      'サービス品質の可視化と継続的改善に不可欠です。目標値との乖離を監視し、SLA違反のリスクを早期に検知します。経営層やビジネス部門に対するIT部門の価値証明として重要な役割を果たします。'
    );
    section.appendChild(explanation);

    const controlRow = createEl('div');
    controlRow.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const searchInput = createEl('input', {
      type: 'text',
      placeholder: '検索... (SLA ID、サービス名、メトリクス)'
    });
    searchInput.style.cssText =
      'padding: 8px; width: 300px; border: 1px solid #ccc; border-radius: 4px;';
    searchInput.addEventListener('input', (e) => {
      filteredData = searchData(allSLAs, e.target.value, [
        'sla_id',
        'service_name',
        'metric_name',
        'status'
      ]);
      paginator.data = filteredData;
      paginator.currentPage = 1;
      renderTable();
    });

    const pageSizeSelect = createEl('select');
    pageSizeSelect.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
    [10, 20, 50].forEach((size) => {
      const option = createEl('option', { value: String(size), textContent: `${size}件表示` });
      pageSizeSelect.appendChild(option);
    });
    pageSizeSelect.addEventListener('change', (e) => {
      paginator.itemsPerPage = parseInt(e.target.value, 10);
      paginator.currentPage = 1;
      renderTable();
    });

    controlRow.appendChild(searchInput);
    controlRow.appendChild(pageSizeSelect);
    section.appendChild(controlRow);

    renderTable();
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'SLA管理データの読み込みに失敗しました');
  }
}

// ===== SLA Alert History View =====

async function renderSLAAlertHistory(container) {
  try {
    const alertsResponse = await apiCall('/sla-alerts');
    const alerts = alertsResponse.data || [];
    const unacknowledgedCount = alertsResponse.unacknowledged_count || 0;

    const section = createEl('div');

    // Header with stats
    const headerWrapper = createEl('div');
    headerWrapper.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 16px;';

    const title = createEl('h2', { textContent: 'SLAアラート履歴' });
    headerWrapper.appendChild(title);

    // Quick stats
    const statsDiv = createEl('div');
    statsDiv.style.cssText = 'display: flex; gap: 16px; align-items: center;';

    if (unacknowledgedCount > 0) {
      const unackBadge = createEl('span');
      unackBadge.style.cssText =
        'background: #dc2626; color: white; padding: 4px 12px; border-radius: 16px; font-size: 14px; font-weight: 600;';
      unackBadge.textContent = `${unacknowledgedCount} 件の未確認アラート`;
      statsDiv.appendChild(unackBadge);
    }

    const refreshBtn = createEl('button', { className: 'btn-primary' });
    setText(refreshBtn, '🔄 更新');
    refreshBtn.addEventListener('click', () => loadView('sla-alerts'));
    statsDiv.appendChild(refreshBtn);

    headerWrapper.appendChild(statsDiv);
    section.appendChild(headerWrapper);

    // Explanation
    const explanation = createExplanationSection(
      'SLA違反やリスク状態への変化を検出した際のアラート履歴を管理します。',
      'アラートを確認（Acknowledge）することで、対応済みとしてマークできます。未確認のアラートは優先的に表示されます。'
    );
    section.appendChild(explanation);

    // Filter buttons
    const filterRow = createEl('div');
    filterRow.style.cssText = 'display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;';

    const filterButtons = [
      { label: '全て', filter: null },
      { label: '未確認のみ', filter: 'unacknowledged' },
      { label: '違反', filter: 'violation' },
      { label: 'リスク', filter: 'at_risk' },
      { label: '閾値割れ', filter: 'threshold_breach' }
    ];

    let currentFilter = null;

    filterButtons.forEach(({ label, filter }) => {
      const btn = createEl('button', {
        className: filter === currentFilter ? 'btn-primary' : 'btn-secondary'
      });
      btn.textContent = label;
      btn.addEventListener('click', async () => {
        currentFilter = filter;
        let queryParams = '';
        if (filter === 'unacknowledged') {
          queryParams = '?acknowledged=false';
        } else if (filter) {
          queryParams = `?alert_type=${filter}`;
        }
        const filteredResponse = await apiCall(`/sla-alerts${queryParams}`);
        renderAlertList(filteredResponse.data || []);
        // Update button styles
        filterRow.querySelectorAll('button').forEach((filterBtn, i) => {
          const newClassName = filterButtons[i].filter === filter ? 'btn-primary' : 'btn-secondary';
          filterBtn.setAttribute('class', newClassName);
        });
      });
      filterRow.appendChild(btn);
    });

    section.appendChild(filterRow);

    // Alert list container
    const listContainer = createEl('div', { className: 'alert-list-container' });
    section.appendChild(listContainer);

    function renderAlertList(alertData) {
      listContainer.innerHTML = '';

      if (alertData.length === 0) {
        const emptyMsg = createEl('div');
        emptyMsg.style.cssText =
          'text-align: center; color: #64748b; padding: 60px 20px; background: #f8fafc; border-radius: 12px;';
        emptyMsg.innerHTML =
          '<i class="fas fa-check-circle" style="font-size: 48px; color: #16a34a; margin-bottom: 16px;"></i><p>アラートはありません</p>';
        listContainer.appendChild(emptyMsg);
        return;
      }

      alertData.forEach((alert) => {
        const alertCard = createEl('div');
        alertCard.style.cssText = `
          background: white;
          border-radius: 12px;
          padding: 16px 20px;
          margin-bottom: 12px;
          border-left: 4px solid ${getAlertTypeBorderColor(alert.alert_type)};
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          ${!alert.acknowledged ? 'background: #fef2f2;' : ''}
        `;

        // Header row
        const headerDiv = createEl('div');
        headerDiv.style.cssText =
          'display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;';

        const titleDiv = createEl('div');

        const alertTypeBadge = createEl('span');
        alertTypeBadge.style.cssText = `
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 600;
          margin-right: 8px;
          background: ${getAlertTypeBgColor(alert.alert_type)};
          color: ${getAlertTypeTextColor(alert.alert_type)};
        `;
        alertTypeBadge.textContent = getAlertTypeLabel(alert.alert_type);
        titleDiv.appendChild(alertTypeBadge);

        const serviceName = createEl('span');
        serviceName.style.cssText = 'font-weight: 600; font-size: 16px; color: #1e293b;';
        serviceName.textContent = alert.service_name;
        titleDiv.appendChild(serviceName);

        headerDiv.appendChild(titleDiv);

        // Status badges
        const statusDiv = createEl('div');
        statusDiv.style.cssText = 'display: flex; gap: 8px; align-items: center;';

        if (!alert.acknowledged) {
          const unackBadge = createEl('span');
          unackBadge.style.cssText =
            'background: #fef3c7; color: #92400e; padding: 2px 8px; border-radius: 4px; font-size: 12px;';
          unackBadge.textContent = '未確認';
          statusDiv.appendChild(unackBadge);
        } else {
          const ackBadge = createEl('span');
          ackBadge.style.cssText =
            'background: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-size: 12px;';
          ackBadge.textContent = '確認済み';
          statusDiv.appendChild(ackBadge);
        }

        headerDiv.appendChild(statusDiv);
        alertCard.appendChild(headerDiv);

        // Message
        const messageDiv = createEl('div');
        messageDiv.style.cssText = 'color: #475569; margin-bottom: 12px;';
        messageDiv.textContent = alert.message;
        alertCard.appendChild(messageDiv);

        // Details
        const detailsDiv = createEl('div');
        detailsDiv.style.cssText =
          'display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; font-size: 13px; color: #64748b; margin-bottom: 12px;';
        detailsDiv.innerHTML = `
          <div><strong>メトリクス:</strong> ${alert.metric_name}</div>
          <div><strong>達成率変化:</strong> ${alert.previous_achievement_rate || 0}% → ${alert.new_achievement_rate || 0}%</div>
          <div><strong>ステータス:</strong> ${alert.previous_status} → ${alert.new_status}</div>
          <div><strong>発生日時:</strong> ${new Date(alert.triggered_at).toLocaleString('ja-JP')}</div>
        `;
        alertCard.appendChild(detailsDiv);

        // Actions
        if (!alert.acknowledged) {
          const actionsDiv = createEl('div');
          actionsDiv.style.cssText =
            'display: flex; gap: 8px; padding-top: 12px; border-top: 1px solid #e2e8f0;';

          const ackBtn = createEl('button', { className: 'btn-primary' });
          ackBtn.textContent = '✓ 確認済みにする';
          ackBtn.style.fontSize = '13px';
          ackBtn.addEventListener('click', async () => {
            try {
              await apiCall(`/sla-alerts/${alert.alert_id}/acknowledge`, 'PUT', { note: '' });
              // Update local state for immediate UI feedback
              // eslint-disable-next-line no-param-reassign
              alert.acknowledged = true;
              renderAlertList(alertData);
            } catch (err) {
              console.error('Failed to acknowledge:', err);
            }
          });
          actionsDiv.appendChild(ackBtn);

          alertCard.appendChild(actionsDiv);
        } else if (alert.acknowledged_by) {
          const ackInfoDiv = createEl('div');
          ackInfoDiv.style.cssText =
            'font-size: 12px; color: #94a3b8; padding-top: 8px; border-top: 1px solid #e2e8f0;';
          ackInfoDiv.textContent = `確認者: ${alert.acknowledged_by} (${new Date(alert.acknowledged_at).toLocaleString('ja-JP')})`;
          if (alert.acknowledgment_note) {
            ackInfoDiv.textContent += ` - ${alert.acknowledgment_note}`;
          }
          alertCard.appendChild(ackInfoDiv);
        }

        listContainer.appendChild(alertCard);
      });
    }

    // Initial render
    renderAlertList(alerts);

    container.appendChild(section);
  } catch (error) {
    renderError(container, 'SLAアラート履歴の読み込みに失敗しました');
  }
}

// ===== Knowledge Management View =====

async function renderKnowledge(container) {
  try {
    const response = await apiCall('/knowledge-articles');
    const allArticles = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
    const section = createEl('div');

    let filteredData = allArticles;
    let sortKey = 'updated_at';
    let sortDirection = 'desc';
    const paginator = new Paginator(filteredData, 10);

    function renderTable() {
      const existingTable = section.querySelector('.table-wrapper');
      if (existingTable) section.removeChild(existingTable);
      const existingPagination = section.querySelector('.pagination-wrapper');
      if (existingPagination) section.removeChild(existingPagination);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });

      const thead = createEl('thead');
      const headerRow = createEl('tr');
      const headers = [
        { text: '記事ID', key: 'article_id' },
        { text: 'タイトル', key: 'title' },
        { text: 'カテゴリ', key: 'category' },
        { text: '閲覧数', key: 'view_count' },
        { text: '評価', key: 'rating' },
        { text: '著者', key: 'author' },
        { text: 'ステータス', key: 'status' },
        { text: '更新日', key: 'updated_at' }
      ];

      headers.forEach((header) => {
        const th = createEl('th', { textContent: header.text });
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          sortKey = header.key;
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          filteredData = sortData(filteredData, sortKey, sortDirection);
          paginator.data = filteredData;
          renderTable();
        });
        if (sortKey === header.key) {
          const arrow = createEl('span', { textContent: sortDirection === 'asc' ? ' ▲' : ' ▼' });
          th.appendChild(arrow);
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = createEl('tbody');
      paginator.currentData.forEach((article) => {
        const row = createEl('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => openEditKnowledgeModal(article));

        row.appendChild(createEl('td', { textContent: article.article_id }));
        row.appendChild(createEl('td', { textContent: article.title }));
        row.appendChild(createEl('td', { textContent: article.category }));
        row.appendChild(createEl('td', { textContent: article.view_count }));

        const stars =
          '★'.repeat(Math.round(article.rating)) + '☆'.repeat(5 - Math.round(article.rating));
        row.appendChild(createEl('td', { textContent: stars }));

        row.appendChild(createEl('td', { textContent: article.author }));

        const statusBadge = createEl('span', {
          className: `badge badge-${article.status === 'Published' ? 'success' : 'info'}`,
          textContent: article.status
        });
        const statusCell = createEl('td');
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        row.appendChild(
          createEl('td', { textContent: new Date(article.updated_at).toLocaleDateString('ja-JP') })
        );

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);

      const paginationWrapper = createEl('div');
      paginationWrapper.className = 'pagination-wrapper';
      paginationWrapper.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 16px;';

      const prevBtn = createEl('button', { textContent: '← 前へ', className: 'btn-secondary' });
      prevBtn.disabled = !paginator.hasPrev;
      prevBtn.addEventListener('click', () => {
        paginator.prev();
        renderTable();
      });

      const pageInfo = createEl('span', {
        textContent: `${paginator.currentPage} / ${paginator.totalPages} ページ (全 ${filteredData.length} 件)`
      });

      const nextBtn = createEl('button', { textContent: '次へ →', className: 'btn-secondary' });
      nextBtn.disabled = !paginator.hasNext;
      nextBtn.addEventListener('click', () => {
        paginator.next();
        renderTable();
      });

      paginationWrapper.appendChild(prevBtn);
      paginationWrapper.appendChild(pageInfo);
      paginationWrapper.appendChild(nextBtn);
      section.appendChild(paginationWrapper);
    }

    const header = createEl('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: 'ナレッジベース記事 (FAQ)' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '12px';

    const createBtn = createEl('button', {
      className: 'btn-primary',
      textContent: '新規作成'
    });
    createBtn.addEventListener('click', () => {
      openCreateKnowledgeModal();
    });

    const csvBtn = createEl('button', { className: 'btn-export' });
    const csvIcon = createEl('i', { className: 'fas fa-download' });
    csvBtn.appendChild(csvIcon);
    setText(csvBtn, ' CSVエクスポート', true);
    csvBtn.addEventListener('click', () => {
      exportToCSV(filteredData, 'knowledge_articles.csv');
    });

    const excelBtn = createEl('button', { className: 'btn-export' });
    const excelIcon = createEl('i', { className: 'fas fa-file-excel' });
    excelBtn.appendChild(excelIcon);
    setText(excelBtn, ' Excelエクスポート', true);
    excelBtn.addEventListener('click', () => {
      exportToExcel(filteredData, 'knowledge_articles.xlsx');
    });

    const pdfBtn = createEl('button', { className: 'btn-export' });
    const pdfIcon = createEl('i', { className: 'fas fa-file-pdf' });
    pdfBtn.appendChild(pdfIcon);
    setText(pdfBtn, ' PDFエクスポート', true);
    pdfBtn.addEventListener('click', () => {
      exportToPDF(filteredData, 'knowledge_articles.pdf', { title: 'ナレッジ記事一覧' });
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(csvBtn);
    btnGroup.appendChild(excelBtn);
    btnGroup.appendChild(pdfBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    // 説明セクション
    const explanation = createExplanationSection(
      'トラブルシューティング手順、設定ガイド、FAQなどの技術情報を体系的に蓄積・共有するナレッジベースです。',
      '問題解決時間の短縮と対応品質の標準化を実現します。ベテラン担当者のノウハウを組織資産として蓄積し、新人教育やスキル伝承にも活用できます。セルフサービス提供により、サービスデスクの負荷軽減にも貢献します。'
    );
    section.appendChild(explanation);

    const controlRow = createEl('div');
    controlRow.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const searchInput = createEl('input', {
      type: 'text',
      placeholder: '検索... (記事ID、タイトル、カテゴリ)'
    });
    searchInput.style.cssText =
      'padding: 8px; width: 300px; border: 1px solid #ccc; border-radius: 4px;';
    searchInput.addEventListener('input', (e) => {
      filteredData = searchData(allArticles, e.target.value, [
        'article_id',
        'title',
        'category',
        'author',
        'status'
      ]);
      paginator.data = filteredData;
      paginator.currentPage = 1;
      renderTable();
    });

    const pageSizeSelect = createEl('select');
    pageSizeSelect.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
    [10, 20, 50].forEach((size) => {
      const option = createEl('option', { value: String(size), textContent: `${size}件表示` });
      pageSizeSelect.appendChild(option);
    });
    pageSizeSelect.addEventListener('change', (e) => {
      paginator.itemsPerPage = parseInt(e.target.value, 10);
      paginator.currentPage = 1;
      renderTable();
    });

    controlRow.appendChild(searchInput);
    controlRow.appendChild(pageSizeSelect);
    section.appendChild(controlRow);

    renderTable();
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'ナレッジ管理データの読み込みに失敗しました');
  }
}

// ===== Capacity Management View =====

async function renderCapacity(container) {
  try {
    const response = await apiCall('/capacity-metrics');
    const allMetrics = Array.isArray(response.data) ? response.data : (Array.isArray(response) ? response : []);
    const section = createEl('div');

    let filteredData = allMetrics;
    let sortKey = 'measured_at';
    let sortDirection = 'desc';
    const paginator = new Paginator(filteredData, 10);

    function renderTable() {
      const existingTable = section.querySelector('.table-wrapper');
      if (existingTable) section.removeChild(existingTable);
      const existingPagination = section.querySelector('.pagination-wrapper');
      if (existingPagination) section.removeChild(existingPagination);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });

      const thead = createEl('thead');
      const headerRow = createEl('tr');
      const headers = [
        { text: 'メトリクスID', key: 'metric_id' },
        { text: 'リソース名', key: 'resource_name' },
        { text: 'タイプ', key: 'resource_type' },
        { text: '現在使用率', key: 'current_usage' },
        { text: '閾値', key: 'threshold' },
        { text: '3ヶ月予測', key: 'forecast_3m' },
        { text: 'ステータス', key: 'status' },
        { text: '測定日時', key: 'measured_at' }
      ];

      headers.forEach((header) => {
        const th = createEl('th', { textContent: header.text });
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          sortKey = header.key;
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          filteredData = sortData(filteredData, sortKey, sortDirection);
          paginator.data = filteredData;
          renderTable();
        });
        if (sortKey === header.key) {
          const arrow = createEl('span', { textContent: sortDirection === 'asc' ? ' ▲' : ' ▼' });
          th.appendChild(arrow);
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);

      const tbody = createEl('tbody');
      paginator.currentData.forEach((metric) => {
        const row = createEl('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => openEditCapacityModal(metric));

        row.appendChild(createEl('td', { textContent: metric.metric_id }));
        row.appendChild(createEl('td', { textContent: metric.resource_name }));
        row.appendChild(createEl('td', { textContent: metric.resource_type }));
        row.appendChild(createEl('td', { textContent: `${metric.current_usage}${metric.unit}` }));
        row.appendChild(createEl('td', { textContent: `${metric.threshold}${metric.unit}` }));
        row.appendChild(createEl('td', { textContent: `${metric.forecast_3m}${metric.unit}` }));

        let statusEmoji = '';
        let statusText = metric.status;
        if (metric.status === 'Normal') {
          statusEmoji = '✅';
          statusText = '正常';
        } else if (metric.status === 'Warning') {
          statusEmoji = '🟡';
          statusText = '注意';
        } else if (metric.status === 'Critical') {
          statusEmoji = '🔴';
          statusText = '要増設';
        }

        row.appendChild(createEl('td', { textContent: `${statusEmoji} ${statusText}` }));

        row.appendChild(
          createEl('td', { textContent: new Date(metric.measured_at).toLocaleDateString('ja-JP') })
        );

        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);

      const paginationWrapper = createEl('div');
      paginationWrapper.className = 'pagination-wrapper';
      paginationWrapper.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 16px;';

      const prevBtn = createEl('button', { textContent: '← 前へ', className: 'btn-secondary' });
      prevBtn.disabled = !paginator.hasPrev;
      prevBtn.addEventListener('click', () => {
        paginator.prev();
        renderTable();
      });

      const pageInfo = createEl('span', {
        textContent: `${paginator.currentPage} / ${paginator.totalPages} ページ (全 ${filteredData.length} 件)`
      });

      const nextBtn = createEl('button', { textContent: '次へ →', className: 'btn-secondary' });
      nextBtn.disabled = !paginator.hasNext;
      nextBtn.addEventListener('click', () => {
        paginator.next();
        renderTable();
      });

      paginationWrapper.appendChild(prevBtn);
      paginationWrapper.appendChild(pageInfo);
      paginationWrapper.appendChild(nextBtn);
      section.appendChild(paginationWrapper);
    }

    const header = createEl('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: 'リソース使用状況' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '12px';

    const createBtn = createEl('button', {
      className: 'btn-primary',
      textContent: '新規作成'
    });
    createBtn.addEventListener('click', () => {
      openCreateCapacityModal();
    });

    const csvBtn = createEl('button', { className: 'btn-export' });
    const csvIcon = createEl('i', { className: 'fas fa-download' });
    csvBtn.appendChild(csvIcon);
    setText(csvBtn, ' CSVエクスポート', true);
    csvBtn.addEventListener('click', () => {
      exportToCSV(filteredData, 'capacity_metrics.csv');
    });

    const excelBtn = createEl('button', { className: 'btn-export' });
    const excelIcon = createEl('i', { className: 'fas fa-file-excel' });
    excelBtn.appendChild(excelIcon);
    setText(excelBtn, ' Excelエクスポート', true);
    excelBtn.addEventListener('click', () => {
      exportToExcel(filteredData, 'capacity_metrics.xlsx');
    });

    const pdfBtn = createEl('button', { className: 'btn-export' });
    const pdfIcon = createEl('i', { className: 'fas fa-file-pdf' });
    pdfBtn.appendChild(pdfIcon);
    setText(pdfBtn, ' PDFエクスポート', true);
    pdfBtn.addEventListener('click', () => {
      exportToPDF(filteredData, 'capacity_metrics.pdf', { title: 'キャパシティメトリクス一覧' });
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(csvBtn);
    btnGroup.appendChild(excelBtn);
    btnGroup.appendChild(pdfBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    // 説明セクション
    const explanation = createExplanationSection(
      'CPU、メモリ、ディスク、ネットワークなどのITリソース使用状況を監視し、キャパシティの最適化を図る機能です。',
      'リソース不足によるサービス低下を予防します。使用率の推移分析により、適切なタイミングでのリソース増強を計画できます。コスト最適化と性能維持のバランスを取るために重要です。'
    );
    section.appendChild(explanation);

    const controlRow = createEl('div');
    controlRow.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const searchInput = createEl('input', {
      type: 'text',
      placeholder: '検索... (メトリクスID、リソース名、タイプ)'
    });
    searchInput.style.cssText =
      'padding: 8px; width: 300px; border: 1px solid #ccc; border-radius: 4px;';
    searchInput.addEventListener('input', (e) => {
      filteredData = searchData(allMetrics, e.target.value, [
        'metric_id',
        'resource_name',
        'resource_type',
        'status'
      ]);
      paginator.data = filteredData;
      paginator.currentPage = 1;
      renderTable();
    });

    const pageSizeSelect = createEl('select');
    pageSizeSelect.style.cssText = 'padding: 8px; border: 1px solid #ccc; border-radius: 4px;';
    [10, 20, 50].forEach((size) => {
      const option = createEl('option', { value: String(size), textContent: `${size}件表示` });
      pageSizeSelect.appendChild(option);
    });
    pageSizeSelect.addEventListener('change', (e) => {
      paginator.itemsPerPage = parseInt(e.target.value, 10);
      paginator.currentPage = 1;
      renderTable();
    });

    controlRow.appendChild(searchInput);
    controlRow.appendChild(pageSizeSelect);
    section.appendChild(controlRow);

    renderTable();
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'キャパシティ管理データの読み込みに失敗しました');
  }
}

// ===== Settings Views =====

function renderSettingsGeneral(container) {
  const section = createEl('div');

  const header = createEl('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '24px';

  const h2 = createEl('h2', { textContent: 'システム基本設定' });
  header.appendChild(h2);

  const editBtn = createEl('button', {
    className: 'btn-primary',
    textContent: '設定を編集'
  });
  editBtn.addEventListener('click', () => {
    openSystemSettingsModal();
  });
  header.appendChild(editBtn);
  section.appendChild(header);

  const card = createEl('div', { className: 'card' });
  card.style.padding = '24px';

  const settingsItems = [
    { label: 'システム名', value: 'ITSM-Sec Nexus' },
    { label: 'バージョン', value: '1.0.0' },
    { label: '環境', value: '開発環境' },
    { label: 'データベース', value: 'SQLite 3.x' },
    { label: 'API Base URL', value: API_BASE },
    { label: 'セキュリティレベル', value: '高（JWT + RBAC）' },
    { label: '最終更新', value: new Date().toLocaleString('ja-JP') }
  ];

  settingsItems.forEach((item) => {
    const row = createEl('div');
    row.style.marginBottom = '16px';
    row.style.paddingBottom = '16px';
    row.style.borderBottom = '1px solid var(--border-color)';

    const label = createEl('div', { textContent: item.label });
    label.style.fontWeight = '600';
    label.style.color = 'var(--text-secondary)';
    label.style.fontSize = '0.85rem';
    label.style.marginBottom = '4px';

    const value = createEl('div', { textContent: item.value });
    value.style.fontSize = '1rem';
    value.style.color = 'var(--text-primary)';

    row.appendChild(label);
    row.appendChild(value);
    card.appendChild(row);
  });

  section.appendChild(card);
  container.appendChild(section);
}

async function renderSettingsUsers(container) {
  const section = createEl('div');

  const header = createEl('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '24px';

  const h2 = createEl('h2', { textContent: 'ユーザー・権限管理' });
  header.appendChild(h2);

  // Header buttons container
  const headerBtns = createEl('div');
  headerBtns.style.display = 'flex';
  headerBtns.style.gap = '12px';

  // M365 Sync button
  const syncBtn = createEl('button', {
    className: 'btn-secondary',
    innerHTML: '<i class="fas fa-sync"></i> M365同期'
  });
  syncBtn.title = 'Microsoft 365からユーザー情報を同期';
  syncBtn.addEventListener('click', async () => {
    syncBtn.disabled = true;
    syncBtn.innerHTML = '<i class="fas fa-sync fa-spin"></i> 同期中...';
    try {
      // Future: Call M365 sync API endpoint
      Toast.info('M365同期機能は現在準備中です。定期同期はバックエンドで設定予定です。');
    } catch (error) {
      Toast.error(`同期エラー: ${error.message}`);
    } finally {
      syncBtn.disabled = false;
      syncBtn.innerHTML = '<i class="fas fa-sync"></i> M365同期';
    }
  });
  headerBtns.appendChild(syncBtn);

  const createBtn = createEl('button', {
    className: 'btn-primary',
    textContent: '新規ユーザー作成'
  });
  createBtn.addEventListener('click', () => {
    openCreateUserModal();
  });
  headerBtns.appendChild(createBtn);
  header.appendChild(headerBtns);
  section.appendChild(header);

  // 説明セクション
  const explanation = createExplanationSection(
    'システムを利用するユーザーアカウントと権限（ロール）を管理する機能です。admin、manager、analyst、viewerの4段階の権限を設定できます。',
    'セキュリティとアクセス制御の要です。最小権限の原則に基づき、各ユーザーに必要な権限のみを付与することで、誤操作や不正アクセスを防止します。監査証跡の記録とコンプライアンス対応にも不可欠です。'
  );
  section.appendChild(explanation);

  const card = createEl('div', { className: 'card' });
  card.style.padding = '24px';

  const infoText = createEl('p', {
    textContent:
      '現在のロール体系: admin（全権限）、manager（管理者）、analyst（分析者）、viewer（閲覧者）'
  });
  infoText.style.marginBottom = '20px';
  infoText.style.color = 'var(--text-secondary)';
  card.appendChild(infoText);

  // Search and filter section
  const searchSection = createEl('div');
  searchSection.style.cssText =
    'display: flex; flex-wrap: wrap; gap: 12px; margin-bottom: 20px; padding: 16px; background: var(--bg-secondary); border-radius: 8px;';

  // Text search input
  const searchInput = createEl('input', {
    type: 'text',
    placeholder: 'ユーザー名、社員名、メールで検索...',
    id: 'user-search-input'
  });
  searchInput.style.cssText =
    'flex: 1; min-width: 200px; padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);';
  searchSection.appendChild(searchInput);

  // Role filter
  const roleFilter = createEl('select', { id: 'user-role-filter' });
  roleFilter.style.cssText =
    'padding: 8px 12px; border: 1px solid var(--border-color); border-radius: 4px; background: var(--bg-primary); color: var(--text-primary);';
  const roleOptions = [
    { value: '', text: 'すべてのロール' },
    { value: 'admin', text: 'Admin' },
    { value: 'manager', text: 'Manager' },
    { value: 'analyst', text: 'Analyst' },
    { value: 'viewer', text: 'Viewer' }
  ];
  roleOptions.forEach((opt) => {
    const option = createEl('option', { value: opt.value, textContent: opt.text });
    roleFilter.appendChild(option);
  });
  searchSection.appendChild(roleFilter);

  // Search button
  const searchBtn = createEl('button', {
    className: 'btn-primary',
    innerHTML: '<i class="fas fa-search"></i> 検索'
  });
  searchSection.appendChild(searchBtn);

  // Clear button
  const clearBtn = createEl('button', {
    className: 'btn-secondary',
    textContent: 'クリア'
  });
  searchSection.appendChild(clearBtn);

  card.appendChild(searchSection);

  // Fetch users from API
  const allUsers = await apiCall('/users');

  // Pagination state
  const USERS_PER_PAGE = 10;
  let currentPage = 1;
  let filteredUsers = [...allUsers];

  // Get current user role for conditional display
  const currentUserRole = localStorage.getItem('userRole') || 'viewer';

  // Stats display
  const statsDiv = createEl('div');
  statsDiv.style.cssText = 'margin-bottom: 16px; color: var(--text-secondary); font-size: 14px;';
  card.appendChild(statsDiv);

  // Table container
  const tableContainer = createEl('div');
  card.appendChild(tableContainer);

  // Pagination container
  const paginationContainer = createEl('div');
  paginationContainer.style.cssText =
    'display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 20px;';
  card.appendChild(paginationContainer);

  // Function to filter users
  function filterUsers() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    const roleValue = roleFilter.value;

    filteredUsers = allUsers.filter((user) => {
      const matchesSearch =
        !searchTerm ||
        (user.username && user.username.toLowerCase().includes(searchTerm)) ||
        (user.full_name && user.full_name.toLowerCase().includes(searchTerm)) ||
        (user.email && user.email.toLowerCase().includes(searchTerm)) ||
        (user.employee_number && user.employee_number.toLowerCase().includes(searchTerm));

      const matchesRole = !roleValue || user.role === roleValue;

      return matchesSearch && matchesRole;
    });

    currentPage = 1;
    renderTable();
  }

  // Function to render table
  function renderTable() {
    clearElement(tableContainer);
    clearElement(paginationContainer);

    const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
    const startIndex = (currentPage - 1) * USERS_PER_PAGE;
    const endIndex = startIndex + USERS_PER_PAGE;
    const pageUsers = filteredUsers.slice(startIndex, endIndex);

    // Update stats
    setText(
      statsDiv,
      `全${allUsers.length}件中 ${filteredUsers.length}件表示 (ページ ${currentPage}/${totalPages || 1})`
    );

    if (filteredUsers.length === 0) {
      const noData = createEl('div');
      noData.style.cssText = 'text-align: center; padding: 40px; color: var(--text-secondary);';
      setText(noData, '該当するユーザーが見つかりません');
      tableContainer.appendChild(noData);
      return;
    }

    const usersTable = createEl('table', { className: 'data-table' });
    const thead = createEl('thead');
    const headerRow = createEl('tr');
    const headers = ['ログインユーザー名', '社員番号', '社員名', 'メールアドレス', 'ロール'];

    if (currentUserRole === 'admin') {
      headers.push('最終ログイン');
    }
    headers.push('アクション');

    headers.forEach((text) => {
      headerRow.appendChild(createEl('th', { textContent: text }));
    });
    thead.appendChild(headerRow);
    usersTable.appendChild(thead);

    const tbody = createEl('tbody');

    pageUsers.forEach((user) => {
      const row = createEl('tr');

      row.appendChild(createEl('td', { textContent: user.username }));
      row.appendChild(createEl('td', { textContent: user.employee_number || '-' }));
      row.appendChild(createEl('td', { textContent: user.full_name || '-' }));
      row.appendChild(createEl('td', { textContent: user.email }));

      const roleBadge = createEl('span', {
        className: user.role === 'admin' ? 'badge badge-critical' : 'badge badge-info',
        textContent: user.role.toUpperCase()
      });
      const roleCell = createEl('td');
      roleCell.appendChild(roleBadge);
      row.appendChild(roleCell);

      if (currentUserRole === 'admin') {
        const lastLoginCell = createEl('td');
        if (user.last_login) {
          const date = new Date(user.last_login);
          setText(lastLoginCell, date.toLocaleString('ja-JP'));
        } else {
          setText(lastLoginCell, '未ログイン');
        }
        row.appendChild(lastLoginCell);
      }

      const actionCell = createEl('td');
      actionCell.style.cssText = 'display: flex; gap: 8px;';

      const editBtn = createEl('button', { className: 'btn-icon' });
      editBtn.style.cssText =
        'background: #3b82f6; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;';
      setText(editBtn, '✏️');
      editBtn.title = '編集';
      editBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openEditUserModal(user);
      });
      actionCell.appendChild(editBtn);

      const deleteBtn = createEl('button', { className: 'btn-icon' });
      deleteBtn.style.cssText =
        'background: #dc2626; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer;';
      setText(deleteBtn, '🗑️');
      deleteBtn.title = '削除';
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showDeleteConfirmDialog('ユーザー', user.id, user.username, async () => {
          await deleteUser(user.id);
        });
      });
      actionCell.appendChild(deleteBtn);

      row.appendChild(actionCell);
      tbody.appendChild(row);
    });

    usersTable.appendChild(tbody);
    tableContainer.appendChild(usersTable);

    // Render pagination
    if (totalPages > 1) {
      // First page button
      const firstBtn = createEl('button', { className: 'btn-secondary', textContent: '«' });
      firstBtn.disabled = currentPage === 1;
      firstBtn.addEventListener('click', () => {
        currentPage = 1;
        renderTable();
      });
      paginationContainer.appendChild(firstBtn);

      // Previous button
      const prevBtn = createEl('button', { className: 'btn-secondary', textContent: '‹' });
      prevBtn.disabled = currentPage === 1;
      prevBtn.addEventListener('click', () => {
        currentPage -= 1;
        renderTable();
      });
      paginationContainer.appendChild(prevBtn);

      // Page numbers
      const maxVisiblePages = 5;
      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
      const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
      if (endPage - startPage < maxVisiblePages - 1) {
        startPage = Math.max(1, endPage - maxVisiblePages + 1);
      }

      const createPageClickHandler = (pageNum) => () => {
        currentPage = pageNum;
        renderTable();
      };

      for (let i = startPage; i <= endPage; i += 1) {
        const pageNum = i;
        const pageBtn = createEl('button', {
          className: pageNum === currentPage ? 'btn-primary' : 'btn-secondary',
          textContent: String(pageNum)
        });
        pageBtn.addEventListener('click', createPageClickHandler(pageNum));
        paginationContainer.appendChild(pageBtn);
      }

      // Next button
      const nextBtn = createEl('button', { className: 'btn-secondary', textContent: '›' });
      nextBtn.disabled = currentPage === totalPages;
      nextBtn.addEventListener('click', () => {
        currentPage += 1;
        renderTable();
      });
      paginationContainer.appendChild(nextBtn);

      // Last page button
      const lastBtn = createEl('button', { className: 'btn-secondary', textContent: '»' });
      lastBtn.disabled = currentPage === totalPages;
      lastBtn.addEventListener('click', () => {
        currentPage = totalPages;
        renderTable();
      });
      paginationContainer.appendChild(lastBtn);
    }
  }

  // Event listeners for search
  searchBtn.addEventListener('click', filterUsers);
  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') filterUsers();
  });
  roleFilter.addEventListener('change', filterUsers);
  clearBtn.addEventListener('click', () => {
    searchInput.value = '';
    roleFilter.value = '';
    filterUsers();
  });

  // Initial render
  renderTable();

  section.appendChild(card);
  container.appendChild(section);
}

async function renderSettingsNotifications(container) {
  const section = createEl('div');

  // Header
  const header = createEl('div');
  header.style.cssText =
    'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;';

  const h2 = createEl('h2', { textContent: '通知設定' });
  header.appendChild(h2);

  const addChannelBtn = createEl('button', { className: 'btn-primary', textContent: '+ チャネル追加' });
  addChannelBtn.addEventListener('click', () => openAddNotificationChannelModal());
  header.appendChild(addChannelBtn);

  section.appendChild(header);

  // 説明セクション
  const explanation = createExplanationSection(
    'Slack、Teams、メールなどの通知チャネルを管理し、重要イベント発生時の通知方法を設定します。',
    '重大な問題の見逃しを防ぎます。リアルタイムアラートにより、担当者が迅速に対応を開始できます。通知チャネルの最適化により、アラート疲れを防ぎつつ、本当に重要な情報を確実に伝達します。'
  );
  section.appendChild(explanation);

  try {
    // チャネル一覧を取得
    const response = await apiCall('/notifications/channels');
    const channels = response.data || [];

    // 通知チャネル一覧
    const channelsCard = createEl('div', { className: 'card-large glass' });
    channelsCard.style.padding = '24px';
    channelsCard.style.marginBottom = '24px';

    const channelsTitle = createEl('h3', { textContent: '通知チャネル一覧' });
    channelsTitle.style.marginBottom = '16px';
    channelsCard.appendChild(channelsTitle);

    if (channels.length === 0) {
      const emptyMsg = createEl('div', { textContent: '通知チャネルが登録されていません。' });
      emptyMsg.style.cssText = 'text-align: center; padding: 40px; color: var(--text-secondary);';
      channelsCard.appendChild(emptyMsg);
    } else {
      const channelsTable = createEl('table', { className: 'data-table' });
      const thead = createEl('thead');
      const headerRow = createEl('tr');
      ['タイプ', '名前', '設定', 'ステータス', 'アクション'].forEach((text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      });
      thead.appendChild(headerRow);
      channelsTable.appendChild(thead);

      const tbody = createEl('tbody');
      channels.forEach((channel) => {
        const row = createEl('tr');

        // Type
        const typeCell = createEl('td');
        const typeIcon =
          channel.type === 'slack'
            ? '💬'
            : channel.type === 'teams'
              ? '👥'
              : channel.type === 'email'
                ? '📧'
                : '🔔';
        typeCell.appendChild(
          createEl('span', { textContent: `${typeIcon} ${(channel.type || 'unknown').toUpperCase()}` })
        );
        row.appendChild(typeCell);

        // Name
        row.appendChild(createEl('td', { textContent: channel.name }));

        // Config
        const configCell = createEl('td');
        if (channel.type === 'slack') {
          setText(configCell, `#${channel.config.channel || 'general'}`);
        } else if (channel.type === 'teams') {
          setText(configCell, channel.config.webhook_url ? 'Webhook設定済' : '未設定');
        } else if (channel.type === 'email') {
          setText(configCell, channel.config.recipients || '未設定');
        }
        row.appendChild(configCell);

        // Status
        const statusCell = createEl('td');
        const statusBadge = createEl('span', {
          className: channel.enabled ? 'badge badge-success' : 'badge badge-secondary',
          textContent: channel.enabled ? '有効' : '無効'
        });
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        // Actions
        const actionCell = createEl('td');
        actionCell.style.cssText = 'display: flex; gap: 8px;';

        const testBtn = createEl('button', { className: 'btn-secondary', textContent: 'テスト送信' });
        testBtn.style.cssText = 'padding: 6px 12px; font-size: 0.85rem;';
        testBtn.addEventListener('click', () => testNotificationChannel(channel.id));
        actionCell.appendChild(testBtn);

        const editBtn = createEl('button', { className: 'btn-secondary', textContent: '編集' });
        editBtn.style.cssText = 'padding: 6px 12px; font-size: 0.85rem;';
        editBtn.addEventListener('click', () => openEditNotificationChannelModal(channel));
        actionCell.appendChild(editBtn);

        const deleteBtn = createEl('button', { className: 'btn-danger', textContent: '削除' });
        deleteBtn.style.cssText = 'padding: 6px 12px; font-size: 0.85rem;';
        deleteBtn.addEventListener('click', () =>
          showDeleteConfirmDialog('通知チャネル', channel.id, channel.name, async () => {
            await deleteNotificationChannel(channel.id);
            await loadView('settings_notifications');
          })
        );
        actionCell.appendChild(deleteBtn);

        row.appendChild(actionCell);
        tbody.appendChild(row);
      });

      channelsTable.appendChild(tbody);
      channelsCard.appendChild(channelsTable);
    }

    section.appendChild(channelsCard);

    // 通知ログ
    const logsResponse = await apiCall('/notifications/logs?limit=10');
    const logs = Array.isArray(logsResponse) ? logsResponse : (logsResponse.data || []);

    const logsCard = createEl('div', { className: 'card-large glass' });
    logsCard.style.padding = '24px';
    logsCard.style.marginBottom = '24px';

    const logsTitle = createEl('h3', { textContent: '最近の通知ログ' });
    logsTitle.style.marginBottom = '16px';
    logsCard.appendChild(logsTitle);

    if (logs.length === 0) {
      const emptyMsg = createEl('div', { textContent: '通知ログがありません。' });
      emptyMsg.style.cssText = 'text-align: center; padding: 40px; color: var(--text-secondary);';
      logsCard.appendChild(emptyMsg);
    } else {
      const logsTable = createEl('table', { className: 'data-table' });
      const thead = createEl('thead');
      const headerRow = createEl('tr');
      ['日時', 'チャネル', 'イベント', 'ステータス'].forEach((text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      });
      thead.appendChild(headerRow);
      logsTable.appendChild(thead);

      const tbody = createEl('tbody');
      logs.forEach((log) => {
        const row = createEl('tr');

        const dateCell = createEl('td');
        const date = new Date(log.created_at);
        setText(dateCell, date.toLocaleString('ja-JP'));
        row.appendChild(dateCell);

        row.appendChild(createEl('td', { textContent: log.channel_name || '-' }));
        row.appendChild(createEl('td', { textContent: log.event_type || '-' }));

        const statusCell = createEl('td');
        const statusBadge = createEl('span', {
          className: log.status === 'sent' ? 'badge badge-success' : 'badge badge-critical',
          textContent: log.status === 'sent' ? '送信成功' : '送信失敗'
        });
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        tbody.appendChild(row);
      });

      logsTable.appendChild(tbody);
      logsCard.appendChild(logsTable);
    }

    section.appendChild(logsCard);

    // 通知統計
    const stats = await apiCall('/notifications/stats');

    const statsCard = createEl('div', { className: 'card-large glass' });
    statsCard.style.padding = '24px';

    const statsTitle = createEl('h3', { textContent: '通知統計（過去30日）' });
    statsTitle.style.marginBottom = '16px';
    statsCard.appendChild(statsTitle);

    const statsGrid = createEl('div');
    statsGrid.style.cssText = 'display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;';

    const statsItems = [
      { label: '総送信数', value: stats.total_sent || 0, icon: '📨' },
      { label: '成功', value: stats.success_count || 0, icon: '✅' },
      { label: '失敗', value: stats.failed_count || 0, icon: '❌' },
      {
        label: '成功率',
        value: stats.total_sent > 0
          ? `${((stats.success_count / stats.total_sent) * 100).toFixed(1)}%`
          : '0%',
        icon: '📊'
      }
    ];

    statsItems.forEach((item) => {
      const statCard = createEl('div');
      statCard.style.cssText =
        'background: rgba(255,255,255,0.05); padding: 16px; border-radius: 8px; border: 1px solid var(--border-color);';

      const iconLabel = createEl('div', { textContent: `${item.icon} ${item.label}` });
      iconLabel.style.cssText = 'font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 8px;';

      const valueDiv = createEl('div', { textContent: String(item.value) });
      valueDiv.style.cssText = 'font-size: 1.5rem; font-weight: 700; color: var(--text-primary);';

      statCard.appendChild(iconLabel);
      statCard.appendChild(valueDiv);
      statsGrid.appendChild(statCard);
    });

    statsCard.appendChild(statsGrid);
    section.appendChild(statsCard);
  } catch (error) {
    console.error('Error loading notification settings:', error);
    renderError(section, '通知設定の読み込みに失敗しました');
  }

  container.appendChild(section);
}

// Helper functions for notification channels
async function testNotificationChannel(channelId) {
  try {
    await apiCall(`/notifications/channels/${channelId}/test`, 'POST');
    Toast.success('テスト通知を送信しました');
  } catch (error) {
    Toast.error('テスト通知の送信に失敗しました');
  }
}

async function deleteNotificationChannel(channelId) {
  try {
    await apiCall(`/notifications/channels/${channelId}`, 'DELETE');
    Toast.success('通知チャネルを削除しました');
  } catch (error) {
    Toast.error('通知チャネルの削除に失敗しました');
  }
}

function openAddNotificationChannelModal() {
  const modal = createModal('通知チャネル追加');

  const form = createEl('form');
  form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

  // Channel Type
  const typeGroup = createEl('div', { className: 'form-group' });
  const typeLabel = createEl('label', { textContent: 'チャネルタイプ' });
  const typeSelect = createEl('select', { className: 'form-control', id: 'channel-type' });
  ['slack', 'teams', 'email'].forEach((type) => {
    const option = createEl('option', { value: type, textContent: type.toUpperCase() });
    typeSelect.appendChild(option);
  });
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeSelect);
  form.appendChild(typeGroup);

  // Channel Name
  const nameGroup = createEl('div', { className: 'form-group' });
  const nameLabel = createEl('label', { textContent: 'チャネル名' });
  const nameInput = createEl('input', { type: 'text', className: 'form-control', id: 'channel-name', placeholder: '例: Slack本番アラート' });
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  form.appendChild(nameGroup);

  // Dynamic config fields container
  const configContainer = createEl('div', { id: 'config-container' });
  form.appendChild(configContainer);

  // Update config fields based on type
  function updateConfigFields() {
    clearElement(configContainer);
    const selectedType = typeSelect.value;

    if (selectedType === 'slack') {
      const webhookGroup = createEl('div', { className: 'form-group' });
      const webhookLabel = createEl('label', { textContent: 'Webhook URL' });
      const webhookInput = createEl('input', {
        type: 'text',
        className: 'form-control',
        id: 'slack-webhook',
        placeholder: 'https://hooks.slack.com/services/...'
      });
      webhookGroup.appendChild(webhookLabel);
      webhookGroup.appendChild(webhookInput);
      configContainer.appendChild(webhookGroup);

      const channelGroup = createEl('div', { className: 'form-group' });
      const channelLabel = createEl('label', { textContent: 'チャネル名' });
      const channelInput = createEl('input', {
        type: 'text',
        className: 'form-control',
        id: 'slack-channel',
        placeholder: 'general'
      });
      channelGroup.appendChild(channelLabel);
      channelGroup.appendChild(channelInput);
      configContainer.appendChild(channelGroup);
    } else if (selectedType === 'teams') {
      const webhookGroup = createEl('div', { className: 'form-group' });
      const webhookLabel = createEl('label', { textContent: 'Webhook URL' });
      const webhookInput = createEl('input', {
        type: 'text',
        className: 'form-control',
        id: 'teams-webhook',
        placeholder: 'https://outlook.office.com/webhook/...'
      });
      webhookGroup.appendChild(webhookLabel);
      webhookGroup.appendChild(webhookInput);
      configContainer.appendChild(webhookGroup);
    } else if (selectedType === 'email') {
      const recipientsGroup = createEl('div', { className: 'form-group' });
      const recipientsLabel = createEl('label', { textContent: '宛先（カンマ区切り）' });
      const recipientsInput = createEl('input', {
        type: 'text',
        className: 'form-control',
        id: 'email-recipients',
        placeholder: 'admin@example.com, ops@example.com'
      });
      recipientsGroup.appendChild(recipientsLabel);
      recipientsGroup.appendChild(recipientsInput);
      configContainer.appendChild(recipientsGroup);
    }
  }

  typeSelect.addEventListener('change', updateConfigFields);
  updateConfigFields();

  // Enabled checkbox
  const enabledGroup = createEl('div', { className: 'form-group' });
  enabledGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const enabledCheckbox = createEl('input', { type: 'checkbox', id: 'channel-enabled' });
  enabledCheckbox.checked = true;
  const enabledLabel = createEl('label', { textContent: '有効化' });
  enabledLabel.style.margin = '0';
  enabledGroup.appendChild(enabledCheckbox);
  enabledGroup.appendChild(enabledLabel);
  form.appendChild(enabledGroup);

  modal.body.appendChild(form);

  // Buttons
  const saveBtn = createEl('button', { className: 'btn-primary', textContent: '保存' });
  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const type = typeSelect.value;
    const name = nameInput.value.trim();
    const enabled = enabledCheckbox.checked;

    if (!name) {
      Toast.error('チャネル名を入力してください');
      return;
    }

    const config = {};
    if (type === 'slack') {
      const webhookInput = document.getElementById('slack-webhook');
      const channelInput = document.getElementById('slack-channel');
      config.webhook_url = webhookInput.value.trim();
      config.channel = channelInput.value.trim() || 'general';
    } else if (type === 'teams') {
      const webhookInput = document.getElementById('teams-webhook');
      config.webhook_url = webhookInput.value.trim();
    } else if (type === 'email') {
      const recipientsInput = document.getElementById('email-recipients');
      config.recipients = recipientsInput.value.trim();
    }

    try {
      await apiCall('/notifications/channels', 'POST', { type, name, config, enabled });
      Toast.success('通知チャネルを追加しました');
      closeModal();
      await loadView('settings_notifications');
    } catch (error) {
      Toast.error('通知チャネルの追加に失敗しました');
    }
  });

  const cancelBtn = createEl('button', { className: 'btn-secondary', textContent: 'キャンセル' });
  cancelBtn.addEventListener('click', () => closeModal());

  modal.footer.appendChild(saveBtn);
  modal.footer.appendChild(cancelBtn);

  showModal();
}

function openEditNotificationChannelModal(channel) {
  const modal = createModal('通知チャネル編集');

  const form = createEl('form');
  form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

  // Channel Name
  const nameGroup = createEl('div', { className: 'form-group' });
  const nameLabel = createEl('label', { textContent: 'チャネル名' });
  const nameInput = createEl('input', { type: 'text', className: 'form-control', value: channel.name });
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  form.appendChild(nameGroup);

  // Config fields based on type
  if (channel.type === 'slack') {
    const webhookGroup = createEl('div', { className: 'form-group' });
    const webhookLabel = createEl('label', { textContent: 'Webhook URL' });
    const webhookInput = createEl('input', {
      type: 'text',
      className: 'form-control',
      id: 'edit-slack-webhook',
      value: channel.config.webhook_url || ''
    });
    webhookGroup.appendChild(webhookLabel);
    webhookGroup.appendChild(webhookInput);
    form.appendChild(webhookGroup);

    const channelGroup = createEl('div', { className: 'form-group' });
    const channelLabel = createEl('label', { textContent: 'チャネル名' });
    const channelInput = createEl('input', {
      type: 'text',
      className: 'form-control',
      id: 'edit-slack-channel',
      value: channel.config.channel || ''
    });
    channelGroup.appendChild(channelLabel);
    channelGroup.appendChild(channelInput);
    form.appendChild(channelGroup);
  } else if (channel.type === 'teams') {
    const webhookGroup = createEl('div', { className: 'form-group' });
    const webhookLabel = createEl('label', { textContent: 'Webhook URL' });
    const webhookInput = createEl('input', {
      type: 'text',
      className: 'form-control',
      id: 'edit-teams-webhook',
      value: channel.config.webhook_url || ''
    });
    webhookGroup.appendChild(webhookLabel);
    webhookGroup.appendChild(webhookInput);
    form.appendChild(webhookGroup);
  } else if (channel.type === 'email') {
    const recipientsGroup = createEl('div', { className: 'form-group' });
    const recipientsLabel = createEl('label', { textContent: '宛先（カンマ区切り）' });
    const recipientsInput = createEl('input', {
      type: 'text',
      className: 'form-control',
      id: 'edit-email-recipients',
      value: channel.config.recipients || ''
    });
    recipientsGroup.appendChild(recipientsLabel);
    recipientsGroup.appendChild(recipientsInput);
    form.appendChild(recipientsGroup);
  }

  // Enabled checkbox
  const enabledGroup = createEl('div', { className: 'form-group' });
  enabledGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const enabledCheckbox = createEl('input', { type: 'checkbox', id: 'edit-channel-enabled' });
  enabledCheckbox.checked = channel.enabled;
  const enabledLabel = createEl('label', { textContent: '有効化' });
  enabledLabel.style.margin = '0';
  enabledGroup.appendChild(enabledCheckbox);
  enabledGroup.appendChild(enabledLabel);
  form.appendChild(enabledGroup);

  modal.body.appendChild(form);

  // Buttons
  const saveBtn = createEl('button', { className: 'btn-primary', textContent: '保存' });
  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const name = nameInput.value.trim();
    const enabled = enabledCheckbox.checked;

    if (!name) {
      Toast.error('チャネル名を入力してください');
      return;
    }

    const config = {};
    if (channel.type === 'slack') {
      const webhookInput = document.getElementById('edit-slack-webhook');
      const channelInput = document.getElementById('edit-slack-channel');
      config.webhook_url = webhookInput.value.trim();
      config.channel = channelInput.value.trim();
    } else if (channel.type === 'teams') {
      const webhookInput = document.getElementById('edit-teams-webhook');
      config.webhook_url = webhookInput.value.trim();
    } else if (channel.type === 'email') {
      const recipientsInput = document.getElementById('edit-email-recipients');
      config.recipients = recipientsInput.value.trim();
    }

    try {
      await apiCall(`/notifications/channels/${channel.id}`, 'PUT', { name, config, enabled });
      Toast.success('通知チャネルを更新しました');
      closeModal();
      await loadView('settings_notifications');
    } catch (error) {
      Toast.error('通知チャネルの更新に失敗しました');
    }
  });

  const cancelBtn = createEl('button', { className: 'btn-secondary', textContent: 'キャンセル' });
  cancelBtn.addEventListener('click', () => closeModal());

  modal.footer.appendChild(saveBtn);
  modal.footer.appendChild(cancelBtn);

  showModal();
}

// ===== User Settings View =====

async function renderUserSettings(container) {
  const section = createEl('div');

  const header = createEl('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '24px';

  const h2 = createEl('h2', { textContent: 'ユーザー設定' });
  header.appendChild(h2);
  section.appendChild(header);

  // Get current user info from localStorage
  const user = currentUser || JSON.parse(localStorage.getItem(USER_KEY) || '{}');

  // Profile Card
  const profileCard = createEl('div', { className: 'card' });
  profileCard.style.padding = '24px';
  profileCard.style.marginBottom = '24px';

  const profileTitle = createEl('h3', { textContent: 'プロフィール情報' });
  profileTitle.style.marginBottom = '20px';
  profileTitle.style.fontSize = '1.1rem';
  profileTitle.style.color = 'var(--text-primary)';
  profileCard.appendChild(profileTitle);

  // User info items
  const userInfoItems = [
    { label: 'ユーザー名', value: user.username || '-', editable: false },
    {
      label: '氏名',
      value: user.full_name || user.fullName || '-',
      field: 'full_name',
      editable: true
    },
    {
      label: 'メールアドレス',
      value: user.email || '-',
      field: 'email',
      editable: true
    },
    { label: 'ロール', value: (user.role || '-').toUpperCase(), editable: false },
    {
      label: '社員番号',
      value: user.employee_number || user.employeeNumber || '-',
      editable: false
    }
  ];

  userInfoItems.forEach((item) => {
    const row = createEl('div');
    row.style.marginBottom = '16px';
    row.style.paddingBottom = '16px';
    row.style.borderBottom = '1px solid var(--border-color)';
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';

    const leftDiv = createEl('div');
    const label = createEl('div', { textContent: item.label });
    label.style.fontWeight = '600';
    label.style.color = 'var(--text-secondary)';
    label.style.fontSize = '0.85rem';
    label.style.marginBottom = '4px';

    const value = createEl('div', { textContent: item.value });
    value.style.fontSize = '1rem';
    value.style.color = 'var(--text-primary)';

    leftDiv.appendChild(label);
    leftDiv.appendChild(value);
    row.appendChild(leftDiv);

    if (item.editable) {
      const editBtn = createEl('button', {
        className: 'btn-edit',
        textContent: '編集'
      });
      editBtn.style.padding = '6px 12px';
      editBtn.style.fontSize = '0.85rem';
      editBtn.addEventListener('click', () => {
        openEditProfileFieldModal(item.field, item.label, item.value);
      });
      row.appendChild(editBtn);
    }

    profileCard.appendChild(row);
  });

  section.appendChild(profileCard);

  // Password Change Card
  const passwordCard = createEl('div', { className: 'card' });
  passwordCard.style.padding = '24px';
  passwordCard.style.marginBottom = '24px';

  const passwordTitle = createEl('h3', { textContent: 'パスワード変更' });
  passwordTitle.style.marginBottom = '20px';
  passwordTitle.style.fontSize = '1.1rem';
  passwordTitle.style.color = 'var(--text-primary)';
  passwordCard.appendChild(passwordTitle);

  const passwordDesc = createEl('p', {
    textContent: 'セキュリティ向上のため、定期的なパスワード変更を推奨します。'
  });
  passwordDesc.style.color = 'var(--text-secondary)';
  passwordDesc.style.marginBottom = '20px';
  passwordCard.appendChild(passwordDesc);

  const changePasswordBtn = createEl('button', {
    className: 'btn-primary',
    textContent: 'パスワードを変更'
  });
  changePasswordBtn.addEventListener('click', () => {
    openChangePasswordModal();
  });
  passwordCard.appendChild(changePasswordBtn);

  section.appendChild(passwordCard);

  // 2FA Settings Card
  const twoFACard = createEl('div', { className: 'card' });
  twoFACard.style.padding = '24px';
  twoFACard.style.marginBottom = '24px';

  const twoFATitle = createEl('h3', { textContent: '二要素認証 (2FA)' });
  twoFATitle.style.marginBottom = '20px';
  twoFATitle.style.fontSize = '1.1rem';
  twoFATitle.style.color = 'var(--text-primary)';
  twoFACard.appendChild(twoFATitle);

  const twoFADesc = createEl('p', {
    textContent:
      '二要素認証を有効にすると、ログイン時に追加のセキュリティコードが必要になります。アカウントの安全性が大幅に向上します。'
  });
  twoFADesc.style.color = 'var(--text-secondary)';
  twoFADesc.style.marginBottom = '20px';
  twoFACard.appendChild(twoFADesc);

  // Get 2FA status from API
  const twoFAStatusContainer = createEl('div');
  twoFAStatusContainer.id = 'twofa-status-container';
  twoFACard.appendChild(twoFAStatusContainer);

  // Render loading state initially
  const loadingText = createEl('p', { textContent: '2FAステータスを確認中...' });
  loadingText.style.color = 'var(--text-secondary)';
  loadingText.style.fontStyle = 'italic';
  twoFAStatusContainer.appendChild(loadingText);

  section.appendChild(twoFACard);

  // Fetch 2FA status asynchronously
  get2FAStatus().then((status) => {
    clearElement(twoFAStatusContainer);

    const twoFAStatus = createEl('div');
    twoFAStatus.style.marginBottom = '20px';
    twoFAStatus.style.display = 'flex';
    twoFAStatus.style.alignItems = 'center';
    twoFAStatus.style.gap = '12px';

    const statusLabel = createEl('span', { textContent: '現在のステータス:' });
    statusLabel.style.fontWeight = '600';

    const statusBadge = createEl('span', {
      className: status.enabled ? 'badge badge-success' : 'badge badge-secondary',
      textContent: status.enabled ? '有効' : '無効'
    });

    twoFAStatus.appendChild(statusLabel);
    twoFAStatus.appendChild(statusBadge);

    if (status.enabled) {
      const backupInfo = createEl('span', {
        textContent: `(バックアップコード: ${status.backupCodesRemaining}/10)`
      });
      backupInfo.style.color =
        status.backupCodesRemaining < 3 ? 'var(--color-danger)' : 'var(--text-secondary)';
      backupInfo.style.fontSize = '0.9rem';
      twoFAStatus.appendChild(backupInfo);
    }

    twoFAStatusContainer.appendChild(twoFAStatus);

    const manage2FABtn = createEl('button', {
      className: 'btn-primary',
      textContent: status.enabled ? '2FA設定を管理' : '2FAを有効化'
    });
    manage2FABtn.addEventListener('click', () => {
      if (status.enabled) {
        open2FAManageModal();
      } else {
        open2FASetupModal();
      }
    });
    twoFAStatusContainer.appendChild(manage2FABtn);
  });

  container.appendChild(section);
}

// ===== User Settings Modals =====

function openEditProfileFieldModal(field, label, currentValue) {
  openModal(`${label}の編集`);

  const modalBody = document.getElementById('modal-body');

  const form = createEl('form');
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '16px';

  const formGroup = createEl('div', { className: 'form-group' });

  const inputLabel = createEl('label', { textContent: label });
  inputLabel.style.display = 'block';
  inputLabel.style.marginBottom = '8px';
  inputLabel.style.fontWeight = '600';

  const input = createEl('input', {
    type: field === 'email' ? 'email' : 'text',
    value: currentValue
  });
  input.style.width = '100%';
  input.style.padding = '10px';
  input.style.border = '1px solid var(--border-color)';
  input.style.borderRadius = '6px';
  input.required = true;

  formGroup.appendChild(inputLabel);
  formGroup.appendChild(input);
  form.appendChild(formGroup);

  modalBody.appendChild(form);

  const modalFooter = document.getElementById('modal-footer');

  const cancelBtn = createEl('button', {
    className: 'btn-cancel',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  const saveBtn = createEl('button', {
    className: 'btn-primary',
    textContent: '保存'
  });
  saveBtn.addEventListener('click', async () => {
    const newValue = input.value.trim();
    if (!newValue) {
      Toast.warning('値を入力してください');
      return;
    }

    try {
      // Update user profile
      const user = currentUser || JSON.parse(localStorage.getItem(USER_KEY) || '{}');
      const userId = user.id || user.user_id;

      const updateData = {};
      updateData[field] = newValue;

      // API call to update user profile
      await apiCall(`/users/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });

      // Update local storage
      user[field] = newValue;
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      currentUser = user;

      Toast.success(`${label}を更新しました`);
      closeModal();
      loadView('user-settings'); // Reload the view
    } catch (error) {
      Toast.error(`更新に失敗しました: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
}

function openChangePasswordModal() {
  openModal('パスワード変更');

  const modalBody = document.getElementById('modal-body');

  const form = createEl('form');
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '16px';

  // Current Password
  const currentPasswordGroup = createEl('div', { className: 'form-group' });
  const currentPasswordLabel = createEl('label', { textContent: '現在のパスワード' });
  currentPasswordLabel.style.display = 'block';
  currentPasswordLabel.style.marginBottom = '8px';
  currentPasswordLabel.style.fontWeight = '600';

  const currentPasswordInput = createEl('input', { type: 'password' });
  currentPasswordInput.style.width = '100%';
  currentPasswordInput.style.padding = '10px';
  currentPasswordInput.style.border = '1px solid var(--border-color)';
  currentPasswordInput.style.borderRadius = '6px';
  currentPasswordInput.required = true;
  currentPasswordInput.autocomplete = 'current-password';

  currentPasswordGroup.appendChild(currentPasswordLabel);
  currentPasswordGroup.appendChild(currentPasswordInput);
  form.appendChild(currentPasswordGroup);

  // New Password
  const newPasswordGroup = createEl('div', { className: 'form-group' });
  const newPasswordLabel = createEl('label', { textContent: '新しいパスワード' });
  newPasswordLabel.style.display = 'block';
  newPasswordLabel.style.marginBottom = '8px';
  newPasswordLabel.style.fontWeight = '600';

  const newPasswordInput = createEl('input', { type: 'password' });
  newPasswordInput.style.width = '100%';
  newPasswordInput.style.padding = '10px';
  newPasswordInput.style.border = '1px solid var(--border-color)';
  newPasswordInput.style.borderRadius = '6px';
  newPasswordInput.required = true;
  newPasswordInput.autocomplete = 'new-password';

  const passwordHint = createEl('div', {
    textContent: '8文字以上を推奨します'
  });
  passwordHint.style.fontSize = '0.85rem';
  passwordHint.style.color = 'var(--text-secondary)';
  passwordHint.style.marginTop = '4px';

  newPasswordGroup.appendChild(newPasswordLabel);
  newPasswordGroup.appendChild(newPasswordInput);
  newPasswordGroup.appendChild(passwordHint);
  form.appendChild(newPasswordGroup);

  // Confirm Password
  const confirmPasswordGroup = createEl('div', { className: 'form-group' });
  const confirmPasswordLabel = createEl('label', { textContent: 'パスワードの確認' });
  confirmPasswordLabel.style.display = 'block';
  confirmPasswordLabel.style.marginBottom = '8px';
  confirmPasswordLabel.style.fontWeight = '600';

  const confirmPasswordInput = createEl('input', { type: 'password' });
  confirmPasswordInput.style.width = '100%';
  confirmPasswordInput.style.padding = '10px';
  confirmPasswordInput.style.border = '1px solid var(--border-color)';
  confirmPasswordInput.style.borderRadius = '6px';
  confirmPasswordInput.required = true;
  confirmPasswordInput.autocomplete = 'new-password';

  confirmPasswordGroup.appendChild(confirmPasswordLabel);
  confirmPasswordGroup.appendChild(confirmPasswordInput);
  form.appendChild(confirmPasswordGroup);

  modalBody.appendChild(form);

  const modalFooter = document.getElementById('modal-footer');

  const cancelBtn = createEl('button', {
    className: 'btn-cancel',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  const changeBtn = createEl('button', {
    className: 'btn-primary',
    textContent: 'パスワードを変更'
  });
  changeBtn.addEventListener('click', async () => {
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;

    if (!currentPassword || !newPassword || !confirmPassword) {
      Toast.warning('すべてのフィールドを入力してください');
      return;
    }

    if (newPassword !== confirmPassword) {
      Toast.warning('新しいパスワードが一致しません');
      return;
    }

    if (newPassword.length < 6) {
      Toast.warning('パスワードは6文字以上にしてください');
      return;
    }

    try {
      // API call to change password
      await apiCall('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword
        })
      });

      Toast.success('パスワードを変更しました');
      closeModal();
    } catch (error) {
      Toast.error(`パスワード変更に失敗しました: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(changeBtn);
}

// ===== Two-Factor Authentication Functions =====

async function get2FAStatus() {
  try {
    const response = await apiCall('/auth/2fa/status');
    return response;
  } catch (error) {
    console.error('2FA status check failed:', error);
    return { enabled: false, configured: false, backupCodesRemaining: 0 };
  }
}

async function open2FASetupModal() {
  openModal('二要素認証 (2FA) のセットアップ');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  // Step 1: Initial explanation
  const setupContainer = createEl('div');
  setupContainer.style.textAlign = 'center';

  const explanation = createEl('div');
  explanation.style.marginBottom = '24px';
  explanation.style.padding = '16px';
  explanation.style.background = '#f0f9ff';
  explanation.style.borderRadius = '8px';
  explanation.style.textAlign = 'left';

  const explTitle = createEl('h4', { textContent: '二要素認証について' });
  explTitle.style.marginBottom = '12px';
  explTitle.style.color = '#1e40af';

  const explText = createEl('p', {
    textContent:
      '二要素認証は、パスワードに加えて認証アプリからの一時的なコードを使用することで、アカウントのセキュリティを強化します。Google Authenticator、Authy、Microsoft Authenticatorなどのアプリをご利用いただけます。'
  });
  explText.style.color = '#334155';
  explText.style.lineHeight = '1.6';
  explText.style.margin = '0';

  explanation.appendChild(explTitle);
  explanation.appendChild(explText);
  setupContainer.appendChild(explanation);

  const startBtn = createEl('button', {
    className: 'btn-primary',
    textContent: 'セットアップを開始'
  });
  startBtn.style.padding = '12px 32px';
  startBtn.style.fontSize = '1rem';

  setupContainer.appendChild(startBtn);
  modalBody.appendChild(setupContainer);

  startBtn.addEventListener('click', async () => {
    clearElement(modalBody);
    clearElement(modalFooter);

    // Loading state
    const loading = createEl('div', { textContent: 'QRコードを生成中...' });
    loading.style.textAlign = 'center';
    loading.style.padding = '40px';
    modalBody.appendChild(loading);

    try {
      const response = await apiCall('/auth/2fa/setup', {
        method: 'POST'
      });

      clearElement(modalBody);

      // QR Code display
      const qrContainer = createEl('div');
      qrContainer.style.textAlign = 'center';

      const instructions = createEl('p', {
        textContent: '認証アプリでこのQRコードをスキャンしてください:'
      });
      instructions.style.marginBottom = '20px';
      qrContainer.appendChild(instructions);

      const qrImage = createEl('img');
      qrImage.src = response.qrCode;
      qrImage.alt = 'QR Code for 2FA';
      qrImage.style.maxWidth = '200px';
      qrImage.style.margin = '0 auto 20px';
      qrImage.style.display = 'block';
      qrImage.style.border = '4px solid #fff';
      qrImage.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
      qrImage.style.borderRadius = '8px';
      qrContainer.appendChild(qrImage);

      // Manual entry option
      const manualEntry = createEl('div');
      manualEntry.style.marginTop = '20px';
      manualEntry.style.padding = '12px';
      manualEntry.style.background = '#f8fafc';
      manualEntry.style.borderRadius = '6px';
      manualEntry.style.fontSize = '0.9rem';

      const manualLabel = createEl('div', { textContent: 'または手動で入力:' });
      manualLabel.style.marginBottom = '8px';
      manualLabel.style.color = '#64748b';

      const secretCode = createEl('code', { textContent: response.secret });
      secretCode.style.display = 'block';
      secretCode.style.padding = '8px';
      secretCode.style.background = '#e2e8f0';
      secretCode.style.borderRadius = '4px';
      secretCode.style.fontFamily = 'monospace';
      secretCode.style.wordBreak = 'break-all';
      secretCode.style.userSelect = 'all';

      manualEntry.appendChild(manualLabel);
      manualEntry.appendChild(secretCode);
      qrContainer.appendChild(manualEntry);

      // Verification input
      const verifySection = createEl('div');
      verifySection.style.marginTop = '24px';
      verifySection.style.paddingTop = '24px';
      verifySection.style.borderTop = '1px solid var(--border-color)';

      const verifyLabel = createEl('label', {
        textContent: '認証アプリに表示されている6桁のコードを入力:'
      });
      verifyLabel.style.display = 'block';
      verifyLabel.style.marginBottom = '12px';
      verifyLabel.style.fontWeight = '600';

      const tokenInput = createEl('input', { type: 'text', maxLength: 6 });
      tokenInput.style.width = '150px';
      tokenInput.style.padding = '12px';
      tokenInput.style.fontSize = '1.5rem';
      tokenInput.style.textAlign = 'center';
      tokenInput.style.letterSpacing = '0.5em';
      tokenInput.style.border = '2px solid var(--border-color)';
      tokenInput.style.borderRadius = '8px';
      tokenInput.placeholder = '000000';
      tokenInput.autocomplete = 'one-time-code';

      verifySection.appendChild(verifyLabel);
      verifySection.appendChild(tokenInput);
      qrContainer.appendChild(verifySection);

      modalBody.appendChild(qrContainer);

      // Footer buttons
      const cancelBtn = createEl('button', {
        className: 'btn-cancel',
        textContent: 'キャンセル'
      });
      cancelBtn.addEventListener('click', closeModal);

      const verifyBtn = createEl('button', {
        className: 'btn-primary',
        textContent: '確認して有効化'
      });

      verifyBtn.addEventListener('click', async () => {
        const token = tokenInput.value.trim();
        if (token.length !== 6 || !/^\d+$/.test(token)) {
          Toast.warning('6桁の数字を入力してください');
          return;
        }

        verifyBtn.disabled = true;
        verifyBtn.textContent = '確認中...';

        try {
          const verifyResponse = await apiCall('/auth/2fa/verify', {
            method: 'POST',
            body: JSON.stringify({ token })
          });

          closeModal();
          show2FABackupCodesModal(verifyResponse.backupCodes);
          Toast.success('二要素認証が有効になりました');
        } catch (error) {
          Toast.error(`検証に失敗しました: ${error.message}`);
          verifyBtn.disabled = false;
          verifyBtn.textContent = '確認して有効化';
        }
      });

      modalFooter.appendChild(cancelBtn);
      modalFooter.appendChild(verifyBtn);
    } catch (error) {
      Toast.error(`2FAセットアップに失敗しました: ${error.message}`);
      closeModal();
    }
  });
}

function show2FABackupCodesModal(backupCodes) {
  openModal('バックアップコードを保存してください');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  const container = createEl('div');

  const warning = createEl('div');
  warning.style.padding = '16px';
  warning.style.background = '#fef3c7';
  warning.style.borderRadius = '8px';
  warning.style.marginBottom = '20px';
  warning.style.border = '1px solid #f59e0b';

  const warningIcon = createEl('span', { textContent: '! ' });
  warningIcon.style.fontWeight = 'bold';
  warningIcon.style.color = '#d97706';

  const warningText = createEl('span', {
    textContent:
      'これらのコードは一度だけ表示されます。安全な場所に保存してください。認証アプリにアクセスできなくなった場合、これらのコードでログインできます。'
  });
  warningText.style.color = '#92400e';

  warning.appendChild(warningIcon);
  warning.appendChild(warningText);
  container.appendChild(warning);

  const codesGrid = createEl('div');
  codesGrid.style.display = 'grid';
  codesGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
  codesGrid.style.gap = '8px';
  codesGrid.style.marginBottom = '20px';

  backupCodes.forEach((code) => {
    const codeEl = createEl('div', { textContent: code });
    codeEl.style.padding = '10px';
    codeEl.style.background = '#f8fafc';
    codeEl.style.borderRadius = '4px';
    codeEl.style.fontFamily = 'monospace';
    codeEl.style.fontSize = '1.1rem';
    codeEl.style.textAlign = 'center';
    codeEl.style.border = '1px solid #e2e8f0';
    codesGrid.appendChild(codeEl);
  });

  container.appendChild(codesGrid);
  modalBody.appendChild(container);

  // Download button
  const downloadBtn = createEl('button', {
    className: 'btn-secondary',
    textContent: 'コードをダウンロード'
  });
  downloadBtn.style.marginRight = '12px';
  downloadBtn.addEventListener('click', () => {
    const content = `ITSM-Sec Nexus 二要素認証バックアップコード\n生成日時: ${new Date().toLocaleString('ja-JP')}\n\n${backupCodes.join('\n')}\n\n注意: これらのコードは各1回のみ使用できます。安全な場所に保管してください。`;
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = createEl('a');
    a.href = url;
    a.download = 'itsm-2fa-backup-codes.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    Toast.success('バックアップコードをダウンロードしました');
  });

  const doneBtn = createEl('button', {
    className: 'btn-primary',
    textContent: '完了'
  });
  doneBtn.addEventListener('click', () => {
    closeModal();
    loadView('user-settings');
  });

  modalFooter.appendChild(downloadBtn);
  modalFooter.appendChild(doneBtn);
}

async function open2FAManageModal() {
  openModal('二要素認証の管理');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  try {
    const status = await get2FAStatus();

    const container = createEl('div');

    // Status card
    const statusCard = createEl('div');
    statusCard.style.padding = '20px';
    statusCard.style.background = status.enabled ? '#ecfdf5' : '#f8fafc';
    statusCard.style.borderRadius = '8px';
    statusCard.style.marginBottom = '24px';
    statusCard.style.border = `1px solid ${status.enabled ? '#10b981' : '#e2e8f0'}`;

    const statusTitle = createEl('div', { textContent: '現在のステータス' });
    statusTitle.style.fontSize = '0.9rem';
    statusTitle.style.color = '#64748b';
    statusTitle.style.marginBottom = '8px';

    const statusBadge = createEl('span', {
      className: status.enabled ? 'badge badge-success' : 'badge badge-secondary',
      textContent: status.enabled ? '有効' : '無効'
    });
    statusBadge.style.fontSize = '1rem';
    statusBadge.style.padding = '6px 12px';

    statusCard.appendChild(statusTitle);
    statusCard.appendChild(statusBadge);

    if (status.enabled) {
      const backupInfo = createEl('div');
      backupInfo.style.marginTop = '16px';
      backupInfo.style.paddingTop = '16px';
      backupInfo.style.borderTop = '1px solid #d1fae5';

      const backupLabel = createEl('div', { textContent: '残りのバックアップコード:' });
      backupLabel.style.fontSize = '0.9rem';
      backupLabel.style.color = '#64748b';
      backupLabel.style.marginBottom = '4px';

      const backupCount = createEl('div', {
        textContent: `${status.backupCodesRemaining} / 10 コード`
      });
      backupCount.style.fontWeight = '600';
      backupCount.style.color = status.backupCodesRemaining < 3 ? '#dc2626' : '#059669';

      backupInfo.appendChild(backupLabel);
      backupInfo.appendChild(backupCount);
      statusCard.appendChild(backupInfo);
    }

    container.appendChild(statusCard);

    if (status.enabled) {
      // Regenerate backup codes section
      const regenSection = createEl('div');
      regenSection.style.marginBottom = '24px';

      const regenTitle = createEl('h4', { textContent: 'バックアップコード再生成' });
      regenTitle.style.marginBottom = '12px';

      const regenDesc = createEl('p', {
        textContent: '新しいバックアップコードを生成します。既存のコードは無効になります。'
      });
      regenDesc.style.color = '#64748b';
      regenDesc.style.marginBottom = '12px';

      const regenBtn = createEl('button', {
        className: 'btn-secondary',
        textContent: 'バックアップコードを再生成'
      });
      regenBtn.addEventListener('click', () => {
        closeModal();
        openRegenerateBackupCodesModal();
      });

      regenSection.appendChild(regenTitle);
      regenSection.appendChild(regenDesc);
      regenSection.appendChild(regenBtn);
      container.appendChild(regenSection);

      // Disable 2FA section
      const disableSection = createEl('div');
      disableSection.style.paddingTop = '20px';
      disableSection.style.borderTop = '1px solid var(--border-color)';

      const disableTitle = createEl('h4', { textContent: '二要素認証の無効化' });
      disableTitle.style.marginBottom = '12px';
      disableTitle.style.color = '#dc2626';

      const disableDesc = createEl('p', {
        textContent:
          '二要素認証を無効にすると、アカウントのセキュリティが低下します。この操作にはパスワードと現在のトークンが必要です。'
      });
      disableDesc.style.color = '#64748b';
      disableDesc.style.marginBottom = '12px';

      const disableBtn = createEl('button', {
        className: 'btn-danger',
        textContent: '2FAを無効化'
      });
      disableBtn.style.background = '#dc2626';
      disableBtn.style.color = '#fff';
      disableBtn.addEventListener('click', () => {
        closeModal();
        openDisable2FAModal();
      });

      disableSection.appendChild(disableTitle);
      disableSection.appendChild(disableDesc);
      disableSection.appendChild(disableBtn);
      container.appendChild(disableSection);
    } else {
      // Enable 2FA prompt
      const enableSection = createEl('div');
      enableSection.style.textAlign = 'center';

      const enableDesc = createEl('p', {
        textContent: '二要素認証を有効にして、アカウントのセキュリティを強化しましょう。'
      });
      enableDesc.style.marginBottom = '20px';
      enableDesc.style.color = '#64748b';

      const enableBtn = createEl('button', {
        className: 'btn-primary',
        textContent: '2FAを有効化'
      });
      enableBtn.style.padding = '12px 32px';
      enableBtn.addEventListener('click', () => {
        closeModal();
        open2FASetupModal();
      });

      enableSection.appendChild(enableDesc);
      enableSection.appendChild(enableBtn);
      container.appendChild(enableSection);
    }

    modalBody.appendChild(container);

    const closeBtn = createEl('button', {
      className: 'btn-cancel',
      textContent: '閉じる'
    });
    closeBtn.addEventListener('click', closeModal);
    modalFooter.appendChild(closeBtn);
  } catch (error) {
    Toast.error(`2FA情報の取得に失敗しました: ${error.message}`);
    closeModal();
  }
}

function openRegenerateBackupCodesModal() {
  openModal('バックアップコード再生成');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  const form = createEl('div');
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '16px';

  const warning = createEl('div');
  warning.style.padding = '12px';
  warning.style.background = '#fef3c7';
  warning.style.borderRadius = '6px';
  warning.style.marginBottom = '8px';
  warning.style.color = '#92400e';
  warning.style.fontSize = '0.9rem';
  setText(warning, '既存のバックアップコードは無効になります。この操作は取り消せません。');
  form.appendChild(warning);

  // Password input
  const passwordGroup = createEl('div', { className: 'form-group' });
  const passwordLabel = createEl('label', { textContent: '現在のパスワード' });
  passwordLabel.style.display = 'block';
  passwordLabel.style.marginBottom = '8px';
  passwordLabel.style.fontWeight = '600';

  const passwordInput = createEl('input', { type: 'password' });
  passwordInput.style.width = '100%';
  passwordInput.style.padding = '10px';
  passwordInput.style.border = '1px solid var(--border-color)';
  passwordInput.style.borderRadius = '6px';
  passwordInput.autocomplete = 'current-password';

  passwordGroup.appendChild(passwordLabel);
  passwordGroup.appendChild(passwordInput);
  form.appendChild(passwordGroup);

  // Token input
  const tokenGroup = createEl('div', { className: 'form-group' });
  const tokenLabel = createEl('label', { textContent: '現在の2FAトークン (6桁)' });
  tokenLabel.style.display = 'block';
  tokenLabel.style.marginBottom = '8px';
  tokenLabel.style.fontWeight = '600';

  const tokenInput = createEl('input', { type: 'text', maxLength: 6 });
  tokenInput.style.width = '100%';
  tokenInput.style.padding = '10px';
  tokenInput.style.border = '1px solid var(--border-color)';
  tokenInput.style.borderRadius = '6px';
  tokenInput.placeholder = '000000';
  tokenInput.autocomplete = 'one-time-code';

  tokenGroup.appendChild(tokenLabel);
  tokenGroup.appendChild(tokenInput);
  form.appendChild(tokenGroup);

  modalBody.appendChild(form);

  const cancelBtn = createEl('button', {
    className: 'btn-cancel',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  const regenerateBtn = createEl('button', {
    className: 'btn-primary',
    textContent: '再生成'
  });

  regenerateBtn.addEventListener('click', async () => {
    const password = passwordInput.value;
    const token = tokenInput.value.trim();

    if (!password) {
      Toast.warning('パスワードを入力してください');
      return;
    }

    if (token.length !== 6 || !/^\d+$/.test(token)) {
      Toast.warning('6桁のトークンを入力してください');
      return;
    }

    regenerateBtn.disabled = true;
    regenerateBtn.textContent = '再生成中...';

    try {
      const response = await apiCall('/auth/2fa/backup-codes', {
        method: 'POST',
        body: JSON.stringify({ password, token })
      });

      closeModal();
      show2FABackupCodesModal(response.backupCodes);
      Toast.success('バックアップコードを再生成しました');
    } catch (error) {
      Toast.error(`再生成に失敗しました: ${error.message}`);
      regenerateBtn.disabled = false;
      regenerateBtn.textContent = '再生成';
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(regenerateBtn);
}

function openDisable2FAModal() {
  openModal('二要素認証の無効化');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  const form = createEl('div');
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '16px';

  const warning = createEl('div');
  warning.style.padding = '16px';
  warning.style.background = '#fef2f2';
  warning.style.borderRadius = '8px';
  warning.style.marginBottom = '8px';
  warning.style.border = '1px solid #fecaca';

  const warningTitle = createEl('div', { textContent: '警告' });
  warningTitle.style.fontWeight = '600';
  warningTitle.style.color = '#dc2626';
  warningTitle.style.marginBottom = '8px';

  const warningText = createEl('div', {
    textContent:
      '二要素認証を無効にすると、アカウントはパスワードのみで保護されます。これによりセキュリティリスクが高まります。'
  });
  warningText.style.color = '#991b1b';
  warningText.style.fontSize = '0.9rem';

  warning.appendChild(warningTitle);
  warning.appendChild(warningText);
  form.appendChild(warning);

  // Password input
  const passwordGroup = createEl('div', { className: 'form-group' });
  const passwordLabel = createEl('label', { textContent: '現在のパスワード' });
  passwordLabel.style.display = 'block';
  passwordLabel.style.marginBottom = '8px';
  passwordLabel.style.fontWeight = '600';

  const passwordInput = createEl('input', { type: 'password' });
  passwordInput.style.width = '100%';
  passwordInput.style.padding = '10px';
  passwordInput.style.border = '1px solid var(--border-color)';
  passwordInput.style.borderRadius = '6px';
  passwordInput.autocomplete = 'current-password';

  passwordGroup.appendChild(passwordLabel);
  passwordGroup.appendChild(passwordInput);
  form.appendChild(passwordGroup);

  // Token input
  const tokenGroup = createEl('div', { className: 'form-group' });
  const tokenLabel = createEl('label', { textContent: '現在の2FAトークン (6桁)' });
  tokenLabel.style.display = 'block';
  tokenLabel.style.marginBottom = '8px';
  tokenLabel.style.fontWeight = '600';

  const tokenInput = createEl('input', { type: 'text', maxLength: 6 });
  tokenInput.style.width = '100%';
  tokenInput.style.padding = '10px';
  tokenInput.style.border = '1px solid var(--border-color)';
  tokenInput.style.borderRadius = '6px';
  tokenInput.placeholder = '000000';
  tokenInput.autocomplete = 'one-time-code';

  tokenGroup.appendChild(tokenLabel);
  tokenGroup.appendChild(tokenInput);
  form.appendChild(tokenGroup);

  modalBody.appendChild(form);

  const cancelBtn = createEl('button', {
    className: 'btn-cancel',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  const disableBtn = createEl('button', {
    textContent: '2FAを無効化'
  });
  disableBtn.style.background = '#dc2626';
  disableBtn.style.color = '#fff';
  disableBtn.style.border = 'none';
  disableBtn.style.padding = '10px 20px';
  disableBtn.style.borderRadius = '6px';
  disableBtn.style.cursor = 'pointer';

  disableBtn.addEventListener('click', async () => {
    const password = passwordInput.value;
    const token = tokenInput.value.trim();

    if (!password) {
      Toast.warning('パスワードを入力してください');
      return;
    }

    if (token.length !== 6 || !/^\d+$/.test(token)) {
      Toast.warning('6桁のトークンを入力してください');
      return;
    }

    disableBtn.disabled = true;
    disableBtn.textContent = '無効化中...';

    try {
      await apiCall('/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ password, token })
      });

      Toast.success('二要素認証を無効化しました');
      closeModal();
      loadView('user-settings');
    } catch (error) {
      Toast.error(`無効化に失敗しました: ${error.message}`);
      disableBtn.disabled = false;
      disableBtn.textContent = '2FAを無効化';
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(disableBtn);
}

// ===== CSV Export Utility =====

function exportToCSV(dataArray, filename) {
  if (!dataArray || dataArray.length === 0) {
    Toast.warning('エクスポートするデータがありません');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(dataArray[0]);

  // Create CSV content
  let csvContent = `${headers.join(',')}\n`;

  dataArray.forEach((row) => {
    const values = headers.map((header) => {
      const value = row[header];
      // Escape quotes and wrap in quotes if contains comma
      const stringValue = String(value || '');
      return stringValue.includes(',') ? `"${stringValue.replace(/"/g, '""')}"` : stringValue;
    });
    csvContent += `${values.join(',')}\n`;
  });

  // Create download link
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ===== Quick Detail Modals (Simplified for Phase A-3) =====

// eslint-disable-next-line no-unused-vars
function showDetailModal(title, data) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, title);
  clearElement(modalBody);
  clearElement(modalFooter);

  // Display data as key-value pairs
  Object.entries(data).forEach(([key, value]) => {
    const row = createEl('div');
    row.style.marginBottom = '16px';
    row.style.paddingBottom = '12px';
    row.style.borderBottom = '1px solid var(--border-color)';

    const label = createEl('div', { textContent: key.replace(/_/g, ' ').toUpperCase() });
    label.style.fontWeight = '600';
    label.style.fontSize = '0.85rem';
    label.style.color = 'var(--text-secondary)';
    label.style.marginBottom = '4px';

    const valueText = createEl('div', { textContent: String(value || '-') });
    valueText.style.fontSize = '1rem';
    valueText.style.color = 'var(--text-primary)';

    row.appendChild(label);
    row.appendChild(valueText);
    modalBody.appendChild(row);
  });

  // Close button
  const closeBtn = createEl('button', { className: 'btn-modal-secondary', textContent: '閉じる' });
  closeBtn.addEventListener('click', closeModal);
  modalFooter.appendChild(closeBtn);

  modal.style.display = 'flex';
}

// Close modal on ESC key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeModal();
  }
});

// Close modal on background click
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') {
    closeModal();
  }
});

document.getElementById('modal-close')?.addEventListener('click', closeModal);

// ===== Modal Functions - SLA Agreement Creation =====
function openCreateSLAModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'SLA契約作成');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Create form
  const form = createEl('form', { id: 'sla-form' });
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '16px';

  // Service Name field (required)
  const serviceGroup = createEl('div');
  const serviceLabel = createEl('label', { textContent: 'サービス名' });
  serviceLabel.style.display = 'block';
  serviceLabel.style.fontWeight = '500';
  serviceLabel.style.marginBottom = '6px';
  serviceLabel.style.color = 'var(--text-primary)';
  const serviceInput = createEl('input', {
    type: 'text',
    id: 'sla-service-name',
    required: true,
    placeholder: '例: Webアプリケーション'
  });
  serviceInput.style.width = '100%';
  serviceInput.style.padding = '10px';
  serviceInput.style.border = '1px solid var(--border-color)';
  serviceInput.style.borderRadius = '6px';
  serviceInput.style.fontSize = '0.95rem';
  serviceGroup.appendChild(serviceLabel);
  serviceGroup.appendChild(serviceInput);

  // Metric Name field (required)
  const metricGroup = createEl('div');
  const metricLabel = createEl('label', { textContent: 'メトリクス名' });
  metricLabel.style.display = 'block';
  metricLabel.style.fontWeight = '500';
  metricLabel.style.marginBottom = '6px';
  metricLabel.style.color = 'var(--text-primary)';
  const metricInput = createEl('input', {
    type: 'text',
    id: 'sla-metric-name',
    required: true,
    placeholder: '例: 稼働率、レスポンス時間'
  });
  metricInput.style.width = '100%';
  metricInput.style.padding = '10px';
  metricInput.style.border = '1px solid var(--border-color)';
  metricInput.style.borderRadius = '6px';
  metricInput.style.fontSize = '0.95rem';
  metricGroup.appendChild(metricLabel);
  metricGroup.appendChild(metricInput);

  // Target Value field (required)
  const targetGroup = createEl('div');
  const targetLabel = createEl('label', { textContent: '目標値' });
  targetLabel.style.display = 'block';
  targetLabel.style.fontWeight = '500';
  targetLabel.style.marginBottom = '6px';
  targetLabel.style.color = 'var(--text-primary)';
  const targetInput = createEl('input', {
    type: 'text',
    id: 'sla-target-value',
    required: true,
    placeholder: '例: 99.9、500'
  });
  targetInput.style.width = '100%';
  targetInput.style.padding = '10px';
  targetInput.style.border = '1px solid var(--border-color)';
  targetInput.style.borderRadius = '6px';
  targetInput.style.fontSize = '0.95rem';
  targetGroup.appendChild(targetLabel);
  targetGroup.appendChild(targetInput);

  // Unit field
  const unitGroup = createEl('div');
  const unitLabel = createEl('label', { textContent: '測定単位' });
  unitLabel.style.display = 'block';
  unitLabel.style.fontWeight = '500';
  unitLabel.style.marginBottom = '6px';
  unitLabel.style.color = 'var(--text-primary)';
  const unitInput = createEl('input', {
    type: 'text',
    id: 'sla-unit',
    placeholder: '例: %、ms、件'
  });
  unitInput.style.width = '100%';
  unitInput.style.padding = '10px';
  unitInput.style.border = '1px solid var(--border-color)';
  unitInput.style.borderRadius = '6px';
  unitInput.style.fontSize = '0.95rem';
  unitGroup.appendChild(unitLabel);
  unitGroup.appendChild(unitInput);

  form.appendChild(serviceGroup);
  form.appendChild(metricGroup);
  form.appendChild(targetGroup);
  form.appendChild(unitGroup);
  modalBody.appendChild(form);

  // Footer buttons
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', closeModal);

  const submitBtn = createEl('button', { className: 'btn-modal-primary', textContent: '作成' });
  submitBtn.type = 'button';
  submitBtn.addEventListener('click', async () => {
    const serviceName = document.getElementById('sla-service-name').value.trim();
    const metricName = document.getElementById('sla-metric-name').value.trim();
    const targetValue = document.getElementById('sla-target-value').value.trim();
    const unit = document.getElementById('sla-unit').value.trim();

    if (!serviceName || !metricName || !targetValue) {
      Toast.warning('必須フィールドを入力してください');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/sla-agreements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`
        },
        body: JSON.stringify({
          service_name: serviceName,
          metric_name: metricName,
          target_value: targetValue,
          unit
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'SLA契約の作成に失敗しました');
      }

      Toast.success('SLA契約が正常に作成されました');
      closeModal();
      if (typeof loadSLADashboard === 'function') {
        // eslint-disable-next-line no-undef
        loadSLADashboard();
      }
    } catch (error) {
      console.error('Error creating SLA agreement:', error);
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(submitBtn);

  modal.style.display = 'flex';
}

// ===== Modal Functions - Knowledge Article Creation =====
function openCreateKnowledgeModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'ナレッジ記事作成');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Create form
  const form = createEl('form', { id: 'knowledge-form' });
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '16px';

  // Title field (required)
  const titleGroup = createEl('div');
  const titleLabel = createEl('label', { textContent: 'タイトル' });
  titleLabel.style.display = 'block';
  titleLabel.style.fontWeight = '500';
  titleLabel.style.marginBottom = '6px';
  titleLabel.style.color = 'var(--text-primary)';
  const titleInput = createEl('input', {
    type: 'text',
    id: 'knowledge-title',
    required: true,
    placeholder: '例: VPN接続トラブルシューティングガイド'
  });
  titleInput.style.width = '100%';
  titleInput.style.padding = '10px';
  titleInput.style.border = '1px solid var(--border-color)';
  titleInput.style.borderRadius = '6px';
  titleInput.style.fontSize = '0.95rem';
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);

  // Category field (select)
  const categoryGroup = createEl('div');
  const categoryLabel = createEl('label', { textContent: 'カテゴリ' });
  categoryLabel.style.display = 'block';
  categoryLabel.style.fontWeight = '500';
  categoryLabel.style.marginBottom = '6px';
  categoryLabel.style.color = 'var(--text-primary)';
  const categorySelect = createEl('select', { id: 'knowledge-category' });
  categorySelect.style.width = '100%';
  categorySelect.style.padding = '10px';
  categorySelect.style.border = '1px solid var(--border-color)';
  categorySelect.style.borderRadius = '6px';
  categorySelect.style.fontSize = '0.95rem';
  categorySelect.style.backgroundColor = 'var(--bg-primary)';

  const categories = ['トラブルシューティング', '設定ガイド', 'FAQ', 'その他'];
  categories.forEach((cat) => {
    const option = createEl('option', { value: cat, textContent: cat });
    categorySelect.appendChild(option);
  });
  categoryGroup.appendChild(categoryLabel);
  categoryGroup.appendChild(categorySelect);

  // Content field (textarea, required)
  const contentGroup = createEl('div');
  const contentLabel = createEl('label', { textContent: '内容' });
  contentLabel.style.display = 'block';
  contentLabel.style.fontWeight = '500';
  contentLabel.style.marginBottom = '6px';
  contentLabel.style.color = 'var(--text-primary)';
  const contentTextarea = createEl('textarea', {
    id: 'knowledge-content',
    required: true,
    placeholder: '記事の内容を入力してください...'
  });
  contentTextarea.rows = 8;
  contentTextarea.style.width = '100%';
  contentTextarea.style.padding = '10px';
  contentTextarea.style.border = '1px solid var(--border-color)';
  contentTextarea.style.borderRadius = '6px';
  contentTextarea.style.fontSize = '0.95rem';
  contentTextarea.style.fontFamily = 'inherit';
  contentTextarea.style.resize = 'vertical';
  contentGroup.appendChild(contentLabel);
  contentGroup.appendChild(contentTextarea);

  // Author field (default: currentUser.username)
  const authorGroup = createEl('div');
  const authorLabel = createEl('label', { textContent: '著者' });
  authorLabel.style.display = 'block';
  authorLabel.style.fontWeight = '500';
  authorLabel.style.marginBottom = '6px';
  authorLabel.style.color = 'var(--text-primary)';
  const authorInput = createEl('input', {
    type: 'text',
    id: 'knowledge-author',
    value: currentUser?.username || ''
  });
  authorInput.style.width = '100%';
  authorInput.style.padding = '10px';
  authorInput.style.border = '1px solid var(--border-color)';
  authorInput.style.borderRadius = '6px';
  authorInput.style.fontSize = '0.95rem';
  authorGroup.appendChild(authorLabel);
  authorGroup.appendChild(authorInput);

  form.appendChild(titleGroup);
  form.appendChild(categoryGroup);
  form.appendChild(contentGroup);
  form.appendChild(authorGroup);
  modalBody.appendChild(form);

  // Footer buttons
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', closeModal);

  const submitBtn = createEl('button', { className: 'btn-modal-primary', textContent: '作成' });
  submitBtn.type = 'button';
  submitBtn.addEventListener('click', async () => {
    const title = document.getElementById('knowledge-title').value.trim();
    const category = document.getElementById('knowledge-category').value;
    const content = document.getElementById('knowledge-content').value.trim();
    const author = document.getElementById('knowledge-author').value.trim();

    if (!title || !content) {
      Toast.warning('タイトルと内容を入力してください');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/knowledge-articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`
        },
        body: JSON.stringify({
          title,
          category,
          content,
          author: author || currentUser?.username || 'Unknown'
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'ナレッジ記事の作成に失敗しました');
      }

      Toast.success('ナレッジ記事が正常に作成されました');
      closeModal();
      if (typeof loadKnowledgeBase === 'function') {
        // eslint-disable-next-line no-undef
        loadKnowledgeBase();
      }
    } catch (error) {
      console.error('Error creating knowledge article:', error);
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(submitBtn);

  modal.style.display = 'flex';
}

// ===== Modal Functions - Capacity Metrics Creation =====
function openCreateCapacityModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'キャパシティメトリクス登録');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Create form
  const form = createEl('form', { id: 'capacity-form' });
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '16px';

  // Resource Name field (required)
  const resourceGroup = createEl('div');
  const resourceLabel = createEl('label', { textContent: 'リソース名' });
  resourceLabel.style.display = 'block';
  resourceLabel.style.fontWeight = '500';
  resourceLabel.style.marginBottom = '6px';
  resourceLabel.style.color = 'var(--text-primary)';
  const resourceInput = createEl('input', {
    type: 'text',
    id: 'capacity-resource-name',
    required: true,
    placeholder: '例: サーバーA、データベース01'
  });
  resourceInput.style.width = '100%';
  resourceInput.style.padding = '10px';
  resourceInput.style.border = '1px solid var(--border-color)';
  resourceInput.style.borderRadius = '6px';
  resourceInput.style.fontSize = '0.95rem';
  resourceGroup.appendChild(resourceLabel);
  resourceGroup.appendChild(resourceInput);

  // Resource Type field (select)
  const typeGroup = createEl('div');
  const typeLabel = createEl('label', { textContent: 'タイプ' });
  typeLabel.style.display = 'block';
  typeLabel.style.fontWeight = '500';
  typeLabel.style.marginBottom = '6px';
  typeLabel.style.color = 'var(--text-primary)';
  const typeSelect = createEl('select', { id: 'capacity-resource-type' });
  typeSelect.style.width = '100%';
  typeSelect.style.padding = '10px';
  typeSelect.style.border = '1px solid var(--border-color)';
  typeSelect.style.borderRadius = '6px';
  typeSelect.style.fontSize = '0.95rem';
  typeSelect.style.backgroundColor = 'var(--bg-primary)';

  const types = ['CPU', 'Memory', 'Disk', 'Network', 'Database'];
  types.forEach((type) => {
    const option = createEl('option', { value: type, textContent: type });
    typeSelect.appendChild(option);
  });
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeSelect);

  // Current Usage field (number, %)
  const usageGroup = createEl('div');
  const usageLabel = createEl('label', { textContent: '現在使用率 (%)' });
  usageLabel.style.display = 'block';
  usageLabel.style.fontWeight = '500';
  usageLabel.style.marginBottom = '6px';
  usageLabel.style.color = 'var(--text-primary)';
  const usageInput = createEl('input', {
    type: 'number',
    id: 'capacity-current-usage',
    min: '0',
    max: '100',
    step: '0.1',
    placeholder: '例: 75.5'
  });
  usageInput.style.width = '100%';
  usageInput.style.padding = '10px';
  usageInput.style.border = '1px solid var(--border-color)';
  usageInput.style.borderRadius = '6px';
  usageInput.style.fontSize = '0.95rem';
  usageGroup.appendChild(usageLabel);
  usageGroup.appendChild(usageInput);

  // Threshold field (number, %, default: 80)
  const thresholdGroup = createEl('div');
  const thresholdLabel = createEl('label', { textContent: '閾値 (%)' });
  thresholdLabel.style.display = 'block';
  thresholdLabel.style.fontWeight = '500';
  thresholdLabel.style.marginBottom = '6px';
  thresholdLabel.style.color = 'var(--text-primary)';
  const thresholdInput = createEl('input', {
    type: 'number',
    id: 'capacity-threshold',
    min: '0',
    max: '100',
    step: '1',
    value: '80',
    placeholder: '80'
  });
  thresholdInput.style.width = '100%';
  thresholdInput.style.padding = '10px';
  thresholdInput.style.border = '1px solid var(--border-color)';
  thresholdInput.style.borderRadius = '6px';
  thresholdInput.style.fontSize = '0.95rem';
  thresholdGroup.appendChild(thresholdLabel);
  thresholdGroup.appendChild(thresholdInput);

  form.appendChild(resourceGroup);
  form.appendChild(typeGroup);
  form.appendChild(usageGroup);
  form.appendChild(thresholdGroup);
  modalBody.appendChild(form);

  // Footer buttons
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', closeModal);

  const submitBtn = createEl('button', { className: 'btn-modal-primary', textContent: '登録' });
  submitBtn.type = 'button';
  submitBtn.addEventListener('click', async () => {
    const resourceName = document.getElementById('capacity-resource-name').value.trim();
    const resourceType = document.getElementById('capacity-resource-type').value;
    const currentUsage = document.getElementById('capacity-current-usage').value;
    const threshold = document.getElementById('capacity-threshold').value;

    if (!resourceName) {
      Toast.warning('リソース名を入力してください');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/capacity-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`
        },
        body: JSON.stringify({
          resource_name: resourceName,
          resource_type: resourceType,
          current_usage: currentUsage ? parseFloat(currentUsage) : 0,
          threshold: threshold ? parseFloat(threshold) : 80
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'キャパシティメトリクスの登録に失敗しました');
      }

      Toast.success('キャパシティメトリクスが正常に登録されました');
      closeModal();
      if (typeof loadCapacityDashboard === 'function') {
        // eslint-disable-next-line no-undef
        loadCapacityDashboard();
      }
    } catch (error) {
      console.error('Error creating capacity metric:', error);
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(submitBtn);

  modal.style.display = 'flex';
}

// ===== Modal Functions - System Settings =====
function openSystemSettingsModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'システム設定');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Create form
  const form = createEl('form', { id: 'system-settings-form' });
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '16px';

  // System Name field
  const systemNameGroup = createEl('div');
  const systemNameLabel = createEl('label', { textContent: 'システム名' });
  systemNameLabel.style.display = 'block';
  systemNameLabel.style.fontWeight = '500';
  systemNameLabel.style.marginBottom = '6px';
  systemNameLabel.style.color = 'var(--text-primary)';
  const systemNameInput = createEl('input', {
    type: 'text',
    id: 'system-name',
    value: 'ITSM Nexus',
    placeholder: 'ITSM Nexus'
  });
  systemNameInput.style.width = '100%';
  systemNameInput.style.padding = '10px';
  systemNameInput.style.border = '1px solid var(--border-color)';
  systemNameInput.style.borderRadius = '6px';
  systemNameInput.style.fontSize = '0.95rem';
  systemNameGroup.appendChild(systemNameLabel);
  systemNameGroup.appendChild(systemNameInput);

  // Environment field (select)
  const envGroup = createEl('div');
  const envLabel = createEl('label', { textContent: '環境' });
  envLabel.style.display = 'block';
  envLabel.style.fontWeight = '500';
  envLabel.style.marginBottom = '6px';
  envLabel.style.color = 'var(--text-primary)';
  const envSelect = createEl('select', { id: 'system-environment' });
  envSelect.style.width = '100%';
  envSelect.style.padding = '10px';
  envSelect.style.border = '1px solid var(--border-color)';
  envSelect.style.borderRadius = '6px';
  envSelect.style.fontSize = '0.95rem';
  envSelect.style.backgroundColor = 'var(--bg-primary)';

  const environments = ['Development', 'Staging', 'Production'];
  environments.forEach((env) => {
    const option = createEl('option', { value: env, textContent: env });
    if (env === 'Production') option.selected = true;
    envSelect.appendChild(option);
  });
  envGroup.appendChild(envLabel);
  envGroup.appendChild(envSelect);

  // Email Notification field (checkbox)
  const emailGroup = createEl('div');
  emailGroup.style.display = 'flex';
  emailGroup.style.alignItems = 'center';
  emailGroup.style.gap = '10px';
  const emailCheckbox = createEl('input', {
    type: 'checkbox',
    id: 'email-notification',
    checked: true
  });
  emailCheckbox.style.width = '18px';
  emailCheckbox.style.height = '18px';
  emailCheckbox.style.cursor = 'pointer';
  const emailLabel = createEl('label', { textContent: 'メール通知を有効にする' });
  emailLabel.style.fontWeight = '500';
  emailLabel.style.color = 'var(--text-primary)';
  emailLabel.style.cursor = 'pointer';
  emailLabel.addEventListener('click', () => {
    emailCheckbox.checked = !emailCheckbox.checked;
  });
  emailGroup.appendChild(emailCheckbox);
  emailGroup.appendChild(emailLabel);

  // Session Timeout field (number, minutes)
  const timeoutGroup = createEl('div');
  const timeoutLabel = createEl('label', { textContent: 'セッションタイムアウト (分)' });
  timeoutLabel.style.display = 'block';
  timeoutLabel.style.fontWeight = '500';
  timeoutLabel.style.marginBottom = '6px';
  timeoutLabel.style.color = 'var(--text-primary)';
  const timeoutInput = createEl('input', {
    type: 'number',
    id: 'session-timeout',
    min: '5',
    max: '1440',
    step: '5',
    value: '30',
    placeholder: '30'
  });
  timeoutInput.style.width = '100%';
  timeoutInput.style.padding = '10px';
  timeoutInput.style.border = '1px solid var(--border-color)';
  timeoutInput.style.borderRadius = '6px';
  timeoutInput.style.fontSize = '0.95rem';
  timeoutGroup.appendChild(timeoutLabel);
  timeoutGroup.appendChild(timeoutInput);

  form.appendChild(systemNameGroup);
  form.appendChild(envGroup);
  form.appendChild(emailGroup);
  form.appendChild(timeoutGroup);
  modalBody.appendChild(form);

  // Footer buttons
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', closeModal);

  const saveBtn = createEl('button', { className: 'btn-modal-primary', textContent: '保存' });
  saveBtn.type = 'button';
  saveBtn.addEventListener('click', () => {
    const systemName = document.getElementById('system-name').value.trim();
    const environment = document.getElementById('system-environment').value;
    const emailNotification = document.getElementById('email-notification').checked;
    const sessionTimeout = document.getElementById('session-timeout').value;

    // Save settings (next phase will implement actual API)
    console.log('System Settings:', {
      system_name: systemName,
      environment,
      email_notification: emailNotification,
      session_timeout: sessionTimeout
    });

    Toast.success('設定が保存されました');
    closeModal();
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);

  modal.style.display = 'flex';
}

// ===== Modal Functions - User Creation =====
function openCreateUserModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'ユーザー作成');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Create form
  const form = createEl('form', { id: 'user-form' });
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '16px';

  // Username field (required)
  const usernameGroup = createEl('div');
  const usernameLabel = createEl('label', { textContent: 'ログインユーザー名' });
  usernameLabel.style.display = 'block';
  usernameLabel.style.fontWeight = '500';
  usernameLabel.style.marginBottom = '6px';
  usernameLabel.style.color = 'var(--text-primary)';
  const usernameInput = createEl('input', {
    type: 'text',
    id: 'user-username',
    required: true,
    placeholder: '例: john_doe'
  });
  usernameInput.style.width = '100%';
  usernameInput.style.padding = '10px';
  usernameInput.style.border = '1px solid var(--border-color)';
  usernameInput.style.borderRadius = '6px';
  usernameInput.style.fontSize = '0.95rem';
  usernameGroup.appendChild(usernameLabel);
  usernameGroup.appendChild(usernameInput);

  // Employee Number field (required)
  const employeeNumberGroup = createEl('div');
  const employeeNumberLabel = createEl('label', { textContent: '社員番号' });
  employeeNumberLabel.style.display = 'block';
  employeeNumberLabel.style.fontWeight = '500';
  employeeNumberLabel.style.marginBottom = '6px';
  employeeNumberLabel.style.color = 'var(--text-primary)';
  const employeeNumberInput = createEl('input', {
    type: 'text',
    id: 'user-employee-number',
    required: true,
    placeholder: '例: EMP001'
  });
  employeeNumberInput.style.width = '100%';
  employeeNumberInput.style.padding = '10px';
  employeeNumberInput.style.border = '1px solid var(--border-color)';
  employeeNumberInput.style.borderRadius = '6px';
  employeeNumberInput.style.fontSize = '0.95rem';
  employeeNumberGroup.appendChild(employeeNumberLabel);
  employeeNumberGroup.appendChild(employeeNumberInput);

  // Full Name field (社員名)
  const fullNameGroup = createEl('div');
  const fullNameLabel = createEl('label', { textContent: '社員名' });
  fullNameLabel.style.display = 'block';
  fullNameLabel.style.fontWeight = '500';
  fullNameLabel.style.marginBottom = '6px';
  fullNameLabel.style.color = 'var(--text-primary)';
  const fullNameInput = createEl('input', {
    type: 'text',
    id: 'user-fullname',
    placeholder: '例: 山田 太郎'
  });
  fullNameInput.style.width = '100%';
  fullNameInput.style.padding = '10px';
  fullNameInput.style.border = '1px solid var(--border-color)';
  fullNameInput.style.borderRadius = '6px';
  fullNameInput.style.fontSize = '0.95rem';
  fullNameGroup.appendChild(fullNameLabel);
  fullNameGroup.appendChild(fullNameInput);

  // Email field (required)
  const emailGroup = createEl('div');
  const emailLabel = createEl('label', { textContent: 'メール' });
  emailLabel.style.display = 'block';
  emailLabel.style.fontWeight = '500';
  emailLabel.style.marginBottom = '6px';
  emailLabel.style.color = 'var(--text-primary)';
  const emailInput = createEl('input', {
    type: 'email',
    id: 'user-email',
    required: true,
    placeholder: '例: john@example.com'
  });
  emailInput.style.width = '100%';
  emailInput.style.padding = '10px';
  emailInput.style.border = '1px solid var(--border-color)';
  emailInput.style.borderRadius = '6px';
  emailInput.style.fontSize = '0.95rem';
  emailGroup.appendChild(emailLabel);
  emailGroup.appendChild(emailInput);

  // Password field (required)
  const passwordGroup = createEl('div');
  const passwordLabel = createEl('label', { textContent: 'パスワード' });
  passwordLabel.style.display = 'block';
  passwordLabel.style.fontWeight = '500';
  passwordLabel.style.marginBottom = '6px';
  passwordLabel.style.color = 'var(--text-primary)';
  const passwordInput = createEl('input', {
    type: 'password',
    id: 'user-password',
    required: true,
    placeholder: '最低8文字'
  });
  passwordInput.style.width = '100%';
  passwordInput.style.padding = '10px';
  passwordInput.style.border = '1px solid var(--border-color)';
  passwordInput.style.borderRadius = '6px';
  passwordInput.style.fontSize = '0.95rem';
  passwordGroup.appendChild(passwordLabel);
  passwordGroup.appendChild(passwordInput);

  // Role field (select)
  const roleGroup = createEl('div');
  const roleLabel = createEl('label', { textContent: 'ロール' });
  roleLabel.style.display = 'block';
  roleLabel.style.fontWeight = '500';
  roleLabel.style.marginBottom = '6px';
  roleLabel.style.color = 'var(--text-primary)';
  const roleSelect = createEl('select', { id: 'user-role' });
  roleSelect.style.width = '100%';
  roleSelect.style.padding = '10px';
  roleSelect.style.border = '1px solid var(--border-color)';
  roleSelect.style.borderRadius = '6px';
  roleSelect.style.fontSize = '0.95rem';
  roleSelect.style.backgroundColor = 'var(--bg-primary)';

  const roles = ['admin', 'manager', 'analyst', 'viewer'];
  roles.forEach((role) => {
    const option = createEl('option', { value: role, textContent: role });
    if (role === 'viewer') option.selected = true;
    roleSelect.appendChild(option);
  });
  roleGroup.appendChild(roleLabel);
  roleGroup.appendChild(roleSelect);

  form.appendChild(usernameGroup);
  form.appendChild(employeeNumberGroup);
  form.appendChild(fullNameGroup);
  form.appendChild(emailGroup);
  form.appendChild(passwordGroup);
  form.appendChild(roleGroup);
  modalBody.appendChild(form);

  // Footer buttons
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', closeModal);

  const submitBtn = createEl('button', { className: 'btn-modal-primary', textContent: '作成' });
  submitBtn.type = 'button';
  submitBtn.addEventListener('click', async () => {
    const username = document.getElementById('user-username').value.trim();
    const employeeNumber = document.getElementById('user-employee-number').value.trim();
    const fullName = document.getElementById('user-fullname').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;

    if (!username || !employeeNumber || !email || !password) {
      Toast.warning('ログインユーザー名、社員番号、メール、パスワードを入力してください');
      return;
    }

    if (password.length < 8) {
      Toast.warning('パスワードは最低8文字必要です');
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem(TOKEN_KEY)}`
        },
        body: JSON.stringify({
          username,
          employee_number: employeeNumber,
          email,
          password,
          role,
          full_name: fullName
        })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'ユーザーの作成に失敗しました');
      }

      Toast.success('ユーザーが正常に作成されました');
      closeModal();
      loadView('settings_users');
    } catch (error) {
      console.error('Error creating user:', error);
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(submitBtn);

  modal.style.display = 'flex';
}

// Edit User Modal
function openEditUserModal(data) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'ユーザー編集');
  clearElement(modalBody);
  clearElement(modalFooter);

  // User ID (readonly, hidden)
  const idGroup = createEl('div', { className: 'modal-form-group' });
  idGroup.style.display = 'none';
  const idInput = createEl('input', { type: 'hidden', id: 'edit-user-id', value: data.id });
  idGroup.appendChild(idInput);
  modalBody.appendChild(idGroup);

  // Username (readonly for security)
  const usernameGroup = createEl('div', { className: 'modal-form-group' });
  const usernameLabel = createEl('label', { textContent: 'ログインユーザー名' });
  const usernameInput = createEl('input', {
    type: 'text',
    id: 'edit-user-username',
    value: data.username || '',
    readonly: true
  });
  usernameInput.style.backgroundColor = 'var(--bg-secondary)';
  usernameGroup.appendChild(usernameLabel);
  usernameGroup.appendChild(usernameInput);
  modalBody.appendChild(usernameGroup);

  // Employee Number
  const employeeNumberGroup = createEl('div', { className: 'modal-form-group' });
  const employeeNumberLabel = createEl('label', { textContent: '社員番号' });
  const employeeNumberInput = createEl('input', {
    type: 'text',
    id: 'edit-user-employee-number',
    value: data.employee_number || ''
  });
  employeeNumberGroup.appendChild(employeeNumberLabel);
  employeeNumberGroup.appendChild(employeeNumberInput);
  modalBody.appendChild(employeeNumberGroup);

  // Full Name (社員名)
  const fullNameGroup = createEl('div', { className: 'modal-form-group' });
  const fullNameLabel = createEl('label', { textContent: '社員名' });
  const fullNameInput = createEl('input', {
    type: 'text',
    id: 'edit-user-fullname',
    value: data.full_name || ''
  });
  fullNameGroup.appendChild(fullNameLabel);
  fullNameGroup.appendChild(fullNameInput);
  modalBody.appendChild(fullNameGroup);

  // Email
  const emailGroup = createEl('div', { className: 'modal-form-group' });
  const emailLabel = createEl('label', { textContent: 'メールアドレス' });
  const emailInput = createEl('input', {
    type: 'email',
    id: 'edit-user-email',
    value: data.email || ''
  });
  emailGroup.appendChild(emailLabel);
  emailGroup.appendChild(emailInput);
  modalBody.appendChild(emailGroup);

  // Role
  const roleGroup = createEl('div', { className: 'modal-form-group' });
  const roleLabel = createEl('label', { textContent: 'ロール' });
  const roleSelect = createEl('select', { id: 'edit-user-role' });
  ['admin', 'manager', 'analyst', 'viewer'].forEach((role) => {
    const option = createEl('option', { value: role, textContent: role });
    if (role === data.role) option.selected = true;
    roleSelect.appendChild(option);
  });
  roleGroup.appendChild(roleLabel);
  roleGroup.appendChild(roleSelect);
  modalBody.appendChild(roleGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', { className: 'btn-modal-primary', textContent: '更新' });
  saveBtn.addEventListener('click', async () => {
    const updateData = {
      username: document.getElementById('edit-user-username').value,
      employee_number: document.getElementById('edit-user-employee-number').value,
      full_name: document.getElementById('edit-user-fullname').value,
      email: document.getElementById('edit-user-email').value,
      role: document.getElementById('edit-user-role').value
    };

    if (!updateData.email) {
      Toast.warning('メールアドレスを入力してください');
      return;
    }

    try {
      await apiCall(`/users/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      Toast.success('ユーザーが正常に更新されました');
      closeModal();
      loadView('settings_users');
    } catch (error) {
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);

  modal.style.display = 'flex';
}

// Delete User API function
// eslint-disable-next-line no-unused-vars
async function deleteUser(userId) {
  await apiCall(`/users/${userId}`, { method: 'DELETE' });
  Toast.success('ユーザーを削除しました');
  loadView('settings_users');
}

// ===== Modal Functions - Edit Notification Setting =====
function openEditNotificationSettingModal(setting) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, '通知設定編集');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Create form
  const form = createEl('form', { id: 'notification-setting-form' });
  form.style.display = 'flex';
  form.style.flexDirection = 'column';
  form.style.gap = '16px';

  // Setting Name field (readonly)
  const nameGroup = createEl('div');
  const nameLabel = createEl('label', { textContent: '設定名' });
  nameLabel.style.display = 'block';
  nameLabel.style.fontWeight = '500';
  nameLabel.style.marginBottom = '6px';
  nameLabel.style.color = 'var(--text-primary)';
  const nameInput = createEl('input', {
    type: 'text',
    id: 'notification-setting-name',
    value: setting?.setting_name || '',
    readonly: true
  });
  nameInput.style.width = '100%';
  nameInput.style.padding = '10px';
  nameInput.style.border = '1px solid var(--border-color)';
  nameInput.style.borderRadius = '6px';
  nameInput.style.fontSize = '0.95rem';
  nameInput.style.backgroundColor = 'var(--bg-secondary)';
  nameInput.style.color = 'var(--text-secondary)';
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);

  // Enabled field (checkbox)
  const enabledGroup = createEl('div');
  enabledGroup.style.display = 'flex';
  enabledGroup.style.alignItems = 'center';
  enabledGroup.style.gap = '10px';
  const enabledCheckbox = createEl('input', {
    type: 'checkbox',
    id: 'notification-enabled',
    checked: setting?.enabled === 1 || setting?.enabled === true
  });
  enabledCheckbox.style.width = '18px';
  enabledCheckbox.style.height = '18px';
  enabledCheckbox.style.cursor = 'pointer';
  const enabledLabel = createEl('label', { textContent: '有効/無効' });
  enabledLabel.style.fontWeight = '500';
  enabledLabel.style.color = 'var(--text-primary)';
  enabledLabel.style.cursor = 'pointer';
  enabledLabel.addEventListener('click', () => {
    enabledCheckbox.checked = !enabledCheckbox.checked;
  });
  enabledGroup.appendChild(enabledCheckbox);
  enabledGroup.appendChild(enabledLabel);

  // Description field (readonly, textarea)
  const descGroup = createEl('div');
  const descLabel = createEl('label', { textContent: '説明' });
  descLabel.style.display = 'block';
  descLabel.style.fontWeight = '500';
  descLabel.style.marginBottom = '6px';
  descLabel.style.color = 'var(--text-primary)';
  const descTextarea = createEl('textarea', {
    id: 'notification-description',
    readonly: true
  });
  descTextarea.value = setting?.description || '';
  descTextarea.rows = 4;
  descTextarea.style.width = '100%';
  descTextarea.style.padding = '10px';
  descTextarea.style.border = '1px solid var(--border-color)';
  descTextarea.style.borderRadius = '6px';
  descTextarea.style.fontSize = '0.95rem';
  descTextarea.style.fontFamily = 'inherit';
  descTextarea.style.backgroundColor = 'var(--bg-secondary)';
  descTextarea.style.color = 'var(--text-secondary)';
  descTextarea.style.resize = 'vertical';
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);

  form.appendChild(nameGroup);
  form.appendChild(enabledGroup);
  form.appendChild(descGroup);
  modalBody.appendChild(form);

  // Footer buttons
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.type = 'button';
  cancelBtn.addEventListener('click', closeModal);

  const saveBtn = createEl('button', { className: 'btn-modal-primary', textContent: '保存' });
  saveBtn.type = 'button';
  saveBtn.addEventListener('click', () => {
    const enabled = document.getElementById('notification-enabled').checked;

    // Save setting (next phase will implement actual PUT API)
    console.log('Notification Setting:', {
      setting_id: setting?.id,
      setting_name: setting?.setting_name,
      enabled
    });

    Toast.success('設定が保存されました');
    closeModal();
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);

  modal.style.display = 'flex';
}

// ===== Edit Modal Functions =====

// Edit Problem Modal
function openEditProblemModal(data) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, '問題編集');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Problem ID (readonly)
  const idGroup = createEl('div', { className: 'modal-form-group' });
  const idLabel = createEl('label', { textContent: '問題ID' });
  const idInput = createEl('input', {
    type: 'text',
    id: 'edit-problem-id',
    value: data.problem_id || '',
    readonly: true
  });
  idInput.style.backgroundColor = 'var(--bg-secondary)';
  idGroup.appendChild(idLabel);
  idGroup.appendChild(idInput);
  modalBody.appendChild(idGroup);

  // Title
  const titleGroup = createEl('div', { className: 'modal-form-group' });
  const titleLabel = createEl('label', { textContent: 'タイトル' });
  const titleInput = createEl('input', {
    type: 'text',
    id: 'edit-problem-title',
    value: data.title || ''
  });
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  modalBody.appendChild(titleGroup);

  // Description
  const descGroup = createEl('div', { className: 'modal-form-group' });
  const descLabel = createEl('label', { textContent: '説明' });
  const descTextarea = createEl('textarea', { id: 'edit-problem-description' });
  descTextarea.value = data.description || '';
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);
  modalBody.appendChild(descGroup);

  // Status
  const statusGroup = createEl('div', { className: 'modal-form-group' });
  const statusLabel = createEl('label', { textContent: 'ステータス' });
  const statusSelect = createEl('select', { id: 'edit-problem-status' });
  ['Open', 'Investigating', 'Resolved', 'Closed'].forEach((s) => {
    const option = createEl('option', { value: s, textContent: s });
    if (s === data.status) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  // Priority
  const priorityGroup = createEl('div', { className: 'modal-form-group' });
  const priorityLabel = createEl('label', { textContent: '優先度' });
  const prioritySelect = createEl('select', { id: 'edit-problem-priority' });
  ['Critical', 'High', 'Medium', 'Low'].forEach((p) => {
    const option = createEl('option', { value: p, textContent: p });
    if (p === data.priority) option.selected = true;
    prioritySelect.appendChild(option);
  });
  priorityGroup.appendChild(priorityLabel);
  priorityGroup.appendChild(prioritySelect);
  modalBody.appendChild(priorityGroup);

  // Related Incidents
  const incidentsGroup = createEl('div', { className: 'modal-form-group' });
  const incidentsLabel = createEl('label', { textContent: '関連インシデント数' });
  const incidentsInput = createEl('input', {
    type: 'number',
    id: 'edit-problem-incidents',
    value: String(data.related_incidents || 0),
    min: '0'
  });
  incidentsGroup.appendChild(incidentsLabel);
  incidentsGroup.appendChild(incidentsInput);
  modalBody.appendChild(incidentsGroup);

  // Assignee
  const assigneeGroup = createEl('div', { className: 'modal-form-group' });
  const assigneeLabel = createEl('label', { textContent: '担当者' });
  const assigneeInput = createEl('input', {
    type: 'text',
    id: 'edit-problem-assignee',
    value: data.assignee || ''
  });
  assigneeGroup.appendChild(assigneeLabel);
  assigneeGroup.appendChild(assigneeInput);
  modalBody.appendChild(assigneeGroup);

  // Root Cause
  const rootCauseGroup = createEl('div', { className: 'modal-form-group' });
  const rootCauseLabel = createEl('label', { textContent: '根本原因' });
  const rootCauseTextarea = createEl('textarea', { id: 'edit-problem-root-cause' });
  rootCauseTextarea.value = data.root_cause || '';
  rootCauseGroup.appendChild(rootCauseLabel);
  rootCauseGroup.appendChild(rootCauseTextarea);
  modalBody.appendChild(rootCauseGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', { className: 'btn-modal-primary', textContent: '更新' });
  saveBtn.addEventListener('click', async () => {
    const updateData = {
      title: document.getElementById('edit-problem-title').value,
      description: document.getElementById('edit-problem-description').value,
      status: document.getElementById('edit-problem-status').value,
      priority: document.getElementById('edit-problem-priority').value,
      related_incidents: parseInt(document.getElementById('edit-problem-incidents').value, 10) || 0,
      assignee: document.getElementById('edit-problem-assignee').value,
      root_cause: document.getElementById('edit-problem-root-cause').value
    };

    if (!updateData.title) {
      Toast.warning('タイトルを入力してください');
      return;
    }

    try {
      await apiCall(`/problems/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      Toast.success('問題を更新しました');
      closeModal();
      loadView('problems');
    } catch (error) {
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
  modal.style.display = 'flex';
}

// Edit Release Modal
function openEditReleaseModal(data) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'リリース編集');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Release ID (readonly)
  const idGroup = createEl('div', { className: 'modal-form-group' });
  const idLabel = createEl('label', { textContent: 'リリースID' });
  const idInput = createEl('input', {
    type: 'text',
    id: 'edit-release-id',
    value: data.release_id || '',
    readonly: true
  });
  idInput.style.backgroundColor = 'var(--bg-secondary)';
  idGroup.appendChild(idLabel);
  idGroup.appendChild(idInput);
  modalBody.appendChild(idGroup);

  // Name
  const nameGroup = createEl('div', { className: 'modal-form-group' });
  const nameLabel = createEl('label', { textContent: 'リリース名' });
  const nameInput = createEl('input', {
    type: 'text',
    id: 'edit-release-name',
    value: data.name || ''
  });
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  modalBody.appendChild(nameGroup);

  // Version
  const versionGroup = createEl('div', { className: 'modal-form-group' });
  const versionLabel = createEl('label', { textContent: 'バージョン' });
  const versionInput = createEl('input', {
    type: 'text',
    id: 'edit-release-version',
    value: data.version || ''
  });
  versionGroup.appendChild(versionLabel);
  versionGroup.appendChild(versionInput);
  modalBody.appendChild(versionGroup);

  // Description
  const descGroup = createEl('div', { className: 'modal-form-group' });
  const descLabel = createEl('label', { textContent: '説明' });
  const descTextarea = createEl('textarea', { id: 'edit-release-description' });
  descTextarea.value = data.description || '';
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);
  modalBody.appendChild(descGroup);

  // Status
  const statusGroup = createEl('div', { className: 'modal-form-group' });
  const statusLabel = createEl('label', { textContent: 'ステータス' });
  const statusSelect = createEl('select', { id: 'edit-release-status' });
  ['Planning', 'Building', 'Testing', 'Deployed', 'Rollback'].forEach((s) => {
    const option = createEl('option', { value: s, textContent: s });
    if (s === data.status) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  // Target Environment
  const envGroup = createEl('div', { className: 'modal-form-group' });
  const envLabel = createEl('label', { textContent: '対象環境' });
  const envSelect = createEl('select', { id: 'edit-release-environment' });
  ['Development', 'Staging', 'Production'].forEach((env) => {
    const option = createEl('option', { value: env, textContent: env });
    if (env === data.target_environment) option.selected = true;
    envSelect.appendChild(option);
  });
  envGroup.appendChild(envLabel);
  envGroup.appendChild(envSelect);
  modalBody.appendChild(envGroup);

  // Release Date
  const dateGroup = createEl('div', { className: 'modal-form-group' });
  const dateLabel = createEl('label', { textContent: 'リリース予定日' });
  const dateInput = createEl('input', { type: 'date', id: 'edit-release-date' });
  if (data.release_date) {
    const [datePart] = data.release_date.split('T');
    dateInput.value = datePart;
  }
  dateGroup.appendChild(dateLabel);
  dateGroup.appendChild(dateInput);
  modalBody.appendChild(dateGroup);

  // Change Count
  const changeCountGroup = createEl('div', { className: 'modal-form-group' });
  const changeCountLabel = createEl('label', { textContent: '含まれる変更数' });
  const changeCountInput = createEl('input', {
    type: 'number',
    id: 'edit-release-change-count',
    value: String(data.change_count || 0),
    min: '0'
  });
  changeCountGroup.appendChild(changeCountLabel);
  changeCountGroup.appendChild(changeCountInput);
  modalBody.appendChild(changeCountGroup);

  // Progress
  const progressGroup = createEl('div', { className: 'modal-form-group' });
  const progressLabel = createEl('label', { textContent: '進捗 (%)' });
  const progressInput = createEl('input', {
    type: 'number',
    id: 'edit-release-progress',
    value: String(data.progress || 0),
    min: '0',
    max: '100'
  });
  progressGroup.appendChild(progressLabel);
  progressGroup.appendChild(progressInput);
  modalBody.appendChild(progressGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', { className: 'btn-modal-primary', textContent: '更新' });
  saveBtn.addEventListener('click', async () => {
    const updateData = {
      name: document.getElementById('edit-release-name').value,
      version: document.getElementById('edit-release-version').value,
      description: document.getElementById('edit-release-description').value,
      status: document.getElementById('edit-release-status').value,
      target_environment: document.getElementById('edit-release-environment').value,
      release_date: document.getElementById('edit-release-date').value,
      change_count: parseInt(document.getElementById('edit-release-change-count').value, 10) || 0,
      progress: parseInt(document.getElementById('edit-release-progress').value, 10) || 0
    };

    if (!updateData.name || !updateData.version) {
      Toast.warning('リリース名とバージョンを入力してください');
      return;
    }

    try {
      await apiCall(`/releases/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      Toast.success('リリースを更新しました');
      closeModal();
      loadView('releases');
    } catch (error) {
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
  modal.style.display = 'flex';
}

// Edit Service Request Modal
function openEditServiceRequestModal(data) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'サービス要求編集');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Request ID (readonly)
  const idGroup = createEl('div', { className: 'modal-form-group' });
  const idLabel = createEl('label', { textContent: '要求ID' });
  const idInput = createEl('input', {
    type: 'text',
    id: 'edit-request-id',
    value: data.request_id || '',
    readonly: true
  });
  idInput.style.backgroundColor = 'var(--bg-secondary)';
  idGroup.appendChild(idLabel);
  idGroup.appendChild(idInput);
  modalBody.appendChild(idGroup);

  // Request Type
  const typeGroup = createEl('div', { className: 'modal-form-group' });
  const typeLabel = createEl('label', { textContent: '要求タイプ' });
  const typeSelect = createEl('select', { id: 'edit-request-type' });
  ['アカウント作成', 'アクセス権限', 'ソフトウェアインストール', 'その他'].forEach((type) => {
    const option = createEl('option', { value: type, textContent: type });
    if (type === data.request_type) option.selected = true;
    typeSelect.appendChild(option);
  });
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeSelect);
  modalBody.appendChild(typeGroup);

  // Title
  const titleGroup = createEl('div', { className: 'modal-form-group' });
  const titleLabel = createEl('label', { textContent: 'タイトル' });
  const titleInput = createEl('input', {
    type: 'text',
    id: 'edit-request-title',
    value: data.title || ''
  });
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  modalBody.appendChild(titleGroup);

  // Description
  const descGroup = createEl('div', { className: 'modal-form-group' });
  const descLabel = createEl('label', { textContent: '説明' });
  const descTextarea = createEl('textarea', { id: 'edit-request-description' });
  descTextarea.value = data.description || '';
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);
  modalBody.appendChild(descGroup);

  // Status
  const statusGroup = createEl('div', { className: 'modal-form-group' });
  const statusLabel = createEl('label', { textContent: 'ステータス' });
  const statusSelect = createEl('select', { id: 'edit-request-status' });
  ['Submitted', 'Approved', 'In Progress', 'Completed', 'Rejected'].forEach((s) => {
    const option = createEl('option', { value: s, textContent: s });
    if (s === data.status) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  // Priority
  const priorityGroup = createEl('div', { className: 'modal-form-group' });
  const priorityLabel = createEl('label', { textContent: '優先度' });
  const prioritySelect = createEl('select', { id: 'edit-request-priority' });
  ['Critical', 'High', 'Medium', 'Low'].forEach((p) => {
    const option = createEl('option', { value: p, textContent: p });
    if (p === data.priority) option.selected = true;
    prioritySelect.appendChild(option);
  });
  priorityGroup.appendChild(priorityLabel);
  priorityGroup.appendChild(prioritySelect);
  modalBody.appendChild(priorityGroup);

  // Requester
  const requesterGroup = createEl('div', { className: 'modal-form-group' });
  const requesterLabel = createEl('label', { textContent: '申請者' });
  const requesterInput = createEl('input', {
    type: 'text',
    id: 'edit-request-requester',
    value: data.requester || ''
  });
  requesterGroup.appendChild(requesterLabel);
  requesterGroup.appendChild(requesterInput);
  modalBody.appendChild(requesterGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', { className: 'btn-modal-primary', textContent: '更新' });
  saveBtn.addEventListener('click', async () => {
    const updateData = {
      request_type: document.getElementById('edit-request-type').value,
      title: document.getElementById('edit-request-title').value,
      description: document.getElementById('edit-request-description').value,
      status: document.getElementById('edit-request-status').value,
      priority: document.getElementById('edit-request-priority').value,
      requester: document.getElementById('edit-request-requester').value
    };

    if (!updateData.title || !updateData.description) {
      Toast.warning('タイトルと説明を入力してください');
      return;
    }

    try {
      await apiCall(`/service-requests/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      Toast.success('サービス要求を更新しました');
      closeModal();
      loadView('requests');
    } catch (error) {
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
  modal.style.display = 'flex';
}

// Edit SLA Modal
function openEditSLAModal(data) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'SLA契約編集');
  clearElement(modalBody);
  clearElement(modalFooter);

  // SLA ID (readonly)
  const idGroup = createEl('div', { className: 'modal-form-group' });
  const idLabel = createEl('label', { textContent: 'SLA ID' });
  const idInput = createEl('input', {
    type: 'text',
    id: 'edit-sla-id',
    value: data.sla_id || '',
    readonly: true
  });
  idInput.style.backgroundColor = 'var(--bg-secondary)';
  idGroup.appendChild(idLabel);
  idGroup.appendChild(idInput);
  modalBody.appendChild(idGroup);

  // Service Name
  const serviceGroup = createEl('div', { className: 'modal-form-group' });
  const serviceLabel = createEl('label', { textContent: 'サービス名' });
  const serviceInput = createEl('input', {
    type: 'text',
    id: 'edit-sla-service-name',
    value: data.service_name || ''
  });
  serviceGroup.appendChild(serviceLabel);
  serviceGroup.appendChild(serviceInput);
  modalBody.appendChild(serviceGroup);

  // Metric Name
  const metricGroup = createEl('div', { className: 'modal-form-group' });
  const metricLabel = createEl('label', { textContent: 'メトリクス名' });
  const metricInput = createEl('input', {
    type: 'text',
    id: 'edit-sla-metric-name',
    value: data.metric_name || ''
  });
  metricGroup.appendChild(metricLabel);
  metricGroup.appendChild(metricInput);
  modalBody.appendChild(metricGroup);

  // Target Value
  const targetGroup = createEl('div', { className: 'modal-form-group' });
  const targetLabel = createEl('label', { textContent: '目標値' });
  const targetInput = createEl('input', {
    type: 'text',
    id: 'edit-sla-target-value',
    value: data.target_value || ''
  });
  targetGroup.appendChild(targetLabel);
  targetGroup.appendChild(targetInput);
  modalBody.appendChild(targetGroup);

  // Actual Value
  const actualGroup = createEl('div', { className: 'modal-form-group' });
  const actualLabel = createEl('label', { textContent: '実績値' });
  const actualInput = createEl('input', {
    type: 'text',
    id: 'edit-sla-actual-value',
    value: data.actual_value || ''
  });
  actualGroup.appendChild(actualLabel);
  actualGroup.appendChild(actualInput);
  modalBody.appendChild(actualGroup);

  // Unit
  const unitGroup = createEl('div', { className: 'modal-form-group' });
  const unitLabel = createEl('label', { textContent: '測定単位' });
  const unitInput = createEl('input', {
    type: 'text',
    id: 'edit-sla-unit',
    value: data.unit || ''
  });
  unitGroup.appendChild(unitLabel);
  unitGroup.appendChild(unitInput);
  modalBody.appendChild(unitGroup);

  // Measurement Period
  const periodGroup = createEl('div', { className: 'modal-form-group' });
  const periodLabel = createEl('label', { textContent: '測定期間' });
  const periodInput = createEl('input', {
    type: 'text',
    id: 'edit-sla-period',
    value: data.measurement_period || ''
  });
  periodGroup.appendChild(periodLabel);
  periodGroup.appendChild(periodInput);
  modalBody.appendChild(periodGroup);

  // Status
  const statusGroup = createEl('div', { className: 'modal-form-group' });
  const statusLabel = createEl('label', { textContent: 'ステータス' });
  const statusSelect = createEl('select', { id: 'edit-sla-status' });
  ['Met', 'At Risk', 'Breached'].forEach((s) => {
    const option = createEl('option', { value: s, textContent: s });
    if (s === data.status) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', { className: 'btn-modal-primary', textContent: '更新' });
  saveBtn.addEventListener('click', async () => {
    const updateData = {
      service_name: document.getElementById('edit-sla-service-name').value,
      metric_name: document.getElementById('edit-sla-metric-name').value,
      target_value: document.getElementById('edit-sla-target-value').value,
      actual_value: document.getElementById('edit-sla-actual-value').value,
      unit: document.getElementById('edit-sla-unit').value,
      measurement_period: document.getElementById('edit-sla-period').value,
      status: document.getElementById('edit-sla-status').value
    };

    if (!updateData.service_name || !updateData.metric_name) {
      Toast.warning('サービス名とメトリクス名を入力してください');
      return;
    }

    try {
      await apiCall(`/sla-agreements/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      Toast.success('SLA契約を更新しました');
      closeModal();
      loadView('sla');
    } catch (error) {
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
  modal.style.display = 'flex';
}

// Edit Knowledge Modal
function openEditKnowledgeModal(data) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'ナレッジ記事編集');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Article ID (readonly)
  const idGroup = createEl('div', { className: 'modal-form-group' });
  const idLabel = createEl('label', { textContent: '記事ID' });
  const idInput = createEl('input', {
    type: 'text',
    id: 'edit-knowledge-id',
    value: data.article_id || '',
    readonly: true
  });
  idInput.style.backgroundColor = 'var(--bg-secondary)';
  idGroup.appendChild(idLabel);
  idGroup.appendChild(idInput);
  modalBody.appendChild(idGroup);

  // Title
  const titleGroup = createEl('div', { className: 'modal-form-group' });
  const titleLabel = createEl('label', { textContent: 'タイトル' });
  const titleInput = createEl('input', {
    type: 'text',
    id: 'edit-knowledge-title',
    value: data.title || ''
  });
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  modalBody.appendChild(titleGroup);

  // Category
  const categoryGroup = createEl('div', { className: 'modal-form-group' });
  const categoryLabel = createEl('label', { textContent: 'カテゴリ' });
  const categorySelect = createEl('select', { id: 'edit-knowledge-category' });
  ['トラブルシューティング', '設定ガイド', 'FAQ', 'その他'].forEach((cat) => {
    const option = createEl('option', { value: cat, textContent: cat });
    if (cat === data.category) option.selected = true;
    categorySelect.appendChild(option);
  });
  categoryGroup.appendChild(categoryLabel);
  categoryGroup.appendChild(categorySelect);
  modalBody.appendChild(categoryGroup);

  // Content
  const contentGroup = createEl('div', { className: 'modal-form-group' });
  const contentLabel = createEl('label', { textContent: '内容' });
  const contentTextarea = createEl('textarea', { id: 'edit-knowledge-content' });
  contentTextarea.value = data.content || '';
  contentTextarea.rows = 8;
  contentGroup.appendChild(contentLabel);
  contentGroup.appendChild(contentTextarea);
  modalBody.appendChild(contentGroup);

  // Author
  const authorGroup = createEl('div', { className: 'modal-form-group' });
  const authorLabel = createEl('label', { textContent: '著者' });
  const authorInput = createEl('input', {
    type: 'text',
    id: 'edit-knowledge-author',
    value: data.author || ''
  });
  authorGroup.appendChild(authorLabel);
  authorGroup.appendChild(authorInput);
  modalBody.appendChild(authorGroup);

  // Status
  const statusGroup = createEl('div', { className: 'modal-form-group' });
  const statusLabel = createEl('label', { textContent: 'ステータス' });
  const statusSelect = createEl('select', { id: 'edit-knowledge-status' });
  ['Draft', 'Published', 'Archived'].forEach((s) => {
    const option = createEl('option', { value: s, textContent: s });
    if (s === data.status) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', { className: 'btn-modal-primary', textContent: '更新' });
  saveBtn.addEventListener('click', async () => {
    const updateData = {
      title: document.getElementById('edit-knowledge-title').value,
      category: document.getElementById('edit-knowledge-category').value,
      content: document.getElementById('edit-knowledge-content').value,
      author: document.getElementById('edit-knowledge-author').value,
      status: document.getElementById('edit-knowledge-status').value
    };

    if (!updateData.title || !updateData.content) {
      Toast.warning('タイトルと内容を入力してください');
      return;
    }

    try {
      await apiCall(`/knowledge-articles/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      Toast.success('ナレッジ記事を更新しました');
      closeModal();
      loadView('knowledge');
    } catch (error) {
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
  modal.style.display = 'flex';
}

// Edit Capacity Modal
function openEditCapacityModal(data) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'キャパシティメトリクス編集');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Metric ID (readonly)
  const idGroup = createEl('div', { className: 'modal-form-group' });
  const idLabel = createEl('label', { textContent: 'メトリクスID' });
  const idInput = createEl('input', {
    type: 'text',
    id: 'edit-capacity-id',
    value: data.metric_id || '',
    readonly: true
  });
  idInput.style.backgroundColor = 'var(--bg-secondary)';
  idGroup.appendChild(idLabel);
  idGroup.appendChild(idInput);
  modalBody.appendChild(idGroup);

  // Resource Name
  const resourceGroup = createEl('div', { className: 'modal-form-group' });
  const resourceLabel = createEl('label', { textContent: 'リソース名' });
  const resourceInput = createEl('input', {
    type: 'text',
    id: 'edit-capacity-resource-name',
    value: data.resource_name || ''
  });
  resourceGroup.appendChild(resourceLabel);
  resourceGroup.appendChild(resourceInput);
  modalBody.appendChild(resourceGroup);

  // Resource Type
  const typeGroup = createEl('div', { className: 'modal-form-group' });
  const typeLabel = createEl('label', { textContent: 'タイプ' });
  const typeSelect = createEl('select', { id: 'edit-capacity-resource-type' });
  ['CPU', 'Memory', 'Disk', 'Network', 'Database'].forEach((type) => {
    const option = createEl('option', { value: type, textContent: type });
    if (type === data.resource_type) option.selected = true;
    typeSelect.appendChild(option);
  });
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeSelect);
  modalBody.appendChild(typeGroup);

  // Current Usage
  const usageGroup = createEl('div', { className: 'modal-form-group' });
  const usageLabel = createEl('label', { textContent: '現在使用率 (%)' });
  const usageInput = createEl('input', {
    type: 'number',
    id: 'edit-capacity-current-usage',
    value: String(data.current_usage || 0),
    min: '0',
    max: '100',
    step: '0.1'
  });
  usageGroup.appendChild(usageLabel);
  usageGroup.appendChild(usageInput);
  modalBody.appendChild(usageGroup);

  // Threshold
  const thresholdGroup = createEl('div', { className: 'modal-form-group' });
  const thresholdLabel = createEl('label', { textContent: '閾値 (%)' });
  const thresholdInput = createEl('input', {
    type: 'number',
    id: 'edit-capacity-threshold',
    value: String(data.threshold || 80),
    min: '0',
    max: '100',
    step: '1'
  });
  thresholdGroup.appendChild(thresholdLabel);
  thresholdGroup.appendChild(thresholdInput);
  modalBody.appendChild(thresholdGroup);

  // Status
  const statusGroup = createEl('div', { className: 'modal-form-group' });
  const statusLabel = createEl('label', { textContent: 'ステータス' });
  const statusSelect = createEl('select', { id: 'edit-capacity-status' });
  ['Normal', 'Warning', 'Critical'].forEach((s) => {
    const option = createEl('option', { value: s, textContent: s });
    if (s === data.status) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', { className: 'btn-modal-primary', textContent: '更新' });
  saveBtn.addEventListener('click', async () => {
    const updateData = {
      resource_name: document.getElementById('edit-capacity-resource-name').value,
      resource_type: document.getElementById('edit-capacity-resource-type').value,
      current_usage: parseFloat(document.getElementById('edit-capacity-current-usage').value) || 0,
      threshold: parseFloat(document.getElementById('edit-capacity-threshold').value) || 80,
      status: document.getElementById('edit-capacity-status').value
    };

    if (!updateData.resource_name) {
      Toast.warning('リソース名を入力してください');
      return;
    }

    try {
      await apiCall(`/capacity-metrics/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      Toast.success('キャパシティメトリクスを更新しました');
      closeModal();
      loadView('capacity');
    } catch (error) {
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
  modal.style.display = 'flex';
}

// Edit Vulnerability Modal
async function openEditVulnerabilityModal(data) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, '脆弱性編集');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Vulnerability ID (readonly)
  const idGroup = createEl('div', { className: 'modal-form-group' });
  const idLabel = createEl('label', { textContent: '脆弱性ID' });
  const vulnId = data.vulnerability_id || data.id || '';
  const idInput = createEl('input', {
    type: 'text',
    id: 'edit-vuln-id',
    value: vulnId,
    readonly: true
  });
  idInput.style.backgroundColor = 'var(--bg-secondary)';
  idGroup.appendChild(idLabel);
  idGroup.appendChild(idInput);
  modalBody.appendChild(idGroup);

  // Title
  const titleGroup = createEl('div', { className: 'modal-form-group' });
  const titleLabel = createEl('label', { textContent: 'タイトル' });
  const titleInput = createEl('input', {
    type: 'text',
    id: 'edit-vuln-title',
    value: data.title || ''
  });
  titleGroup.appendChild(titleLabel);
  titleGroup.appendChild(titleInput);
  modalBody.appendChild(titleGroup);

  // Description
  const descGroup = createEl('div', { className: 'modal-form-group' });
  const descLabel = createEl('label', { textContent: '説明' });
  const descTextarea = createEl('textarea', { id: 'edit-vuln-description' });
  descTextarea.value = data.description || '';
  descGroup.appendChild(descLabel);
  descGroup.appendChild(descTextarea);
  modalBody.appendChild(descGroup);

  // Severity
  const severityGroup = createEl('div', { className: 'modal-form-group' });
  const severityLabel = createEl('label', { textContent: '深刻度' });
  const severitySelect = createEl('select', { id: 'edit-vuln-severity' });
  ['Critical', 'High', 'Medium', 'Low', 'Info'].forEach((s) => {
    const option = createEl('option', { value: s, textContent: s });
    if (s === data.severity) option.selected = true;
    severitySelect.appendChild(option);
  });
  severityGroup.appendChild(severityLabel);
  severityGroup.appendChild(severitySelect);
  modalBody.appendChild(severityGroup);

  // CVSS Score
  const cvssGroup = createEl('div', { className: 'modal-form-group' });
  const cvssLabel = createEl('label', { textContent: 'CVSSスコア' });
  const cvssInput = createEl('input', {
    type: 'number',
    id: 'edit-vuln-cvss',
    min: '0',
    max: '10',
    step: '0.1',
    value: String(data.cvss_score || 0)
  });
  cvssGroup.appendChild(cvssLabel);
  cvssGroup.appendChild(cvssInput);
  modalBody.appendChild(cvssGroup);

  // Affected Asset
  const assetGroup = createEl('div', { className: 'modal-form-group' });
  const assetLabel = createEl('label', { textContent: '影響を受ける資産' });
  const assetSelect = createEl('select', { id: 'edit-vuln-asset' });
  assetSelect.appendChild(createEl('option', { value: '', textContent: '読み込み中...' }));
  assetGroup.appendChild(assetLabel);
  assetGroup.appendChild(assetSelect);
  modalBody.appendChild(assetGroup);

  // Status
  const statusGroup = createEl('div', { className: 'modal-form-group' });
  const statusLabel = createEl('label', { textContent: 'ステータス' });
  const statusSelect = createEl('select', { id: 'edit-vuln-status' });
  ['Open', 'In Progress', 'Mitigated', 'Resolved', 'Accepted'].forEach((s) => {
    const option = createEl('option', { value: s, textContent: s });
    if (s === data.status) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', { className: 'btn-modal-primary', textContent: '更新' });
  saveBtn.addEventListener('click', async () => {
    const updateData = {
      title: document.getElementById('edit-vuln-title').value,
      description: document.getElementById('edit-vuln-description').value,
      severity: document.getElementById('edit-vuln-severity').value,
      cvss_score: parseFloat(document.getElementById('edit-vuln-cvss').value) || 0,
      affected_asset: document.getElementById('edit-vuln-asset').value,
      status: document.getElementById('edit-vuln-status').value
    };

    if (!updateData.title) {
      Toast.warning('タイトルを入力してください');
      return;
    }

    try {
      await apiCall(`/vulnerabilities/${vulnId}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      Toast.success('脆弱性を更新しました');
      closeModal();
      loadView('security');
    } catch (error) {
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
  modal.style.display = 'flex';

  // Fetch assets after modal opens
  try {
    const assetsResponse = await apiCall('/assets');
    const resolvedAssets = assetsResponse.data || assetsResponse || [];
    const assets = Array.isArray(resolvedAssets) ? resolvedAssets : [];
    clearElement(assetSelect);
    assetSelect.appendChild(createEl('option', { value: '', textContent: '選択してください' }));
    assets.forEach((asset) => {
      const option = createEl('option', {
        value: asset.asset_tag,
        textContent: `${asset.asset_tag} - ${asset.name}`
      });
      if (asset.asset_tag === data.affected_asset) option.selected = true;
      assetSelect.appendChild(option);
    });
  } catch (error) {
    console.error('Failed to load assets:', error);
    clearElement(assetSelect);
    assetSelect.appendChild(createEl('option', { value: '', textContent: '取得に失敗しました' }));
  }
}

// Edit Asset Modal
function openEditAssetModal(data) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, '資産編集 (CMDB)');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Asset Tag (readonly)
  const tagGroup = createEl('div', { className: 'modal-form-group' });
  const tagLabel = createEl('label', { textContent: '資産タグ' });
  const tagInput = createEl('input', {
    type: 'text',
    id: 'edit-asset-tag',
    value: data.asset_tag || '',
    readonly: true
  });
  tagInput.style.backgroundColor = 'var(--bg-secondary)';
  tagGroup.appendChild(tagLabel);
  tagGroup.appendChild(tagInput);
  modalBody.appendChild(tagGroup);

  // Name
  const nameGroup = createEl('div', { className: 'modal-form-group' });
  const nameLabel = createEl('label', { textContent: '名称' });
  const nameInput = createEl('input', {
    type: 'text',
    id: 'edit-asset-name',
    value: data.name || ''
  });
  nameGroup.appendChild(nameLabel);
  nameGroup.appendChild(nameInput);
  modalBody.appendChild(nameGroup);

  // Type
  const typeGroup = createEl('div', { className: 'modal-form-group' });
  const typeLabel = createEl('label', { textContent: 'タイプ' });
  const typeSelect = createEl('select', { id: 'edit-asset-type' });
  ['Server', 'Network', 'Endpoint', 'Cloud', 'Software'].forEach((type) => {
    const option = createEl('option', { value: type, textContent: type });
    if (type === data.type) option.selected = true;
    typeSelect.appendChild(option);
  });
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeSelect);
  modalBody.appendChild(typeGroup);

  // Criticality
  const criticalityGroup = createEl('div', { className: 'modal-form-group' });
  const criticalityLabel = createEl('label', { textContent: '重要度' });
  const criticalitySelect = createEl('select', { id: 'edit-asset-criticality' });
  for (let i = 1; i <= 5; i += 1) {
    const stars = String.fromCharCode(9733).repeat(i) + String.fromCharCode(9734).repeat(5 - i);
    const option = createEl('option', { value: i.toString(), textContent: `${stars} (${i})` });
    if (i === data.criticality) option.selected = true;
    criticalitySelect.appendChild(option);
  }
  criticalityGroup.appendChild(criticalityLabel);
  criticalityGroup.appendChild(criticalitySelect);
  modalBody.appendChild(criticalityGroup);

  // Status
  const statusGroup = createEl('div', { className: 'modal-form-group' });
  const statusLabel = createEl('label', { textContent: 'ステータス' });
  const statusSelect = createEl('select', { id: 'edit-asset-status' });
  ['Operational', 'Maintenance', 'Retired'].forEach((status) => {
    const option = createEl('option', { value: status, textContent: status });
    if (status === data.status) option.selected = true;
    statusSelect.appendChild(option);
  });
  statusGroup.appendChild(statusLabel);
  statusGroup.appendChild(statusSelect);
  modalBody.appendChild(statusGroup);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Save button
  const saveBtn = createEl('button', { className: 'btn-modal-primary', textContent: '更新' });
  saveBtn.addEventListener('click', async () => {
    const updateData = {
      name: document.getElementById('edit-asset-name').value,
      type: document.getElementById('edit-asset-type').value,
      criticality: parseInt(document.getElementById('edit-asset-criticality').value, 10),
      status: document.getElementById('edit-asset-status').value
    };

    if (!updateData.name) {
      Toast.warning('名称を入力してください');
      return;
    }

    try {
      await apiCall(`/assets/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      Toast.success('資産情報を更新しました');
      closeModal();
      loadView('cmdb');
    } catch (error) {
      Toast.error(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
  modal.style.display = 'flex';
}

// ===== Delete Confirmation Dialog =====

// eslint-disable-next-line no-unused-vars
function showDeleteConfirmDialog(resourceType, resourceId, resourceName, onConfirm) {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, '削除確認');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Warning container
  const warningContainer = createEl('div');
  warningContainer.style.cssText = 'text-align: center; padding: 20px;';

  // Warning icon
  const warningIcon = createEl('div');
  warningIcon.style.cssText = 'font-size: 48px; color: #dc3545; margin-bottom: 16px;';
  setText(warningIcon, '⚠');
  warningContainer.appendChild(warningIcon);

  // Warning message
  const warningText = createEl('p');
  warningText.style.cssText = 'font-size: 16px; margin-bottom: 12px;';
  setText(warningText, '以下のデータを削除しようとしています。');
  warningContainer.appendChild(warningText);

  // Resource details
  const detailBox = createEl('div');
  detailBox.style.cssText =
    'background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin-bottom: 16px;';

  const typeLabel = createEl('p');
  typeLabel.style.cssText = 'margin: 4px 0; font-weight: bold;';
  setText(typeLabel, `種類: ${resourceType}`);
  detailBox.appendChild(typeLabel);

  const idLabel = createEl('p');
  idLabel.style.cssText = 'margin: 4px 0;';
  setText(idLabel, `ID: ${resourceId}`);
  detailBox.appendChild(idLabel);

  const nameLabel = createEl('p');
  nameLabel.style.cssText = 'margin: 4px 0;';
  setText(nameLabel, `名前: ${resourceName}`);
  detailBox.appendChild(nameLabel);

  warningContainer.appendChild(detailBox);

  // Caution text
  const cautionText = createEl('p');
  cautionText.style.cssText = 'color: #dc3545; font-weight: bold;';
  setText(cautionText, 'この操作は取り消すことができません。');
  warningContainer.appendChild(cautionText);

  modalBody.appendChild(warningContainer);

  // Cancel button
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);

  // Delete button (red)
  const deleteBtn = createEl('button', { className: 'btn-modal-primary', textContent: '削除' });
  deleteBtn.style.cssText = 'background: #dc3545; border-color: #dc3545;';
  deleteBtn.addEventListener('click', async () => {
    try {
      await onConfirm();
      closeModal();
    } catch (error) {
      Toast.error(`削除エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(deleteBtn);

  modal.style.display = 'flex';
}

// ===== Delete API Functions =====

// eslint-disable-next-line no-unused-vars
async function deleteIncident(ticketId) {
  await apiCall(`/incidents/${ticketId}`, { method: 'DELETE' });
  Toast.success('インシデントを削除しました');
  loadView('incidents');
}

// eslint-disable-next-line no-unused-vars
async function deleteChange(rfcId) {
  await apiCall(`/changes/${rfcId}`, { method: 'DELETE' });
  Toast.success('変更要求を削除しました');
  loadView('changes');
}

// eslint-disable-next-line no-unused-vars
async function deleteProblem(problemId) {
  await apiCall(`/problems/${problemId}`, { method: 'DELETE' });
  Toast.success('問題を削除しました');
  loadView('problems');
}

// eslint-disable-next-line no-unused-vars
async function deleteRelease(releaseId) {
  await apiCall(`/releases/${releaseId}`, { method: 'DELETE' });
  Toast.success('リリースを削除しました');
  loadView('releases');
}

// eslint-disable-next-line no-unused-vars
async function deleteServiceRequest(requestId) {
  await apiCall(`/service-requests/${requestId}`, { method: 'DELETE' });
  Toast.success('サービス要求を削除しました');
  loadView('requests');
}

// eslint-disable-next-line no-unused-vars
async function deleteSLA(slaId) {
  await apiCall(`/sla-agreements/${slaId}`, { method: 'DELETE' });
  Toast.success('SLA契約を削除しました');
  loadView('sla');
}

// eslint-disable-next-line no-unused-vars
async function deleteKnowledge(articleId) {
  await apiCall(`/knowledge-articles/${articleId}`, { method: 'DELETE' });
  Toast.success('ナレッジ記事を削除しました');
  loadView('knowledge');
}

// eslint-disable-next-line no-unused-vars
async function deleteCapacity(metricId) {
  await apiCall(`/capacity-metrics/${metricId}`, { method: 'DELETE' });
  Toast.success('キャパシティメトリクスを削除しました');
  loadView('capacity');
}

// eslint-disable-next-line no-unused-vars
async function deleteVulnerability(vulnId) {
  await apiCall(`/vulnerabilities/${vulnId}`, { method: 'DELETE' });
  Toast.success('脆弱性を削除しました');
  loadView('security');
}

// eslint-disable-next-line no-unused-vars
async function deleteAsset(assetId) {
  await apiCall(`/assets/${assetId}`, { method: 'DELETE' });
  Toast.success('資産を削除しました');
  loadView('cmdb');
}

// ===== Compliance Policies View =====

// eslint-disable-next-line no-unused-vars
async function renderCompliancePolicies(container) {
  try {
    const samplePolicies = [
      {
        policy_id: 'POL-001',
        policy_name: 'アクセス制御ポリシー',
        framework: 'ISO 27001',
        version: '2.1',
        status: 'Active',
        last_review: '2025-11-15',
        next_review: '2026-05-15',
        owner: '情報セキュリティ部',
        approval_date: '2025-11-01',
        description: 'システムおよびデータへのアクセス制御に関する方針'
      },
      {
        policy_id: 'POL-002',
        policy_name: 'データ暗号化基準',
        framework: 'NIST CSF',
        version: '1.5',
        status: 'Active',
        last_review: '2025-10-20',
        next_review: '2026-04-20',
        owner: 'IT基盤部',
        approval_date: '2025-10-10',
        description: '保管データおよび転送データの暗号化要件'
      },
      {
        policy_id: 'POL-003',
        policy_name: 'インシデント対応手順',
        framework: 'NIST CSF',
        version: '3.0',
        status: 'Active',
        last_review: '2025-12-01',
        next_review: '2026-06-01',
        owner: 'セキュリティ運用部',
        approval_date: '2025-11-20',
        description: 'セキュリティインシデント発生時の対応プロセス'
      },
      {
        policy_id: 'POL-004',
        policy_name: 'バックアップ・復旧基準',
        framework: 'ISO 27001',
        version: '2.0',
        status: 'Under Review',
        last_review: '2025-09-10',
        next_review: '2026-03-10',
        owner: 'IT基盤部',
        approval_date: '2025-09-01',
        description: 'データバックアップと災害復旧に関する基準'
      },
      {
        policy_id: 'POL-005',
        policy_name: 'パスワード管理規程',
        framework: 'PCI DSS',
        version: '1.8',
        status: 'Active',
        last_review: '2025-11-25',
        next_review: '2026-05-25',
        owner: '情報セキュリティ部',
        approval_date: '2025-11-15',
        description: 'パスワードの複雑性、有効期限、管理要件'
      },
      {
        policy_id: 'POL-006',
        policy_name: 'ベンダー管理基準',
        framework: 'ISO 27001',
        version: '1.2',
        status: 'Draft',
        last_review: '2025-12-10',
        next_review: '2026-06-10',
        owner: '調達部',
        approval_date: null,
        description: '外部ベンダーのセキュリティ評価および管理'
      }
    ];

    const section = createEl('div');
    let filteredData = [...samplePolicies];
    let sortKey = 'next_review';
    let sortDirection = 'asc';
    const paginator = new Paginator(filteredData, 10);

    function renderTable() {
      const existingTable = section.querySelector('.table-wrapper');
      if (existingTable) section.removeChild(existingTable);
      const existingPagination = section.querySelector('.pagination-wrapper');
      if (existingPagination) section.removeChild(existingPagination);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });
      const thead = createEl('thead');
      const headerRow = createEl('tr');
      const headers = [
        { text: 'ポリシーID', key: 'policy_id' },
        { text: 'ポリシー名', key: 'policy_name' },
        { text: 'フレームワーク', key: 'framework' },
        { text: 'バージョン', key: 'version' },
        { text: 'ステータス', key: 'status' },
        { text: '前回レビュー', key: 'last_review' },
        { text: '次回レビュー', key: 'next_review' },
        { text: '担当部署', key: 'owner' }
      ];
      headers.forEach((header) => {
        const th = createEl('th', { textContent: header.text });
        th.style.cursor = 'pointer';
        th.addEventListener('click', () => {
          sortKey = header.key;
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
          filteredData = sortData(filteredData, sortKey, sortDirection);
          paginator.data = filteredData;
          renderTable();
        });
        if (sortKey === header.key) {
          const arrow = createEl('span', { textContent: sortDirection === 'asc' ? ' ▲' : ' ▼' });
          th.appendChild(arrow);
        }
        headerRow.appendChild(th);
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      const tbody = createEl('tbody');
      paginator.currentData.forEach((policy) => {
        const row = createEl('tr');
        row.style.cursor = 'pointer';
        row.addEventListener('click', () => Toast.info(`ポリシー: ${policy.policy_name}`));
        row.appendChild(createEl('td', { textContent: policy.policy_id }));
        row.appendChild(createEl('td', { textContent: policy.policy_name }));
        row.appendChild(createEl('td', { textContent: policy.framework }));
        row.appendChild(createEl('td', { textContent: policy.version }));
        let statusClass = 'secondary';
        if (policy.status === 'Active') statusClass = 'success';
        else if (policy.status === 'Under Review') statusClass = 'warning';
        const statusBadge = createEl('span', {
          className: `badge badge-${statusClass}`,
          textContent: policy.status
        });
        const statusCell = createEl('td');
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);
        row.appendChild(createEl('td', { textContent: policy.last_review }));
        row.appendChild(createEl('td', { textContent: policy.next_review }));
        row.appendChild(createEl('td', { textContent: policy.owner }));
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      section.appendChild(tableWrapper);

      const paginationWrapper = createEl('div');
      paginationWrapper.className = 'pagination-wrapper';
      paginationWrapper.style.cssText =
        'display: flex; justify-content: space-between; align-items: center; margin-top: 16px;';
      const prevBtn = createEl('button', { textContent: '← 前へ', className: 'btn-secondary' });
      prevBtn.disabled = !paginator.hasPrev;
      prevBtn.addEventListener('click', () => {
        paginator.prev();
        renderTable();
      });
      const pageInfo = createEl('span', {
        textContent: `${paginator.currentPage} / ${paginator.totalPages} ページ (全 ${filteredData.length} 件)`
      });
      const nextBtn = createEl('button', { textContent: '次へ →', className: 'btn-secondary' });
      nextBtn.disabled = !paginator.hasNext;
      nextBtn.addEventListener('click', () => {
        paginator.next();
        renderTable();
      });
      paginationWrapper.appendChild(prevBtn);
      paginationWrapper.appendChild(pageInfo);
      paginationWrapper.appendChild(nextBtn);
      section.appendChild(paginationWrapper);
    }

    const header = createEl('div');
    header.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;';
    const h2 = createEl('h2', { textContent: 'コンプライアンスポリシー管理' });
    header.appendChild(h2);
    const btnGroup = createEl('div');
    btnGroup.style.cssText = 'display: flex; gap: 12px;';
    const createBtn = createEl('button', {
      className: 'btn-primary',
      textContent: '新規ポリシー作成'
    });
    createBtn.addEventListener('click', () => Toast.info('新規ポリシー作成機能は実装予定です'));
    const csvBtn = createEl('button', { className: 'btn-export' });
    const csvIcon = createEl('i', { className: 'fas fa-download' });
    csvBtn.appendChild(csvIcon);
    setText(csvBtn, ' CSVエクスポート', true);
    csvBtn.addEventListener('click', () => exportToCSV(filteredData, 'compliance_policies.csv'));
    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(csvBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    const explanation = createExplanationSection(
      '社内のポリシーと業務プロシージャーを体系的に整理し、最新状態を維持する管理領域です。プロシージャーとは、ポリシーを実務に落とし込むための具体的な手順・役割・判断基準を定義した実行ルールを指します。',
      '統一されたルールと手順を整備することで、判断のばらつきを抑え、監査対応や法令順守を継続的に担保できます。'
    );
    section.appendChild(explanation);

    const filtersDiv = createEl('div');
    filtersDiv.style.cssText = 'display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap;';
    const frameworkFilter = createEl('select');
    frameworkFilter.style.cssText = 'padding: 8px; border-radius: 4px; border: 1px solid #cbd5e1;';
    ['全てのフレームワーク', 'ISO 27001', 'NIST CSF', 'PCI DSS'].forEach((opt) => {
      frameworkFilter.appendChild(createEl('option', { textContent: opt, value: opt }));
    });
    frameworkFilter.addEventListener('change', (e) => {
      const { value } = e.target;
      filteredData =
        value === '全てのフレームワーク'
          ? [...samplePolicies]
          : samplePolicies.filter((p) => p.framework === value);
      filteredData = sortData(filteredData, sortKey, sortDirection);
      paginator.data = filteredData;
      renderTable();
    });
    filtersDiv.appendChild(frameworkFilter);
    section.appendChild(filtersDiv);
    renderTable();
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'コンプライアンスポリシーの読み込みに失敗しました');
  }
}

// ===== Compliance Management View =====

// eslint-disable-next-line no-unused-vars
async function renderComplianceManagement(container) {
  try {
    const section = createEl('div');
    const evidenceItems = [
      {
        evidence_id: 'EV-001',
        control: 'AC-2',
        title: 'アクセス権棚卸し記録',
        owner: 'IT運用部',
        status: '承認済み',
        due_date: '2025-12-28',
        updated: '2025-12-20'
      },
      {
        evidence_id: 'EV-002',
        control: 'IR-4',
        title: 'インシデント対応訓練報告書',
        owner: 'セキュリティ運用部',
        status: 'レビュー待ち',
        due_date: '2025-12-22',
        updated: '2025-12-10'
      },
      {
        evidence_id: 'EV-003',
        control: 'CP-9',
        title: 'バックアップ復旧テスト結果',
        owner: 'IT基盤部',
        status: '収集中',
        due_date: '2025-12-31',
        updated: '2025-11-28'
      },
      {
        evidence_id: 'EV-004',
        control: 'SA-9',
        title: '委託先セキュリティ評価票',
        owner: '調達部',
        status: '未提出',
        due_date: '2025-12-18',
        updated: '2025-11-15'
      },
      {
        evidence_id: 'EV-005',
        control: 'AU-12',
        title: '監査ログ保管証跡',
        owner: 'IT運用部',
        status: '承認済み',
        due_date: '2025-12-25',
        updated: '2025-12-21'
      }
    ];

    const auditSchedules = [
      {
        audit_id: 'AUD-2026-01',
        name: 'ISO 27001 内部監査',
        scope: '情報セキュリティ統制',
        start: '2026-01-15',
        end: '2026-01-20',
        status: '計画中',
        lead: '内部監査室'
      },
      {
        audit_id: 'AUD-2025-12',
        name: '個人情報保護監査',
        scope: '顧客データ管理',
        start: '2025-12-05',
        end: '2025-12-12',
        status: '実施中',
        lead: 'GRCチーム'
      },
      {
        audit_id: 'AUD-2025-11',
        name: 'BCP実効性レビュー',
        scope: '事業継続計画',
        start: '2025-11-10',
        end: '2025-11-12',
        status: '完了',
        lead: 'リスク管理室'
      }
    ];

    const findings = [
      {
        finding_id: 'FND-204',
        title: '特権IDの四半期レビュー未実施',
        severity: 'High',
        status: '対応中',
        owner: 'IT運用部',
        due_date: '2026-01-10',
        control: 'AC-2'
      },
      {
        finding_id: 'FND-198',
        title: '監査証跡の保持期間不足',
        severity: 'Medium',
        status: '未対応',
        owner: 'セキュリティ運用部',
        due_date: '2026-01-05',
        control: 'AU-6'
      },
      {
        finding_id: 'FND-173',
        title: 'バックアップ復旧テストの記録不足',
        severity: 'Low',
        status: '対応中',
        owner: 'IT基盤部',
        due_date: '2025-12-30',
        control: 'CP-9'
      },
      {
        finding_id: 'FND-165',
        title: '委託先セキュリティ評価の更新遅延',
        severity: 'High',
        status: '完了',
        owner: '調達部',
        due_date: '2025-12-01',
        control: 'SA-9'
      }
    ];

    const reports = [
      {
        report_id: 'REP-2025-Q4',
        title: '2025 Q4 コンプライアンス総括',
        framework: 'ISO 27001',
        period: '2025/10-12',
        status: '承認待ち',
        owner: 'GRCチーム',
        generated: '2025-12-28'
      },
      {
        report_id: 'REP-2025-NOV',
        title: '個人情報保護 月次レポート',
        framework: '個人情報保護',
        period: '2025/11',
        status: 'レビュー中',
        owner: '法務部',
        generated: '2025-12-05'
      },
      {
        report_id: 'REP-2025-OCT',
        title: 'PCI DSS 対応状況レポート',
        framework: 'PCI DSS',
        period: '2025/10',
        status: '公開済み',
        owner: '情報セキュリティ部',
        generated: '2025-11-10'
      }
    ];

    const header = createEl('div');
    header.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';
    const h2 = createEl('h2', { textContent: 'コンプライアンス管理' });
    header.appendChild(h2);
    const actionGroup = createEl('div');
    actionGroup.style.cssText = 'display: flex; gap: 12px; flex-wrap: wrap;';
    const addEvidenceBtn = createEl('button', {
      className: 'btn-primary',
      textContent: 'エビデンス登録'
    });
    addEvidenceBtn.addEventListener('click', () => Toast.info('エビデンス登録機能は準備中です'));
    const reportBtn = createEl('button', {
      className: 'btn-secondary',
      textContent: 'レポート生成'
    });
    reportBtn.addEventListener('click', () => Toast.info('レポート生成機能は準備中です'));
    actionGroup.appendChild(addEvidenceBtn);
    actionGroup.appendChild(reportBtn);
    header.appendChild(actionGroup);
    section.appendChild(header);

    const explanation = createExplanationSection(
      '証跡収集・監査スケジュール・指摘事項・レポート生成を一元管理します。',
      'コンプライアンス対応を継続的に監視し、監査に向けた準備と是正を計画的に進めます。'
    );
    section.appendChild(explanation);

    const evidenceApproved = evidenceItems.filter((item) => item.status === '承認済み');
    const evidenceRate = Math.round(
      (evidenceApproved.length / Math.max(evidenceItems.length, 1)) * 100
    );
    const openFindings = findings.filter((item) => item.status !== '完了');
    const upcomingAudits = auditSchedules
      .filter((audit) => audit.status !== '完了')
      .sort((a, b) => new Date(a.start) - new Date(b.start));
    const nextAudit = upcomingAudits[0];
    const pendingReports = reports.filter((report) => report.status !== '公開済み');

    const summaryGrid = createEl('div', { className: 'grid' });
    const summaryCards = [
      {
        icon: 'fa-folder-open',
        value: `${evidenceRate}%`,
        label: '証跡充足率',
        color: 'rgba(16, 185, 129, 0.1)',
        iconColor: 'var(--accent-green)',
        detail: `承認済み ${evidenceApproved.length}/${evidenceItems.length}`
      },
      {
        icon: 'fa-exclamation-circle',
        value: openFindings.length,
        label: '未対応指摘',
        color: 'rgba(239, 68, 68, 0.1)',
        iconColor: 'var(--accent-red)',
        detail: `全指摘 ${findings.length}件`
      },
      {
        icon: 'fa-calendar-check',
        value: nextAudit ? nextAudit.start : '-',
        label: '次回監査',
        color: 'rgba(59, 130, 246, 0.1)',
        iconColor: 'var(--accent-blue)',
        detail: nextAudit ? nextAudit.name : '予定なし'
      },
      {
        icon: 'fa-file-alt',
        value: pendingReports.length,
        label: '作成中レポート',
        color: 'rgba(245, 158, 11, 0.1)',
        iconColor: 'var(--accent-orange)',
        detail: `公開済み ${reports.length - pendingReports.length}件`
      }
    ];

    summaryCards.forEach((card) => {
      const cardEl = createEl('div', { className: 'stat-card glass' });
      const headerRow = createEl('div', { className: 'stat-header' });
      const iconDiv = createEl('div', { className: 'stat-icon' });
      iconDiv.style.background = card.color;
      iconDiv.style.color = card.iconColor;
      iconDiv.appendChild(createEl('i', { className: `fas ${card.icon}` }));
      headerRow.appendChild(iconDiv);
      cardEl.appendChild(headerRow);
      cardEl.appendChild(
        createEl('div', { className: 'stat-val', textContent: String(card.value) })
      );
      cardEl.appendChild(createEl('div', { className: 'stat-label', textContent: card.label }));
      const detail = createEl('div');
      detail.style.cssText = 'font-size: 11px; color: #64748b; margin-top: 4px;';
      setText(detail, card.detail);
      cardEl.appendChild(detail);
      summaryGrid.appendChild(cardEl);
    });

    section.appendChild(summaryGrid);

    const tabNav = createEl('div');
    tabNav.style.cssText =
      'display: flex; gap: 8px; border-bottom: 2px solid #e2e8f0; margin-bottom: 24px; flex-wrap: wrap;';
    const tabs = [
      { id: 'evidence', label: 'エビデンス管理' },
      { id: 'audit-schedule', label: '監査スケジュール' },
      { id: 'audit-findings', label: '監査指摘事項' },
      { id: 'compliance-reports', label: 'コンプライアンスレポート' }
    ];
    let activeTab = 'evidence';
    let evidenceFilter = 'すべて';

    const evidenceBadgeMap = {
      承認済み: 'success',
      レビュー待ち: 'info',
      収集中: 'warning',
      未提出: 'rejected'
    };
    const scheduleBadgeMap = {
      計画中: 'pending',
      実施中: 'info',
      完了: 'success'
    };
    const findingBadgeMap = {
      未対応: 'pending',
      対応中: 'warning',
      完了: 'success'
    };
    const reportBadgeMap = {
      承認待ち: 'pending',
      レビュー中: 'warning',
      ドラフト: 'info',
      公開済み: 'success'
    };

    function renderEvidenceTab(contentArea) {
      const filterRow = createEl('div');
      filterRow.style.cssText = 'display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 16px;';
      ['すべて', '承認済み', 'レビュー待ち', '収集中', '未提出'].forEach((label) => {
        const btn = createEl('button', { className: 'btn-secondary', textContent: label });
        if (label === evidenceFilter) {
          btn.style.background = '#2563eb';
          btn.style.color = 'white';
          btn.style.borderColor = '#2563eb';
        }
        btn.addEventListener('click', () => {
          evidenceFilter = label;
          renderTabContent();
        });
        filterRow.appendChild(btn);
      });
      contentArea.appendChild(filterRow);

      const filteredEvidence =
        evidenceFilter === 'すべて'
          ? evidenceItems
          : evidenceItems.filter((item) => item.status === evidenceFilter);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });
      const thead = createEl('thead');
      const headerRow = createEl('tr');
      ['証跡ID', '管理項目', '証跡名', '担当', '期限', 'ステータス'].forEach((text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      const tbody = createEl('tbody');
      filteredEvidence.forEach((item) => {
        const row = createEl('tr');
        row.appendChild(createEl('td', { textContent: item.evidence_id }));
        row.appendChild(createEl('td', { textContent: item.control }));
        row.appendChild(createEl('td', { textContent: item.title }));
        row.appendChild(createEl('td', { textContent: item.owner }));
        row.appendChild(createEl('td', { textContent: item.due_date }));
        const statusCell = createEl('td');
        statusCell.appendChild(createBadge(item.status, evidenceBadgeMap[item.status] || 'info'));
        row.appendChild(statusCell);
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      contentArea.appendChild(tableWrapper);
    }

    function renderScheduleTab(contentArea) {
      const timeline = createEl('div');
      timeline.style.cssText =
        'display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 16px;';
      auditSchedules.forEach((audit) => {
        const card = createEl('div');
        card.style.cssText =
          'background: white; border-radius: 12px; padding: 16px; border: 1px solid var(--border-color);';
        card.appendChild(createEl('h4', { textContent: audit.name }));
        const scope = createEl('p');
        scope.style.cssText = 'margin: 6px 0; color: #475569;';
        setText(scope, audit.scope);
        card.appendChild(scope);
        const period = createEl('p');
        period.style.cssText = 'margin: 6px 0; font-size: 13px;';
        setText(period, `期間: ${audit.start} 〜 ${audit.end}`);
        card.appendChild(period);
        const badge = createBadge(audit.status, scheduleBadgeMap[audit.status] || 'info');
        card.appendChild(badge);
        timeline.appendChild(card);
      });
      contentArea.appendChild(timeline);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });
      const thead = createEl('thead');
      const headerRow = createEl('tr');
      ['監査ID', '監査名', '期間', '責任者', '状況'].forEach((text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      const tbody = createEl('tbody');
      auditSchedules.forEach((audit) => {
        const row = createEl('tr');
        row.appendChild(createEl('td', { textContent: audit.audit_id }));
        row.appendChild(createEl('td', { textContent: audit.name }));
        row.appendChild(createEl('td', { textContent: `${audit.start} 〜 ${audit.end}` }));
        row.appendChild(createEl('td', { textContent: audit.lead }));
        const statusCell = createEl('td');
        statusCell.appendChild(createBadge(audit.status, scheduleBadgeMap[audit.status] || 'info'));
        row.appendChild(statusCell);
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      contentArea.appendChild(tableWrapper);
    }

    function renderFindingsTab(contentArea) {
      const severityRow = createEl('div');
      severityRow.style.cssText = 'display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;';
      ['Critical', 'High', 'Medium', 'Low'].forEach((severity) => {
        const count = findings.filter((item) => item.severity === severity).length;
        const badge = createEl('span', {
          className: `badge badge-${severity.toLowerCase()}`,
          textContent: `${severity} ${count}`
        });
        severityRow.appendChild(badge);
      });
      contentArea.appendChild(severityRow);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });
      const thead = createEl('thead');
      const headerRow = createEl('tr');
      ['指摘ID', '指摘内容', '重要度', '期限', '担当', '状況'].forEach((text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      const tbody = createEl('tbody');
      findings.forEach((item) => {
        const row = createEl('tr');
        row.appendChild(createEl('td', { textContent: item.finding_id }));
        row.appendChild(createEl('td', { textContent: item.title }));
        const severityCell = createEl('td');
        severityCell.appendChild(
          createEl('span', {
            className: `badge badge-${item.severity.toLowerCase()}`,
            textContent: item.severity
          })
        );
        row.appendChild(severityCell);
        row.appendChild(createEl('td', { textContent: item.due_date }));
        row.appendChild(createEl('td', { textContent: item.owner }));
        const statusCell = createEl('td');
        statusCell.appendChild(createBadge(item.status, findingBadgeMap[item.status] || 'info'));
        row.appendChild(statusCell);
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      contentArea.appendChild(tableWrapper);
    }

    function renderReportsTab(contentArea) {
      const reportsGrid = createEl('div');
      reportsGrid.style.cssText =
        'display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin-bottom: 16px;';
      reports.forEach((report) => {
        const card = createEl('div');
        card.style.cssText =
          'background: white; border-radius: 12px; padding: 16px; border: 1px solid var(--border-color);';
        card.appendChild(createEl('h4', { textContent: report.title }));
        const meta = createEl('p');
        meta.style.cssText = 'margin: 6px 0; color: #475569;';
        setText(meta, `${report.framework} | ${report.period}`);
        card.appendChild(meta);
        const badge = createBadge(report.status, reportBadgeMap[report.status] || 'info');
        card.appendChild(badge);
        const actions = createEl('div');
        actions.style.cssText = 'display: flex; gap: 8px; margin-top: 12px;';
        const previewBtn = createEl('button', {
          className: 'btn-secondary',
          textContent: 'プレビュー'
        });
        previewBtn.addEventListener('click', () => Toast.info('プレビュー機能は準備中です'));
        const exportBtn = createEl('button', { className: 'btn-export', textContent: 'CSV出力' });
        exportBtn.addEventListener('click', () => exportToCSV([report], `${report.report_id}.csv`));
        actions.appendChild(previewBtn);
        actions.appendChild(exportBtn);
        card.appendChild(actions);
        reportsGrid.appendChild(card);
      });
      contentArea.appendChild(reportsGrid);

      const tableWrapper = createEl('div');
      tableWrapper.className = 'table-wrapper';
      const table = createEl('table', { className: 'data-table' });
      const thead = createEl('thead');
      const headerRow = createEl('tr');
      ['レポートID', '対象期間', 'フレームワーク', '作成日', 'ステータス'].forEach((text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      });
      thead.appendChild(headerRow);
      table.appendChild(thead);
      const tbody = createEl('tbody');
      reports.forEach((report) => {
        const row = createEl('tr');
        row.appendChild(createEl('td', { textContent: report.report_id }));
        row.appendChild(createEl('td', { textContent: report.period }));
        row.appendChild(createEl('td', { textContent: report.framework }));
        row.appendChild(createEl('td', { textContent: report.generated }));
        const statusCell = createEl('td');
        statusCell.appendChild(createBadge(report.status, reportBadgeMap[report.status] || 'info'));
        row.appendChild(statusCell);
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      tableWrapper.appendChild(table);
      contentArea.appendChild(tableWrapper);
    }

    function renderTabContent() {
      const existingContent = section.querySelector('.tab-content-area');
      if (existingContent) section.removeChild(existingContent);
      const contentArea = createEl('div');
      contentArea.className = 'tab-content-area';
      const heading = createEl('h3', {
        textContent: `${tabs.find((t) => t.id === activeTab).label}`
      });
      heading.style.marginBottom = '12px';
      contentArea.appendChild(heading);

      if (activeTab === 'evidence') {
        renderEvidenceTab(contentArea);
      } else if (activeTab === 'audit-schedule') {
        renderScheduleTab(contentArea);
      } else if (activeTab === 'audit-findings') {
        renderFindingsTab(contentArea);
      } else if (activeTab === 'compliance-reports') {
        renderReportsTab(contentArea);
      }

      section.appendChild(contentArea);
    }

    tabs.forEach((tab) => {
      const tabBtn = createEl('button');
      tabBtn.textContent = tab.label;
      tabBtn.style.cssText =
        'padding: 12px 24px; background: none; border: none; cursor: pointer; font-size: 14px; font-weight: 500; color: #64748b; border-bottom: 2px solid transparent; transition: all 0.2s;';
      if (tab.id === activeTab) {
        tabBtn.style.color = '#3b82f6';
        tabBtn.style.borderBottomColor = '#3b82f6';
      }
      tabBtn.addEventListener('click', () => {
        activeTab = tab.id;
        Array.from(tabNav.children).forEach((btn) => {
          // eslint-disable-next-line no-param-reassign
          btn.style.color = '#64748b';
          // eslint-disable-next-line no-param-reassign
          btn.style.borderBottomColor = 'transparent';
        });
        tabBtn.style.color = '#3b82f6';
        tabBtn.style.borderBottomColor = '#3b82f6';
        renderTabContent();
      });
      tabNav.appendChild(tabBtn);
    });

    section.appendChild(tabNav);
    renderTabContent();
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'コンプライアンス管理の読み込みに失敗しました');
  }
}

// ===== Report Management View =====

async function renderSettingsReports(container) {
  const section = createEl('div');

  // Header
  const header = createEl('div');
  header.style.cssText =
    'display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;';

  const h2 = createEl('h2', { textContent: 'レポート管理' });
  header.appendChild(h2);

  section.appendChild(header);

  // 説明セクション
  const explanation = createExplanationSection(
    'インシデント、SLA、セキュリティなどの各種レポートを即時生成またはスケジュール設定できます。',
    '定期的なレポート生成により、経営層への報告や監査対応が効率化されます。PDFレポートはメール送信やダウンロードが可能で、業務の透明性と説明責任を強化します。'
  );
  section.appendChild(explanation);

  try {
    // 即時レポート生成セクション
    const instantCard = createEl('div', { className: 'card-large glass' });
    instantCard.style.padding = '24px';
    instantCard.style.marginBottom = '24px';

    const instantTitle = createEl('h3', { textContent: '即時レポート生成' });
    instantTitle.style.marginBottom = '16px';
    instantCard.appendChild(instantTitle);

    const form = createEl('form');
    form.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr 1fr auto; gap: 16px; align-items: end;';

    // Report Type
    const typeGroup = createEl('div', { className: 'form-group' });
    const typeLabel = createEl('label', { textContent: 'レポートタイプ' });
    const typeSelect = createEl('select', { className: 'form-control', id: 'report-type' });
    [
      { value: 'incident', label: 'インシデントレポート' },
      { value: 'sla', label: 'SLAレポート' },
      { value: 'security', label: 'セキュリティレポート' },
      { value: 'audit', label: '監査レポート' },
      { value: 'compliance', label: 'コンプライアンスレポート' }
    ].forEach((opt) => {
      const option = createEl('option', { value: opt.value, textContent: opt.label });
      typeSelect.appendChild(option);
    });
    typeGroup.appendChild(typeLabel);
    typeGroup.appendChild(typeSelect);
    form.appendChild(typeGroup);

    // Start Date
    const startGroup = createEl('div', { className: 'form-group' });
    const startLabel = createEl('label', { textContent: '開始日' });
    const startInput = createEl('input', {
      type: 'date',
      className: 'form-control',
      id: 'report-start-date'
    });
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    startInput.value = thirtyDaysAgo.toISOString().split('T')[0];
    startGroup.appendChild(startLabel);
    startGroup.appendChild(startInput);
    form.appendChild(startGroup);

    // End Date
    const endGroup = createEl('div', { className: 'form-group' });
    const endLabel = createEl('label', { textContent: '終了日' });
    const endInput = createEl('input', { type: 'date', className: 'form-control', id: 'report-end-date' });
    endInput.value = new Date().toISOString().split('T')[0];
    endGroup.appendChild(endLabel);
    endGroup.appendChild(endInput);
    form.appendChild(endGroup);

    // Generate Button
    const generateBtn = createEl('button', { className: 'btn-primary', textContent: 'PDF生成' });
    generateBtn.type = 'button';
    generateBtn.addEventListener('click', async () => {
      const reportType = typeSelect.value;
      const startDate = startInput.value;
      const endDate = endInput.value;

      if (!startDate || !endDate) {
        Toast.error('日付範囲を指定してください');
        return;
      }

      try {
        Toast.info('レポートを生成中...');
        const response = await fetch(
          `${API_BASE}/reports/generate?type=${reportType}&start_date=${startDate}&end_date=${endDate}`,
          {
            headers: {
              Authorization: `Bearer ${authToken}`
            }
          }
        );

        if (!response.ok) throw new Error('Report generation failed');

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${reportType}_report_${startDate}_${endDate}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        Toast.success('レポートをダウンロードしました');
      } catch (error) {
        console.error('Report generation error:', error);
        Toast.error('レポート生成に失敗しました');
      }
    });
    form.appendChild(generateBtn);

    instantCard.appendChild(form);
    section.appendChild(instantCard);

    // スケジュールレポート一覧
    const response = await apiCall('/reports/schedules');
    const schedules = response.schedules || [];

    const schedulesCard = createEl('div', { className: 'card-large glass' });
    schedulesCard.style.padding = '24px';
    schedulesCard.style.marginBottom = '24px';

    const schedulesHeader = createEl('div');
    schedulesHeader.style.cssText =
      'display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;';

    const schedulesTitle = createEl('h3', { textContent: 'スケジュールレポート' });
    schedulesHeader.appendChild(schedulesTitle);

    const addScheduleBtn = createEl('button', { className: 'btn-primary', textContent: '+ スケジュール追加' });
    addScheduleBtn.addEventListener('click', () => openAddReportScheduleModal());
    schedulesHeader.appendChild(addScheduleBtn);

    schedulesCard.appendChild(schedulesHeader);

    if (schedules.length === 0) {
      const emptyMsg = createEl('div', { textContent: 'スケジュールレポートが登録されていません。' });
      emptyMsg.style.cssText = 'text-align: center; padding: 40px; color: var(--text-secondary);';
      schedulesCard.appendChild(emptyMsg);
    } else {
      const schedulesTable = createEl('table', { className: 'data-table' });
      const thead = createEl('thead');
      const headerRow = createEl('tr');
      ['レポートタイプ', '頻度', '次回実行', 'ステータス', 'アクション'].forEach((text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      });
      thead.appendChild(headerRow);
      schedulesTable.appendChild(thead);

      const tbody = createEl('tbody');
      schedules.forEach((schedule) => {
        const row = createEl('tr');

        // Report Type
        const typeLabel = {
          incident: 'インシデント',
          sla: 'SLA',
          security: 'セキュリティ',
          audit: '監査',
          compliance: 'コンプライアンス'
        }[schedule.report_type] || schedule.report_type;
        row.appendChild(createEl('td', { textContent: typeLabel }));

        // Frequency
        const freqLabel = {
          daily: '日次',
          weekly: '週次',
          monthly: '月次'
        }[schedule.frequency] || schedule.frequency;
        row.appendChild(createEl('td', { textContent: freqLabel }));

        // Next Run
        const nextRunCell = createEl('td');
        if (schedule.next_run) {
          const date = new Date(schedule.next_run);
          setText(nextRunCell, date.toLocaleString('ja-JP'));
        } else {
          setText(nextRunCell, '-');
        }
        row.appendChild(nextRunCell);

        // Status
        const statusCell = createEl('td');
        const statusBadge = createEl('span', {
          className: schedule.enabled ? 'badge badge-success' : 'badge badge-secondary',
          textContent: schedule.enabled ? '有効' : '無効'
        });
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        // Actions
        const actionCell = createEl('td');
        actionCell.style.cssText = 'display: flex; gap: 8px;';

        const editBtn = createEl('button', { className: 'btn-secondary', textContent: '編集' });
        editBtn.style.cssText = 'padding: 6px 12px; font-size: 0.85rem;';
        editBtn.addEventListener('click', () => openEditReportScheduleModal(schedule));
        actionCell.appendChild(editBtn);

        const deleteBtn = createEl('button', { className: 'btn-danger', textContent: '削除' });
        deleteBtn.style.cssText = 'padding: 6px 12px; font-size: 0.85rem;';
        deleteBtn.addEventListener('click', () =>
          showDeleteConfirmDialog('レポートスケジュール', schedule.id, schedule.report_type, async () => {
            await deleteReportSchedule(schedule.id);
            await loadView('settings_reports');
          })
        );
        actionCell.appendChild(deleteBtn);

        row.appendChild(actionCell);
        tbody.appendChild(row);
      });

      schedulesTable.appendChild(tbody);
      schedulesCard.appendChild(schedulesTable);
    }

    section.appendChild(schedulesCard);

    // レポート生成履歴
    const historyResponse = await apiCall('/reports/history?limit=10');
    const history = Array.isArray(historyResponse) ? historyResponse : (historyResponse.history || []);

    const historyCard = createEl('div', { className: 'card-large glass' });
    historyCard.style.padding = '24px';

    const historyTitle = createEl('h3', { textContent: 'レポート生成履歴' });
    historyTitle.style.marginBottom = '16px';
    historyCard.appendChild(historyTitle);

    if (history.length === 0) {
      const emptyMsg = createEl('div', { textContent: 'レポート生成履歴がありません。' });
      emptyMsg.style.cssText = 'text-align: center; padding: 40px; color: var(--text-secondary);';
      historyCard.appendChild(emptyMsg);
    } else {
      const historyTable = createEl('table', { className: 'data-table' });
      const thead = createEl('thead');
      const headerRow = createEl('tr');
      ['生成日時', 'レポートタイプ', '期間', 'ステータス', 'アクション'].forEach((text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      });
      thead.appendChild(headerRow);
      historyTable.appendChild(thead);

      const tbody = createEl('tbody');
      history.forEach((item) => {
        const row = createEl('tr');

        // Generated At
        const dateCell = createEl('td');
        const date = new Date(item.generated_at);
        setText(dateCell, date.toLocaleString('ja-JP'));
        row.appendChild(dateCell);

        // Report Type
        const typeLabel = {
          incident: 'インシデント',
          sla: 'SLA',
          security: 'セキュリティ',
          audit: '監査',
          compliance: 'コンプライアンス'
        }[item.report_type] || item.report_type;
        row.appendChild(createEl('td', { textContent: typeLabel }));

        // Period
        const periodCell = createEl('td');
        setText(periodCell, `${item.start_date} ~ ${item.end_date}`);
        row.appendChild(periodCell);

        // Status
        const statusCell = createEl('td');
        const statusBadge = createEl('span', {
          className: item.status === 'completed' ? 'badge badge-success' : 'badge badge-critical',
          textContent: item.status === 'completed' ? '完了' : '失敗'
        });
        statusCell.appendChild(statusBadge);
        row.appendChild(statusCell);

        // Actions
        const actionCell = createEl('td');
        if (item.status === 'completed' && item.file_path) {
          const downloadBtn = createEl('button', { className: 'btn-secondary', textContent: 'ダウンロード' });
          downloadBtn.style.cssText = 'padding: 6px 12px; font-size: 0.85rem;';
          downloadBtn.addEventListener('click', () => downloadReport(item.id));
          actionCell.appendChild(downloadBtn);
        }
        row.appendChild(actionCell);

        tbody.appendChild(row);
      });

      historyTable.appendChild(tbody);
      historyCard.appendChild(historyTable);
    }

    section.appendChild(historyCard);
  } catch (error) {
    console.error('Error loading reports settings:', error);
    renderError(section, 'レポート設定の読み込みに失敗しました');
  }

  container.appendChild(section);
}

// Helper functions for reports
async function deleteReportSchedule(scheduleId) {
  try {
    await apiCall(`/reports/schedules/${scheduleId}`, 'DELETE');
    Toast.success('レポートスケジュールを削除しました');
  } catch (error) {
    Toast.error('レポートスケジュールの削除に失敗しました');
  }
}

async function downloadReport(reportId) {
  try {
    const response = await fetch(`${API_BASE}/reports/${reportId}/download`, {
      headers: {
        Authorization: `Bearer ${authToken}`
      }
    });

    if (!response.ok) throw new Error('Download failed');

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `report_${reportId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);

    Toast.success('レポートをダウンロードしました');
  } catch (error) {
    Toast.error('レポートのダウンロードに失敗しました');
  }
}

function openAddReportScheduleModal() {
  const modal = createModal('レポートスケジュール追加');

  const form = createEl('form');
  form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

  // Report Type
  const typeGroup = createEl('div', { className: 'form-group' });
  const typeLabel = createEl('label', { textContent: 'レポートタイプ' });
  const typeSelect = createEl('select', { className: 'form-control', id: 'schedule-report-type' });
  [
    { value: 'incident', label: 'インシデントレポート' },
    { value: 'sla', label: 'SLAレポート' },
    { value: 'security', label: 'セキュリティレポート' },
    { value: 'audit', label: '監査レポート' },
    { value: 'compliance', label: 'コンプライアンスレポート' }
  ].forEach((opt) => {
    const option = createEl('option', { value: opt.value, textContent: opt.label });
    typeSelect.appendChild(option);
  });
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeSelect);
  form.appendChild(typeGroup);

  // Frequency
  const freqGroup = createEl('div', { className: 'form-group' });
  const freqLabel = createEl('label', { textContent: '頻度' });
  const freqSelect = createEl('select', { className: 'form-control', id: 'schedule-frequency' });
  [
    { value: 'daily', label: '日次' },
    { value: 'weekly', label: '週次' },
    { value: 'monthly', label: '月次' }
  ].forEach((opt) => {
    const option = createEl('option', { value: opt.value, textContent: opt.label });
    freqSelect.appendChild(option);
  });
  freqGroup.appendChild(freqLabel);
  freqGroup.appendChild(freqSelect);
  form.appendChild(freqGroup);

  // Recipients
  const recipientsGroup = createEl('div', { className: 'form-group' });
  const recipientsLabel = createEl('label', { textContent: '送信先メールアドレス（カンマ区切り）' });
  const recipientsInput = createEl('input', {
    type: 'text',
    className: 'form-control',
    id: 'schedule-recipients',
    placeholder: 'admin@example.com, ops@example.com'
  });
  recipientsGroup.appendChild(recipientsLabel);
  recipientsGroup.appendChild(recipientsInput);
  form.appendChild(recipientsGroup);

  // Enabled checkbox
  const enabledGroup = createEl('div', { className: 'form-group' });
  enabledGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const enabledCheckbox = createEl('input', { type: 'checkbox', id: 'schedule-enabled' });
  enabledCheckbox.checked = true;
  const enabledLabel = createEl('label', { textContent: '有効化' });
  enabledLabel.style.margin = '0';
  enabledGroup.appendChild(enabledCheckbox);
  enabledGroup.appendChild(enabledLabel);
  form.appendChild(enabledGroup);

  modal.body.appendChild(form);

  // Buttons
  const saveBtn = createEl('button', { className: 'btn-primary', textContent: '保存' });
  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const reportType = typeSelect.value;
    const frequency = freqSelect.value;
    const recipients = recipientsInput.value.trim();
    const enabled = enabledCheckbox.checked;

    if (!recipients) {
      Toast.error('送信先メールアドレスを入力してください');
      return;
    }

    try {
      await apiCall('/reports/schedules', 'POST', {
        report_type: reportType,
        frequency,
        recipients,
        enabled
      });
      Toast.success('レポートスケジュールを追加しました');
      closeModal();
      await loadView('settings_reports');
    } catch (error) {
      Toast.error('レポートスケジュールの追加に失敗しました');
    }
  });

  const cancelBtn = createEl('button', { className: 'btn-secondary', textContent: 'キャンセル' });
  cancelBtn.addEventListener('click', () => closeModal());

  modal.footer.appendChild(saveBtn);
  modal.footer.appendChild(cancelBtn);

  showModal();
}

function openEditReportScheduleModal(schedule) {
  const modal = createModal('レポートスケジュール編集');

  const form = createEl('form');
  form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

  // Report Type (read-only)
  const typeGroup = createEl('div', { className: 'form-group' });
  const typeLabel = createEl('label', { textContent: 'レポートタイプ' });
  const typeText = createEl('div', { className: 'form-control', textContent: schedule.report_type });
  typeText.style.cssText = 'background: #f1f5f9; cursor: not-allowed;';
  typeGroup.appendChild(typeLabel);
  typeGroup.appendChild(typeText);
  form.appendChild(typeGroup);

  // Frequency
  const freqGroup = createEl('div', { className: 'form-group' });
  const freqLabel = createEl('label', { textContent: '頻度' });
  const freqSelect = createEl('select', { className: 'form-control', id: 'edit-schedule-frequency' });
  [
    { value: 'daily', label: '日次' },
    { value: 'weekly', label: '週次' },
    { value: 'monthly', label: '月次' }
  ].forEach((opt) => {
    const option = createEl('option', { value: opt.value, textContent: opt.label });
    if (opt.value === schedule.frequency) option.selected = true;
    freqSelect.appendChild(option);
  });
  freqGroup.appendChild(freqLabel);
  freqGroup.appendChild(freqSelect);
  form.appendChild(freqGroup);

  // Recipients
  const recipientsGroup = createEl('div', { className: 'form-group' });
  const recipientsLabel = createEl('label', { textContent: '送信先メールアドレス（カンマ区切り）' });
  const recipientsInput = createEl('input', {
    type: 'text',
    className: 'form-control',
    id: 'edit-schedule-recipients',
    value: schedule.recipients || ''
  });
  recipientsGroup.appendChild(recipientsLabel);
  recipientsGroup.appendChild(recipientsInput);
  form.appendChild(recipientsGroup);

  // Enabled checkbox
  const enabledGroup = createEl('div', { className: 'form-group' });
  enabledGroup.style.cssText = 'display: flex; align-items: center; gap: 8px;';
  const enabledCheckbox = createEl('input', { type: 'checkbox', id: 'edit-schedule-enabled' });
  enabledCheckbox.checked = schedule.enabled;
  const enabledLabel = createEl('label', { textContent: '有効化' });
  enabledLabel.style.margin = '0';
  enabledGroup.appendChild(enabledCheckbox);
  enabledGroup.appendChild(enabledLabel);
  form.appendChild(enabledGroup);

  modal.body.appendChild(form);

  // Buttons
  const saveBtn = createEl('button', { className: 'btn-primary', textContent: '保存' });
  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const frequency = freqSelect.value;
    const recipients = recipientsInput.value.trim();
    const enabled = enabledCheckbox.checked;

    if (!recipients) {
      Toast.error('送信先メールアドレスを入力してください');
      return;
    }

    try {
      await apiCall(`/reports/schedules/${schedule.id}`, 'PUT', {
        frequency,
        recipients,
        enabled
      });
      Toast.success('レポートスケジュールを更新しました');
      closeModal();
      await loadView('settings_reports');
    } catch (error) {
      Toast.error('レポートスケジュールの更新に失敗しました');
    }
  });

  const cancelBtn = createEl('button', { className: 'btn-secondary', textContent: 'キャンセル' });
  cancelBtn.addEventListener('click', () => closeModal());

  modal.footer.appendChild(saveBtn);
  modal.footer.appendChild(cancelBtn);

  showModal();
}

// ===== Integration Settings View =====

async function renderSettingsIntegrations(container) {
  const section = createEl('div');

  // Header
  const header = createEl('div');
  header.style.cssText = 'margin-bottom: 24px;';

  const h2 = createEl('h2', { textContent: '統合設定' });
  header.appendChild(h2);

  section.appendChild(header);

  // 説明セクション
  const explanation = createExplanationSection(
    'Microsoft 365やServiceNowなど、外部システムとの連携設定を管理します。',
    '外部システムとの統合により、データの一元管理と業務効率化を実現します。接続テストと同期実行により、統合の健全性を確認できます。'
  );
  section.appendChild(explanation);

  try {
    // M365統合設定
    const m365Status = await apiCall('/integrations/m365/status');

    const m365Card = createEl('div', { className: 'card-large glass' });
    m365Card.style.padding = '24px';
    m365Card.style.marginBottom = '24px';

    const m365Title = createEl('h3', { textContent: 'Microsoft 365 統合' });
    m365Title.style.marginBottom = '16px';
    m365Card.appendChild(m365Title);

    const m365Grid = createEl('div');
    m365Grid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 24px;';

    // Status info
    const statusDiv = createEl('div');

    const statusItems = [
      { label: '接続ステータス', value: m365Status.connected ? '接続済' : '未接続', isStatus: true },
      { label: 'テナントID', value: m365Status.tenant_id || '-' },
      { label: 'クライアントID', value: m365Status.client_id || '-' },
      { label: '最終同期', value: m365Status.last_sync ? new Date(m365Status.last_sync).toLocaleString('ja-JP') : '-' }
    ];

    statusItems.forEach((item) => {
      const row = createEl('div');
      row.style.cssText = 'margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);';

      const label = createEl('div', { textContent: item.label });
      label.style.cssText = 'font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 4px;';

      const value = createEl('div');
      if (item.isStatus) {
        const badge = createEl('span', {
          className: m365Status.connected ? 'badge badge-success' : 'badge badge-secondary',
          textContent: item.value
        });
        value.appendChild(badge);
      } else {
        setText(value, item.value);
        value.style.cssText = 'font-weight: 600;';
      }

      row.appendChild(label);
      row.appendChild(value);
      statusDiv.appendChild(row);
    });

    m365Grid.appendChild(statusDiv);

    // Actions
    const actionsDiv = createEl('div');
    actionsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    const testBtn = createEl('button', { className: 'btn-secondary', textContent: '接続テスト' });
    testBtn.style.width = '100%';
    testBtn.addEventListener('click', async () => {
      try {
        Toast.info('接続テスト中...');
        await apiCall('/integrations/m365/test', 'POST');
        Toast.success('接続テスト成功');
      } catch (error) {
        Toast.error('接続テスト失敗');
      }
    });
    actionsDiv.appendChild(testBtn);

    const syncBtn = createEl('button', { className: 'btn-primary', textContent: '手動同期実行' });
    syncBtn.style.width = '100%';
    syncBtn.addEventListener('click', async () => {
      try {
        Toast.info('同期を開始しました...');
        await apiCall('/integrations/m365/sync', 'POST');
        Toast.success('同期が完了しました');
        await loadView('settings_integrations');
      } catch (error) {
        Toast.error('同期に失敗しました');
      }
    });
    actionsDiv.appendChild(syncBtn);

    const configBtn = createEl('button', { className: 'btn-secondary', textContent: '設定変更' });
    configBtn.style.width = '100%';
    configBtn.addEventListener('click', () => openM365ConfigModal(m365Status));
    actionsDiv.appendChild(configBtn);

    m365Grid.appendChild(actionsDiv);
    m365Card.appendChild(m365Grid);
    section.appendChild(m365Card);

    // ServiceNow統合設定
    const snowStatus = await apiCall('/integrations/servicenow/status');

    const snowCard = createEl('div', { className: 'card-large glass' });
    snowCard.style.padding = '24px';

    const snowTitle = createEl('h3', { textContent: 'ServiceNow 統合' });
    snowTitle.style.marginBottom = '16px';
    snowCard.appendChild(snowTitle);

    const snowGrid = createEl('div');
    snowGrid.style.cssText = 'display: grid; grid-template-columns: 1fr 1fr; gap: 24px;';

    // Status info
    const snowStatusDiv = createEl('div');

    const snowStatusItems = [
      { label: '接続ステータス', value: snowStatus.connected ? '接続済' : '未接続', isStatus: true },
      { label: 'インスタンスURL', value: snowStatus.instance_url || '-' },
      { label: 'ユーザー名', value: snowStatus.username || '-' },
      { label: '最終同期', value: snowStatus.last_sync ? new Date(snowStatus.last_sync).toLocaleString('ja-JP') : '-' }
    ];

    snowStatusItems.forEach((item) => {
      const row = createEl('div');
      row.style.cssText = 'margin-bottom: 12px; padding-bottom: 12px; border-bottom: 1px solid var(--border-color);';

      const label = createEl('div', { textContent: item.label });
      label.style.cssText = 'font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 4px;';

      const value = createEl('div');
      if (item.isStatus) {
        const badge = createEl('span', {
          className: snowStatus.connected ? 'badge badge-success' : 'badge badge-secondary',
          textContent: item.value
        });
        value.appendChild(badge);
      } else {
        setText(value, item.value);
        value.style.cssText = 'font-weight: 600;';
      }

      row.appendChild(label);
      row.appendChild(value);
      snowStatusDiv.appendChild(row);
    });

    snowGrid.appendChild(snowStatusDiv);

    // Actions
    const snowActionsDiv = createEl('div');
    snowActionsDiv.style.cssText = 'display: flex; flex-direction: column; gap: 12px;';

    const snowTestBtn = createEl('button', { className: 'btn-secondary', textContent: '接続テスト' });
    snowTestBtn.style.width = '100%';
    snowTestBtn.addEventListener('click', async () => {
      try {
        Toast.info('接続テスト中...');
        await apiCall('/integrations/servicenow/test', 'POST');
        Toast.success('接続テスト成功');
      } catch (error) {
        Toast.error('接続テスト失敗');
      }
    });
    snowActionsDiv.appendChild(snowTestBtn);

    const snowSyncBtn = createEl('button', { className: 'btn-primary', textContent: '手動同期実行' });
    snowSyncBtn.style.width = '100%';
    snowSyncBtn.addEventListener('click', async () => {
      try {
        Toast.info('同期を開始しました...');
        await apiCall('/integrations/servicenow/sync', 'POST');
        Toast.success('同期が完了しました');
        await loadView('settings_integrations');
      } catch (error) {
        Toast.error('同期に失敗しました');
      }
    });
    snowActionsDiv.appendChild(snowSyncBtn);

    const snowConfigBtn = createEl('button', { className: 'btn-secondary', textContent: '設定変更' });
    snowConfigBtn.style.width = '100%';
    snowConfigBtn.addEventListener('click', () => openServiceNowConfigModal(snowStatus));
    snowActionsDiv.appendChild(snowConfigBtn);

    snowGrid.appendChild(snowActionsDiv);
    snowCard.appendChild(snowGrid);
    section.appendChild(snowCard);
  } catch (error) {
    console.error('Error loading integration settings:', error);
    renderError(section, '統合設定の読み込みに失敗しました');
  }

  container.appendChild(section);
}

function openM365ConfigModal(currentConfig) {
  const modal = createModal('Microsoft 365 設定');

  const form = createEl('form');
  form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

  // Tenant ID
  const tenantGroup = createEl('div', { className: 'form-group' });
  const tenantLabel = createEl('label', { textContent: 'テナントID' });
  const tenantInput = createEl('input', {
    type: 'text',
    className: 'form-control',
    id: 'm365-tenant-id',
    value: currentConfig.tenant_id || ''
  });
  tenantGroup.appendChild(tenantLabel);
  tenantGroup.appendChild(tenantInput);
  form.appendChild(tenantGroup);

  // Client ID
  const clientGroup = createEl('div', { className: 'form-group' });
  const clientLabel = createEl('label', { textContent: 'クライアントID' });
  const clientInput = createEl('input', {
    type: 'text',
    className: 'form-control',
    id: 'm365-client-id',
    value: currentConfig.client_id || ''
  });
  clientGroup.appendChild(clientLabel);
  clientGroup.appendChild(clientInput);
  form.appendChild(clientGroup);

  // Client Secret
  const secretGroup = createEl('div', { className: 'form-group' });
  const secretLabel = createEl('label', { textContent: 'クライアントシークレット' });
  const secretInput = createEl('input', {
    type: 'password',
    className: 'form-control',
    id: 'm365-client-secret',
    placeholder: '変更する場合のみ入力'
  });
  secretGroup.appendChild(secretLabel);
  secretGroup.appendChild(secretInput);
  form.appendChild(secretGroup);

  modal.body.appendChild(form);

  // Buttons
  const saveBtn = createEl('button', { className: 'btn-primary', textContent: '保存' });
  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const tenantId = tenantInput.value.trim();
    const clientId = clientInput.value.trim();
    const clientSecret = secretInput.value.trim();

    if (!tenantId || !clientId) {
      Toast.error('テナントIDとクライアントIDを入力してください');
      return;
    }

    try {
      const payload = { tenant_id: tenantId, client_id: clientId };
      if (clientSecret) {
        payload.client_secret = clientSecret;
      }

      await apiCall('/integrations/m365/config', 'PUT', payload);
      Toast.success('Microsoft 365設定を更新しました');
      closeModal();
      await loadView('settings_integrations');
    } catch (error) {
      Toast.error('設定の更新に失敗しました');
    }
  });

  const cancelBtn = createEl('button', { className: 'btn-secondary', textContent: 'キャンセル' });
  cancelBtn.addEventListener('click', () => closeModal());

  modal.footer.appendChild(saveBtn);
  modal.footer.appendChild(cancelBtn);

  showModal();
}

function openServiceNowConfigModal(currentConfig) {
  const modal = createModal('ServiceNow 設定');

  const form = createEl('form');
  form.style.cssText = 'display: flex; flex-direction: column; gap: 16px;';

  // Instance URL
  const urlGroup = createEl('div', { className: 'form-group' });
  const urlLabel = createEl('label', { textContent: 'インスタンスURL' });
  const urlInput = createEl('input', {
    type: 'text',
    className: 'form-control',
    id: 'snow-instance-url',
    value: currentConfig.instance_url || '',
    placeholder: 'https://your-instance.service-now.com'
  });
  urlGroup.appendChild(urlLabel);
  urlGroup.appendChild(urlInput);
  form.appendChild(urlGroup);

  // Username
  const userGroup = createEl('div', { className: 'form-group' });
  const userLabel = createEl('label', { textContent: 'ユーザー名' });
  const userInput = createEl('input', {
    type: 'text',
    className: 'form-control',
    id: 'snow-username',
    value: currentConfig.username || ''
  });
  userGroup.appendChild(userLabel);
  userGroup.appendChild(userInput);
  form.appendChild(userGroup);

  // Password
  const passGroup = createEl('div', { className: 'form-group' });
  const passLabel = createEl('label', { textContent: 'パスワード' });
  const passInput = createEl('input', {
    type: 'password',
    className: 'form-control',
    id: 'snow-password',
    placeholder: '変更する場合のみ入力'
  });
  passGroup.appendChild(passLabel);
  passGroup.appendChild(passInput);
  form.appendChild(passGroup);

  modal.body.appendChild(form);

  // Buttons
  const saveBtn = createEl('button', { className: 'btn-primary', textContent: '保存' });
  saveBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const instanceUrl = urlInput.value.trim();
    const username = userInput.value.trim();
    const password = passInput.value.trim();

    if (!instanceUrl || !username) {
      Toast.error('インスタンスURLとユーザー名を入力してください');
      return;
    }

    try {
      const payload = { instance_url: instanceUrl, username };
      if (password) {
        payload.password = password;
      }

      await apiCall('/integrations/servicenow/config', 'PUT', payload);
      Toast.success('ServiceNow設定を更新しました');
      closeModal();
      await loadView('settings_integrations');
    } catch (error) {
      Toast.error('設定の更新に失敗しました');
    }
  });

  const cancelBtn = createEl('button', { className: 'btn-secondary', textContent: 'キャンセル' });
  cancelBtn.addEventListener('click', () => closeModal());

  modal.footer.appendChild(saveBtn);
  modal.footer.appendChild(cancelBtn);

  showModal();
}

// ========================================
// アクセシビリティ: キーボードナビゲーション機能
// ========================================

/**
 * グローバルキーボードイベントハンドラー
 * - Escキー: モーダルを閉じる
 * - Tabキー: フォーカストラップ（モーダル内）
 */
document.addEventListener('keydown', (event) => {
  const modalOverlay = document.getElementById('modal-overlay');
  const isModalOpen = modalOverlay && modalOverlay.style.display !== 'none';

  // Escキーでモーダルを閉じる
  if (event.key === 'Escape' && isModalOpen) {
    event.preventDefault();
    closeModal();
    return;
  }

  // モーダル内でのフォーカストラップ
  if (event.key === 'Tab' && isModalOpen) {
    const modalContainer = document.getElementById('modal-container');
    if (!modalContainer) return;

    const focusableElements = modalContainer.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // Shift+Tab: 最初の要素から前に戻ろうとしたら最後の要素へ
      if (document.activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    } else {
      // Tab: 最後の要素から次に進もうとしたら最初の要素へ
      if (document.activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
      }
    }
  }
});

/**
 * サイドバートグルのaria-expanded属性を更新
 */
const sidebarToggle = document.getElementById('sidebar-toggle');
const sidebar = document.querySelector('.sidebar');
if (sidebarToggle && sidebar) {
  sidebarToggle.addEventListener('click', () => {
    const isExpanded = sidebarToggle.getAttribute('aria-expanded') === 'true';
    sidebarToggle.setAttribute('aria-expanded', !isExpanded);
  });
}

/**
 * ナビゲーション項目のaria-current属性を更新
 */
function updateNavigationAriaCurrent(activeView) {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach((item) => {
    const viewName = item.getAttribute('data-view');
    if (viewName === activeView) {
      item.setAttribute('aria-current', 'page');
      item.classList.add('active');
    } else {
      item.removeAttribute('aria-current');
      item.classList.remove('active');
    }
  });
}

/**
 * フォーカス管理: モーダル表示時に最初のフォーカス可能要素にフォーカス
 */
let lastFocusedElement = null;

const originalShowModal = window.showModal;
if (typeof originalShowModal === 'function') {
  window.showModal = function () {
    // 現在のフォーカス要素を保存
    lastFocusedElement = document.activeElement;

    // 元のshowModal関数を実行
    originalShowModal.apply(this, arguments);

    // モーダル内の最初のフォーカス可能要素にフォーカス
    setTimeout(() => {
      const modalContainer = document.getElementById('modal-container');
      if (modalContainer) {
        const firstFocusable = modalContainer.querySelector(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (firstFocusable) {
          firstFocusable.focus();
        }
      }
    }, 100);
  };
}

const originalCloseModal = window.closeModal;
if (typeof originalCloseModal === 'function') {
  window.closeModal = function () {
    // 元のcloseModal関数を実行
    originalCloseModal.apply(this, arguments);

    // フォーカスを元の要素に戻す
    if (lastFocusedElement) {
      setTimeout(() => {
        lastFocusedElement.focus();
        lastFocusedElement = null;
      }, 100);
    }
  };
}

/**
 * ライブリージョン通知機能
 * 動的なコンテンツ変更をスクリーンリーダーに通知
 */
function announceToScreenReader(message, priority = 'polite') {
  const liveRegion =
    document.getElementById('a11y-live-region') || createLiveRegion();
  liveRegion.setAttribute('aria-live', priority);
  liveRegion.textContent = message;

  // メッセージをクリア（次の通知のため）
  setTimeout(() => {
    liveRegion.textContent = '';
  }, 1000);
}

function createLiveRegion() {
  const region = document.createElement('div');
  region.id = 'a11y-live-region';
  region.className = 'visually-hidden';
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'true');
  document.body.appendChild(region);
  return region;
}

// Toast通知時にスクリーンリーダーにも通知
const originalToastSuccess = Toast.success;
Toast.success = function (message, duration) {
  announceToScreenReader(message, 'polite');
  return originalToastSuccess.call(this, message, duration);
};

const originalToastError = Toast.error;
Toast.error = function (message, duration) {
  announceToScreenReader(message, 'assertive');
  return originalToastError.call(this, message, duration);
};

console.log('[Accessibility] キーボードナビゲーション機能を初期化しました');
