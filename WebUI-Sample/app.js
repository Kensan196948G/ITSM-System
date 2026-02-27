document.addEventListener('DOMContentLoaded', () => {
  const app = document.getElementById('app');

  const datasets = {
    incidents: [
      { id: 'INC-1021', title: 'VPN接続失敗が断続発生', team: 'NW運用', priority: 'high', status: 'progress', age: '2h', impact: '在宅勤務 12名', summary: '認証サーバー応答遅延を確認。閾値調整を実施中。' },
      { id: 'INC-1019', title: 'メール配信遅延', team: '基盤', priority: 'critical', status: 'open', age: '38m', impact: '全社通知', summary: '中継サーバーのキュー滞留を調査中。' },
      { id: 'INC-1016', title: '3F複合機スキャン不可', team: 'クライアント', priority: 'info', status: 'resolved', age: '1d', impact: '総務', summary: 'SMB共有先の資格情報更新で復旧。' },
      { id: 'INC-1012', title: '社内ポータル表示遅延', team: 'アプリ', priority: 'high', status: 'progress', age: '4h', impact: '全社', summary: 'キャッシュ失効タイミングの偏りを確認。' }
    ],
    requests: [
      { id: 'REQ-330', type: 'アカウント作成', requester: '人事部 佐々木', status: 'review', sla: '8h以内', due: '今日 17:00', detail: '新入社員 3名分 / M365 + VPN 権限' },
      { id: 'REQ-329', type: 'ソフトウェア導入', requester: '開発部 木村', status: 'progress', sla: '2営業日', due: '明日', detail: 'VS / Docker Desktop ライセンス追加' },
      { id: 'REQ-327', type: 'アクセス権限', requester: '営業部 小川', status: 'resolved', sla: '4h以内', due: '完了', detail: 'CRM 閲覧ロール付与' }
    ],
    changes: [
      { id: 'CHG-210', title: 'FWルール追加（取引先VPN）', risk: 'high', owner: 'NW運用', status: 'review', window: '02/25 22:00-23:00', note: 'CAB承認待ち。ロールバック手順あり。' },
      { id: 'CHG-208', title: 'M365 条件付きアクセス更新', risk: 'medium', owner: 'SecOps', status: 'progress', window: '02/24 20:00-21:00', note: '段階適用中。監視強化。' },
      { id: 'CHG-205', title: '端末資産タグ命名規則反映', risk: 'low', owner: 'IT企画', status: 'resolved', window: '02/23 19:00-19:30', note: 'CMDB同期まで完了。' }
    ],
    assets: [
      { id: 'CI-SRV-01', name: 'AD Domain Controller', type: 'Server', owner: '情シス', status: 'open', location: 'DC室', note: 'パッチ適用待ち（3件）' },
      { id: 'CI-NW-07', name: 'Main Firewall', type: 'Network', owner: 'SecOps', status: 'progress', location: 'DC室', note: 'ポリシー棚卸し進行中' },
      { id: 'CI-EP-142', name: '営業部ノートPC #142', type: 'Endpoint', owner: '営業部', status: 'resolved', location: '本社 4F', note: '暗号化ポリシー適用済み' }
    ],
    knowledge: [
      { id: 'KB-014', title: 'OneDrive 同期トラブル一次切り分け', category: 'Client', status: 'resolved', score: '4.8', updated: '2日前', summary: 'Proxy/認証/容量不足の切り分け手順を標準化。' },
      { id: 'KB-011', title: 'VPN接続不可時の確認チェックリスト', category: 'Network', status: 'progress', score: '4.5', updated: '今日', summary: 'MFA/証明書/回線/FWの確認順を統一。' },
      { id: 'KB-009', title: '条件付きアクセス例外申請手順', category: 'Security', status: 'review', score: '4.2', updated: '昨日', summary: '申請テンプレートと承認フローを追記中。' }
    ],
    users: [
      { id: 'USR-001', userId: 't.yamada', name: '山田 太郎', department: '情報システム部', role: '運用管理者', status: 'active', email: 't.yamada@example.local' },
      { id: 'USR-002', userId: 'h.sato', name: '佐藤 花子', department: 'サービスデスク', role: 'サービスデスク', status: 'active', email: 'h.sato@example.local' },
      { id: 'USR-003', userId: 'sec.ops', name: 'SecOps Bot', department: 'セキュリティ運用', role: 'SecOps', status: 'inactive', email: 'secops-bot@example.local' }
    ],
    auditTrail: [
      { time: '14:45', actor: '佐藤 花子', action: 'CHG-208 ステータス更新', detail: '実施中へ変更 / 影響監視開始' },
      { time: '14:38', actor: 'System', action: 'SLAアラート', detail: 'REQ-330 期限2時間前を通知' },
      { time: '14:20', actor: '山田 太郎', action: 'INC-1019 追記', detail: 'メールキュー滞留ノードを特定' },
      { time: '13:58', actor: 'SecOps Bot', action: '脆弱性情報同期', detail: 'CVSS High 2件を登録' }
    ]
  };

  const rolePermissions = [
    { role: '運用管理者', scope: '全画面', update: '可', approve: '可', audit: '可', admin: '可' },
    { role: 'サービスデスク', scope: '運用系', update: '可', approve: '一部', audit: '参照のみ', admin: '不可' },
    { role: 'SecOps', scope: 'セキュリティ系', update: '可', approve: '一部', audit: '可', admin: '一部' },
    { role: '監査者', scope: '全画面', update: '不可', approve: '不可', audit: '可', admin: '不可' }
  ];

  const navSections = [
    {
      label: '概要（Overview）',
      items: [
        { id: 'dash', icon: 'fa-gauge-high', title: '統合ダッシュボード（Integrated Dashboard）', subtitle: '運用状況俯瞰（ITSM / NIST CSF 2.0 Overview）' }
      ]
    },
    {
      label: '運用（Operations）',
      items: [
        { id: 'incidents', icon: 'fa-triangle-exclamation', title: 'インシデント管理（Incident Management）', subtitle: '優先度・進捗・影響範囲の一元管理（Priority / Status / Impact）' },
        { id: 'requests', icon: 'fa-inbox', title: 'サービス要求管理（Service Request Management）', subtitle: '申請・承認・処理の追跡（Request / Approval / Fulfillment）' },
        { id: 'changes', icon: 'fa-code-branch', title: '変更管理（Change Management）', subtitle: 'RFC / CAB / 実施ウィンドウ管理（Change Control）' },
        { id: 'assets', icon: 'fa-server', title: '構成管理（Configuration Management / CMDB）', subtitle: '資産状態と責任部署の可視化（Asset / Owner Visibility）' }
      ]
    },
    {
      label: '品質（Quality）',
      items: [
        { id: 'sla', icon: 'fa-clock', title: 'SLA管理（SLA Management）', subtitle: '目標値・違反予兆・レポート（Targets / Risk / Reports）' },
        { id: 'knowledge', icon: 'fa-book-open', title: 'ナレッジ管理（Knowledge Management）', subtitle: 'FAQ / 手順書 / 標準化（Knowledge Base / SOP）' }
      ]
    },
    {
      label: 'セキュリティ（Security）',
      items: [
        { id: 'csf', icon: 'fa-shield-halved', title: 'NIST CSF 2.0（Cybersecurity Framework）', subtitle: '成熟度評価（GV / ID / PR / DE / RS / RC Maturity）' },
        { id: 'audit', icon: 'fa-clipboard-check', title: '監査（Audit）', subtitle: '監査ログ・差分・操作履歴の確認（Audit Log / Diff / Trace）' }
      ]
    },
    {
      label: '管理（Admin）',
      items: [
        { id: 'settings', icon: 'fa-sliders', title: 'システム設定（System Settings）', subtitle: '通知・権限・運用プロファイル（Notifications / Roles / Profiles）' }
      ]
    }
  ];

  const views = {
    dash: {
      render: renderDashboard
    },
    incidents: {
      render: () => renderRecordTablePage({
        key: 'incidents',
        title: 'インシデント一覧',
        description: '重大度と担当チームを基準に優先対応を進めます。',
        addLabel: '新規インシデント',
        filters: [
          { value: 'all', label: '全ステータス' },
          { value: 'open', label: '未対応' },
          { value: 'progress', label: '対応中' },
          { value: 'resolved', label: '解決済み' }
        ],
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'title', label: '内容', render: (row) => stackCell(row.title, row.summary) },
          { key: 'team', label: '担当' },
          { key: 'priority', label: '優先度', render: (row) => priorityTag(row.priority) },
          { key: 'status', label: '状態', render: (row) => statusChip(row.status) },
          { key: 'impact', label: '影響' },
          { key: 'age', label: '経過' }
        ]
      })
    },
    requests: {
      render: () => renderRecordTablePage({
        key: 'requests',
        title: 'サービス要求・申請',
        description: '標準要求の処理状況とSLAの見通しを管理します。',
        addLabel: '新規申請登録',
        filters: [
          { value: 'all', label: '全ステータス' },
          { value: 'review', label: '承認待ち' },
          { value: 'progress', label: '処理中' },
          { value: 'resolved', label: '完了' }
        ],
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'type', label: '要求種別' },
          { key: 'requester', label: '申請者' },
          { key: 'detail', label: '内容', render: (row) => stackCell(row.detail, `SLA: ${row.sla}`) },
          { key: 'status', label: '状態', render: (row) => statusChip(row.status) },
          { key: 'due', label: '期限' }
        ]
      })
    },
    changes: {
      render: () => renderRecordTablePage({
        key: 'changes',
        title: '変更管理 (RFC)',
        description: '変更リスクと実施ウィンドウの整合を確認します。',
        addLabel: 'RFC登録',
        filters: [
          { value: 'all', label: '全ステータス' },
          { value: 'review', label: '承認待ち' },
          { value: 'progress', label: '実施中' },
          { value: 'resolved', label: '完了' }
        ],
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'title', label: '変更内容', render: (row) => stackCell(row.title, row.note) },
          { key: 'owner', label: '担当' },
          { key: 'risk', label: 'リスク', render: (row) => priorityTag(row.risk) },
          { key: 'status', label: '状態', render: (row) => statusChip(row.status) },
          { key: 'window', label: '実施枠' }
        ]
      })
    },
    assets: {
      render: () => renderRecordTablePage({
        key: 'assets',
        title: '構成資産 (CMDB)',
        description: 'IT資産の状態・責任部署・配置場所を追跡します。',
        addLabel: '資産登録',
        filters: [
          { value: 'all', label: '全状態' },
          { value: 'open', label: '未整備/要対応' },
          { value: 'progress', label: '整備中' },
          { value: 'resolved', label: '正常/完了' }
        ],
        columns: [
          { key: 'id', label: 'CI ID' },
          { key: 'name', label: '資産', render: (row) => stackCell(row.name, row.note) },
          { key: 'type', label: '種別' },
          { key: 'owner', label: '所有部署' },
          { key: 'location', label: '設置場所' },
          { key: 'status', label: '状態', render: (row) => statusChip(row.status) }
        ]
      })
    },
    sla: {
      render: renderSlaPage
    },
    knowledge: {
      render: () => renderRecordTablePage({
        key: 'knowledge',
        title: 'ナレッジベース',
        description: '再発防止と一次対応品質の標準化を進めます。',
        addLabel: '記事作成',
        filters: [
          { value: 'all', label: '全状態' },
          { value: 'review', label: 'レビュー中' },
          { value: 'progress', label: '更新中' },
          { value: 'resolved', label: '公開中' }
        ],
        columns: [
          { key: 'id', label: 'ID' },
          { key: 'title', label: 'タイトル', render: (row) => stackCell(row.title, row.summary) },
          { key: 'category', label: 'カテゴリ' },
          { key: 'score', label: '評価' },
          { key: 'status', label: '状態', render: (row) => statusChip(row.status) },
          { key: 'updated', label: '更新' }
        ]
      })
    },
    csf: {
      render: renderCsfPage
    },
    audit: {
      render: renderAuditPage
    },
    settings: {
      render: renderSettingsPage
    }
  };

  const state = {
    isAuthenticated: false,
    user: {
      name: '山田 太郎',
      role: '運用管理者',
      team: '情報システム部'
    },
    currentView: 'dash',
    sidebarOpen: false,
    pageQuery: '',
    pageFilter: 'all',
    settingsUserQuery: '',
    settingsUserRoleFilter: 'all',
    settingsUserStatusFilter: 'all',
    settingsUserDeptFilter: 'all',
    settingsUserSortKey: 'id',
    settingsUserSortDir: 'asc',
    settingsUserPage: 1,
    settingsUserPageSize: 5,
    settingsAuditQuery: '',
    settingsAuditActionFilter: 'all',
    settingsAuditSortKey: 'time',
    settingsAuditSortDir: 'desc',
    settingsAuditPage: 1,
    settingsAuditPageSize: 10,
    apiStatus: 'idle',
    userAdminLoaded: false,
    modal: null,
    modalErrors: {},
    toasts: []
  };

  const apiClient = {
    async request(path, options = {}) {
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 5000);
      try {
        const response = await fetch(path, {
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {})
          },
          ...options,
          signal: controller.signal
        });
        if (!response.ok) {
          const text = await response.text();
          let parsed = null;
          try { parsed = text ? JSON.parse(text) : null; } catch (_) { parsed = null; }
          const error = new Error(`HTTP ${response.status}: ${text || response.statusText}`);
          error.status = response.status;
          error.payload = parsed;
          throw error;
        }
        if (response.status === 204) return null;
        return await response.json();
      } finally {
        window.clearTimeout(timeout);
      }
    },
    listUsers() {
      return this.request('/api/users');
    },
    createUser(payload) {
      return this.request('/api/users', { method: 'POST', body: JSON.stringify(payload) });
    },
    updateUser(id, payload, version) {
      return this.request(`/api/users/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: version != null ? { 'If-Match-Version': String(version) } : {},
        body: JSON.stringify(payload)
      });
    },
    deleteUser(id) {
      return this.request(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
    },
    listRoles() {
      return this.request('/api/roles');
    },
    saveRoles(payload) {
      return this.request('/api/roles', { method: 'PUT', body: JSON.stringify(payload) });
    },
    listAudit(options = 20) {
      if (typeof options === 'number') {
        return this.request(`/api/audit?limit=${encodeURIComponent(String(options))}`);
      }
      const params = new URLSearchParams();
      Object.entries(options || {}).forEach(([k, v]) => {
        if (v == null || v === '') return;
        params.set(k, String(v));
      });
      return this.request(`/api/audit?${params.toString()}`);
    },
    addAudit(entry) {
      return this.request('/api/audit', { method: 'POST', body: JSON.stringify(entry) });
    }
  };

  function init() {
    loadUiPrefs();
    renderRoot();
    bindEvents();
  }

  function renderRoot() {
    if (!app) return;
    if (!state.isAuthenticated) {
      app.innerHTML = renderLoginScreen();
      return;
    }
    app.innerHTML = renderMainShell();
    syncView();
    renderModal();
    renderToasts();
  }

  function renderLoginScreen() {
    return `
      <section class="screen">
        <div class="login-shell">
          <div class="login-hero">
            <div class="brand-row">
              <div class="brand-mark" aria-hidden="true"></div>
              <div class="brand-title">ITSM-Sec Nexus</div>
            </div>
            <div class="hero-headline">
              <h1>ISO 20000 と NIST CSF 2.0 を横断する運用UIサンプル</h1>
              <p>運用デスク向けの統合ビュー、変更・SLA・セキュリティ成熟度をひとつの画面で確認できるデモ版WebUIです。</p>
            </div>
            <div class="hero-panels">
              <div class="mini-panel">
                <h3>運用監視</h3>
                <ul class="mini-list">
                  <li>インシデントの優先度管理</li>
                  <li>SLA違反予兆の表示</li>
                  <li>変更実施ウィンドウ監視</li>
                </ul>
              </div>
              <div class="mini-panel">
                <h3>セキュリティ</h3>
                <ul class="mini-list">
                  <li>NIST CSF 2.0 スコア可視化</li>
                  <li>監査ログタイムライン</li>
                  <li>改善バックログ管理</li>
                </ul>
              </div>
            </div>
          </div>
          <div class="login-card">
            <h2>サインイン（デモ）</h2>
            <p>認証は実装していません。入力内容は画面遷移のみで使用します。</p>
            <form id="login-form" class="form-grid" data-testid="login-form">
              <div class="field">
                <label for="login-user">ユーザーID</label>
                <input id="login-user" data-testid="login-user-id" name="user" type="text" value="it-admin" required>
              </div>
              <div class="field">
                <label for="login-password">パスワード</label>
                <input id="login-password" data-testid="login-password" name="password" type="password" value="demo-password" required>
              </div>
              <div class="inline-fields">
                <div class="field">
                  <label for="login-role">ロール</label>
                  <select id="login-role" data-testid="login-role" name="role">
                    <option value="運用管理者" selected>運用管理者</option>
                    <option value="SecOps">SecOps</option>
                    <option value="サービスデスク">サービスデスク</option>
                  </select>
                </div>
                <div class="field">
                  <label for="login-team">所属</label>
                  <select id="login-team" data-testid="login-team" name="team">
                    <option value="情報システム部" selected>情報システム部</option>
                    <option value="セキュリティ運用">セキュリティ運用</option>
                    <option value="運用統括">運用統括</option>
                  </select>
                </div>
              </div>
              <div class="note-box">サンプル実装継続中: 今回は <code>index.html</code> / <code>style.css</code> / <code>app.js</code> の分離構成で動作する最小実用UIを提供します。</div>
              <div class="hint-row">
                <span>推奨ブラウザ: Chrome / Edge 最新版</span>
                <span>モバイル表示対応</span>
              </div>
              <div class="btn-row">
                <button type="submit" class="btn btn-primary btn-icon" data-testid="login-submit">
                  <i class="fa-solid fa-arrow-right-to-bracket" aria-hidden="true"></i>
                  ログインして開始
                </button>
                <button type="button" class="btn btn-soft" data-action="demo-fill" data-testid="login-demo-fill">デモ値を適用</button>
              </div>
            </form>
          </div>
        </div>
      </section>
    `;
  }

  function renderMainShell() {
    const navHtml = navSections.map((section) => `
      <div class="nav-section">
        <div class="nav-label">${escapeHtml(section.label)}</div>
        ${section.items.map((item) => `
          <button class="nav-item${item.id === state.currentView ? ' active' : ''}" type="button" data-action="nav" data-view="${item.id}" data-testid="nav-${item.id}">
            <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
            <span>${escapeHtml(item.title)}</span>
          </button>
        `).join('')}
      </div>
    `).join('');

    return `
      <section class="screen">
        <div class="app-shell">
          <aside class="sidebar${state.sidebarOpen ? ' open' : ''}" id="sidebar" data-testid="sidebar">
            <div class="sidebar-top">
              <div class="sidebar-brand">
                <div class="brand-mark" aria-hidden="true"></div>
                <div class="sidebar-brand-text">ITSM-Sec Nexus</div>
              </div>
              <button class="btn btn-soft" type="button" data-action="collapse-sidebar" aria-label="サイドバーを閉じる">
                <i class="fa-solid fa-xmark"></i>
              </button>
            </div>
            ${navHtml}
          </aside>

          <div class="main-pane">
            <header class="topbar">
              <div class="topbar-left">
                <button id="sidebar-toggle" type="button" data-action="toggle-sidebar" aria-label="サイドバーを開く" data-testid="sidebar-toggle">
                  <i class="fa-solid fa-bars"></i>
                </button>
                <div class="title-stack">
                  <h2 id="page-title"></h2>
                  <p id="page-subtitle"></p>
                </div>
              </div>
              <div class="topbar-right">
                <span class="pill live"><i class="fa-solid fa-circle"></i> Live Demo</span>
                <span class="pill role">${escapeHtml(state.user.role)}</span>
                <span class="pill warn"><i class="fa-solid fa-bell"></i> SLA注意 2件</span>
                <button class="btn" type="button" data-action="logout" data-testid="logout-button">
                  <i class="fa-solid fa-right-from-bracket"></i>
                  ログアウト
                </button>
              </div>
            </header>
            <main class="content" id="page-content" data-testid="page-content"></main>
          </div>
        </div>
        <div class="drawer-overlay${state.sidebarOpen ? ' open' : ''}" id="drawer-overlay" data-action="collapse-sidebar"></div>
        <div class="modal-root" id="modal-root"></div>
        <div class="toast-stack" id="toast-stack"></div>
      </section>
    `;
  }

  function bindEvents() {
    app.addEventListener('submit', async (event) => {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if (form.id !== 'login-form') return;
      event.preventDefault();

      const formData = new FormData(form);
      state.user = {
        name: String(formData.get('user') || 'it-admin'),
        role: String(formData.get('role') || '運用管理者'),
        team: String(formData.get('team') || '情報システム部')
      };
      state.isAuthenticated = true;
      state.pageQuery = '';
      state.pageFilter = 'all';
      renderRoot();
      await ensureUserAdminLoaded();
      pushToast('success', 'ログイン', `${state.user.name} としてデモ画面を開始しました。`);
    });

    app.addEventListener('click', async (event) => {
      const target = event.target.closest('[data-action]');
      if (!target) return;
      const action = target.getAttribute('data-action');
      if (!action) return;

      if (action === 'demo-fill') {
        const userInput = document.getElementById('login-user');
        const roleInput = document.getElementById('login-role');
        const teamInput = document.getElementById('login-team');
        if (userInput) userInput.value = 't.yamada';
        if (roleInput) roleInput.value = '運用管理者';
        if (teamInput) teamInput.value = '情報システム部';
        return;
      }

      if (action === 'nav') {
        const nextView = target.getAttribute('data-view');
        if (nextView && views[nextView]) {
          if (nextView === 'settings') {
            await ensureUserAdminLoaded();
          }
          state.currentView = nextView;
          state.pageQuery = '';
          state.pageFilter = 'all';
          state.sidebarOpen = false;
          saveUiPrefs();
          syncView();
        }
        return;
      }

      if (action === 'toggle-sidebar') {
        state.sidebarOpen = !state.sidebarOpen;
        syncSidebar();
        return;
      }

      if (action === 'collapse-sidebar') {
        state.sidebarOpen = false;
        syncSidebar();
        return;
      }

      if (action === 'logout') {
        state.isAuthenticated = false;
        state.sidebarOpen = false;
        state.modal = null;
        renderRoot();
        return;
      }

      if (action === 'open-create') {
        const datasetKey = target.getAttribute('data-dataset');
        openModal({
          kind: 'form',
          title: `${resolveCreateTitle(datasetKey)}（デモ）`,
          datasetKey,
          body: `
            <div class="field">
              <label>タイトル / 名称</label>
              <input type="text" placeholder="入力してください">
            </div>
            <div class="inline-fields">
              <div class="field">
                <label>担当 / 所有部署</label>
                <input type="text" placeholder="例: 情報システム部">
              </div>
              <div class="field">
                <label>優先度 / 種別</label>
                <select>
                  <option>高</option>
                  <option>中</option>
                  <option>低</option>
                </select>
              </div>
            </div>
            <div class="field">
              <label>備考</label>
              <textarea placeholder="サンプルのため保存は行いません。"></textarea>
            </div>
            <div class="note-box">このフォームはUI検証用です。保存処理やAPI連携は未実装です。</div>
          `
        });
        return;
      }

      if (action === 'open-detail') {
        const datasetKey = target.getAttribute('data-dataset');
        const recordId = target.getAttribute('data-id');
        if (!datasetKey || !recordId) return;
        const record = (datasets[datasetKey] || []).find((item) => item.id === recordId);
        if (!record) return;
        openDetailModal(datasetKey, record);
        return;
      }

      if (action === 'open-user-create') {
        openUserFormModal('create');
        return;
      }

      if (action === 'open-user-edit') {
        const userId = target.getAttribute('data-id');
        if (!userId) return;
        const record = datasets.users.find((item) => item.id === userId);
        if (!record) return;
        openUserFormModal('edit', record);
        return;
      }

      if (action === 'open-user-delete') {
        const userId = target.getAttribute('data-id');
        if (!userId) return;
        const record = datasets.users.find((item) => item.id === userId);
        if (!record) return;
        openUserDeleteModal(record);
        return;
      }

      if (action === 'modal-close') {
        closeModal();
        return;
      }

      if (action === 'modal-submit') {
        if (state.modal && state.modal.kind === 'audit-diff') {
          closeModal();
          return;
        }
        if (await handleModalSubmit()) {
          return;
        }
        const label = state.modal && state.modal.datasetKey ? resolveCreateTitle(state.modal.datasetKey) : '項目';
        pushToast('info', 'デモ保存', `${label} の保存操作を受け付けました（UIデモ）。`);
        closeModal();
        return;
      }

      if (action === 'quick-toast') {
        pushToast('warn', '通知設定', 'サンプル操作です。バックエンド連携は未接続です。');
        return;
      }

      if (action === 'save-role-permissions') {
        await saveRolePermissionsFromUi();
        return;
      }

      if (action === 'sort-users') {
        const sortKey = target.getAttribute('data-sort');
        if (!sortKey) return;
        if (state.settingsUserSortKey === sortKey) {
          state.settingsUserSortDir = state.settingsUserSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.settingsUserSortKey = sortKey;
          state.settingsUserSortDir = 'asc';
        }
        state.settingsUserPage = 1;
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }

      if (action === 'users-page-prev') {
        state.settingsUserPage = Math.max(1, state.settingsUserPage - 1);
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }

      if (action === 'users-page-next') {
        state.settingsUserPage += 1;
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }

      if (action === 'users-page-go') {
        const page = Number(target.getAttribute('data-page') || '1');
        state.settingsUserPage = Math.max(1, page);
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }

      if (action === 'open-audit-diff') {
        const index = Number(target.getAttribute('data-audit-index') || '-1');
        const entry = datasets.auditTrail[index];
        if (!entry) return;
        openAuditDiffModal(entry);
        return;
      }

      if (action === 'sort-audit') {
        const sortKey = target.getAttribute('data-sort');
        if (!sortKey) return;
        if (state.settingsAuditSortKey === sortKey) {
          state.settingsAuditSortDir = state.settingsAuditSortDir === 'asc' ? 'desc' : 'asc';
        } else {
          state.settingsAuditSortKey = sortKey;
          state.settingsAuditSortDir = sortKey === 'time' ? 'desc' : 'asc';
        }
        state.settingsAuditPage = 1;
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }

      if (action === 'audit-page-prev') {
        state.settingsAuditPage = Math.max(1, state.settingsAuditPage - 1);
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }

      if (action === 'audit-page-next') {
        state.settingsAuditPage += 1;
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }

      if (action === 'audit-page-go') {
        const page = Number(target.getAttribute('data-page') || '1');
        state.settingsAuditPage = Math.max(1, page);
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }
    });

    app.addEventListener('input', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.id === 'page-search') {
        state.pageQuery = target.value.trim();
        syncViewContentOnly();
        return;
      }
      if (target.id === 'settings-user-search') {
        state.settingsUserQuery = target.value.trim();
        state.settingsUserPage = 1;
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }
      if (target.id === 'settings-audit-search') {
        state.settingsAuditQuery = target.value.trim();
        state.settingsAuditPage = 1;
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }
      if (target.id && target.id.startsWith('user-form-')) {
        const field = target.id.replace('user-form-', '').replace('recordId', '');
        if (state.modalErrors[field]) {
          const next = { ...state.modalErrors };
          delete next[field];
          state.modalErrors = next;
          renderInlineFormErrors();
        }
      }
    });

    app.addEventListener('change', (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.id === 'page-filter') {
        state.pageFilter = target.value;
        syncViewContentOnly();
        return;
      }
      if (target.id === 'settings-role-filter') {
        state.settingsUserRoleFilter = target.value;
        state.settingsUserPage = 1;
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }
      if (target.id === 'settings-status-filter') {
        state.settingsUserStatusFilter = target.value;
        state.settingsUserPage = 1;
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }
      if (target.id === 'settings-dept-filter') {
        state.settingsUserDeptFilter = target.value;
        state.settingsUserPage = 1;
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }
      if (target.id === 'settings-page-size') {
        state.settingsUserPageSize = Math.max(1, Number(target.value) || 5);
        state.settingsUserPage = 1;
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }
      if (target.id === 'settings-audit-action-filter') {
        state.settingsAuditActionFilter = target.value;
        state.settingsAuditPage = 1;
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }
      if (target.id === 'settings-audit-page-size') {
        state.settingsAuditPageSize = Math.max(1, Number(target.value) || 10);
        state.settingsAuditPage = 1;
        saveUiPrefs();
        syncViewContentOnly();
        return;
      }
      if (target.matches('input[type="checkbox"][data-perm]')) {
        const labelText = target.closest('label')?.querySelector('span');
        if (labelText) labelText.textContent = target.checked ? '可' : '不可';
        return;
      }
    });
  }

  function syncView() {
    syncSidebar();
    syncViewHeader();
    syncViewContentOnly();
  }

  function syncSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('drawer-overlay');
    if (sidebar) sidebar.classList.toggle('open', state.sidebarOpen);
    if (overlay) overlay.classList.toggle('open', state.sidebarOpen);

    document.querySelectorAll('.nav-item[data-view]').forEach((button) => {
      button.classList.toggle('active', button.getAttribute('data-view') === state.currentView);
    });
  }

  function syncViewHeader() {
    const meta = findViewMeta(state.currentView);
    const titleEl = document.getElementById('page-title');
    const subEl = document.getElementById('page-subtitle');
    if (titleEl) titleEl.textContent = meta ? meta.title : '画面';
    if (subEl) subEl.textContent = meta ? meta.subtitle : '';
  }

  function syncViewContentOnly() {
    const root = document.getElementById('page-content');
    const view = views[state.currentView];
    if (!root || !view) return;
    root.innerHTML = view.render();
    renderModal();
    renderToasts();
  }

  function loadUiPrefs() {
    try {
      const raw = localStorage.getItem('itsm_webui_prefs_v1');
      if (!raw) return;
      const prefs = JSON.parse(raw);
      if (!prefs || typeof prefs !== 'object') return;
      state.settingsUserQuery = String(prefs.settingsUserQuery || '');
      state.settingsUserRoleFilter = String(prefs.settingsUserRoleFilter || 'all');
      state.settingsUserStatusFilter = String(prefs.settingsUserStatusFilter || 'all');
      state.settingsUserDeptFilter = String(prefs.settingsUserDeptFilter || 'all');
      state.settingsUserSortKey = String(prefs.settingsUserSortKey || 'id');
      state.settingsUserSortDir = prefs.settingsUserSortDir === 'desc' ? 'desc' : 'asc';
      state.settingsUserPageSize = [5, 10, 20].includes(Number(prefs.settingsUserPageSize)) ? Number(prefs.settingsUserPageSize) : 5;
      state.settingsAuditQuery = String(prefs.settingsAuditQuery || '');
      state.settingsAuditActionFilter = String(prefs.settingsAuditActionFilter || 'all');
      state.settingsAuditSortKey = String(prefs.settingsAuditSortKey || 'time');
      state.settingsAuditSortDir = prefs.settingsAuditSortDir === 'asc' ? 'asc' : 'desc';
      state.settingsAuditPageSize = [10, 20, 50].includes(Number(prefs.settingsAuditPageSize)) ? Number(prefs.settingsAuditPageSize) : 10;
    } catch (error) {
      console.warn('Failed to load ui prefs:', error);
    }
  }

  function saveUiPrefs() {
    try {
      localStorage.setItem('itsm_webui_prefs_v1', JSON.stringify({
        settingsUserQuery: state.settingsUserQuery,
        settingsUserRoleFilter: state.settingsUserRoleFilter,
        settingsUserStatusFilter: state.settingsUserStatusFilter,
        settingsUserDeptFilter: state.settingsUserDeptFilter,
        settingsUserSortKey: state.settingsUserSortKey,
        settingsUserSortDir: state.settingsUserSortDir,
        settingsUserPageSize: state.settingsUserPageSize,
        settingsAuditQuery: state.settingsAuditQuery,
        settingsAuditActionFilter: state.settingsAuditActionFilter,
        settingsAuditSortKey: state.settingsAuditSortKey,
        settingsAuditSortDir: state.settingsAuditSortDir,
        settingsAuditPageSize: state.settingsAuditPageSize
      }));
    } catch (error) {
      console.warn('Failed to save ui prefs:', error);
    }
  }

  async function ensureUserAdminLoaded(force = false) {
    if (state.userAdminLoaded && !force) return;
    state.apiStatus = 'loading';
    try {
      const [users, roles, auditResp] = await Promise.all([
        apiClient.listUsers(),
        apiClient.listRoles(),
        apiClient.listAudit(20)
      ]);
      if (Array.isArray(users)) datasets.users = users;
      if (Array.isArray(roles) && roles.length) {
        rolePermissions.splice(0, rolePermissions.length, ...roles);
      }
      const auditItems = Array.isArray(auditResp) ? auditResp : (Array.isArray(auditResp?.items) ? auditResp.items : []);
      if (auditItems.length) {
        datasets.auditTrail = auditItems.map((entry) => ({
          time: entry.time || formatTimeForUi(),
          actor: entry.actor || 'System',
          action: entry.action || 'イベント',
          detail: entry.detail || ''
        , ...(entry.before !== undefined ? { before: entry.before } : {}), ...(entry.after !== undefined ? { after: entry.after } : {}) }));
      }
      state.userAdminLoaded = true;
      state.apiStatus = 'ready';
      if (state.currentView === 'settings') syncViewContentOnly();
    } catch (error) {
      state.apiStatus = 'error';
      state.userAdminLoaded = true;
      pushToast('warn', 'API接続', `バックエンドAPIに接続できません。ローカルデモで継続します。`);
      console.warn('Failed to load user admin data from API:', error);
    }
  }

  async function appendAuditLog(actor, action, detail, before = undefined, after = undefined) {
    const entry = {
      time: formatTimeForUi(),
      actor,
      action,
      detail
    };
    if (before !== undefined) entry.before = before;
    if (after !== undefined) entry.after = after;
    datasets.auditTrail.unshift(entry);
    datasets.auditTrail = datasets.auditTrail.slice(0, 20);
    try {
      await apiClient.addAudit(entry);
    } catch (error) {
      console.warn('Failed to persist audit log:', error);
    }
  }

  async function saveRolePermissionsFromUi() {
    const table = document.getElementById('role-permission-table');
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    const next = rows.map((row) => ({
      role: row.getAttribute('data-role') || '',
      scope: readCellText(row, '[data-col="scope"]'),
      update: readCheckedCell(row, 'update'),
      approve: readCheckedCell(row, 'approve'),
      audit: readCheckedCell(row, 'audit'),
      admin: readCheckedCell(row, 'admin')
    }));

    const before = rolePermissions.map((r) => ({ ...r }));
    rolePermissions.splice(0, rolePermissions.length, ...next);

    try {
      await apiClient.saveRoles(rolePermissions);
      pushToast('success', 'ロール権限', 'ロール権限マトリクスを保存しました。');
      await appendAuditLog(state.user.name, 'ロール権限更新', '設定画面からロール権限マトリクスを更新', before, next);
    } catch (error) {
      pushToast('warn', 'ロール権限', 'API保存に失敗したためローカル表示のみ更新しました。');
      console.warn('Failed to save role permissions:', error);
    }

    if (state.currentView === 'settings') syncViewContentOnly();
  }

  function readCellText(row, selector) {
    const cell = row.querySelector(selector);
    const input = cell ? cell.querySelector('input, select, textarea') : null;
    if (input && 'value' in input) return String(input.value).trim();
    return cell ? cell.textContent.trim() : '';
  }

  function readCheckedCell(row, key) {
    const input = row.querySelector(`input[data-perm="${key}"]`);
    return input && input.checked ? '可' : '不可';
  }

  function formatTimeForUi(date = new Date()) {
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  }

  function compareUsers(a, b, key, dir) {
    const av = normalizeUserSortValue(a, key);
    const bv = normalizeUserSortValue(b, key);
    const result = av.localeCompare(bv, 'ja', { numeric: true, sensitivity: 'base' });
    return dir === 'desc' ? result * -1 : result;
  }

  function normalizeUserSortValue(user, key) {
    if (key === 'name') return `${user.name || ''} ${user.userId || ''}`;
    if (key === 'status') return user.status === 'active' ? '0' : '1';
    return String(user[key] ?? '');
  }

  function buildPageWindow(current, total) {
    const pages = new Set([1, total, current - 1, current, current + 1]);
    return [...pages].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  }

  function compareAuditEntries(a, b, key, dir) {
    const av = normalizeAuditSortValue(a, key);
    const bv = normalizeAuditSortValue(b, key);
    const result = av.localeCompare(bv, 'ja', { numeric: true, sensitivity: 'base' });
    return dir === 'desc' ? result * -1 : result;
  }

  function normalizeAuditSortValue(entry, key) {
    if (key === 'time') {
      return String(entry.time || '').replace(':', '');
    }
    if (key === 'detail') {
      return String(entry.detail || '');
    }
    if (key === 'actor') {
      return String(entry.actor || '');
    }
    if (key === 'action') {
      return String(entry.action || '');
    }
    return String(entry[key] ?? '');
  }

  function renderDashboard() {
    const openIncidents = datasets.incidents.filter((r) => r.status !== 'resolved').length;
    const pendingChanges = datasets.changes.filter((r) => r.status !== 'resolved').length;
    const knowledgeUpdating = datasets.knowledge.filter((r) => r.status !== 'resolved').length;

    return `
      <div class="hero-card">
        <div>
          <h3>統合運用サマリー</h3>
          <p>ISO 20000 の運用指標と NIST CSF 2.0 の改善状況を一画面に集約したサンプルビューです。</p>
        </div>
        <div class="alert-banner">
          <div>
            <strong>要注意:</strong> メール配信遅延 (<code>INC-1019</code>) が全社通知に影響。SLA逸脱リスクあり。
          </div>
          <button class="btn btn-soft" type="button" data-action="nav" data-view="incidents">インシデントを開く</button>
        </div>
      </div>

      <section class="panel">
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="label">未解決インシデント</div>
            <div class="value">${String(openIncidents).padStart(2, '0')}</div>
            <div class="meta">高優先度 3件 / 監視継続</div>
          </div>
          <div class="kpi-card">
            <div class="label">SLA遵守率 (7日)</div>
            <div class="value">96.4%</div>
            <div class="meta">目標 95% を上回る</div>
          </div>
          <div class="kpi-card">
            <div class="label">進行中変更</div>
            <div class="value">${String(pendingChanges).padStart(2, '0')}</div>
            <div class="meta">CAB承認待ち 1件</div>
          </div>
          <div class="kpi-card">
            <div class="label">ナレッジ更新中</div>
            <div class="value">${String(knowledgeUpdating).padStart(2, '0')}</div>
            <div class="meta">公開レビュー 1件</div>
          </div>
        </div>
      </section>

      <div class="split-grid">
        <section class="table-card">
          <div class="card-head">
            <div>
              <div class="table-title">運用アクティビティ</div>
              <p>直近のインシデント / 変更 / 監査イベント</p>
            </div>
            <button class="btn" type="button" data-action="quick-toast">通知テスト</button>
          </div>
          <div class="card-body">
            <div class="timeline">
              ${datasets.auditTrail.map((item) => `
                <div class="timeline-item">
                  <div class="timeline-time">${escapeHtml(item.time)}</div>
                  <div class="timeline-body">
                    <h4>${escapeHtml(item.action)}</h4>
                    <p>${escapeHtml(item.actor)} / ${escapeHtml(item.detail)}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </section>

        <div class="cards-grid-2">
          <section class="chart-card">
            <div class="card-head">
              <div>
                <div class="chart-title">SLA / 稼働指標</div>
                <p>サービス品質の週次トレンド</p>
              </div>
            </div>
            <div class="card-body">
              <div class="spark-list">
                ${[
                  ['一次応答 SLA', 96, 'metric-ok'],
                  ['解決 SLA', 91, 'metric-warn'],
                  ['変更成功率', 98, 'metric-ok'],
                  ['監視検知 MTTA', 84, 'metric-info']
                ].map(([label, value, tone]) => `
                  <div class="spark-item">
                    <div class="row">
                      <span>${label}</span>
                      <span class="metric-badge ${tone}">${value}%</span>
                    </div>
                    <div class="progress-bar"><div class="progress-fill" style="width:${value}%"></div></div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>

          <section class="chart-card">
            <div class="card-head">
              <div>
                <div class="chart-title">NIST CSF 2.0 スコア</div>
                <p>機能別の改善状況</p>
              </div>
            </div>
            <div class="card-body">
              <div class="csf-grid">
                ${[
                  ['GV', 'Govern', 85, 'metric-info'],
                  ['ID', 'Identify', 78, 'metric-info'],
                  ['PR', 'Protect', 82, 'metric-ok'],
                  ['DE', 'Detect', 75, 'metric-warn'],
                  ['RS', 'Respond', 80, 'metric-ok'],
                  ['RC', 'Recover', 72, 'metric-warn']
                ].map(([code, label, score, tone]) => `
                  <div class="csf-card">
                    <h4>${code} / ${label}</h4>
                    <div class="sub">成熟度評価（デモ）</div>
                    <div class="metric-badge ${tone}">${score}%</div>
                  </div>
                `).join('')}
              </div>
            </div>
          </section>
        </div>
      </div>

      <div class="footer-note">Sample WebUI (Vanilla JS) / UI state is local only / API integration not yet wired.</div>
    `;
  }

  function renderRecordTablePage(config) {
    const rawRows = datasets[config.key] || [];
    const filteredRows = rawRows.filter((row) => {
      const byStatus = state.pageFilter === 'all' ? true : row.status === state.pageFilter;
      const byQuery = !state.pageQuery || stringifyRecord(row).includes(state.pageQuery.toLowerCase());
      return byStatus && byQuery;
    });

    return `
      <section class="hero-card">
        <div>
          <h3>${escapeHtml(config.title)}</h3>
          <p>${escapeHtml(config.description)}</p>
        </div>
        <div class="toolbar">
          <div class="toolbar-left">
            <div class="search-box">
              <i class="fa-solid fa-magnifying-glass" aria-hidden="true"></i>
              <input id="page-search" type="search" value="${escapeAttr(state.pageQuery)}" placeholder="検索 (ID / 内容 / 担当)">
            </div>
            <select id="page-filter" class="select-sm" aria-label="ステータスフィルタ">
              ${config.filters.map((item) => `
                <option value="${escapeAttr(item.value)}"${state.pageFilter === item.value ? ' selected' : ''}>${escapeHtml(item.label)}</option>
              `).join('')}
            </select>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-primary btn-icon" type="button" data-action="open-create" data-dataset="${config.key}">
              <i class="fa-solid fa-plus"></i>
              ${escapeHtml(config.addLabel)}
            </button>
          </div>
        </div>
      </section>

      <section class="table-card">
        <div class="card-head">
          <div>
            <div class="table-title">一覧 (${filteredRows.length}件)</div>
            <p>表示中のデータはサンプル固定値です。</p>
          </div>
        </div>
        <div class="card-body table-wrap">
          <table class="data-table">
            <thead>
              <tr>
                ${config.columns.map((col) => `<th>${escapeHtml(col.label)}</th>`).join('')}
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRows.length ? filteredRows.map((row) => `
                <tr>
                  ${config.columns.map((col) => `<td>${col.render ? col.render(row) : escapeHtml(String(row[col.key] ?? ''))}</td>`).join('')}
                  <td>
                    <button class="btn btn-soft" type="button" data-action="open-detail" data-dataset="${config.key}" data-id="${escapeAttr(row.id)}">
                      詳細
                    </button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="${config.columns.length + 1}">
                    <div class="empty-card">
                      <h3>該当データなし</h3>
                      <p>検索条件またはフィルタを変更してください。</p>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </section>
    `;
  }

  function renderSlaPage() {
    return `
      <section class="hero-card">
        <div>
          <h3>SLA管理</h3>
          <p>目標値と実績値のギャップを監視し、逸脱前に対応を促すための運用ビューです。</p>
        </div>
        <div class="alert-banner">
          <div><strong>予兆:</strong> サービス要求一次応答SLAが本日ピーク帯で低下傾向です。</div>
          <button class="btn btn-soft" type="button" data-action="quick-toast">通知設定を確認</button>
        </div>
      </section>

      <div class="cards-grid-3">
        ${[
          ['インシデント一次応答', '95%', '96.4%', 'metric-ok'],
          ['サービス要求処理', '90%', '88.9%', 'metric-warn'],
          ['変更成功率', '97%', '98.2%', 'metric-ok']
        ].map(([name, target, actual, tone]) => `
          <section class="panel">
            <h3 class="panel-title">${name}</h3>
            <div class="info-list" style="margin-top: 10px;">
              <div class="info-item"><span class="label">目標値</span><span class="value">${target}</span></div>
              <div class="info-item"><span class="label">実績値</span><span class="value"><span class="metric-badge ${tone}">${actual}</span></span></div>
              <div class="info-item"><span class="label">更新時刻</span><span class="value">14:50</span></div>
            </div>
          </section>
        `).join('')}
      </div>

      <section class="chart-card">
        <div class="card-head">
          <div>
            <div class="chart-title">SLA違反リスクの内訳（デモ）</div>
            <p>件数ベースの優先対応カテゴリ</p>
          </div>
        </div>
        <div class="card-body">
          <div class="spark-list">
            ${[
              ['承認待ちボトルネック', 68, 'metric-warn'],
              ['担当者アサイン遅延', 42, 'metric-info'],
              ['夜間変更影響', 25, 'metric-danger'],
              ['ナレッジ不足による再作業', 37, 'metric-warn']
            ].map(([label, score, tone]) => `
              <div class="spark-item">
                <div class="row">
                  <span>${label}</span>
                  <span class="metric-badge ${tone}">${score}</span>
                </div>
                <div class="progress-bar"><div class="progress-fill" style="width:${Math.min(score, 100)}%"></div></div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function renderCsfPage() {
    const items = [
      { code: 'GV', title: 'Govern (統治)', score: 85, tone: 'metric-info', note: 'ポリシー・責任分界・監督体制が安定' },
      { code: 'ID', title: 'Identify (識別)', score: 78, tone: 'metric-info', note: 'CMDB整合性と資産台帳の更新を継続' },
      { code: 'PR', title: 'Protect (防御)', score: 82, tone: 'metric-ok', note: 'MFA / 条件付きアクセス / EDR を運用中' },
      { code: 'DE', title: 'Detect (検知)', score: 75, tone: 'metric-warn', note: 'ログ相関ルールの追加余地あり' },
      { code: 'RS', title: 'Respond (対応)', score: 80, tone: 'metric-ok', note: '定型インシデント対応は標準化済み' },
      { code: 'RC', title: 'Recover (復旧)', score: 72, tone: 'metric-warn', note: '復旧訓練記録の継続運用が課題' }
    ];

    return `
      <section class="hero-card">
        <div>
          <h3>NIST CSF 2.0 評価ダッシュボード</h3>
          <p>6機能の成熟度を運用現場向けに簡易可視化したデモです。詳細な評価証跡管理は未実装です。</p>
        </div>
      </section>

      <div class="cards-grid-2">
        <section class="chart-card">
          <div class="card-head">
            <div>
              <div class="chart-title">機能別スコア</div>
              <p>改善優先度の当たりをつけるための概要</p>
            </div>
          </div>
          <div class="card-body">
            <div class="spark-list">
              ${items.map((item) => `
                <div class="spark-item">
                  <div class="row">
                    <span>${item.code} / ${item.title}</span>
                    <span class="metric-badge ${item.tone}">${item.score}%</span>
                  </div>
                  <div class="progress-bar"><div class="progress-fill" style="width:${item.score}%"></div></div>
                </div>
              `).join('')}
            </div>
          </div>
        </section>

        <section class="table-card">
          <div class="card-head">
            <div>
              <div class="table-title">改善バックログ（例）</div>
              <p>CSF観点の短期アクション</p>
            </div>
          </div>
          <div class="card-body">
            <div class="info-list">
              ${[
                ['DE', '監視相関ルール追加', 'High', '今週'],
                ['RC', '復旧訓練テンプレート更新', 'Medium', '今月'],
                ['ID', '資産棚卸し差分の是正', 'High', '今週'],
                ['GV', '例外承認フロー監査ログ整備', 'Medium', '今月']
              ].map(([area, task, priority, due]) => `
                <div class="info-item">
                  <span class="label">${area}</span>
                  <span class="value">${task} / ${priority} / ${due}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </section>
      </div>

      <section class="panel">
        <h3 class="panel-title">機能別メモ</h3>
        <div class="cards-grid-2" style="margin-top: 10px;">
          ${items.map((item) => `
            <div class="csf-card">
              <h4>${item.code} / ${item.title}</h4>
              <div class="sub">${item.note}</div>
              <div class="metric-badge ${item.tone}">Score ${item.score}%</div>
            </div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderAuditPage() {
    const auditActionOptions = Array.from(new Set(datasets.auditTrail.map((a) => a.action))).sort((a, b) => a.localeCompare(b, 'ja'));
    const filteredAudit = datasets.auditTrail.filter((item) => {
      const q = state.settingsAuditQuery.toLowerCase();
      const byQuery = !q || stringifyRecord(item).includes(q);
      const byAction = state.settingsAuditActionFilter === 'all' || item.action === state.settingsAuditActionFilter;
      return byQuery && byAction;
    });
    const sortedAudit = [...filteredAudit].sort((a, b) => compareAuditEntries(a, b, state.settingsAuditSortKey, state.settingsAuditSortDir));
    const auditPageSize = Math.max(1, state.settingsAuditPageSize);
    const auditTotalPages = Math.max(1, Math.ceil(sortedAudit.length / auditPageSize));
    const auditCurrentPage = Math.min(state.settingsAuditPage, auditTotalPages);
    state.settingsAuditPage = auditCurrentPage;
    const auditStart = (auditCurrentPage - 1) * auditPageSize;
    const pagedAudit = sortedAudit.slice(auditStart, auditStart + auditPageSize);
    const auditPageWindow = buildPageWindow(auditCurrentPage, auditTotalPages);

    const diffCount = filteredAudit.filter((x) => ('before' in x || 'after' in x)).length;

    return `
      <section class="hero-card" data-testid="audit-page">
        <div>
          <h3>監査（Audit）</h3>
          <p>監査ログ（Audit Log）と変更差分（Before/After）を確認する専用ビューです。ユーザー操作・権限変更・API更新の履歴を追跡できます。</p>
        </div>
        <div class="toolbar">
          <div class="toolbar-left">
            <span class="pill role">総件数（Total Logs）: ${datasets.auditTrail.length}</span>
            <span class="pill warn">差分あり（With Diff）: ${diffCount}</span>
          </div>
          <div class="toolbar-right">
            <button class="btn btn-soft" type="button" data-action="nav" data-view="settings" data-testid="audit-go-settings">設定画面へ戻る</button>
          </div>
        </div>
      </section>

      <section class="table-card">
        <div class="card-head">
          <div>
            <div class="table-title">監査ログ一覧（Audit Log List）</div>
            <p>検索（Search）・アクション種別（Action Type）で絞り込みできます。</p>
          </div>
        </div>
        <div class="card-body" style="padding-bottom:0;">
          <div class="toolbar">
            <div class="toolbar-left">
              <div class="search-box">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input id="settings-audit-search" data-testid="settings-audit-search" type="search" value="${escapeAttr(state.settingsAuditQuery)}" placeholder="監査ログ検索（Search: 実行者/操作/詳細）">
              </div>
              <select id="settings-audit-action-filter" data-testid="settings-audit-action-filter" class="select-sm" aria-label="監査アクションフィルタ">
                <option value="all"${state.settingsAuditActionFilter === 'all' ? ' selected' : ''}>全アクション（All Actions）</option>
                ${auditActionOptions.map((a) => `<option value="${escapeAttr(a)}"${state.settingsAuditActionFilter === a ? ' selected' : ''}>${escapeHtml(a)}</option>`).join('')}
              </select>
              <select id="settings-audit-page-size" class="select-sm" aria-label="監査ページサイズ" data-testid="settings-audit-page-size">
                ${[10, 20, 50].map((size) => `<option value="${size}"${auditPageSize === size ? ' selected' : ''}>${size}件/頁</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="card-body table-wrap">
          <table class="data-table" data-testid="audit-table">
            <thead>
              <tr>
                <th>${renderAuditSortButton('時刻（Time）', 'time')}</th>
                <th>${renderAuditSortButton('実行者（Actor）', 'actor')}</th>
                <th>${renderAuditSortButton('操作（Action）', 'action')}</th>
                <th>${renderAuditSortButton('詳細（Detail）', 'detail')}</th>
                <th>差分（Diff）</th>
              </tr>
            </thead>
            <tbody>
              ${pagedAudit.length ? pagedAudit.map((item, idx) => `
                <tr data-testid="audit-table-row-${idx}">
                  <td>${escapeHtml(item.time || '')}</td>
                  <td>${escapeHtml(item.actor || '')}</td>
                  <td>${escapeHtml(item.action || '')}</td>
                  <td>${escapeHtml(item.detail || '')}</td>
                  <td>
                    ${('before' in item || 'after' in item)
                      ? `<button class="btn btn-soft" type="button" data-action="open-audit-diff" data-audit-index="${datasets.auditTrail.indexOf(item)}" data-testid="audit-diff-${idx}">差分表示（Show Diff）</button>`
                      : '<span class="footer-note">なし（None）</span>'}
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="5">
                    <div class="empty-card">
                      <h3>該当ログなし（No Matching Logs）</h3>
                      <p>検索条件またはフィルタを変更してください。</p>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
        <div class="card-body" style="padding-top:0;">
          <div class="toolbar">
            <div class="toolbar-left">
              <span class="footer-note">表示 ${sortedAudit.length ? auditStart + 1 : 0}-${Math.min(auditStart + auditPageSize, sortedAudit.length)} / ${sortedAudit.length} 件</span>
            </div>
            <div class="toolbar-right">
              <button class="btn" type="button" data-action="audit-page-prev" data-testid="audit-page-prev" ${auditCurrentPage <= 1 ? 'disabled' : ''}>前へ</button>
              ${auditPageWindow.map((page) => `
                <button class="btn ${page === auditCurrentPage ? 'btn-soft' : ''}" type="button" data-action="audit-page-go" data-page="${page}" data-testid="audit-page-${page}">${page}</button>
              `).join('')}
              <button class="btn" type="button" data-action="audit-page-next" data-testid="audit-page-next" ${auditCurrentPage >= auditTotalPages ? 'disabled' : ''}>次へ</button>
              <span class="footer-note">Page ${auditCurrentPage}/${auditTotalPages}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="chart-card">
        <div class="card-head">
          <div>
            <div class="chart-title">監査タイムライン（Audit Timeline）</div>
            <p>直近イベントを時系列で確認します。差分付きイベントは詳細モーダルから Before/After を確認できます。</p>
          </div>
        </div>
        <div class="card-body">
          <div class="timeline">
            ${sortedAudit.slice(0, 12).map((item, idx) => `
              <div class="timeline-item" data-testid="audit-row-${idx}">
                <div class="timeline-time">${escapeHtml(item.time)}</div>
                <div class="timeline-body">
                  <h4>${escapeHtml(item.action)}</h4>
                  <p>実行者（Actor）: ${escapeHtml(item.actor)} / 詳細（Detail）: ${escapeHtml(item.detail)}</p>
                  ${('before' in item || 'after' in item) ? `
                    <div class="btn-row" style="margin-top:8px;">
                      <button class="btn btn-soft" type="button" data-action="open-audit-diff" data-audit-index="${datasets.auditTrail.indexOf(item)}">差分を見る（View Diff）</button>
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function renderSettingsPage() {
    const deptOptions = Array.from(new Set(datasets.users.map((u) => u.department))).sort((a, b) => a.localeCompare(b, 'ja'));
    const auditActionOptions = Array.from(new Set(datasets.auditTrail.map((a) => a.action))).sort((a, b) => a.localeCompare(b, 'ja'));
    const filteredUsers = datasets.users.filter((user) => {
      const q = state.settingsUserQuery.toLowerCase();
      const byQuery = !q || stringifyRecord(user).includes(q);
      const byRole = state.settingsUserRoleFilter === 'all' || user.role === state.settingsUserRoleFilter;
      const byStatus =
        state.settingsUserStatusFilter === 'all' ||
        (state.settingsUserStatusFilter === 'active' && user.status === 'active') ||
        (state.settingsUserStatusFilter === 'inactive' && user.status === 'inactive');
      const byDept = state.settingsUserDeptFilter === 'all' || user.department === state.settingsUserDeptFilter;
      return byQuery && byRole && byStatus && byDept;
    });

    const sortedUsers = [...filteredUsers].sort((a, b) => compareUsers(a, b, state.settingsUserSortKey, state.settingsUserSortDir));
    const pageSize = Math.max(1, state.settingsUserPageSize);
    const totalPages = Math.max(1, Math.ceil(sortedUsers.length / pageSize));
    const currentPage = Math.min(state.settingsUserPage, totalPages);
    state.settingsUserPage = currentPage;
    const pageStart = (currentPage - 1) * pageSize;
    const pagedUsers = sortedUsers.slice(pageStart, pageStart + pageSize);
    const pageWindow = buildPageWindow(currentPage, totalPages);
    const filteredAudit = datasets.auditTrail.filter((item) => {
      const q = state.settingsAuditQuery.toLowerCase();
      const byQuery = !q || stringifyRecord(item).includes(q);
      const byAction = state.settingsAuditActionFilter === 'all' || item.action === state.settingsAuditActionFilter;
      return byQuery && byAction;
    });

    const userRows = pagedUsers.map((user, idx) => `
      <tr data-testid="user-row-${idx}">
        <td>${escapeHtml(user.id)}</td>
        <td>${stackCell(user.name, `${user.userId} / ${user.email}`)}</td>
        <td>${escapeHtml(user.department)}</td>
        <td><span class="tag tag-info">${escapeHtml(user.role)}</span></td>
        <td>${user.status === 'active' ? '<span class="status-chip status-resolved">有効</span>' : '<span class="status-chip status-review">無効</span>'}</td>
        <td>
          <div class="btn-row">
            <button class="btn btn-soft" type="button" data-action="open-user-edit" data-id="${escapeAttr(user.id)}" data-testid="user-edit-${escapeAttr(user.id)}">編集</button>
            <button class="btn btn-danger" type="button" data-action="open-user-delete" data-id="${escapeAttr(user.id)}" data-testid="user-delete-${escapeAttr(user.id)}">削除</button>
          </div>
        </td>
      </tr>
    `).join('');

    const apiStatusBadge = {
      idle: '<span class="pill role">API 未接続</span>',
      loading: '<span class="pill warn">API 読込中</span>',
      ready: '<span class="pill live">API 接続中</span>',
      error: '<span class="pill warn">API 接続失敗（ローカル継続）</span>'
    }[state.apiStatus] || '<span class="pill warn">API 状態不明</span>';

    return `
      <section class="hero-card">
        <div>
          <h3>システム設定（サンプル）</h3>
          <p>通知・運用プロファイル・権限管理のUIモックです。永続化は未実装です。</p>
        </div>
        <div class="toolbar">
          <div class="toolbar-left">${apiStatusBadge}</div>
          <div class="toolbar-right">
            <button class="btn btn-soft" type="button" data-action="quick-toast">設定ヘルプ</button>
          </div>
        </div>
      </section>

      <div class="cards-grid-2">
        <section class="panel">
          <h3 class="panel-title">基本プロファイル</h3>
          <div class="form-grid" style="margin-top: 12px;">
            <div class="field">
              <label>システム表示名</label>
              <input type="text" value="ITSM-Sec Nexus">
            </div>
            <div class="inline-fields">
              <div class="field">
                <label>タイムゾーン</label>
                <select><option selected>Asia/Tokyo</option><option>UTC</option></select>
              </div>
              <div class="field">
                <label>言語</label>
                <select><option selected>日本語</option><option>English</option></select>
              </div>
            </div>
            <div class="btn-row">
              <button class="btn btn-primary" type="button" data-action="quick-toast">保存（デモ）</button>
            </div>
          </div>
        </section>

        <section class="panel">
          <h3 class="panel-title">通知・アラート</h3>
          <div class="info-list" style="margin-top: 12px;">
            <div class="info-item"><span class="label">メール通知</span><span class="value">有効</span></div>
            <div class="info-item"><span class="label">Teams Webhook</span><span class="value">有効</span></div>
            <div class="info-item"><span class="label">Slack 通知</span><span class="value">無効</span></div>
            <div class="info-item"><span class="label">SLA事前アラート</span><span class="value">120分前</span></div>
          </div>
          <div class="btn-row" style="margin-top: 12px;">
            <button class="btn btn-soft" type="button" data-action="quick-toast">テスト通知</button>
          </div>
        </section>
      </div>

      <section class="table-card">
        <div class="card-head">
          <div>
            <div class="table-title">ユーザー設定</div>
            <p>ユーザーの新規作成・編集・削除、およびロール割当の管理（ローカルデモ）</p>
          </div>
          <button class="btn btn-primary btn-icon" type="button" data-action="open-user-create" data-testid="user-create-open">
            <i class="fa-solid fa-user-plus"></i>
            新規ユーザー作成
          </button>
        </div>
        <div class="card-body" style="padding-bottom: 0;">
            <div class="toolbar">
              <div class="toolbar-left">
              <div class="search-box">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input id="settings-user-search" data-testid="settings-user-search" type="search" value="${escapeAttr(state.settingsUserQuery)}" placeholder="ユーザーID / 氏名 / メール / 部署">
              </div>
              <select id="settings-role-filter" data-testid="settings-role-filter" class="select-sm" aria-label="ロールフィルタ">
                <option value="all"${state.settingsUserRoleFilter === 'all' ? ' selected' : ''}>全ロール</option>
                ${rolePermissions.map((r) => `<option value="${escapeAttr(r.role)}"${state.settingsUserRoleFilter === r.role ? ' selected' : ''}>${escapeHtml(r.role)}</option>`).join('')}
              </select>
              <select id="settings-status-filter" data-testid="settings-status-filter" class="select-sm" aria-label="状態フィルタ">
                <option value="all"${state.settingsUserStatusFilter === 'all' ? ' selected' : ''}>全状態</option>
                <option value="active"${state.settingsUserStatusFilter === 'active' ? ' selected' : ''}>有効</option>
                <option value="inactive"${state.settingsUserStatusFilter === 'inactive' ? ' selected' : ''}>無効</option>
              </select>
              <select id="settings-dept-filter" data-testid="settings-dept-filter" class="select-sm" aria-label="部署フィルタ">
                <option value="all"${state.settingsUserDeptFilter === 'all' ? ' selected' : ''}>全部署</option>
                ${deptOptions.map((d) => `<option value="${escapeAttr(d)}"${state.settingsUserDeptFilter === d ? ' selected' : ''}>${escapeHtml(d)}</option>`).join('')}
              </select>
              <select id="settings-page-size" data-testid="settings-page-size" class="select-sm" aria-label="ページサイズ">
                ${[5, 10, 20].map((size) => `<option value="${size}"${pageSize === size ? ' selected' : ''}>${size}件/頁</option>`).join('')}
              </select>
            </div>
          </div>
        </div>
        <div class="card-body table-wrap">
          <table class="data-table" data-testid="user-table">
            <thead>
              <tr>
                <th>${renderSortButton('ID', 'id')}</th>
                <th>${renderSortButton('ユーザー', 'name')}</th>
                <th>${renderSortButton('部署', 'department')}</th>
                <th>${renderSortButton('ロール権限', 'role')}</th>
                <th>${renderSortButton('状態', 'status')}</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              ${userRows || `
                <tr>
                  <td colspan="6">
                    <div class="empty-card">
                      <h3>該当ユーザーなし</h3>
                      <p>検索・フィルタ条件を変更してください。</p>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
        <div class="card-body" style="padding-top:0;">
          <div class="toolbar">
            <div class="toolbar-left">
              <span class="footer-note">表示 ${sortedUsers.length ? pageStart + 1 : 0}-${Math.min(pageStart + pageSize, sortedUsers.length)} / ${sortedUsers.length} 件</span>
            </div>
            <div class="toolbar-right">
              <button class="btn" type="button" data-action="users-page-prev" data-testid="users-page-prev" ${currentPage <= 1 ? 'disabled' : ''}>前へ</button>
              ${pageWindow.map((page) => `
                <button class="btn ${page === currentPage ? 'btn-soft' : ''}" type="button" data-action="users-page-go" data-page="${page}" data-testid="users-page-${page}">${page}</button>
              `).join('')}
              <button class="btn" type="button" data-action="users-page-next" data-testid="users-page-next" ${currentPage >= totalPages ? 'disabled' : ''}>次へ</button>
              <span class="footer-note">Page ${currentPage}/${totalPages}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="table-card">
        <div class="card-head">
          <div>
            <div class="table-title">ロール権限マトリクス</div>
            <p>ロールごとの操作範囲（UIモック / 実アクセス制御は未実装）</p>
          </div>
          <button class="btn btn-primary" type="button" data-action="save-role-permissions" data-testid="role-matrix-save">権限マトリクス保存</button>
        </div>
        <div class="card-body table-wrap">
          <table class="data-table" id="role-permission-table" data-testid="role-permission-table">
            <thead>
              <tr>
                <th>ロール</th>
                <th>閲覧範囲 (scope)</th>
                <th>更新</th>
                <th>承認</th>
                <th>監査ログ</th>
                <th>管理者設定</th>
              </tr>
            </thead>
            <tbody>
              ${rolePermissions.map((r) => `
                <tr data-role="${escapeAttr(r.role)}">
                  <td>${escapeHtml(r.role)}</td>
                  <td data-col="scope">${renderPermissionScopeEditor(r.scope)}</td>
                  <td>${renderPermissionCheckbox('update', r.update === '可', r.role)}</td>
                  <td>${renderPermissionCheckbox('approve', r.approve === '可', r.role)}</td>
                  <td>${renderPermissionCheckbox('audit', r.audit === '可', r.role)}</td>
                  <td>${renderPermissionCheckbox('admin', r.admin === '可', r.role)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </section>

      <section class="chart-card">
        <div class="card-head">
          <div>
            <div class="chart-title">ユーザー設定監査ログ（直近）</div>
            <p>検索/フィルタと差分ビュー（before/after）に対応</p>
          </div>
        </div>
        <div class="card-body">
          <div class="toolbar" style="margin-bottom: 10px;">
            <div class="toolbar-left">
              <div class="search-box">
                <i class="fa-solid fa-magnifying-glass"></i>
                <input id="settings-audit-search" data-testid="settings-audit-search" type="search" value="${escapeAttr(state.settingsAuditQuery)}" placeholder="監査ログ検索（actor/action/detail）">
              </div>
              <select id="settings-audit-action-filter" data-testid="settings-audit-action-filter" class="select-sm" aria-label="監査アクションフィルタ">
                <option value="all"${state.settingsAuditActionFilter === 'all' ? ' selected' : ''}>全アクション</option>
                ${auditActionOptions.map((a) => `<option value="${escapeAttr(a)}"${state.settingsAuditActionFilter === a ? ' selected' : ''}>${escapeHtml(a)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="timeline">
            ${filteredAudit.slice(0, 12).map((item, idx) => `
              <div class="timeline-item" data-testid="audit-row-${idx}">
                <div class="timeline-time">${escapeHtml(item.time)}</div>
                <div class="timeline-body">
                  <h4>${escapeHtml(item.action)}</h4>
                  <p>${escapeHtml(item.actor)} / ${escapeHtml(item.detail)}</p>
                  ${('before' in item || 'after' in item) ? `
                    <div class="btn-row" style="margin-top:8px;">
                      <button class="btn btn-soft" type="button" data-action="open-audit-diff" data-audit-index="${datasets.auditTrail.indexOf(item)}" data-testid="audit-diff-${idx}">差分を見る</button>
                    </div>
                  ` : ''}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>
    `;
  }

  function stackCell(primary, secondary) {
    return `
      <div class="stack-cell">
        <div class="primary">${escapeHtml(primary)}</div>
        <div class="secondary">${escapeHtml(secondary)}</div>
      </div>
    `;
  }

  function priorityTag(priority) {
    const map = {
      critical: { label: 'Critical', className: 'tag-critical' },
      high: { label: 'High', className: 'tag-high' },
      medium: { label: 'Medium', className: 'tag-info' },
      low: { label: 'Low', className: 'tag-ok' },
      info: { label: 'Info', className: 'tag-info' }
    };
    const value = map[priority] || { label: priority, className: '' };
    return `<span class="tag ${value.className}">${escapeHtml(value.label)}</span>`;
  }

  function statusChip(status) {
    const map = {
      open: { label: '未対応', className: 'status-open' },
      progress: { label: '対応中', className: 'status-progress' },
      resolved: { label: '完了', className: 'status-resolved' },
      violated: { label: '違反', className: 'status-violated' },
      review: { label: '承認待ち', className: 'status-review' }
    };
    const value = map[status] || { label: status, className: 'status-review' };
    return `<span class="status-chip ${value.className}">${escapeHtml(value.label)}</span>`;
  }

  function renderPermissionCheckbox(key, checked, role) {
    return `
      <label style="display:inline-flex; align-items:center; gap:6px; cursor:pointer;">
        <input type="checkbox" data-perm="${escapeAttr(key)}" data-role="${escapeAttr(role)}" data-testid="perm-${escapeAttr(role)}-${escapeAttr(key)}"${checked ? ' checked' : ''}>
        <span style="font-size:0.82rem;">${checked ? '可' : '不可'}</span>
      </label>
    `;
  }

  function renderPermissionScopeEditor(scope) {
    return `
      <select data-col="scope" class="select-sm" style="min-height:36px;" data-testid="perm-scope-editor">
        ${['全画面', '運用系', 'セキュリティ系', '一部画面', '参照のみ'].map((v) =>
          `<option value="${escapeAttr(v)}"${scope === v ? ' selected' : ''}>${escapeHtml(v)}</option>`
        ).join('')}
      </select>
    `;
  }

  function renderSortButton(label, key) {
    const active = state.settingsUserSortKey === key;
    const arrow = active ? (state.settingsUserSortDir === 'asc' ? '▲' : '▼') : '⇅';
    return `<button type="button" data-action="sort-users" data-sort="${escapeAttr(key)}" data-testid="user-sort-${escapeAttr(key)}" style="border:none;background:none;padding:0;cursor:pointer;font:inherit;color:inherit;font-weight:700;">${escapeHtml(label)} ${arrow}</button>`;
  }

  function renderAuditSortButton(label, key) {
    const active = state.settingsAuditSortKey === key;
    const arrow = active ? (state.settingsAuditSortDir === 'asc' ? '▲' : '▼') : '⇅';
    return `<button type="button" data-action="sort-audit" data-sort="${escapeAttr(key)}" data-testid="audit-sort-${escapeAttr(key)}" style="border:none;background:none;padding:0;cursor:pointer;font:inherit;color:inherit;font-weight:700;">${escapeHtml(label)} ${arrow}</button>`;
  }

  function extractAuditDiffChanges(entry) {
    const before = entry && typeof entry.before === 'object' && entry.before !== null ? entry.before : {};
    const after = entry && typeof entry.after === 'object' && entry.after !== null ? entry.after : {};
    const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)])).sort((a, b) => a.localeCompare(b, 'ja'));
    return keys
      .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map((key) => ({ key, before: before[key] ?? null, after: after[key] ?? null }));
  }

  function renderFieldError(field) {
    const message = state.modalErrors[field];
    if (!message) return '';
    return `<div data-error-for="${escapeAttr(field)}" style="color:#b91c1c;font-size:0.78rem;margin-top:4px;">${escapeHtml(message)}</div>`;
  }

  function renderInlineFormErrors() {
    if (!state.modal) return;
    Object.entries(state.modalErrors).forEach(([field, message]) => {
      const container = document.querySelector(`[data-error-for="${CSS.escape(field)}"]`);
      if (container) container.textContent = message;
    });
    ['userId', 'name', 'department', 'email', 'role', 'status'].forEach((field) => {
      if (state.modalErrors[field]) return;
      const container = document.querySelector(`[data-error-for="${CSS.escape(field)}"]`);
      if (container) container.textContent = '';
    });
  }

  function openDetailModal(datasetKey, record) {
    const rows = Object.entries(record).map(([key, value]) => `
      <div class="info-item">
        <span class="label">${escapeHtml(humanizeKey(key))}</span>
        <span class="value">${escapeHtml(String(value))}</span>
      </div>
    `).join('');

    openModal({
      kind: 'detail',
      title: `${resolveCreateTitle(datasetKey)}詳細: ${record.id}`,
      datasetKey,
      body: `
        <div class="info-list">${rows}</div>
        <div class="note-box">詳細モーダルはサンプル表示です。編集/削除の実処理は未実装です。</div>
      `
    });
  }

  function openAuditDiffModal(entry) {
    const changes = extractAuditDiffChanges(entry);
    openModal({
      kind: 'audit-diff',
      title: `監査ログ差分: ${entry.action}`,
      submitLabel: '閉じる',
      body: `
        <div class="info-list">
          <div class="info-item"><span class="label">時刻</span><span class="value">${escapeHtml(entry.time || '')}</span></div>
          <div class="info-item"><span class="label">実行者</span><span class="value">${escapeHtml(entry.actor || '')}</span></div>
          <div class="info-item"><span class="label">操作</span><span class="value">${escapeHtml(entry.action || '')}</span></div>
          <div class="info-item"><span class="label">詳細</span><span class="value">${escapeHtml(entry.detail || '')}</span></div>
        </div>
        <section class="table-card" style="margin-top:12px;">
          <div class="card-head">
            <div>
              <div class="table-title">変更差分（Changed Keys Only）</div>
              <p>変更があったキーのみ表示します。</p>
            </div>
          </div>
          <div class="card-body table-wrap">
            <table class="data-table" data-testid="audit-diff-table">
              <thead>
                <tr>
                  <th>項目（Key）</th>
                  <th>変更前（Before）</th>
                  <th>変更後（After）</th>
                </tr>
              </thead>
              <tbody>
                ${changes.length ? changes.map((row, idx) => `
                  <tr data-testid="audit-diff-row-${idx}">
                    <td>${escapeHtml(row.key)}</td>
                    <td><pre style="margin:0; white-space:pre-wrap; word-break:break-word; font-size:0.78rem;">${escapeHtml(prettyJson(row.before))}</pre></td>
                    <td><pre style="margin:0; white-space:pre-wrap; word-break:break-word; font-size:0.78rem;">${escapeHtml(prettyJson(row.after))}</pre></td>
                  </tr>
                `).join('') : `
                  <tr>
                    <td colspan="3">
                      <div class="empty-card">
                        <h3>変更差分なし</h3>
                        <p>before / after の比較対象がない、または差分がありません。</p>
                      </div>
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </section>
      `
    });
  }

  function openUserFormModal(mode, record) {
    state.modalErrors = {};
    const isEdit = mode === 'edit';
    const user = record || {
      id: '',
      userId: '',
      name: '',
      department: '',
      role: 'サービスデスク',
      status: 'active',
      email: '',
      version: 1
    };

    openModal({
      kind: isEdit ? 'user-edit' : 'user-create',
      title: isEdit ? `ユーザー編集: ${user.id}` : 'ユーザー新規作成',
      datasetKey: 'users',
      body: `
        <div class="form-grid">
          <div class="inline-fields">
            <div class="field">
              <label>ユーザーID</label>
              <input id="user-form-userId" data-testid="user-form-userId" type="text" value="${escapeAttr(user.userId)}" placeholder="例: t.yamada" ${isEdit ? 'readonly' : ''}>
              ${renderFieldError('userId')}
            </div>
            <div class="field">
              <label>表示名</label>
              <input id="user-form-name" data-testid="user-form-name" type="text" value="${escapeAttr(user.name)}" placeholder="例: 山田 太郎">
              ${renderFieldError('name')}
            </div>
          </div>
          <div class="inline-fields">
            <div class="field">
              <label>部署</label>
              <input id="user-form-department" data-testid="user-form-department" type="text" value="${escapeAttr(user.department)}" placeholder="例: 情報シス部">
              ${renderFieldError('department')}
            </div>
            <div class="field">
              <label>メール</label>
              <input id="user-form-email" data-testid="user-form-email" type="email" value="${escapeAttr(user.email)}" placeholder="name@example.local">
              ${renderFieldError('email')}
            </div>
          </div>
          <div class="inline-fields">
            <div class="field">
              <label>ロール権限</label>
              <select id="user-form-role" data-testid="user-form-role">
                ${rolePermissions.map((r) => `<option value="${escapeAttr(r.role)}"${user.role === r.role ? ' selected' : ''}>${escapeHtml(r.role)}</option>`).join('')}
              </select>
              ${renderFieldError('role')}
            </div>
            <div class="field">
              <label>状態</label>
              <select id="user-form-status" data-testid="user-form-status">
                <option value="active"${user.status === 'active' ? ' selected' : ''}>有効</option>
                <option value="inactive"${user.status === 'inactive' ? ' selected' : ''}>無効</option>
              </select>
              ${renderFieldError('status')}
            </div>
          </div>
          ${isEdit ? `<input id="user-form-recordId" type="hidden" value="${escapeAttr(user.id)}"><input id="user-form-version" type="hidden" value="${escapeAttr(user.version ?? 1)}">` : ''}
          <div class="note-box">保存時に入力バリデーションを実施し、API接続時はバックエンドへ永続化します。</div>
        </div>
      `,
      submitLabel: isEdit ? '更新' : '作成'
    });
  }

  function openUserDeleteModal(record) {
    openModal({
      kind: 'user-delete',
      title: `ユーザー削除: ${record.id}`,
      datasetKey: 'users',
      recordId: record.id,
      body: `
        <div class="info-list">
          <div class="info-item"><span class="label">対象</span><span class="value">${escapeHtml(record.name)} (${escapeHtml(record.userId)})</span></div>
          <div class="info-item"><span class="label">部署</span><span class="value">${escapeHtml(record.department)}</span></div>
          <div class="info-item"><span class="label">ロール権限</span><span class="value">${escapeHtml(record.role)}</span></div>
        </div>
        <div class="note-box">削除操作はAPI接続時に永続化され、監査ログにも記録します。</div>
      `,
      submitLabel: '削除',
      submitClass: 'btn-danger'
    });
  }

  async function handleModalSubmit() {
    if (!state.modal) return false;

    if (state.modal.kind === 'user-create' || state.modal.kind === 'user-edit') {
      const userIdEl = document.getElementById('user-form-userId');
      const nameEl = document.getElementById('user-form-name');
      const deptEl = document.getElementById('user-form-department');
      const emailEl = document.getElementById('user-form-email');
      const roleEl = document.getElementById('user-form-role');
      const statusEl = document.getElementById('user-form-status');
      const recordIdEl = document.getElementById('user-form-recordId');
      const versionEl = document.getElementById('user-form-version');
      if (!userIdEl || !nameEl || !deptEl || !emailEl || !roleEl || !statusEl) return false;

      const payload = {
        userId: userIdEl.value.trim(),
        name: nameEl.value.trim(),
        department: deptEl.value.trim(),
        email: emailEl.value.trim(),
        role: roleEl.value,
        status: statusEl.value
      };

      const validation = validateUserPayload(payload, state.modal.kind === 'user-edit');
      if (!validation.ok) {
        state.modalErrors = validation.errors || {};
        renderModal();
        if (validation.message) {
          pushToast('warn', '入力エラー', validation.message);
        }
        return true;
      }
      state.modalErrors = {};

      if (state.modal.kind === 'user-create') {
        const duplicate = datasets.users.some((u) => u.userId === payload.userId);
        if (duplicate) {
          pushToast('warn', '重複', `ユーザーID ${payload.userId} は既に存在します。`);
          return true;
        }
        const optimistic = { id: nextUserRecordId(), ...payload };
        datasets.users.unshift(optimistic);
        try {
          const saved = await apiClient.createUser(payload);
          if (saved && saved.id) {
            datasets.users[0] = saved;
          }
        } catch (error) {
          console.warn('Failed to persist created user:', error);
          applyApiFieldErrorsFromError(error);
          datasets.users = datasets.users.filter((u) => u.id !== optimistic.id);
          pushToast('warn', 'API保存失敗', 'ユーザー作成に失敗したため一覧への反映を戻しました。');
          return true;
        }
        const created = datasets.users[0];
        await appendAuditLog(state.user.name, 'ユーザー作成', `${payload.userId} (${payload.role}) を作成`, undefined, created);
        pushToast('success', 'ユーザー作成', `${payload.name} を追加しました。`);
      } else {
        const recordId = recordIdEl ? recordIdEl.value : state.modal.recordId;
        const index = datasets.users.findIndex((u) => u.id === recordId);
        if (index === -1) {
          pushToast('warn', '対象なし', '編集対象ユーザーが見つかりません。');
          closeModal();
          return true;
        }
        const beforeUser = { ...datasets.users[index] };
        datasets.users[index] = {
          ...datasets.users[index],
          ...payload
        };
        try {
          const currentVersion = versionEl ? Number(versionEl.value) || 1 : (beforeUser.version || 1);
          const saved = await apiClient.updateUser(recordId, payload, currentVersion);
          if (saved) {
            datasets.users[index] = saved;
          }
        } catch (error) {
          console.warn('Failed to persist updated user:', error);
          applyApiFieldErrorsFromError(error);
          datasets.users[index] = beforeUser;
          if (error && error.status === 409) {
            state.modalErrors = { ...state.modalErrors, name: '他の更新と競合しました。画面を再読み込みして再編集してください。' };
            renderModal();
            pushToast('warn', '競合更新', '他の更新が先に保存されました（バージョン不一致）。');
            return true;
          }
          pushToast('warn', 'API保存失敗', 'ユーザー更新に失敗したため変更を戻しました。');
          return true;
        }
        await appendAuditLog(state.user.name, 'ユーザー更新', `${payload.userId} (${payload.role}) を更新`, beforeUser, datasets.users[index]);
        pushToast('success', 'ユーザー更新', `${payload.name} を更新しました。`);
      }

      closeModal();
      if (state.currentView === 'settings') syncViewContentOnly();
      return true;
    }

    if (state.modal.kind === 'user-delete') {
      const before = datasets.users.length;
      const beforeUser = datasets.users.find((u) => u.id === state.modal.recordId);
      const snapshot = datasets.users.map((u) => ({ ...u }));
      datasets.users = datasets.users.filter((u) => u.id !== state.modal.recordId);
      try {
        await apiClient.deleteUser(state.modal.recordId);
      } catch (error) {
        console.warn('Failed to persist user delete:', error);
        datasets.users = snapshot;
        pushToast('warn', 'API削除失敗', 'ユーザー削除に失敗したため一覧を元に戻しました。');
        return true;
      }
      if (datasets.users.length === before) {
        pushToast('warn', '対象なし', '削除対象ユーザーが見つかりません。');
      } else {
        await appendAuditLog(state.user.name, 'ユーザー削除', `${state.modal.recordId} を削除`, beforeUser, null);
        pushToast('success', 'ユーザー削除', `${state.modal.recordId} を削除しました。`);
      }
      closeModal();
      if (state.currentView === 'settings') syncViewContentOnly();
      return true;
    }

    return false;
  }

  function nextUserRecordId() {
    const max = datasets.users.reduce((acc, user) => {
      const num = Number(String(user.id).replace('USR-', ''));
      return Number.isFinite(num) ? Math.max(acc, num) : acc;
    }, 0);
    return `USR-${String(max + 1).padStart(3, '0')}`;
  }

  function validateUserPayload(payload, isEdit = false) {
    const userIdPattern = /^[a-zA-Z0-9._-]{3,32}$/;
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const errors = {};
    if (!payload.userId || !payload.name || !payload.department || !payload.email) {
      if (!payload.userId) errors.userId = '必須項目です。';
      if (!payload.name) errors.name = '必須項目です。';
      if (!payload.department) errors.department = '必須項目です。';
      if (!payload.email) errors.email = '必須項目です。';
    }
    if (!userIdPattern.test(payload.userId)) {
      errors.userId = '3-32文字の英数字・`.`・`_`・`-`のみ使用できます。';
    }
    if (payload.name.length < 2 || payload.name.length > 40) {
      errors.name = '2〜40文字で入力してください。';
    }
    if (payload.department.length < 2 || payload.department.length > 60) {
      errors.department = '2〜60文字で入力してください。';
    }
    if (!emailPattern.test(payload.email) || payload.email.length > 120) {
      errors.email = '有効なメールアドレスを入力してください。';
    }
    if (!rolePermissions.some((r) => r.role === payload.role)) {
      errors.role = '選択されたロール権限が不正です。';
    }
    if (!['active', 'inactive'].includes(payload.status)) {
      errors.status = '状態が不正です。';
    }
    if (Object.keys(errors).length > 0) {
      const first = Object.values(errors)[0];
      return { ok: false, message: String(first), errors };
    }
    return { ok: true, errors: {} };
  }

  function applyApiFieldErrorsFromError(error) {
    const payload = error && error.payload;
    if (!payload || typeof payload !== 'object') return;
    if (payload.fields && typeof payload.fields === 'object') {
      state.modalErrors = { ...state.modalErrors, ...payload.fields };
      renderModal();
    }
  }

  function openModal(modal) {
    if (modal.kind !== 'user-create' && modal.kind !== 'user-edit') {
      state.modalErrors = {};
    }
    state.modal = modal;
    renderModal();
  }

  function closeModal() {
    state.modal = null;
    renderModal();
  }

  function renderModal() {
    const root = document.getElementById('modal-root');
    if (!root) return;

    if (!state.modal) {
      root.classList.remove('open');
      root.innerHTML = '';
      return;
    }

    root.classList.add('open');
    const submitClass = state.modal.submitClass || 'btn-primary';
    const submitLabel = state.modal.submitLabel || '保存（デモ）';
    root.innerHTML = `
      <div class="modal-backdrop" data-action="modal-close" data-testid="modal-backdrop"></div>
      <div class="modal-card" role="dialog" aria-modal="true" aria-label="${escapeAttr(state.modal.title)}" data-testid="modal-card">
        <div class="modal-head">
          <h3>${escapeHtml(state.modal.title)}</h3>
        </div>
        <div class="modal-body">
          ${state.modal.body}
        </div>
        <div class="modal-foot">
          <div class="footer-note">UIデモ: 保存・更新の実処理は未接続</div>
          <div class="btn-row">
            <button class="btn" type="button" data-action="modal-close" data-testid="modal-close">閉じる</button>
            <button class="btn ${submitClass}" type="button" data-action="modal-submit" data-testid="modal-submit">${escapeHtml(submitLabel)}</button>
          </div>
        </div>
      </div>
    `;
  }

  function pushToast(type, title, message) {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    state.toasts = [...state.toasts, { id, type, title, message }];
    renderToasts();
    window.setTimeout(() => {
      state.toasts = state.toasts.filter((toast) => toast.id !== id);
      renderToasts();
    }, 2600);
  }

  function renderToasts() {
    const root = document.getElementById('toast-stack');
    if (!root) return;
    root.innerHTML = state.toasts.map((toast) => `
      <div class="toast ${escapeAttr(toast.type)}">
        <strong>${escapeHtml(toast.title)}</strong>
        <p>${escapeHtml(toast.message)}</p>
      </div>
    `).join('');
  }

  function findViewMeta(viewId) {
    for (const section of navSections) {
      const item = section.items.find((entry) => entry.id === viewId);
      if (item) return item;
    }
    return null;
  }

  function resolveCreateTitle(datasetKey) {
    const map = {
      incidents: 'インシデント',
      requests: 'サービス要求',
      changes: '変更要求',
      assets: '資産',
      knowledge: 'ナレッジ記事'
    };
    return map[datasetKey] || '項目';
  }

  function humanizeKey(key) {
    const labels = {
      id: 'ID',
      title: 'タイトル',
      team: '担当チーム',
      priority: '優先度',
      status: '状態',
      age: '経過時間',
      impact: '影響範囲',
      summary: '概要',
      type: '種別',
      requester: '申請者',
      sla: 'SLA',
      due: '期限',
      detail: '詳細',
      risk: 'リスク',
      owner: '担当/所有',
      window: '実施ウィンドウ',
      note: '備考',
      name: '名称',
      location: '設置場所',
      category: 'カテゴリ',
      score: '評価',
      updated: '更新日時'
    };
    return labels[key] || key;
  }

  function stringifyRecord(record) {
    return Object.values(record).join(' ').toLowerCase();
  }

  function prettyJson(value) {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  function escapeAttr(value) {
    return escapeHtml(value);
  }

  init();
});
