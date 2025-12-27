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
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push(
        `${date.getMonth() + 1}/${date.getDate()}`
      );
      incidentCounts.push(Math.floor(Math.random() * 15) + 5);
    }

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
    const priorityCounts = { Critical: 0, High: 0, Medium: 0, Low: 0 };
    incidents.forEach((inc) => {
      if (priorityCounts.hasOwnProperty(inc.priority)) {
        priorityCounts[inc.priority]++;
      }
    });

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
            backgroundColor: [
              '#dc2626',
              '#ea580c',
              '#eab308',
              '#16a34a'
            ],
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
    for (let i = 5; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      last6Months.push(`${date.getFullYear()}/${date.getMonth() + 1}`);
      slaRates.push(Math.floor(Math.random() * 15) + 85);
    }

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
              callback: function (value) {
                return value + '%';
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
              callback: function (value) {
                return value + '%';
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
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: '変更要求一覧 (RFC)' });
    const createBtn = createEl('button', { className: 'btn-primary', textContent: '新規RFC作成' });
    createBtn.addEventListener('click', () => openCreateRFCModal());

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
    const h3 = createEl('h3', { textContent: '脆弱性管理' });
    h3.style.marginBottom = '16px';
    section.appendChild(h3);

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
      body: JSON.stringify({ title, priority, status, description })
    });

    alert('インシデントを更新しました');
    closeModal();
    loadView('incidents');
  } catch (error) {
    alert(`エラー: ${error.message}`);
  }
}

// ===== Create Incident Modal =====

async function openCreateIncidentModal() {
  openModal('新規インシデント作成');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  const form = createEl('form', { id: 'create-incident-form' });

  // Title
  const titleGroup = createEl('div', { className: 'modal-form-group' });
  titleGroup.appendChild(createEl('label', { textContent: 'タイトル *' }));
  const titleInput = createEl('input', {
    type: 'text',
    id: 'new-incident-title',
    required: true
  });
  titleGroup.appendChild(titleInput);
  const titleError = createEl('div', { className: 'form-error', id: 'title-error' });
  titleGroup.appendChild(titleError);
  form.appendChild(titleGroup);

  // Priority
  const priorityGroup = createEl('div', { className: 'modal-form-group' });
  priorityGroup.appendChild(createEl('label', { textContent: '優先度 *' }));
  const prioritySelect = createEl('select', { id: 'new-incident-priority' });
  ['Critical', 'High', 'Medium', 'Low'].forEach((p) => {
    prioritySelect.appendChild(createEl('option', { value: p, textContent: p }));
  });
  priorityGroup.appendChild(prioritySelect);
  form.appendChild(priorityGroup);

  // Description
  const descGroup = createEl('div', { className: 'modal-form-group' });
  descGroup.appendChild(createEl('label', { textContent: '説明 *' }));
  const descTextarea = createEl('textarea', { id: 'new-incident-description', required: true });
  descGroup.appendChild(descTextarea);
  const descError = createEl('div', { className: 'form-error', id: 'description-error' });
  descGroup.appendChild(descError);
  form.appendChild(descGroup);

  // Security Incident Checkbox
  const securityGroup = createEl('div', { className: 'modal-form-group' });
  const checkboxLabel = createEl('label', { className: 'checkbox-label' });
  const securityCheckbox = createEl('input', {
    type: 'checkbox',
    id: 'new-incident-security'
  });
  checkboxLabel.appendChild(securityCheckbox);
  checkboxLabel.appendChild(document.createTextNode('セキュリティインシデント'));
  securityGroup.appendChild(checkboxLabel);
  form.appendChild(securityGroup);

  modalBody.appendChild(form);

  // Footer buttons
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);
  modalFooter.appendChild(cancelBtn);

  const createBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: '作成'
  });
  createBtn.addEventListener('click', async () => {
    await createIncident();
  });
  modalFooter.appendChild(createBtn);
}

async function createIncident() {
  const title = document.getElementById('new-incident-title').value.trim();
  const priority = document.getElementById('new-incident-priority').value;
  const description = document.getElementById('new-incident-description').value.trim();
  const isSecurityIncident = document.getElementById('new-incident-security').checked;

  const titleError = document.getElementById('title-error');
  const descError = document.getElementById('description-error');

  titleError.classList.remove('visible');
  descError.classList.remove('visible');

  let hasError = false;

  if (!title) {
    setText(titleError, 'タイトルを入力してください');
    titleError.classList.add('visible');
    hasError = true;
  }

  if (!description) {
    setText(descError, '説明を入力してください');
    descError.classList.add('visible');
    hasError = true;
  }

  if (hasError) return;

  try {
    await apiCall('/incidents', {
      method: 'POST',
      body: JSON.stringify({
        title,
        priority,
        description,
        is_security_incident: isSecurityIncident
      })
    });

    alert('インシデントを作成しました');
    closeModal();
    loadView('incidents');
  } catch (error) {
    alert(`エラー: ${error.message}`);
  }
}

// ===== Create RFC Modal =====

async function openCreateRFCModal() {
  openModal('新規RFC作成');

  const modalBody = document.getElementById('modal-body');
  const modalFooter = document.getElementById('modal-footer');

  // Fetch assets for selection
  let assets = [];
  try {
    assets = await apiCall('/assets');
  } catch (error) {
    console.error('Failed to load assets:', error);
  }

  const form = createEl('form', { id: 'create-rfc-form' });

  // Title
  const titleGroup = createEl('div', { className: 'modal-form-group' });
  titleGroup.appendChild(createEl('label', { textContent: 'タイトル *' }));
  const titleInput = createEl('input', { type: 'text', id: 'new-rfc-title', required: true });
  titleGroup.appendChild(titleInput);
  const titleError = createEl('div', { className: 'form-error', id: 'rfc-title-error' });
  titleGroup.appendChild(titleError);
  form.appendChild(titleGroup);

  // Description
  const descGroup = createEl('div', { className: 'modal-form-group' });
  descGroup.appendChild(createEl('label', { textContent: '説明 *' }));
  const descTextarea = createEl('textarea', { id: 'new-rfc-description', required: true });
  descGroup.appendChild(descTextarea);
  const descError = createEl('div', { className: 'form-error', id: 'rfc-description-error' });
  descGroup.appendChild(descError);
  form.appendChild(descGroup);

  // Asset Selection
  const assetGroup = createEl('div', { className: 'modal-form-group' });
  assetGroup.appendChild(createEl('label', { textContent: '関連資産' }));
  const assetSelect = createEl('select', { id: 'new-rfc-asset' });
  assetSelect.appendChild(createEl('option', { value: '', textContent: '選択してください' }));
  assets.forEach((asset) => {
    assetSelect.appendChild(
      createEl('option', { value: asset.id, textContent: `${asset.asset_tag} - ${asset.name}` })
    );
  });
  assetGroup.appendChild(assetSelect);
  form.appendChild(assetGroup);

  // Impact Level
  const impactGroup = createEl('div', { className: 'modal-form-group' });
  impactGroup.appendChild(createEl('label', { textContent: '影響度 *' }));
  const impactSelect = createEl('select', { id: 'new-rfc-impact' });
  ['High', 'Medium', 'Low'].forEach((i) => {
    impactSelect.appendChild(createEl('option', { value: i, textContent: i }));
  });
  impactGroup.appendChild(impactSelect);
  form.appendChild(impactGroup);

  modalBody.appendChild(form);

  // Footer buttons
  const cancelBtn = createEl('button', {
    className: 'btn-modal-secondary',
    textContent: 'キャンセル'
  });
  cancelBtn.addEventListener('click', closeModal);
  modalFooter.appendChild(cancelBtn);

  const createBtn = createEl('button', {
    className: 'btn-modal-primary',
    textContent: '作成'
  });
  createBtn.addEventListener('click', async () => {
    await createRFC();
  });
  modalFooter.appendChild(createBtn);
}

async function createRFC() {
  const title = document.getElementById('new-rfc-title').value.trim();
  const description = document.getElementById('new-rfc-description').value.trim();
  const assetId = document.getElementById('new-rfc-asset').value;
  const impactLevel = document.getElementById('new-rfc-impact').value;

  const titleError = document.getElementById('rfc-title-error');
  const descError = document.getElementById('rfc-description-error');

  titleError.classList.remove('visible');
  descError.classList.remove('visible');

  let hasError = false;

  if (!title) {
    setText(titleError, 'タイトルを入力してください');
    titleError.classList.add('visible');
    hasError = true;
  }

  if (!description) {
    setText(descError, '説明を入力してください');
    descError.classList.add('visible');
    hasError = true;
  }

  if (hasError) return;

  try {
    const payload = {
      title,
      description,
      impact_level: impactLevel,
      requester: currentUser.username
    };

    if (assetId) {
      payload.affected_asset_id = parseInt(assetId);
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
    row.appendChild(createEl('div', { className: 'modal-detail-label', textContent: detail.label }));
    row.appendChild(createEl('div', { className: 'modal-detail-value', textContent: detail.value }));
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
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: '問題管理・根本原因分析' });
    section.appendChild(header);
    header.appendChild(h2);

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
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: 'リリースパッケージ・展開状況' });
    header.appendChild(h2);
    section.appendChild(header);

    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    ['リリースID', 'リリース名', 'バージョン', 'ステータス', '変更数', '対象環境', 'リリース日', '進捗'].forEach(
      (text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      }
    );
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    releases.forEach((release) => {
      const row = createEl('tr');

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
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: 'サービス要求・申請一覧' });
    header.appendChild(h2);
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
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: 'SLA達成状況' });
    header.appendChild(h2);
    section.appendChild(header);

    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    ['SLA ID', 'サービス名', 'メトリクス', '目標値', '実績値', '達成率', '測定期間', 'ステータス'].forEach(
      (text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      }
    );
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    slaAgreements.forEach((sla) => {
      const row = createEl('tr');

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
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: 'ナレッジベース記事 (FAQ)' });
    header.appendChild(h2);
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
    header.style.marginBottom = '24px';

    const h2 = createEl('h2', { textContent: 'リソース使用状況' });
    header.appendChild(h2);
    section.appendChild(header);

    const table = createEl('table', { className: 'data-table' });

    const thead = createEl('thead');
    const headerRow = createEl('tr');
    ['メトリクスID', 'リソース名', 'タイプ', '現在使用率', '閾値', '3ヶ月予測', 'ステータス', '測定日時'].forEach(
      (text) => {
        headerRow.appendChild(createEl('th', { textContent: text }));
      }
    );
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = createEl('tbody');
    metrics.forEach((metric) => {
      const row = createEl('tr');

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

  const h2 = createEl('h2', { textContent: 'システム基本設定' });
  h2.style.marginBottom = '24px';
  section.appendChild(h2);

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

  settingsItems.forEach(item => {
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

  const h2 = createEl('h2', { textContent: 'ユーザー・権限管理' });
  h2.style.marginBottom = '24px';
  section.appendChild(h2);

  const card = createEl('div', { className: 'card' });
  card.style.padding = '24px';

  const infoText = createEl('p', {
    textContent: '現在のロール体系: admin（全権限）、manager（管理者）、analyst（分析者）、viewer（閲覧者）'
  });
  infoText.style.marginBottom = '20px';
  infoText.style.color = 'var(--text-secondary)';
  card.appendChild(infoText);

  const usersTable = createEl('table', { className: 'data-table' });

  const thead = createEl('thead');
  const headerRow = createEl('tr');
  ['ユーザー名', 'メール', 'ロール', 'ステータス'].forEach(text => {
    headerRow.appendChild(createEl('th', { textContent: text }));
  });
  thead.appendChild(headerRow);
  usersTable.appendChild(thead);

  const tbody = createEl('tbody');
  const users = [
    { username: 'admin', email: 'admin@itsm.local', role: 'admin', status: 'Active' },
    { username: 'analyst', email: 'analyst@itsm.local', role: 'analyst', status: 'Active' }
  ];

  users.forEach(user => {
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
    { name: 'Critical インシデントアラート', description: '重要インシデントの即時アラート', enabled: true },
    { name: 'SLA違反警告', description: 'SLA達成率が閾値を下回った際の警告', enabled: true },
    { name: 'セキュリティアラート', description: '脆弱性検出時の通知', enabled: true },
    { name: '週次レポート', description: '毎週月曜日の定期レポート', enabled: false }
  ];

  notificationSettings.forEach(setting => {
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

    const statusBadge = createEl('span', {
      className: setting.enabled ? 'badge badge-success' : 'badge badge-secondary',
      textContent: setting.enabled ? '有効' : '無効'
    });

    row.appendChild(textDiv);
    row.appendChild(statusBadge);

    card.appendChild(row);
  });

  section.appendChild(card);
  container.appendChild(section);
}

// ===== Quick Detail Modals (Simplified for Phase A-3) =====

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

function closeModal() {
  const modal = document.getElementById('modal-overlay');
  modal.style.display = 'none';
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
