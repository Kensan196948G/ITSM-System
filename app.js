/**
 * ITSM-Sec Nexus - Secure Application Logic
 * XSS Protection: No innerHTML usage, DOM API only
 */

// ===== Configuration =====
// 自動的にホスト名を検出（IPアドレスまたはlocalhost）
const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:5000/api/v1'
  : `http://${window.location.hostname}:5000/api/v1`;

const TOKEN_KEY = 'itsm_auth_token';
const USER_KEY = 'itsm_user_info';

console.log('API Base URL:', API_BASE);

// ===== Authentication State =====
let currentUser = null;
let authToken = null;

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
  while (el.firstChild) {
    el.removeChild(el.firstChild);
  }
}

function setText(el, text) {
  el.textContent = text;
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
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      handleUnauthorized();
      throw new Error('認証が必要です');
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
}

async function login(username, password) {
  try {
    const data = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    }).then((res) => {
      if (!res.ok) {
        throw new Error('ログインに失敗しました');
      }
      return res.json();
    });

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

function logout() {
  authToken = null;
  currentUser = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  showLoginScreen();
}

function checkAuth() {
  const token = localStorage.getItem(TOKEN_KEY);
  const userStr = localStorage.getItem(USER_KEY);

  if (token && userStr) {
    authToken = token;
    currentUser = JSON.parse(userStr);
    showApp();
    updateUserInfo();
    return true;
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
    knowledge: 'ナレッジ管理',
    capacity: 'キャパシティ管理',
    security: 'セキュリティ管理',
    settings_general: 'システム基本設定',
    settings_users: 'ユーザー・権限管理',
    settings_notifications: '通知・アラート設定'
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
      case 'changes':
        await renderChanges(container);
        break;
      case 'cmdb':
        await renderCMDB(container);
        break;
      case 'security':
        await renderSecurity(container);
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
    const data = await apiCall('/dashboard/kpi');

    const grid = createEl('div', { className: 'grid' });

    // KPI Cards
    const cards = [
      {
        icon: 'fa-ticket',
        value: data.active_incidents,
        label: '有効なインシデント',
        color: 'rgba(79, 70, 229, 0.1)',
        iconColor: 'var(--accent-blue)'
      },
      {
        icon: 'fa-check-double',
        value: `${data.sla_compliance}%`,
        label: 'SLA達成率',
        color: 'rgba(16, 185, 129, 0.1)',
        iconColor: 'var(--accent-green)'
      },
      {
        icon: 'fa-radiation',
        value: data.vulnerabilities.critical,
        label: '未対策の重要脆弱性',
        color: 'rgba(244, 63, 94, 0.1)',
        iconColor: 'var(--accent-red)'
      },
      {
        icon: 'fa-shield-virus',
        value: `${data.csf_progress.govern}%`,
        label: 'GOVERN進捗率',
        color: 'rgba(245, 158, 11, 0.1)',
        iconColor: 'var(--accent-orange)'
      }
    ];

    cards.forEach((card) => {
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

      grid.appendChild(cardEl);
    });

    container.appendChild(grid);

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
      { label: 'GOVERN (統治)', value: data.csf_progress.govern, color: '#4f46e5' },
      { label: 'IDENTIFY (識別)', value: data.csf_progress.identify, color: '#0284c7' },
      { label: 'PROTECT (保護)', value: data.csf_progress.protect, color: '#059669' },
      { label: 'DETECT (検知)', value: data.csf_progress.detect, color: '#dc2626' },
      { label: 'RESPOND (対応)', value: data.csf_progress.respond, color: '#ea580c' },
      { label: 'RECOVER (復旧)', value: data.csf_progress.recover, color: '#7c3aed' }
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
  } catch (error) {
    renderError(container, 'ダッシュボードデータの読み込みに失敗しました');
  }
}

// ===== Incidents View =====

async function renderIncidents(container) {
  try {
    const incidents = await apiCall('/incidents');

    const section = createEl('div');

    // Header with Create Button
    const header = createEl('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: 'インシデント一覧' });
    const createBtn = createEl('button', {
      className: 'btn-primary',
      textContent: '新規インシデント作成'
    });
    createBtn.addEventListener('click', () => showCreateIncidentModal());

    header.appendChild(h2);
    header.appendChild(createBtn);
    section.appendChild(header);

    // Table
    const table = createEl('table', { className: 'data-table' });

    // Table Header
    const thead = createEl('thead');
    const headerRow = createEl('tr');
    ['チケットID', 'タイトル', '優先度', 'ステータス', 'セキュリティ', '作成日時'].forEach((text) => {
      headerRow.appendChild(createEl('th', { textContent: text }));
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    // Table Body
    const tbody = createEl('tbody');
    incidents.forEach((inc) => {
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

      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    section.appendChild(table);
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'インシデントデータの読み込みに失敗しました');
  }
}

function showIncidentDetail(incident) {
  alert(
    `インシデント詳細: ${incident.ticket_id}\nタイトル: ${incident.title}\n\n詳細モーダル機能は次のフェーズで実装予定`
  );
}

function showCreateIncidentModal() {
  alert('インシデント作成モーダルは次のフェーズで実装予定');
}

// ===== Changes View =====

async function renderChanges(container) {
  try {
    const changes = await apiCall('/changes');

    const section = createEl('div');

    // Header
    const header = createEl('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: '変更要求一覧 (RFC)' });
    const createBtn = createEl('button', { className: 'btn-primary', textContent: '新規RFC作成' });
    createBtn.addEventListener('click', () => alert('RFC作成モーダルは次のフェーズで実装予定'));

    header.appendChild(h2);
    header.appendChild(createBtn);
    section.appendChild(header);

    // Table
    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    ['RFC ID', 'タイトル', 'ステータス', '影響度', '申請者', '承認者', '作成日'].forEach((text) => {
      headerRow.appendChild(createEl('th', { textContent: text }));
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    changes.forEach((change) => {
      const row = createEl('tr');

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

    section.appendChild(table);
    container.appendChild(section);
  } catch (error) {
    renderError(container, '変更要求データの読み込みに失敗しました');
  }
}

// ===== CMDB View =====

async function renderCMDB(container) {
  try {
    const assets = await apiCall('/assets');

    const section = createEl('div');

    const h2 = createEl('h2', { textContent: '構成管理データベース (CMDB)' });
    h2.style.marginBottom = '24px';
    section.appendChild(h2);

    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    ['資産タグ', '名称', 'タイプ', '重要度', 'ステータス', '最終更新'].forEach((text) => {
      headerRow.appendChild(createEl('th', { textContent: text }));
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    assets.forEach((asset) => {
      const row = createEl('tr');

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

    section.appendChild(table);
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'CMDB データの読み込みに失敗しました');
  }
}

// ===== Security View (NIST CSF 2.0) =====

async function renderSecurity(container) {
  const section = createEl('div');

  const h2 = createEl('h2', { textContent: 'NIST CSF 2.0 セキュリティ管理' });
  h2.style.marginBottom = '24px';
  section.appendChild(h2);

  const infoCard = createEl('div', { className: 'card glass' });
  infoCard.style.padding = '24px';
  infoCard.style.background = 'white';

  const p = createEl('p', {
    textContent:
      'NIST CSF 2.0の6つの機能（GOVERN, IDENTIFY, PROTECT, DETECT, RESPOND, RECOVER）に基づくセキュリティ管理を実施します。'
  });
  p.style.marginBottom = '16px';
  infoCard.appendChild(p);

  const ul = createEl('ul');
  ul.style.listStyle = 'disc';
  ul.style.paddingLeft = '24px';

  const functions = [
    'GOVERN (統治): 組織のサイバーセキュリティリスク管理戦略',
    'IDENTIFY (識別): 資産、脆弱性、リスクの特定',
    'PROTECT (保護): 適切なセーフガードの実装',
    'DETECT (検知): サイバーセキュリティイベントの検出',
    'RESPOND (対応): インシデントへの対応アクション',
    'RECOVER (復旧): サービスの復旧とレジリエンス'
  ];

  functions.forEach((text) => {
    ul.appendChild(createEl('li', { textContent: text }));
  });

  infoCard.appendChild(ul);
  section.appendChild(infoCard);
  container.appendChild(section);
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

document.addEventListener('DOMContentLoaded', () => {
  // Check authentication
  checkAuth();

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
        errorEl.style.display = 'block';
        setText(errorEl, result.error || 'ログインに失敗しました');
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
});
