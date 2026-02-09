/**
 * NIST CSF 2.0 Categories and Controls Seed Data
 * Source: https://nvlpubs.nist.gov/nistpubs/CSWP/NIST.CSWP.29.pdf
 *
 * This seed populates:
 * - 23 CSF Categories (csf_categories)
 * - 106 CSF Controls (csf_controls)
 */

exports.seed = async function (knex) {
  // Delete existing data (CASCADE will handle controls)
  await knex('csf_categories').del();
  await knex('csf_controls').del();

  // ========================================
  // STEP 1: Insert Categories
  // ========================================
  const categoryData = [
    // GOVERN (GV) - 6 categories
    {
      function_code: 'GV',
      code: 'GV.OC',
      name: '組織コンテキスト',
      description: 'サイバーセキュリティリスク管理に関連する組織の状況を理解し、優先順位を決定する',
      sort_order: 1
    },
    {
      function_code: 'GV',
      code: 'GV.RM',
      name: 'リスク管理戦略',
      description:
        '組織のサイバーセキュリティリスク管理戦略、期待値、ポリシーを確立、伝達、監視する',
      sort_order: 2
    },
    {
      function_code: 'GV',
      code: 'GV.RR',
      name: '役割・責任・権限',
      description: 'サイバーセキュリティの役割、責任、権限を確立し、伝達する',
      sort_order: 3
    },
    {
      function_code: 'GV',
      code: 'GV.PO',
      name: 'ポリシー',
      description: '組織のポリシーを確立、伝達、実施する',
      sort_order: 4
    },
    {
      function_code: 'GV',
      code: 'GV.OV',
      name: '監視',
      description: 'サイバーセキュリティリスク管理戦略の結果を監視し、測定する',
      sort_order: 5
    },
    {
      function_code: 'GV',
      code: 'GV.SC',
      name: 'サプライチェーンリスク管理',
      description: 'サイバーセキュリティサプライチェーンリスクを識別、評価、管理する',
      sort_order: 6
    },

    // IDENTIFY (ID) - 6 categories
    {
      function_code: 'ID',
      code: 'ID.AM',
      name: '資産管理',
      description: '組織のデータ、人員、デバイス、システム、施設を識別し、管理する',
      sort_order: 1
    },
    {
      function_code: 'ID',
      code: 'ID.RA',
      name: 'リスク評価',
      description: '組織のサイバーセキュリティリスクを理解する',
      sort_order: 2
    },
    {
      function_code: 'ID',
      code: 'ID.IM',
      name: '改善',
      description: '組織のポリシー、計画、プロセスを改善するための教訓を使用する',
      sort_order: 3
    },

    // PROTECT (PR) - 5 categories
    {
      function_code: 'PR',
      code: 'PR.AA',
      name: 'アイデンティティ管理・認証・アクセス制御',
      description:
        '物理的および論理的資産へのアクセスを、許可されたユーザー、プロセス、デバイスに制限し、許可されたアクティビティとトランザクションを管理する',
      sort_order: 1
    },
    {
      function_code: 'PR',
      code: 'PR.AT',
      name: '意識向上とトレーニング',
      description:
        '組織の人員とパートナーに、サイバーセキュリティの意識向上とトレーニングを提供する',
      sort_order: 2
    },
    {
      function_code: 'PR',
      code: 'PR.DS',
      name: 'データセキュリティ',
      description: 'データの機密性、完全性、可用性を保護する',
      sort_order: 3
    },
    {
      function_code: 'PR',
      code: 'PR.PS',
      name: 'プラットフォームセキュリティ',
      description: 'ハードウェア、ソフトウェア、サービスのセキュリティを管理する',
      sort_order: 4
    },
    {
      function_code: 'PR',
      code: 'PR.IR',
      name: 'テクノロジーインフラのレジリエンス',
      description: 'システムとサービスのレジリエンスを設計し、実装する',
      sort_order: 5
    },

    // DETECT (DE) - 3 categories
    {
      function_code: 'DE',
      code: 'DE.CM',
      name: '継続的監視',
      description: '資産を継続的に監視し、異常、指標、脅威を検出する',
      sort_order: 1
    },
    {
      function_code: 'DE',
      code: 'DE.AE',
      name: '有害事象分析',
      description:
        'ネットワーク活動と検出されたイベントを分析し、サイバーセキュリティインシデントを理解する',
      sort_order: 2
    },

    // RESPOND (RS) - 5 categories
    {
      function_code: 'RS',
      code: 'RS.MA',
      name: 'インシデント管理',
      description: 'インシデントライフサイクルを管理する',
      sort_order: 1
    },
    {
      function_code: 'RS',
      code: 'RS.AN',
      name: 'インシデント分析',
      description: 'インシデントの性質、範囲、活動を理解する',
      sort_order: 2
    },
    {
      function_code: 'RS',
      code: 'RS.CO',
      name: 'インシデント対応コミュニケーション',
      description: 'インシデント対応活動を内部および外部のステークホルダーと調整する',
      sort_order: 3
    },
    {
      function_code: 'RS',
      code: 'RS.MI',
      name: 'インシデント軽減',
      description: 'インシデントの影響を抑制する',
      sort_order: 4
    },

    // RECOVER (RC) - 3 categories
    {
      function_code: 'RC',
      code: 'RC.RP',
      name: '復旧計画',
      description: 'インシデントからの復旧活動を管理する',
      sort_order: 1
    },
    {
      function_code: 'RC',
      code: 'RC.CO',
      name: '復旧コミュニケーション',
      description:
        'インシデントからの復旧プロセスを内部および外部のステークホルダーに調整し、伝達する',
      sort_order: 2
    },
    {
      function_code: 'RC',
      code: 'RC.IM',
      name: '復旧改善',
      description: '復旧計画と実施が改善される',
      sort_order: 3
    }
  ];

  // Get function IDs for mapping
  const functions = await knex('csf_functions').select('id', 'code');
  const functionMap = functions.reduce((acc, f) => {
    acc[f.code] = f.id;
    return acc;
  }, {});

  // Insert categories with function_id
  const categoriesToInsert = categoryData.map((cat) => ({
    function_id: functionMap[cat.function_code],
    code: cat.code,
    name: cat.name,
    description: cat.description,
    sort_order: cat.sort_order
  }));

  await knex('csf_categories').insert(categoriesToInsert);

  // ========================================
  // STEP 2: Insert Controls (Subcategories)
  // ========================================

  // Get category IDs for mapping
  const categories = await knex('csf_categories').select('id', 'code');
  const categoryMap = categories.reduce((acc, c) => {
    acc[c.code] = c.id;
    return acc;
  }, {});

  // NIST CSF 2.0 Controls (106 total)
  const controlData = [
    // GV.OC (Organizational Context) - 5 controls
    {
      cat: 'GV.OC',
      id: 'GV.OC-01',
      name: 'ミッションとステークホルダーの期待値が理解され、運用に反映されている'
    },
    {
      cat: 'GV.OC',
      id: 'GV.OC-02',
      name: '内部および外部のサイバーセキュリティリスクとリソースが理解されている'
    },
    { cat: 'GV.OC', id: 'GV.OC-03', name: '法的、規制、契約上の要件が理解され、管理されている' },
    {
      cat: 'GV.OC',
      id: 'GV.OC-04',
      name: '重要な目的、機能、サービスとそれらの依存関係が確立されている'
    },
    {
      cat: 'GV.OC',
      id: 'GV.OC-05',
      name: 'サイバーセキュリティのサプライチェーン依存関係が確立され、管理されている'
    },

    // GV.RM (Risk Management Strategy) - 7 controls
    { cat: 'GV.RM', id: 'GV.RM-01', name: 'リスク管理の目的が確立され、一貫して表現されている' },
    { cat: 'GV.RM', id: 'GV.RM-02', name: 'リスクの許容範囲が確立され、表現され、管理されている' },
    { cat: 'GV.RM', id: 'GV.RM-03', name: 'リスク管理の役割と責任が確立され、調整されている' },
    {
      cat: 'GV.RM',
      id: 'GV.RM-04',
      name: 'サイバーセキュリティが戦略計画と事業目標に統合されている'
    },
    {
      cat: 'GV.RM',
      id: 'GV.RM-05',
      name: 'サイバーセキュリティリスクとエクスポージャーが報告され、ステークホルダーと共有されている'
    },
    {
      cat: 'GV.RM',
      id: 'GV.RM-06',
      name: 'サイバーセキュリティリスクの優先順位が、組織の優先事項と一致するように設定されている'
    },
    {
      cat: 'GV.RM',
      id: 'GV.RM-07',
      name: 'リスク対応戦略（例: 軽減、移転、回避、受容）が確立され、管理されている'
    },

    // GV.RR (Roles, Responsibilities, and Authorities) - 4 controls
    {
      cat: 'GV.RR',
      id: 'GV.RR-01',
      name: 'サイバーセキュリティリスク管理の役割と責任が確立され、組織全体に伝達されている'
    },
    {
      cat: 'GV.RR',
      id: 'GV.RR-02',
      name: 'サイバーセキュリティリスク管理に関する役割と責任が理解され、実行されている'
    },
    {
      cat: 'GV.RR',
      id: 'GV.RR-03',
      name: 'サイバーセキュリティに関する適切な監視が維持されている'
    },
    {
      cat: 'GV.RR',
      id: 'GV.RR-04',
      name: 'サイバーセキュリティ担当者とサプライチェーンパートナーが確立され、調整されている'
    },

    // GV.PO (Policy) - 3 controls
    {
      cat: 'GV.PO',
      id: 'GV.PO-01',
      name: '組織のサイバーセキュリティポリシーが確立され、伝達されている'
    },
    { cat: 'GV.PO', id: 'GV.PO-02', name: 'ポリシーと手順が定期的にレビューされ、更新されている' },

    // GV.OV (Oversight) - 3 controls
    {
      cat: 'GV.OV',
      id: 'GV.OV-01',
      name: 'サイバーセキュリティリスク管理プログラムの結果が経営陣によってレビューされている'
    },
    {
      cat: 'GV.OV',
      id: 'GV.OV-02',
      name: 'サイバーセキュリティリスク管理プログラムの改善機会が特定され、実装されている'
    },
    {
      cat: 'GV.OV',
      id: 'GV.OV-03',
      name: 'エンタープライズリスク管理プログラムは、サイバーセキュリティリスクの特性に対処している'
    },

    // GV.SC (Supply Chain Risk Management) - 10 controls
    {
      cat: 'GV.SC',
      id: 'GV.SC-01',
      name: 'サイバーセキュリティサプライチェーンリスク管理プロセスが確立されている'
    },
    {
      cat: 'GV.SC',
      id: 'GV.SC-02',
      name: 'サプライヤーとサードパーティパートナーが識別され、優先順位付けされ、評価されている'
    },
    {
      cat: 'GV.SC',
      id: 'GV.SC-03',
      name: 'サプライヤーとサードパーティパートナーとの契約に、サイバーセキュリティ要件が含まれている'
    },
    {
      cat: 'GV.SC',
      id: 'GV.SC-04',
      name: 'サプライヤーとサードパーティパートナーがサイバーセキュリティ要件を満たしているかが定期的に評価されている'
    },
    {
      cat: 'GV.SC',
      id: 'GV.SC-05',
      name: 'サプライチェーンのセキュリティプラクティスが組織の運用に統合されている'
    },
    {
      cat: 'GV.SC',
      id: 'GV.SC-06',
      name: 'サプライチェーンリスク管理の計画が、変化するリスクとビジネスニーズに対応するため定期的に改善されている'
    },
    {
      cat: 'GV.SC',
      id: 'GV.SC-07',
      name: 'サイバーセキュリティサプライチェーンリスク管理プログラムが、関連するステークホルダーと共有されている'
    },
    {
      cat: 'GV.SC',
      id: 'GV.SC-08',
      name: 'サプライチェーンのセキュリティイベントが監視され、適切な対応がなされている'
    },
    {
      cat: 'GV.SC',
      id: 'GV.SC-09',
      name: '重要なサプライチェーンセキュリティイベントが上層部に報告されている'
    },
    {
      cat: 'GV.SC',
      id: 'GV.SC-10',
      name: 'サプライチェーンのサイバーセキュリティに関する教訓が記録され、共有されている'
    },

    // ID.AM (Asset Management) - 7 controls
    { cat: 'ID.AM', id: 'ID.AM-01', name: 'ハードウェア資産が識別され、管理されている' },
    {
      cat: 'ID.AM',
      id: 'ID.AM-02',
      name: 'ソフトウェア、サービス、システムが識別され、管理されている'
    },
    { cat: 'ID.AM', id: 'ID.AM-03', name: '組織の通信と接続が識別され、管理されている' },
    { cat: 'ID.AM', id: 'ID.AM-04', name: '外部情報システムが識別され、管理されている' },
    {
      cat: 'ID.AM',
      id: 'ID.AM-05',
      name: 'ハードウェア資産とソフトウェア資産が優先順位付けされている'
    },
    { cat: 'ID.AM', id: 'ID.AM-07', name: 'データとデータの流れが識別され、管理されている' },
    {
      cat: 'ID.AM',
      id: 'ID.AM-08',
      name: 'システム、アプリケーション、ソフトウェアのライフサイクルが管理されている'
    },

    // ID.RA (Risk Assessment) - 10 controls
    { cat: 'ID.RA', id: 'ID.RA-01', name: '資産の脆弱性が識別され、文書化されている' },
    {
      cat: 'ID.RA',
      id: 'ID.RA-02',
      name: 'サイバー脅威インテリジェンスが収集され、分析されている'
    },
    { cat: 'ID.RA', id: 'ID.RA-03', name: '内部および外部の脅威が識別され、文書化されている' },
    { cat: 'ID.RA', id: 'ID.RA-04', name: 'ビジネスインパクト分析が実施されている' },
    {
      cat: 'ID.RA',
      id: 'ID.RA-05',
      name: '脅威、脆弱性、可能性、影響が使用され、リスク判定が行われている'
    },
    {
      cat: 'ID.RA',
      id: 'ID.RA-06',
      name: 'リスク対応が識別され、優先順位付けされ、計画され、追跡され、文書化されている'
    },
    {
      cat: 'ID.RA',
      id: 'ID.RA-07',
      name: 'リスクまたは脅威の変化に対応するため、リスク評価とリスク対応計画が更新される'
    },
    {
      cat: 'ID.RA',
      id: 'ID.RA-08',
      name: 'プロセス、手順、テクノロジーの有効性が定期的に評価されている'
    },
    {
      cat: 'ID.RA',
      id: 'ID.RA-09',
      name: 'サイバーセキュリティリスク管理のパフォーマンスが測定され、分析されている'
    },
    {
      cat: 'ID.RA',
      id: 'ID.RA-10',
      name: '重要なサイバーセキュリティインシデントが特定され、適切な関係者に報告されている'
    },

    // ID.IM (Improvement) - 2 controls
    {
      cat: 'ID.IM',
      id: 'ID.IM-01',
      name: 'インシデントと運用からの教訓が確立され、実装されている'
    },
    {
      cat: 'ID.IM',
      id: 'ID.IM-02',
      name: 'サイバーセキュリティの向上の機会が特定され、経営陣に伝達されている'
    },

    // PR.AA (Identity Management, Authentication and Access Control) - 6 controls
    {
      cat: 'PR.AA',
      id: 'PR.AA-01',
      name: 'アイデンティティとクレデンシャルがライフサイクル全体で管理されている'
    },
    { cat: 'PR.AA', id: 'PR.AA-02', name: 'アイデンティティは、リスクに応じて適切に証明される' },
    {
      cat: 'PR.AA',
      id: 'PR.AA-03',
      name: 'ユーザー、デバイス、その他の資産は、リスクに応じて認証される'
    },
    {
      cat: 'PR.AA',
      id: 'PR.AA-04',
      name: 'アイデンティティとクレデンシャルが承認されたデバイスやユーザーのみに発行されている'
    },
    {
      cat: 'PR.AA',
      id: 'PR.AA-05',
      name: '物理的アクセスは、認可されたユーザーとデバイスに制限されている'
    },
    {
      cat: 'PR.AA',
      id: 'PR.AA-06',
      name: '論理的アクセスは、認可されたユーザー、サービス、ハードウェアに制限されている'
    },

    // PR.AT (Awareness and Training) - 2 controls
    {
      cat: 'PR.AT',
      id: 'PR.AT-01',
      name: 'すべてのユーザーがサイバーセキュリティのトレーニングを受けている'
    },
    { cat: 'PR.AT', id: 'PR.AT-02', name: '特権ユーザーは、役割と責任を理解している' },

    // PR.DS (Data Security) - 11 controls
    {
      cat: 'PR.DS',
      id: 'PR.DS-01',
      name: 'データの機密性、完全性、可用性を保護するために、適切なメカニズムが使用されている'
    },
    { cat: 'PR.DS', id: 'PR.DS-02', name: '保管中のデータが保護されている' },
    { cat: 'PR.DS', id: 'PR.DS-03', name: '転送中のデータが保護されている' },
    { cat: 'PR.DS', id: 'PR.DS-04', name: '資産が管理され、保護されている' },
    { cat: 'PR.DS', id: 'PR.DS-05', name: 'データ漏洩に対する保護が実装されている' },
    { cat: 'PR.DS', id: 'PR.DS-10', name: '組織のデータの機密性と完全性が保護されている' },
    { cat: 'PR.DS', id: 'PR.DS-11', name: 'データは廃棄に関するポリシーに従って管理されている' },

    // PR.PS (Platform Security) - 2 controls
    { cat: 'PR.PS', id: 'PR.PS-01', name: 'ハードウェアのセキュリティ構成が管理されている' },
    { cat: 'PR.PS', id: 'PR.PS-02', name: 'ソフトウェアのセキュリティ構成が管理されている' },

    // PR.IR (Technology Infrastructure Resilience) - 4 controls
    {
      cat: 'PR.IR',
      id: 'PR.IR-01',
      name: 'ネットワークとシステムが物理的および論理的に分離されている'
    },
    {
      cat: 'PR.IR',
      id: 'PR.IR-02',
      name: 'サイバーセキュリティの脅威からシステムを保護するためのメカニズムが実装されている'
    },
    {
      cat: 'PR.IR',
      id: 'PR.IR-03',
      name: '重要なシステムと資産のバックアップとリストアプロセスが実装されている'
    },
    { cat: 'PR.IR', id: 'PR.IR-04', name: 'システムとサービスのレジリエンスが改善されている' },

    // DE.CM (Continuous Monitoring) - 9 controls
    {
      cat: 'DE.CM',
      id: 'DE.CM-01',
      name: 'ネットワークが異常な活動を検出するために監視されている'
    },
    { cat: 'DE.CM', id: 'DE.CM-02', name: '物理環境が異常な活動を検出するために監視されている' },
    {
      cat: 'DE.CM',
      id: 'DE.CM-03',
      name: '人員の活動と技術資産が異常な活動とセキュリティイベントを検出するために監視されている'
    },
    { cat: 'DE.CM', id: 'DE.CM-04', name: '悪意のあるコードが検出されている' },
    { cat: 'DE.CM', id: 'DE.CM-05', name: '認証されていないモバイルコードが検出されている' },
    {
      cat: 'DE.CM',
      id: 'DE.CM-06',
      name: '外部サービスプロバイダーの活動が異常な活動を検出するために監視されている'
    },
    {
      cat: 'DE.CM',
      id: 'DE.CM-07',
      name: '許可されていない人員、接続、デバイス、ソフトウェアが検出されている'
    },
    { cat: 'DE.CM', id: 'DE.CM-08', name: '脆弱性スキャンが実施されている' },
    {
      cat: 'DE.CM',
      id: 'DE.CM-09',
      name: 'ソフトウェアとファームウェアのコンポーネントの完全性が検証されている'
    },

    // DE.AE (Adverse Event Analysis) - 8 controls
    {
      cat: 'DE.AE',
      id: 'DE.AE-01',
      name: 'ベースラインのネットワーク操作と期待されるデータフローが確立され、管理されている'
    },
    { cat: 'DE.AE', id: 'DE.AE-02', name: 'イベントデータが収集され、相関され、分析されている' },
    { cat: 'DE.AE', id: 'DE.AE-03', name: 'イベントデータが脅威インテリジェンスと相関されている' },
    { cat: 'DE.AE', id: 'DE.AE-04', name: 'イベントの影響が評価されている' },
    { cat: 'DE.AE', id: 'DE.AE-05', name: 'インシデントのアラートのしきい値が確立されている' },
    { cat: 'DE.AE', id: 'DE.AE-06', name: 'アラート情報が脅威情報と統合されている' },
    {
      cat: 'DE.AE',
      id: 'DE.AE-07',
      name: 'サイバーセキュリティイベントとインシデントが宣言されている'
    },
    { cat: 'DE.AE', id: 'DE.AE-08', name: 'インシデントの性質と範囲が特徴付けられている' },

    // RS.MA (Incident Management) - 5 controls
    { cat: 'RS.MA', id: 'RS.MA-01', name: 'インシデント対応計画が実行されている' },
    { cat: 'RS.MA', id: 'RS.MA-02', name: 'インシデント報告が確立され、定義されている' },
    { cat: 'RS.MA', id: 'RS.MA-03', name: 'インシデントがトリアージされ、優先順位付けされている' },
    { cat: 'RS.MA', id: 'RS.MA-04', name: 'インシデントが封じ込められている' },
    { cat: 'RS.MA', id: 'RS.MA-05', name: 'インシデント対応プロセスが定期的にテストされている' },

    // RS.AN (Incident Analysis) - 7 controls
    { cat: 'RS.AN', id: 'RS.AN-01', name: 'インシデントの調査が実施されている' },
    { cat: 'RS.AN', id: 'RS.AN-02', name: 'インシデントの影響が理解されている' },
    { cat: 'RS.AN', id: 'RS.AN-03', name: 'インシデントに対する追跡と文書化が実施されている' },
    { cat: 'RS.AN', id: 'RS.AN-04', name: 'インシデントが分類され、優先順位付けされている' },
    { cat: 'RS.AN', id: 'RS.AN-05', name: 'インシデントのプロセスが確立され、実装されている' },
    { cat: 'RS.AN', id: 'RS.AN-06', name: 'インシデントのアクションが法的要件を考慮している' },
    { cat: 'RS.AN', id: 'RS.AN-07', name: 'インシデント関連の通信が組織のプロセスに従っている' },

    // RS.CO (Incident Response Communication) - 4 controls
    { cat: 'RS.CO', id: 'RS.CO-01', name: '人員が、インシデント対応の役割と責任を理解している' },
    {
      cat: 'RS.CO',
      id: 'RS.CO-02',
      name: 'インシデントが報告され、追加のリソースが動員されている'
    },
    { cat: 'RS.CO', id: 'RS.CO-03', name: '情報がインシデント対応中に共有されている' },
    {
      cat: 'RS.CO',
      id: 'RS.CO-04',
      name: 'インシデント対応とサポートプロセスが、外部のステークホルダーと調整されている'
    },

    // RS.MI (Incident Mitigation) - 2 controls
    { cat: 'RS.MI', id: 'RS.MI-01', name: 'インシデントは軽減される、または封じ込められる' },
    {
      cat: 'RS.MI',
      id: 'RS.MI-02',
      name: '新たに識別された脆弱性が軽減される、または文書化される'
    },

    // RC.RP (Recovery Planning) - 4 controls
    { cat: 'RC.RP', id: 'RC.RP-01', name: '復旧計画が実行されている' },
    { cat: 'RC.RP', id: 'RC.RP-02', name: '復旧戦略が実装されている' },
    { cat: 'RC.RP', id: 'RC.RP-03', name: '復旧プロセスが更新されている' },
    {
      cat: 'RC.RP',
      id: 'RC.RP-04',
      name: '復旧計画とプロセスが定期的にテストされ、改善されている'
    },

    // RC.CO (Recovery Communication) - 4 controls
    { cat: 'RC.CO', id: 'RC.CO-01', name: '復旧の進捗が関係者に伝達されている' },
    { cat: 'RC.CO', id: 'RC.CO-02', name: '復旧計画の公開通信が管理されている' },
    { cat: 'RC.CO', id: 'RC.CO-03', name: '復旧活動が内外のステークホルダーと調整されている' },
    { cat: 'RC.CO', id: 'RC.CO-04', name: '復旧時間と復旧ポイントの目標が確立されている' },

    // RC.IM (Recovery Improvement) - 1 control
    { cat: 'RC.IM', id: 'RC.IM-01', name: '復旧プロセスからの教訓が組織の手順に統合されている' }
  ];

  const controlsToInsert = controlData.map((ctrl) => ({
    category_id: categoryMap[ctrl.cat],
    control_id: ctrl.id,
    name: ctrl.name,
    description: ctrl.name, // descriptionはnameと同じ（簡潔な定義）
    status: 'not_started',
    maturity_level: 0,
    score: 0
  }));

  await knex('csf_controls').insert(controlsToInsert);

  console.log(
    `✅ Inserted ${categoriesToInsert.length} categories and ${controlsToInsert.length} controls`
  );
};
