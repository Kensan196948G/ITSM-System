document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & Data ---

    const views = {
        dash: {
            title: '統合ダッシュボード',
            render: renderDashboard
        },
        incidents: {
            title: 'インシデント管理 (ISO 20000)',
            info: {
                meaning: 'ITサービスの中断や品質低下を最小限に抑え、可能な限り迅速にサービスを回復させるプロセスです。',
                necessity: '予期せぬトラブルによる業務停止時間を最短化し、ビジネスへの悪影響を最小限に食い止めるために不可欠です。'
            },
            render: () => renderTable('インシデント一覧', [
                ['ID', '発生日時', '内容', '影響範囲', '優先度', 'ステータス'],
                ['INC-001', '2025-12-26 09:15', 'OneDrive 同期不可', '営業部（15名）', '<span class="badge badge-warning">高</span>', '対応中'],
                ['INC-002', '2025-12-26 10:30', '3Fプリンタ印刷不可', '総務部（5名）', '中', '対応中'],
                ['INC-003', '2025-12-26 11:05', '社内ポータル接続遅延', '全社（200名）', '<span class="badge badge-warning">高</span>', '調査中'],
                ['INC-005', '2025-12-26 14:45', 'VPN接続不可', '在宅勤務者（3名）', '<span class="badge badge-warning">高</span>', '復旧作業中']
            ])
        },
        problems: {
            title: '問題管理',
            info: {
                meaning: '繰り返されるインシデントや重大な障害の「根本原因」を特定し、再発を防止するための恒久的な対策を策定するプロセスです。',
                necessity: '対症療法的な解決（インシデント対応）だけでは防げない、類似トラブルの再発を止め、運用チームの負荷とビジネスリスクを軽減します。'
            },
            render: () => renderTable('問題・根本原因分析', [
                ['ID', '概要', '関連インシデント', 'ステータス', '優先度', '担当'],
                ['PRB-01', 'OneDrive 同期不具合の再発', '12件', '分析中', '高', 'クライアントチーム'],
                ['PRB-02', 'VPN接続タイムアウト頻発', '8件', '分析中', '中', 'ネットワークチーム'],
                ['PRB-03', 'メール遅延（特定ドメイン）', '5件', '対策済', '中', 'メールチーム']
            ])
        },
        changes: {
            title: '変更管理',
            info: {
                meaning: 'ITインフラやサービスへの変更（修正、更新、追加）を計画的にコントロールし、リスク・影響を評価・承認するプロセスです。',
                necessity: '無計画な変更による「意図しないシステムダウン」を防ぎ、確実に、かつ最小限のリスクでシステムを進化させるために必須です。'
            },
            render: () => renderTable('変更要求 (RFC) 一覧', [
                ['ID', '変更内容', 'カテゴリ', 'リスク', '実施予定', 'ステータス'],
                ['CHG-01', 'Windows Update (全社)', '標準変更', '低', '12/28', '承認済'],
                ['CHG-02', 'FWルール追加', '通常変更', '中', '12/27', '承認待ち'],
                ['CHG-03', '基幹システムDB移行', '重要変更', '高', '12/30', '計画中']
            ])
        },
        releases: {
            title: 'リリース管理',
            info: {
                meaning: '承認された変更（ソフトウェアやハードウェア）を、実際に本番環境へ展開・デプロイする一連の活動です。',
                necessity: '新しい機能をユーザーに届ける際、既存環境の安定性を壊さないよう、検証済みのパッケージを安全にリリースするために必要です。'
            },
            render: () => renderTable('リリースパッケージ・展開状況', [
                ['ID', 'リリース名', '変更数', '対象', '予定日', '進捗'],
                ['REL-01', 'OneDrive 設定標準化', '5件', '全社', '12/28', '45%'],
                ['REL-02', 'セキュリティ強化パッケージ Q4', '8件', '全社', '1/10', '計画中']
            ])
        },
        requests: {
            title: 'サービス要求管理',
            info: {
                meaning: 'ユーザーからの標準的な依頼（パスワードリセット、権限追加、機器貸出など）を効率的に処理するプロセスです。',
                necessity: '日常的な小さな「困りごと」や「要望」を標準化された手順で迅速にこなすことで、従業員の生産性を維持します。'
            },
            render: () => renderTable('サービス要求・申請一覧', [
                ['ID', '要求タイプ', '内容', '申請者', '申請日', '状況'],
                ['REQ-01', 'アカウント作成', '新入社員PCセットアップ', '人事部', '12/25', '処理中'],
                ['REQ-02', 'アクセス権限', '共有フォルダ権限追加', '営業部', '12/26', '承認待ち']
            ])
        },
        cmdb: {
            title: '構成管理 (CMDB)',
            info: {
                meaning: 'ITシステムの構成要素（サーバ、PC、ネットワーク、ソフトなど）とそれらの繋がりをデータベースで正確に管理することです。',
                necessity: '「どこで何が動いているか」「何かが壊れたときにどこに影響するか」という現状を把握し、正しいIT管理を行うための土台となります。'
            },
            render: () => renderTable('IT構成資産 (CI) 一覧', [
                ['CI ID', '名称', '種別', 'ステータス', '所有部署', '最終更新'],
                ['PC-023', '営業部ノートPC #23', 'エンドポイント', '稼働中', '営業部', '12/20'],
                ['SRV-01', 'ADドメインコントローラ', 'サーバ', '稼働中', '情シス', '12/15'],
                ['FW-01', 'メインファイアウォール', 'ネットワーク', '稼働中', '情シス', '12/10']
            ])
        },
        sla: {
            title: 'SLA管理',
            info: {
                meaning: '提供するITサービスの品質（稼働率、解決時間など）を定義し、その結果を定期的に測定・報告するプロセスです。',
                necessity: 'サービスの質を「見える化」し、合意した基準を満たしているかを客観的に評価することで、サービス提供者と利用者の信頼関係を維持します。'
            },
            render: () => renderTable('SLA達成状況', [
                ['SLA ID', 'サービス名', '目標', '実績', '達成率', '状況'],
                ['SLA-01', 'インシデント対応', '30分以内', '28分', '93%', '✅ 達成'],
                ['SLA-02', 'システム稼働率', '99.9%', '99.95%', '100%', '✅ 達成']
            ])
        },
        knowledge: {
            title: 'ナレッジ管理',
            info: {
                meaning: '過去のトラブル対応や技術情報を組織全体で共有・蓄積し、誰でも必要な情報を活用できるようにするプロセスです。',
                necessity: '特定の担当者に知識が偏る「属人化」を防ぎ、誰でも迅速かつ正確にトラブル解決ができるようにするために不可欠です。'
            },
            render: () => renderTable('ナレッジベース記事 (FAQ)', [
                ['記事ID', 'タイトル', 'カテゴリ', '閲覧数', '評価', '更新'],
                ['KB-001', 'OneDrive同期トラブル', 'クライアント', '245', '★★★★★', '12/20'],
                ['KB-002', 'VPN接続手順', 'ネットワーク', '189', '★★★★☆', '12/18']
            ])
        },
        capacity: {
            title: 'キャパシティ管理',
            info: {
                meaning: 'ITリソース（CPU、メモリ、ディスク、帯域、ライセンス等）の現状を把握し、将来の需要に対して不足しないよう計画的に確保するプロセスです。',
                necessity: 'ビジネスの成長や突発的な負荷によってシステムがパンクするのを未然に防ぎ、快適なレスポンスを維持するために必要です。'
            },
            render: () => renderTable('リソース使用状況', [
                ['リソース', '現在使用率', '閾値', '予測(3ヶ月)', 'ステータス'],
                ['ストレージ', '72%', '80%', '85%', '🟡 注意'],
                ['帯域', '45%', '70%', '52%', '✅ 正常'],
                ['ライセンス', '95%', '90%', '98%', '🔴 要増設']
            ])
        },
        security: {
            title: 'セキュリティ管理 (NIST CSF 2.0)',
            info: {
                meaning: '情報資産を脅威から守るための統合的な枠組みです。NIST CSF 2.0では「統治、識別、防御、検知、対応、復旧」の6つのコア機能を包括的に管理します。',
                necessity: 'サイバー攻撃や情報漏洩から企業価値を守り、万が一攻撃を受けても事業を継続できる「レジリエンス（回復力）」を確保するために絶対的な必要性があります。'
            },
            render: () => {
                let html = `
                    <div class="nist-grid" style="grid-template-columns: repeat(2, 1fr); gap: 24px;">
                        <div class="nist-card">
                            <div class="nist-header"><h4>Governance (統治)</h4><span class="badge badge-info">GV.OC</span></div>
                            <p>組織全体のリスク管理戦略。成熟度レベル: <strong>Tier 3</strong></p>
                        </div>
                        <div class="nist-card">
                            <div class="nist-header"><h4>Detect (検知)</h4><span class="badge badge-warning">DE.AE</span></div>
                            <p>異常な挙動のリアルタイム監視。検知数: <strong>2件 (調査中)</strong></p>
                        </div>
                    </div>
                `;
                html += renderTable('セキュリティインシデント', [
                    ['ID', '検知日時', '種別', '影響', '状況'],
                    ['SEC-001', '12/25 03:15', '不正アクセス試行', 'VPN (ブロック済)', '解決済'],
                    ['SEC-002', '12/24 10:30', 'フィッシング', '15名開封', '対応完了']
                ]);
                return html;
            }
        },
        settings_general: {
            title: 'システム基本設定',
            info: {
                meaning: 'ITSMシステムの名称、タイムゾーン、言語、および標準的な動作パラメータを定義する場所です。',
                necessity: '組織のドメインや運用文化に合わせてツールを最適化し、全ユーザーに一貫したシステム環境を提供するために不可欠です。'
            },
            render: () => `
                <div style="display: flex; flex-direction: column; gap: 24px;">
                    <div class="nist-card">
                        <h4>基本プロファイル</h4>
                        <div style="margin-top: 16px; display: grid; gap: 16px;">
                            <div><label style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary);">システム表示名</label><input type="text" value="ITSM System" style="width: 100%; border: 1px solid var(--border-color); padding: 8px; border-radius: 6px; margin-top: 4px;"></div>
                            <div><label style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary);">組織名</label><input type="text" value="株式会社サンプルコーポレーション" style="width: 100%; border: 1px solid var(--border-color); padding: 8px; border-radius: 6px; margin-top: 4px;"></div>
                        </div>
                    </div>
                    <div class="nist-card">
                        <h4>リージョンと時刻</h4>
                        <div style="margin-top: 16px;">
                            <label style="font-size: 0.8rem; font-weight: 700; color: var(--text-secondary);">タイムゾーン</label>
                            <select style="width: 100%; border: 1px solid var(--border-color); padding: 8px; border-radius: 6px; margin-top: 4px;">
                                <option>(GMT+09:00) Asia/Tokyo</option>
                                <option>(GMT+00:00) UTC</option>
                            </select>
                        </div>
                    </div>
                </div>
            `
        },
        settings_users: {
            title: 'ユーザー・権限管理',
            info: {
                meaning: 'アクセス可能なユーザーを登録し、役割（管理者、運用者等）に応じて操作権限を制限する機能です。',
                necessity: '「誰が・何を行えるか」を厳格に管理することで、内部不正の防止や職務分掌の徹底（ISO 20000/NIST要件）を実現します。'
            },
            render: () => renderTable('アクティブユーザー一覧', [
                ['ユーザー名', '役割', '部署', 'ステータス', '最終ログイン'],
                ['山田 太郎', 'システム管理者', '情報システム部', '<span style="color: var(--accent-green);">● Active</span>', '2025/12/27 15:30'],
                ['佐藤 花子', '運用オペレーター', '情報システム部', '<span style="color: var(--accent-green);">● Active</span>', '2025/12/27 14:10'],
                ['田中 次郎', '監査者', '内部監査室', '<span style="color: var(--text-secondary);">○ Inactive</span>', '2025/12/20 09:00']
            ])
        },
        settings_notifications: {
            title: '通知・アラート設定',
            info: {
                meaning: 'インシデントや承認要求などの重要なイベントを、電子メールやチャットツールへ自動配信する設定です。',
                necessity: '異常を即時に「気づき」に変え、迅速な意思決定とSLAの遵守を支えるコミュニケーション基盤として機能します。'
            },
            render: () => `
                <div style="display: flex; flex-direction: column; gap: 24px;">
                    <div class="nist-card" style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4>電子メール通知</h4>
                            <p style="font-size: 0.85rem; color: var(--text-secondary);">システム障害・SLA違反時の緊急通知</p>
                        </div>
                        <div style="width: 40px; height: 20px; background: var(--accent-blue); border-radius: 20px; position: relative;"><div style="width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; right: 2px; top: 2px;"></div></div>
                    </div>
                    <div class="nist-card" style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4>Microsoft Teams 連携</h4>
                            <p style="font-size: 0.85rem; color: var(--text-secondary);">Webhookを介したインシデント共有</p>
                        </div>
                        <div style="width: 40px; height: 20px; background: var(--accent-blue); border-radius: 20px; position: relative;"><div style="width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; right: 2px; top: 2px;"></div></div>
                    </div>
                    <div class="nist-card" style="display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <h4>Slack 連携</h4>
                            <p style="font-size: 0.85rem; color: var(--text-secondary);">開発・運用チームへの更新通知</p>
                        </div>
                        <div style="width: 40px; height: 20px; background: #e2e8f0; border-radius: 20px; position: relative;"><div style="width: 16px; height: 16px; background: white; border-radius: 50%; position: absolute; left: 2px; top: 2px;"></div></div>
                    </div>
                </div>
            `
        }
    };

    // --- DOM Elements ---
    const navItems = document.querySelectorAll('.nav-item');
    const sectionTitle = document.querySelector('#section-title');
    const mainView = document.querySelector('#main-view');

    // --- Switch View Engine ---
    function switchView(viewId) {
        const view = views[viewId];
        if (!view) return;

        // Update UI
        sectionTitle.textContent = view.title;

        let content = '';
        if (view.info) {
            content += renderInfoCard(view.info.meaning, view.info.necessity);
        }
        content += view.render();

        mainView.innerHTML = content;

        // Update Sidebar
        navItems.forEach(i => i.classList.remove('active'));
        const activeItem = document.querySelector(`[data-view="${viewId}"]`);
        if (activeItem) activeItem.classList.add('active');
    }

    // --- Renderers ---

    function renderInfoCard(meaning, necessity) {
        return `
            <div style="background: white; border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; margin-bottom: 32px; box-shadow: var(--card-shadow);">
                <div style="display: flex; gap: 32px;">
                    <div style="flex: 1;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-blue); text-transform: uppercase; letter-spacing: 1px;">Meaning / 意味</span>
                        <p style="margin-top: 8px; font-size: 0.95rem; color: var(--text-primary); line-height: 1.6;">${meaning}</p>
                    </div>
                    <div style="width: 1px; background: var(--border-color);"></div>
                    <div style="flex: 1;">
                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--accent-purple); text-transform: uppercase; letter-spacing: 1px;">Necessity / 必要性</span>
                        <p style="margin-top: 8px; font-size: 0.95rem; color: var(--text-primary); line-height: 1.6;">${necessity}</p>
                    </div>
                </div>
            </div>
        `;
    }

    function renderDashboard() {
        return `
            <div class="dashboard-grid">
                <div class="stat-card">
                    <span class="stat-label">未対応インシデント</span>
                    <div class="stat-value">05</div>
                    <span class="badge badge-warning">High Priority: 3</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">SLA遵守率</span>
                    <div class="stat-value">96.4%</div>
                    <span class="badge badge-info">Target: 95%</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">承認待ち変更</span>
                    <div class="stat-value">03件</div>
                    <span class="badge badge-info">Next: 12/28</span>
                </div>
                <div class="stat-card">
                    <span class="stat-label">ライセンス残数</span>
                    <div class="stat-value">10</div>
                    <span class="badge badge-warning">使用率 95%</span>
                </div>
            </div>
            
            <div class="table-container">
                <div style="padding: 24px; border-bottom: 1px solid var(--border-color);">
                    <h3 style="font-weight: 800; color: var(--text-bright);">🚨 緊急アラート</h3>
                </div>
                <table>
                    <thead>
                        <tr><th>優先度</th><th>種別</th><th>内容</th><th>発生時刻</th></tr>
                    </thead>
                    <tbody>
                        <tr><td><span class="badge badge-warning">緊急</span></td><td>SLAリスク</td><td>CHG-03 変更作業が予定超過</td><td>14:45</td></tr>
                        <tr><td><span class="badge badge-warning">緊急</span></td><td>キャパシティ</td><td>M365ライセンス残量低下</td><td>09:00</td></tr>
                    </tbody>
                </table>
            </div>
        `;
    }

    function renderTable(title, rows) {
        const headers = rows[0];
        const body = rows.slice(1);

        return `
            <h3 style="margin: 32px 0 16px; font-weight: 800; color: var(--text-bright);">${title}</h3>
            <div class="table-container">
                <table>
                    <thead>
                        <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${body.map(row => `
                            <tr>
                                ${row.map(cell => `<td>${cell}</td>`).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    // --- Init ---
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const viewId = item.getAttribute('data-view');
            switchView(viewId);
        });
    });

    // Default view
    switchView('dash');
});
