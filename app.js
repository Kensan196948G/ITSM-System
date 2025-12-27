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
  // eslint-disable-next-line no-param-reassign
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
      case 'knowledge':
        await renderKnowledge(container);
        break;
      case 'capacity':
        await renderCapacity(container);
        break;
      case 'security':
        await renderSecurity(container);
        break;
      case 'settings_general':
        renderSettingsGeneral(container);
        break;
      case 'settings_users':
        renderSettingsUsers(container);
        break;
      case 'settings_notifications':
        renderSettingsNotifications(container);
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

    // Charts Section
    await renderDashboardCharts(container, data);
  } catch (error) {
    renderError(container, 'ダッシュボードデータの読み込みに失敗しました');
  }
}

// ===== Dashboard Charts (Chart.js) =====

async function renderDashboardCharts(container, dashboardData) {
  try {
    // Fetch additional data for charts
    const incidents = await apiCall('/incidents');

    // Charts Container
    const chartsSection = createEl('div', { className: 'charts-section' });
    chartsSection.style.marginTop = '24px';
    chartsSection.style.display = 'grid';
    chartsSection.style.gridTemplateColumns = 'repeat(auto-fit, minmax(500px, 1fr))';
    chartsSection.style.gap = '24px';

    // Chart 1: Incident Trend (Line Chart)
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

    // Generate dummy data for last 7 days
    const last7Days = [];
    const incidentCounts = [];
    // eslint-disable-next-line no-plusplus
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push(`${date.getMonth() + 1}/${date.getDate()}`);
      incidentCounts.push(Math.floor(Math.random() * 15) + 5);
    }

    // eslint-disable-next-line no-new
    new Chart(canvasTrend, {
      type: 'line',
      data: {
        labels: last7Days,
        datasets: [
          {
            label: 'インシデント発生数',
            data: incidentCounts,
            borderColor: '#4f46e5',
            backgroundColor: 'rgba(79, 70, 229, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#4f46e5'
          }
        ]
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

    // Chart 2: Priority Distribution (Pie Chart)
    const priorityCard = createEl('div', { className: 'card-large glass' });
    priorityCard.style.padding = '24px';
    priorityCard.style.borderRadius = '24px';
    priorityCard.style.background = 'white';

    const h3Priority = createEl('h3', { textContent: '優先度別分布' });
    h3Priority.style.marginBottom = '16px';
    priorityCard.appendChild(h3Priority);

    const canvasPriority = createEl('canvas');
    canvasPriority.style.maxHeight = '300px';
    priorityCard.appendChild(canvasPriority);

    // Count priorities from incidents data
    const priorityCounts = {
      Critical: 0,
      High: 0,
      Medium: 0,
      Low: 0
    };
    incidents.forEach((inc) => {
      if (Object.prototype.hasOwnProperty.call(priorityCounts, inc.priority)) {
        priorityCounts[inc.priority] += 1;
      }
    });

    // eslint-disable-next-line no-new
    new Chart(canvasPriority, {
      type: 'pie',
      data: {
        labels: ['Critical', 'High', 'Medium', 'Low'],
        datasets: [
          {
            label: 'インシデント数',
            data: [
              priorityCounts.Critical,
              priorityCounts.High,
              priorityCounts.Medium,
              priorityCounts.Low
            ],
            backgroundColor: ['#dc2626', '#ea580c', '#eab308', '#16a34a'],
            borderWidth: 2,
            borderColor: '#fff'
          }
        ]
      },
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

    chartsSection.appendChild(priorityCard);

    // Chart 3: SLA Achievement Trend (Bar Chart)
    const slaCard = createEl('div', { className: 'card-large glass' });
    slaCard.style.padding = '24px';
    slaCard.style.borderRadius = '24px';
    slaCard.style.background = 'white';

    const h3Sla = createEl('h3', { textContent: 'SLA達成率推移（過去6ヶ月）' });
    h3Sla.style.marginBottom = '16px';
    slaCard.appendChild(h3Sla);

    const canvasSla = createEl('canvas');
    canvasSla.style.maxHeight = '300px';
    slaCard.appendChild(canvasSla);

    // Generate dummy data for last 6 months
    const last6Months = [];
    const slaRates = [];
    // eslint-disable-next-line no-plusplus
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      last6Months.push(`${date.getFullYear()}/${date.getMonth() + 1}`);
      slaRates.push(Math.floor(Math.random() * 15) + 85);
    }

    // eslint-disable-next-line no-new
    new Chart(canvasSla, {
      type: 'bar',
      data: {
        labels: last6Months,
        datasets: [
          {
            label: 'SLA達成率 (%)',
            data: slaRates,
            backgroundColor: '#16a34a',
            borderColor: '#15803d',
            borderWidth: 1
          }
        ]
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
            beginAtZero: false,
            min: 70,
            max: 100,
            ticks: {
              callback(value) {
                return `${value}%`;
              }
            }
          }
        }
      }
    });

    chartsSection.appendChild(slaCard);

    // Chart 4: CSF Progress (Radar Chart)
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
  } catch (error) {
    console.error('Charts rendering error:', error);
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
    header.style.alignItems = 'center';
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: 'インシデント一覧' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '12px';

    const createBtn = createEl('button', {
      className: 'btn-primary',
      textContent: '新規インシデント作成'
    });
    createBtn.addEventListener('click', () => showCreateIncidentModal());

    const exportBtn = createEl('button', {
      className: 'btn-export'
    });
    exportBtn.innerHTML = '<i class="fas fa-download"></i> CSVエクスポート';
    exportBtn.addEventListener('click', () => {
      exportToCSV(incidents, 'incidents.csv');
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(exportBtn);
    header.appendChild(btnGroup);
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
  openIncidentDetailModal(incident);
}

function showCreateIncidentModal() {
  openCreateIncidentModal();
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
    header.style.alignItems = 'center';
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: '変更要求一覧 (RFC)' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '12px';

    const createBtn = createEl('button', { className: 'btn-primary', textContent: '新規RFC作成' });
    createBtn.addEventListener('click', () => openCreateRFCModal());

    const exportBtn = createEl('button', {
      className: 'btn-export'
    });
    exportBtn.innerHTML = '<i class="fas fa-download"></i> CSVエクスポート';
    exportBtn.addEventListener('click', () => {
      exportToCSV(changes, 'changes.csv');
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(exportBtn);
    header.appendChild(btnGroup);
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

    const header = createEl('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: '構成管理データベース (CMDB)' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '12px';

    const createBtn = createEl('button', {
      className: 'btn-primary',
      textContent: '新規作成'
    });
    createBtn.addEventListener('click', openCreateAssetModal);

    const exportBtn = createEl('button', {
      className: 'btn-export'
    });
    exportBtn.innerHTML = '<i class="fas fa-download"></i> CSVエクスポート';
    exportBtn.addEventListener('click', () => {
      exportToCSV(assets, 'cmdb_assets.csv');
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(exportBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

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

    section.appendChild(table);
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'CMDB データの読み込みに失敗しました');
  }
}

// ===== Security View (NIST CSF 2.0) =====

async function renderSecurity(container) {
  try {
    const vulnerabilities = await apiCall('/vulnerabilities');

    const section = createEl('div');

    const h2 = createEl('h2', { textContent: 'NIST CSF 2.0 セキュリティ管理 / 脆弱性管理' });
    h2.style.marginBottom = '24px';
    section.appendChild(h2);

    const infoCard = createEl('div', { className: 'card glass' });
    infoCard.style.padding = '24px';
    infoCard.style.background = 'white';
    infoCard.style.marginBottom = '24px';

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

    // Vulnerabilities Table
    const tableHeader = createEl('div');
    tableHeader.style.display = 'flex';
    tableHeader.style.justifyContent = 'space-between';
    tableHeader.style.alignItems = 'center';
    tableHeader.style.marginBottom = '16px';

    const h3 = createEl('h3', { textContent: '脆弱性管理' });
    tableHeader.appendChild(h3);

    const btnGroup = createEl('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '12px';

    const createBtn = createEl('button', {
      className: 'btn-primary',
      textContent: '新規作成'
    });
    createBtn.addEventListener('click', () => openCreateVulnerabilityModal());

    const exportBtn = createEl('button', {
      className: 'btn-export'
    });
    exportBtn.innerHTML = '<i class="fas fa-download"></i> CSVエクスポート';
    exportBtn.addEventListener('click', () => {
      exportToCSV(vulnerabilities, 'vulnerabilities.csv');
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(exportBtn);
    tableHeader.appendChild(btnGroup);
    section.appendChild(tableHeader);

    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    ['脆弱性ID', 'タイトル', '深刻度', 'CVSSスコア', '影響資産', 'ステータス', '検出日'].forEach(
      (text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      }
    );
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    vulnerabilities.forEach((vuln) => {
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

      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    section.appendChild(table);
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'セキュリティデータの読み込みに失敗しました');
  }
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
    alert('タイトルを入力してください');
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

    alert('インシデントを更新しました');
    closeModal();
    loadView('incidents');
  } catch (error) {
    alert(`エラー: ${error.message}`);
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
    alert('タイトルと説明を入力してください');
    return;
  }

  try {
    await apiCall('/incidents', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    alert('インシデントを作成しました');
    closeModal();
    loadView('incidents');
  } catch (error) {
    alert(`エラー: ${error.message}`);
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
    alert('タイトルを入力してください');
    return;
  }

  alert(
    `問題管理APIは未実装です。以下のデータが送信される予定です:\n\n${JSON.stringify(data, null, 2)}`
  );
}

// ===== Create RFC Modal =====

async function openCreateRFCModal() {
  const modal = document.getElementById('modal-overlay');
  const modalTitle = document.getElementById('modal-title');
  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  setText(modalTitle, 'RFC新規作成');
  clearElement(modalBody);
  clearElement(modalFooter);

  // Fetch assets for selection
  let assets = [];
  try {
    assets = await apiCall('/assets');
  } catch (error) {
    console.error('Failed to load assets:', error);
  }

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
  assets.forEach((asset) => {
    assetSelect.appendChild(
      createEl('option', { value: asset.id, textContent: `${asset.asset_tag} - ${asset.name}` })
    );
  });
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
}

async function saveNewRFC() {
  const title = document.getElementById('rfc-title').value.trim();
  const description = document.getElementById('rfc-description').value.trim();
  const assetId = document.getElementById('rfc-asset').value;
  const impactLevel = document.getElementById('rfc-impact').value;
  const requester = document.getElementById('rfc-requester').value.trim();
  const isSecurityChange = document.getElementById('rfc-security').checked;

  if (!title || !description) {
    alert('タイトルと説明を入力してください');
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

    alert('RFCを作成しました');
    closeModal();
    loadView('changes');
  } catch (error) {
    alert(`エラー: ${error.message}`);
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
    assets = await apiCall('/assets');
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
  assetSelect.appendChild(createEl('option', { value: '', textContent: '選択してください' }));
  assets.forEach((asset) => {
    assetSelect.appendChild(
      createEl('option', {
        value: asset.asset_tag,
        textContent: `${asset.asset_tag} - ${asset.name}`
      })
    );
  });
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
    alert('タイトルを入力してください');
    return;
  }

  alert(
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
    alert('リリース名とバージョンを入力してください');
    return;
  }

  try {
    await apiCall('/releases', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    alert('リリースを作成しました');
    closeModal();
    loadView('releases');
  } catch (error) {
    alert(`エラー: ${error.message}`);
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
    alert('タイトルと説明を入力してください');
    return;
  }

  try {
    await apiCall('/service-requests', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    alert('サービス要求を作成しました');
    closeModal();
    loadView('service-requests');
  } catch (error) {
    alert(`エラー: ${error.message}`);
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
    alert('資産タグと名称を入力してください');
    return;
  }

  try {
    await apiCall('/assets', {
      method: 'POST',
      body: JSON.stringify(data)
    });

    alert('資産を登録しました');
    closeModal();
    loadView('cmdb');
  } catch (error) {
    alert(`エラー: ${error.message}`);
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

    alert(`RFCを${status === 'Approved' ? '承認' : '却下'}しました`);
    closeModal();
    loadView('changes');
  } catch (error) {
    alert(`エラー: ${error.message}`);
  }
}

// ===== Problems View =====

async function renderProblems(container) {
  try {
    const problems = await apiCall('/problems');

    const section = createEl('div');

    const header = createEl('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: '問題管理・根本原因分析' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '12px';

    const createBtn = createEl('button', {
      className: 'btn-primary',
      textContent: '新規作成'
    });
    createBtn.addEventListener('click', () => openCreateProblemModal());

    const exportBtn = createEl('button', {
      className: 'btn-export'
    });
    exportBtn.innerHTML = '<i class="fas fa-download"></i> CSVエクスポート';
    exportBtn.addEventListener('click', () => {
      exportToCSV(problems, 'problems.csv');
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(exportBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    ['問題ID', 'タイトル', '関連インシデント', 'ステータス', '優先度', '担当者', '作成日'].forEach(
      (text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      }
    );
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    problems.forEach((problem) => {
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

    section.appendChild(table);
    container.appendChild(section);
  } catch (error) {
    renderError(container, '問題管理データの読み込みに失敗しました');
  }
}

// ===== Releases View =====

async function renderReleases(container) {
  try {
    const releases = await apiCall('/releases');

    const section = createEl('div');

    const header = createEl('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: 'リリースパッケージ・展開状況' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '12px';

    const createBtn = createEl('button', {
      className: 'btn-primary',
      textContent: '新規作成'
    });
    createBtn.addEventListener('click', openCreateReleaseModal);

    const exportBtn = createEl('button', {
      className: 'btn-export'
    });
    exportBtn.innerHTML = '<i class="fas fa-download"></i> CSVエクスポート';
    exportBtn.addEventListener('click', () => {
      exportToCSV(releases, 'releases.csv');
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(exportBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    [
      'リリースID',
      'リリース名',
      'バージョン',
      'ステータス',
      '変更数',
      '対象環境',
      'リリース日',
      '進捗'
    ].forEach((text) => {
      headerRow.appendChild(createEl('th', { textContent: text }));
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    releases.forEach((release) => {
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
        createEl('td', { textContent: new Date(release.release_date).toLocaleDateString('ja-JP') })
      );
      row.appendChild(createEl('td', { textContent: `${release.progress}%` }));

      tbody.appendChild(row);
    });
    table.appendChild(tbody);

    section.appendChild(table);
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'リリース管理データの読み込みに失敗しました');
  }
}

// ===== Service Requests View =====

async function renderServiceRequests(container) {
  try {
    const requests = await apiCall('/service-requests');

    const section = createEl('div');

    const header = createEl('div');
    header.style.display = 'flex';
    header.style.justifyContent = 'space-between';
    header.style.alignItems = 'center';
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: 'サービス要求・申請一覧' });
    header.appendChild(h2);

    const btnGroup = createEl('div');
    btnGroup.style.display = 'flex';
    btnGroup.style.gap = '12px';

    const createBtn = createEl('button', {
      className: 'btn-primary',
      textContent: '新規作成'
    });
    createBtn.addEventListener('click', openCreateServiceRequestModal);

    const exportBtn = createEl('button', {
      className: 'btn-export'
    });
    exportBtn.innerHTML = '<i class="fas fa-download"></i> CSVエクスポート';
    exportBtn.addEventListener('click', () => {
      exportToCSV(requests, 'service_requests.csv');
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(exportBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    ['要求ID', '要求タイプ', 'タイトル', '申請者', 'ステータス', '優先度', '申請日'].forEach(
      (text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      }
    );
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    requests.forEach((request) => {
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

    section.appendChild(table);
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'サービス要求データの読み込みに失敗しました');
  }
}

// ===== SLA Management View =====

async function renderSLAManagement(container) {
  try {
    const slaAgreements = await apiCall('/sla-agreements');

    const section = createEl('div');

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

    const exportBtn = createEl('button', {
      className: 'btn-export'
    });
    exportBtn.innerHTML = '<i class="fas fa-download"></i> CSVエクスポート';
    exportBtn.addEventListener('click', () => {
      exportToCSV(slaAgreements, 'sla_agreements.csv');
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(exportBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    [
      'SLA ID',
      'サービス名',
      'メトリクス',
      '目標値',
      '実績値',
      '達成率',
      '測定期間',
      'ステータス'
    ].forEach((text) => {
      headerRow.appendChild(createEl('th', { textContent: text }));
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    slaAgreements.forEach((sla) => {
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

    section.appendChild(table);
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'SLA管理データの読み込みに失敗しました');
  }
}

// ===== Knowledge Management View =====

async function renderKnowledge(container) {
  try {
    const articles = await apiCall('/knowledge-articles');

    const section = createEl('div');

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

    const exportBtn = createEl('button', {
      className: 'btn-export'
    });
    exportBtn.innerHTML = '<i class="fas fa-download"></i> CSVエクスポート';
    exportBtn.addEventListener('click', () => {
      exportToCSV(articles, 'knowledge_articles.csv');
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(exportBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    ['記事ID', 'タイトル', 'カテゴリ', '閲覧数', '評価', '著者', 'ステータス', '更新日'].forEach(
      (text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      }
    );
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    articles.forEach((article) => {
      const row = createEl('tr');
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => openEditKnowledgeModal(article));

      row.appendChild(createEl('td', { textContent: article.article_id }));
      row.appendChild(createEl('td', { textContent: article.title }));
      row.appendChild(createEl('td', { textContent: article.category }));
      row.appendChild(createEl('td', { textContent: article.view_count }));

      const stars = '★'.repeat(Math.round(article.rating)) + '☆'.repeat(5 - Math.round(article.rating));
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

    section.appendChild(table);
    container.appendChild(section);
  } catch (error) {
    renderError(container, 'ナレッジ管理データの読み込みに失敗しました');
  }
}

// ===== Capacity Management View =====

async function renderCapacity(container) {
  try {
    const metrics = await apiCall('/capacity-metrics');

    const section = createEl('div');

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

    const exportBtn = createEl('button', {
      className: 'btn-export'
    });
    exportBtn.innerHTML = '<i class="fas fa-download"></i> CSVエクスポート';
    exportBtn.addEventListener('click', () => {
      exportToCSV(metrics, 'capacity_metrics.csv');
    });

    btnGroup.appendChild(createBtn);
    btnGroup.appendChild(exportBtn);
    header.appendChild(btnGroup);
    section.appendChild(header);

    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    [
      'メトリクスID',
      'リソース名',
      'タイプ',
      '現在使用率',
      '閾値',
      '3ヶ月予測',
      'ステータス',
      '測定日時'
    ].forEach((text) => {
      headerRow.appendChild(createEl('th', { textContent: text }));
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    metrics.forEach((metric) => {
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

    section.appendChild(table);
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

function renderSettingsUsers(container) {
  const section = createEl('div');

  const header = createEl('div');
  header.style.display = 'flex';
  header.style.justifyContent = 'space-between';
  header.style.alignItems = 'center';
  header.style.marginBottom = '24px';

  const h2 = createEl('h2', { textContent: 'ユーザー・権限管理' });
  header.appendChild(h2);

  const createBtn = createEl('button', {
    className: 'btn-primary',
    textContent: '新規ユーザー作成'
  });
  createBtn.addEventListener('click', () => {
    openCreateUserModal();
  });
  header.appendChild(createBtn);
  section.appendChild(header);

  const card = createEl('div', { className: 'card' });
  card.style.padding = '24px';

  const infoText = createEl('p', {
    textContent:
      '現在のロール体系: admin（全権限）、manager（管理者）、analyst（分析者）、viewer（閲覧者）'
  });
  infoText.style.marginBottom = '20px';
  infoText.style.color = 'var(--text-secondary)';
  card.appendChild(infoText);

  const usersTable = createEl('table', { className: 'data-table' });

  const thead = createEl('thead');
  const headerRow = createEl('tr');
  ['ユーザー名', 'メール', 'ロール', 'ステータス'].forEach((text) => {
    headerRow.appendChild(createEl('th', { textContent: text }));
  });
  thead.appendChild(headerRow);
  usersTable.appendChild(thead);

  const tbody = createEl('tbody');
  const users = [
    {
      username: 'admin',
      email: 'admin@itsm.local',
      role: 'admin',
      status: 'Active'
    },
    {
      username: 'analyst',
      email: 'analyst@itsm.local',
      role: 'analyst',
      status: 'Active'
    }
  ];

  users.forEach((user) => {
    const row = createEl('tr');
    row.appendChild(createEl('td', { textContent: user.username }));
    row.appendChild(createEl('td', { textContent: user.email }));

    const roleBadge = createEl('span', {
      className: user.role === 'admin' ? 'badge badge-critical' : 'badge badge-info',
      textContent: user.role.toUpperCase()
    });
    const roleCell = createEl('td');
    roleCell.appendChild(roleBadge);
    row.appendChild(roleCell);

    const statusBadge = createEl('span', {
      className: 'badge badge-success',
      textContent: user.status
    });
    const statusCell = createEl('td');
    statusCell.appendChild(statusBadge);
    row.appendChild(statusCell);

    tbody.appendChild(row);
  });

  usersTable.appendChild(tbody);
  card.appendChild(usersTable);

  section.appendChild(card);
  container.appendChild(section);
}

function renderSettingsNotifications(container) {
  const section = createEl('div');

  const h2 = createEl('h2', { textContent: '通知・アラート設定' });
  h2.style.marginBottom = '24px';
  section.appendChild(h2);

  const card = createEl('div', { className: 'card' });
  card.style.padding = '24px';

  const notificationSettings = [
    { name: 'メール通知', description: 'インシデント発生時のメール通知', enabled: true },
    {
      name: 'Critical インシデントアラート',
      description: '重要インシデントの即時アラート',
      enabled: true
    },
    { name: 'SLA違反警告', description: 'SLA達成率が閾値を下回った際の警告', enabled: true },
    { name: 'セキュリティアラート', description: '脆弱性検出時の通知', enabled: true },
    { name: '週次レポート', description: '毎週月曜日の定期レポート', enabled: false }
  ];

  notificationSettings.forEach((setting) => {
    const row = createEl('div');
    row.style.marginBottom = '20px';
    row.style.paddingBottom = '16px';
    row.style.borderBottom = '1px solid var(--border-color)';
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';

    const textDiv = createEl('div');
    const nameDiv = createEl('div', { textContent: setting.name });
    nameDiv.style.fontWeight = '600';
    nameDiv.style.marginBottom = '4px';

    const descDiv = createEl('div', { textContent: setting.description });
    descDiv.style.fontSize = '0.85rem';
    descDiv.style.color = 'var(--text-secondary)';

    textDiv.appendChild(nameDiv);
    textDiv.appendChild(descDiv);

    const rightDiv = createEl('div');
    rightDiv.style.display = 'flex';
    rightDiv.style.alignItems = 'center';
    rightDiv.style.gap = '12px';

    const statusBadge = createEl('span', {
      className: setting.enabled ? 'badge badge-success' : 'badge badge-secondary',
      textContent: setting.enabled ? '有効' : '無効'
    });

    const editBtn = createEl('button', {
      className: 'btn-edit',
      textContent: '編集'
    });
    editBtn.style.padding = '6px 12px';
    editBtn.style.fontSize = '0.85rem';
    editBtn.addEventListener('click', () => {
      openEditNotificationSettingModal({
        setting_name: setting.name,
        description: setting.description,
        enabled: setting.enabled
      });
    });

    rightDiv.appendChild(statusBadge);
    rightDiv.appendChild(editBtn);

    row.appendChild(textDiv);
    row.appendChild(rightDiv);

    card.appendChild(row);
  });

  section.appendChild(card);
  container.appendChild(section);
}

// ===== CSV Export Utility =====

function exportToCSV(dataArray, filename) {
  if (!dataArray || dataArray.length === 0) {
    alert('エクスポートするデータがありません');
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
      alert('必須フィールドを入力してください');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/sla-agreements`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
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

      alert('SLA契約が正常に作成されました');
      closeModal();
      if (typeof loadSLADashboard === 'function') {
        // eslint-disable-next-line no-undef
        loadSLADashboard();
      }
    } catch (error) {
      console.error('Error creating SLA agreement:', error);
      alert(`エラー: ${error.message}`);
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
      alert('タイトルと内容を入力してください');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/knowledge-articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
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

      alert('ナレッジ記事が正常に作成されました');
      closeModal();
      if (typeof loadKnowledgeBase === 'function') {
        // eslint-disable-next-line no-undef
        loadKnowledgeBase();
      }
    } catch (error) {
      console.error('Error creating knowledge article:', error);
      alert(`エラー: ${error.message}`);
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
      alert('リソース名を入力してください');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/capacity-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
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

      alert('キャパシティメトリクスが正常に登録されました');
      closeModal();
      if (typeof loadCapacityDashboard === 'function') {
        // eslint-disable-next-line no-undef
        loadCapacityDashboard();
      }
    } catch (error) {
      console.error('Error creating capacity metric:', error);
      alert(`エラー: ${error.message}`);
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

    alert('設定が保存されました');
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
  const usernameLabel = createEl('label', { textContent: 'ユーザー名' });
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

  // Full Name field
  const fullNameGroup = createEl('div');
  const fullNameLabel = createEl('label', { textContent: '氏名' });
  fullNameLabel.style.display = 'block';
  fullNameLabel.style.fontWeight = '500';
  fullNameLabel.style.marginBottom = '6px';
  fullNameLabel.style.color = 'var(--text-primary)';
  const fullNameInput = createEl('input', {
    type: 'text',
    id: 'user-fullname',
    placeholder: '例: John Doe'
  });
  fullNameInput.style.width = '100%';
  fullNameInput.style.padding = '10px';
  fullNameInput.style.border = '1px solid var(--border-color)';
  fullNameInput.style.borderRadius = '6px';
  fullNameInput.style.fontSize = '0.95rem';
  fullNameGroup.appendChild(fullNameLabel);
  fullNameGroup.appendChild(fullNameInput);

  form.appendChild(usernameGroup);
  form.appendChild(emailGroup);
  form.appendChild(passwordGroup);
  form.appendChild(roleGroup);
  form.appendChild(fullNameGroup);
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
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    const fullName = document.getElementById('user-fullname').value.trim();

    if (!username || !email || !password) {
      alert('ユーザー名、メール、パスワードを入力してください');
      return;
    }

    if (password.length < 8) {
      alert('パスワードは最低8文字必要です');
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          username,
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

      alert('ユーザーが正常に作成されました');
      closeModal();
      if (typeof loadUserManagement === 'function') {
        // eslint-disable-next-line no-undef
        loadUserManagement();
      }
    } catch (error) {
      console.error('Error creating user:', error);
      alert(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(submitBtn);

  modal.style.display = 'flex';
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

    alert('設定が保存されました');
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
      alert('タイトルを入力してください');
      return;
    }

    try {
      await apiCall(`/problems/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      alert('問題を更新しました');
      closeModal();
      loadView('problems');
    } catch (error) {
      alert(`エラー: ${error.message}`);
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
      alert('リリース名とバージョンを入力してください');
      return;
    }

    try {
      await apiCall(`/releases/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      alert('リリースを更新しました');
      closeModal();
      loadView('releases');
    } catch (error) {
      alert(`エラー: ${error.message}`);
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
      alert('タイトルと説明を入力してください');
      return;
    }

    try {
      await apiCall(`/service-requests/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      alert('サービス要求を更新しました');
      closeModal();
      loadView('requests');
    } catch (error) {
      alert(`エラー: ${error.message}`);
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
      alert('サービス名とメトリクス名を入力してください');
      return;
    }

    try {
      await apiCall(`/sla-agreements/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      alert('SLA契約を更新しました');
      closeModal();
      loadView('sla');
    } catch (error) {
      alert(`エラー: ${error.message}`);
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
      alert('タイトルと内容を入力してください');
      return;
    }

    try {
      await apiCall(`/knowledge-articles/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      alert('ナレッジ記事を更新しました');
      closeModal();
      loadView('knowledge');
    } catch (error) {
      alert(`エラー: ${error.message}`);
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
      alert('リソース名を入力してください');
      return;
    }

    try {
      await apiCall(`/capacity-metrics/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      alert('キャパシティメトリクスを更新しました');
      closeModal();
      loadView('capacity');
    } catch (error) {
      alert(`エラー: ${error.message}`);
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

  // Fetch assets for selection
  let assets = [];
  try {
    assets = await apiCall('/assets');
  } catch (error) {
    console.error('Failed to load assets:', error);
  }

  // Vulnerability ID (readonly)
  const idGroup = createEl('div', { className: 'modal-form-group' });
  const idLabel = createEl('label', { textContent: '脆弱性ID' });
  const idInput = createEl('input', {
    type: 'text',
    id: 'edit-vuln-id',
    value: data.vulnerability_id || '',
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
  assetSelect.appendChild(createEl('option', { value: '', textContent: '選択してください' }));
  assets.forEach((asset) => {
    const option = createEl('option', {
      value: asset.asset_tag,
      textContent: `${asset.asset_tag} - ${asset.name}`
    });
    if (asset.asset_tag === data.affected_asset) option.selected = true;
    assetSelect.appendChild(option);
  });
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
      alert('タイトルを入力してください');
      return;
    }

    try {
      await apiCall(`/vulnerabilities/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      alert('脆弱性を更新しました');
      closeModal();
      loadView('security');
    } catch (error) {
      alert(`エラー: ${error.message}`);
    }
  });

  modalFooter.appendChild(cancelBtn);
  modalFooter.appendChild(saveBtn);
  modal.style.display = 'flex';
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
      alert('名称を入力してください');
      return;
    }

    try {
      await apiCall(`/assets/${data.id}`, {
        method: 'PUT',
        body: JSON.stringify(updateData)
      });
      alert('資産情報を更新しました');
      closeModal();
      loadView('cmdb');
    } catch (error) {
      alert(`エラー: ${error.message}`);
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
  detailBox.style.cssText = 'background: var(--bg-secondary); padding: 12px; border-radius: 6px; margin-bottom: 16px;';

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
      alert(`削除エラー: ${error.message}`);
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
  alert('インシデントを削除しました');
  loadView('incidents');
}

// eslint-disable-next-line no-unused-vars
async function deleteChange(rfcId) {
  await apiCall(`/changes/${rfcId}`, { method: 'DELETE' });
  alert('変更要求を削除しました');
  loadView('changes');
}

// eslint-disable-next-line no-unused-vars
async function deleteProblem(problemId) {
  await apiCall(`/problems/${problemId}`, { method: 'DELETE' });
  alert('問題を削除しました');
  loadView('problems');
}

// eslint-disable-next-line no-unused-vars
async function deleteRelease(releaseId) {
  await apiCall(`/releases/${releaseId}`, { method: 'DELETE' });
  alert('リリースを削除しました');
  loadView('releases');
}

// eslint-disable-next-line no-unused-vars
async function deleteServiceRequest(requestId) {
  await apiCall(`/service-requests/${requestId}`, { method: 'DELETE' });
  alert('サービス要求を削除しました');
  loadView('requests');
}

// eslint-disable-next-line no-unused-vars
async function deleteSLA(slaId) {
  await apiCall(`/sla-agreements/${slaId}`, { method: 'DELETE' });
  alert('SLA契約を削除しました');
  loadView('sla');
}

// eslint-disable-next-line no-unused-vars
async function deleteKnowledge(articleId) {
  await apiCall(`/knowledge-articles/${articleId}`, { method: 'DELETE' });
  alert('ナレッジ記事を削除しました');
  loadView('knowledge');
}

// eslint-disable-next-line no-unused-vars
async function deleteCapacity(metricId) {
  await apiCall(`/capacity-metrics/${metricId}`, { method: 'DELETE' });
  alert('キャパシティメトリクスを削除しました');
  loadView('capacity');
}

// eslint-disable-next-line no-unused-vars
async function deleteVulnerability(vulnId) {
  await apiCall(`/vulnerabilities/${vulnId}`, { method: 'DELETE' });
  alert('脆弱性を削除しました');
  loadView('security');
}

// eslint-disable-next-line no-unused-vars
async function deleteAsset(assetId) {
  await apiCall(`/assets/${assetId}`, { method: 'DELETE' });
  alert('資産を削除しました');
  loadView('cmdb');
}
