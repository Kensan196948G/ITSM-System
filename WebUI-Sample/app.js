document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration & Data ---

    const views = {
        dash: {
            title: '統合ダッシュボード',
            info: {
                meaning: 'システム全体の稼働状況を一目で把握できる統合監視画面です。KPI（重要業績評価指標）と視覚的なグラフで現状を表示します。',
                necessity: 'IT運用における意思決定の起点となります。インシデント数、SLA達成率、セキュリティリスクなどの重要指標をリアルタイムで監視し、問題の早期発見と迅速な対応を可能にします。経営層への報告資料としても活用できます。'
            },
            render: renderDashboard
        },
        incidents: {
            title: 'インシデント管理 (ISO 20000)',
            info: {
                meaning: 'サービス中断や障害など、通常のサービス運用から外れた事象（インシデント）を記録・追跡する機能です。ITILのインシデント管理プロセスに準拠しています。',
                necessity: 'サービス復旧時間の短縮とユーザー影響の最小化が目的です。インシデントの優先度付け、担当者割り当て、進捗追跡により、組織的な対応が可能になります。過去のインシデント分析により、再発防止策の策定にも貢献します。'
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
                meaning: '複数のインシデントの根本原因を特定し、恒久的な解決策を策定する機能です。インシデントが「症状」なら、問題は「病気」に相当します。',
                necessity: '同じインシデントの繰り返し発生を防止します。根本原因分析により、一時対応ではなく本質的な解決を目指します。関連インシデント数の追跡により、問題の影響範囲と重要度を可視化できます。'
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
                meaning: 'システム構成やサービスに対する変更要求（RFC: Request for Change）を管理し、承認プロセスを実行する機能です。計画的な変更管理を実現します。',
                necessity: '無計画な変更によるサービス障害を防止します。変更の影響評価、承認フロー、ロールバック計画により、リスクを最小化しながら必要な改善を実施できます。変更履歴の記録は監査対応やトラブルシューティングにも不可欠です。'
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
                meaning: '複数の変更要求をまとめて本番環境に展開する計画・実行を管理する機能です。リリースのバージョン管理とデプロイ進捗を追跡します。',
                necessity: '大規模な変更を安全かつ計画的に実施するために必要です。テスト環境での検証、リリースウィンドウの設定、ロールバック手順の準備により、本番環境への影響を最小化します。'
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
                meaning: 'ユーザーからのサービス要求（アカウント作成、アクセス権限付与、ソフトウェアインストールなど）を受付・処理する機能です。',
                necessity: '標準的なサービス提供を効率化します。要求の優先度管理、承認フロー、処理状況の可視化により、ユーザー満足度の向上とサービスデスクの業務効率化を実現します。SLA遵守の基盤となります。'
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
                meaning: '構成管理データベース（CMDB）としてIT資産の構成情報を一元管理する機能です。サーバー、ネットワーク機器、エンドポイント、クラウドリソースなどを登録します。',
                necessity: 'IT資産の全体像把握と変更影響分析の基盤となります。資産の依存関係を理解することで、変更やインシデント発生時の影響範囲を迅速に特定できます。ライセンス管理、コスト配分、セキュリティ管理の土台としても機能します。'
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
                meaning: 'サービスレベル合意（SLA: Service Level Agreement）の目標値と実績値を管理し、サービス品質を定量的に測定する機能です。',
                necessity: 'サービス品質の可視化と継続的改善に不可欠です。目標値との乖離を監視し、SLA違反のリスクを早期に検知します。経営層やビジネス部門に対するIT部門の価値証明として重要な役割を果たします。'
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
                meaning: 'トラブルシューティング手順、設定ガイド、FAQなどの技術情報を体系的に蓄積・共有するナレッジベースです。',
                necessity: '問題解決時間の短縮と対応品質の標準化を実現します。ベテラン担当者のノウハウを組織資産として蓄積し、新人教育やスキル伝承にも活用できます。セルフサービス提供により、サービスデスクの負荷軽減にも貢献します。'
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
                meaning: 'CPU、メモリ、ディスク、ネットワークなどのITリソース使用状況を監視し、キャパシティの最適化を図る機能です。',
                necessity: 'リソース不足によるサービス低下を予防します。使用率の推移分析により、適切なタイミングでのリソース増強を計画できます。コスト最適化と性能維持のバランスを取るために重要です。'
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
                meaning: 'システムやアプリケーションの脆弱性を管理し、CVSS評価に基づいて対策の優先順位を決定する機能です。',
                necessity: 'サイバー攻撃のリスクを最小化します。脆弱性の早期発見、影響範囲の特定、パッチ適用の計画により、セキュリティインシデントを予防します。コンプライアンス対応やセキュリティ監査でも必須の管理項目です。'
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
                meaning: 'システムを利用するユーザーアカウントと権限（ロール）を管理する機能です。admin、manager、analyst、viewerの4段階の権限を設定できます。',
                necessity: 'セキュリティとアクセス制御の要です。最小権限の原則に基づき、各ユーザーに必要な権限のみを付与することで、誤操作や不正アクセスを防止します。監査証跡の記録とコンプライアンス対応にも不可欠です。'
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
                meaning: 'Criticalインシデント、SLA違反、脆弱性検出などの重要イベント発生時の通知方法を設定する機能です。',
                necessity: '重大な問題の見逃しを防ぎます。リアルタイムアラートにより、担当者が迅速に対応を開始できます。通知チャネルの最適化により、アラート疲れを防ぎつつ、本当に重要な情報を確実に伝達します。'
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
