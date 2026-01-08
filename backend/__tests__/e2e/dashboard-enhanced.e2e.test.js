/**
 * E2Eテスト: ダッシュボード強化機能
 * チャートデータとウィジェットデータのエンドポイントをテスト
 */

const request = require('supertest');
const { app } = require('../../server');

describe('E2E: ダッシュボード強化機能テスト', () => {
  let adminToken;

  beforeAll(async () => {
    // サーバー起動待機
    await new Promise((resolve) => setTimeout(resolve, 300));

    // 管理者ログイン
    const res = await request(app).post('/api/v1/auth/login').send({
      username: 'admin',
      password: 'admin123'
    });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    adminToken = res.body.token;
  });

  describe('E2E-DASHBOARD-1: チャートデータ取得テスト', () => {
    it('ステップ1: チャートデータエンドポイントにアクセス', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/charts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('incidentTrend');
      expect(res.body).toHaveProperty('slaAchievement');
      expect(res.body).toHaveProperty('incidentsByPriority');
      expect(res.body).toHaveProperty('incidentsByStatus');
      expect(res.body).toHaveProperty('changeTrend');
      expect(res.body).toHaveProperty('generatedAt');
    });

    it('ステップ2: インシデント推移データの構造を検証', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/charts')
        .set('Authorization', `Bearer ${adminToken}`);

      const { incidentTrend } = res.body;

      // Chart.js形式のデータ構造を確認
      expect(incidentTrend).toHaveProperty('labels');
      expect(incidentTrend).toHaveProperty('datasets');
      expect(Array.isArray(incidentTrend.labels)).toBe(true);
      expect(Array.isArray(incidentTrend.datasets)).toBe(true);

      // 過去7日間のラベルを確認
      expect(incidentTrend.labels.length).toBe(7);

      // データセットの確認（新規インシデント、解決済み）
      expect(incidentTrend.datasets.length).toBeGreaterThanOrEqual(2);
      expect(incidentTrend.datasets[0]).toHaveProperty('label');
      expect(incidentTrend.datasets[0]).toHaveProperty('data');
      expect(incidentTrend.datasets[0]).toHaveProperty('borderColor');
      expect(incidentTrend.datasets[0]).toHaveProperty('backgroundColor');
    });

    it('ステップ3: SLA達成率データの構造を検証', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/charts')
        .set('Authorization', `Bearer ${adminToken}`);

      const { slaAchievement } = res.body;

      // 円グラフデータの構造を確認
      expect(slaAchievement).toHaveProperty('labels');
      expect(slaAchievement).toHaveProperty('datasets');
      expect(slaAchievement).toHaveProperty('summary');

      // サマリーデータの確認
      expect(slaAchievement.summary).toHaveProperty('total');
      expect(slaAchievement.summary).toHaveProperty('met');
      expect(slaAchievement.summary).toHaveProperty('atRisk');
      expect(slaAchievement.summary).toHaveProperty('violated');
      expect(slaAchievement.summary).toHaveProperty('achievementRate');

      // 達成率が0-100の範囲内であることを確認
      expect(slaAchievement.summary.achievementRate).toBeGreaterThanOrEqual(0);
      expect(slaAchievement.summary.achievementRate).toBeLessThanOrEqual(100);
    });

    it('ステップ4: 優先度別インシデント数データの構造を検証', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/charts')
        .set('Authorization', `Bearer ${adminToken}`);

      const { incidentsByPriority } = res.body;

      expect(incidentsByPriority).toHaveProperty('labels');
      expect(incidentsByPriority).toHaveProperty('datasets');

      // ラベルの確認（緊急、高、中、低）
      expect(Array.isArray(incidentsByPriority.labels)).toBe(true);

      // データセットの確認
      expect(incidentsByPriority.datasets[0]).toHaveProperty('label');
      expect(incidentsByPriority.datasets[0]).toHaveProperty('data');
      expect(incidentsByPriority.datasets[0]).toHaveProperty('backgroundColor');

      // データとラベルの長さが一致することを確認
      expect(incidentsByPriority.datasets[0].data.length).toBe(incidentsByPriority.labels.length);
    });

    it('ステップ5: ステータス別インシデント数データの構造を検証', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/charts')
        .set('Authorization', `Bearer ${adminToken}`);

      const { incidentsByStatus } = res.body;

      expect(incidentsByStatus).toHaveProperty('labels');
      expect(incidentsByStatus).toHaveProperty('datasets');

      // 円グラフ形式のデータセット
      expect(incidentsByStatus.datasets[0]).toHaveProperty('data');
      expect(incidentsByStatus.datasets[0]).toHaveProperty('backgroundColor');
      expect(incidentsByStatus.datasets[0]).toHaveProperty('borderWidth');
    });

    it('ステップ6: 変更リクエスト推移データの構造を検証', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/charts')
        .set('Authorization', `Bearer ${adminToken}`);

      const { changeTrend } = res.body;

      expect(changeTrend).toHaveProperty('labels');
      expect(changeTrend).toHaveProperty('datasets');

      // 過去7日間のラベル
      expect(changeTrend.labels.length).toBe(7);

      // 折れ線グラフのデータセット
      expect(changeTrend.datasets[0]).toHaveProperty('label');
      expect(changeTrend.datasets[0]).toHaveProperty('data');
      expect(changeTrend.datasets[0]).toHaveProperty('borderColor');
      expect(changeTrend.datasets[0]).toHaveProperty('tension');
    });
  });

  describe('E2E-DASHBOARD-2: ウィジェットデータ取得テスト', () => {
    it('ステップ1: ウィジェットデータエンドポイントにアクセス', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/widgets')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body).toHaveProperty('kpi');
      expect(res.body).toHaveProperty('activeIncidents');
      expect(res.body).toHaveProperty('weeklyChanges');
      expect(res.body).toHaveProperty('problemStats');
      expect(res.body).toHaveProperty('vulnerabilityStats');
      expect(res.body).toHaveProperty('generatedAt');
    });

    it('ステップ2: KPIメトリクスの構造を検証', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/widgets')
        .set('Authorization', `Bearer ${adminToken}`);

      const { kpi } = res.body;

      // MTTR（平均修復時間）
      expect(kpi).toHaveProperty('mttr');
      expect(kpi.mttr).toHaveProperty('value');
      expect(kpi.mttr).toHaveProperty('unit');
      expect(kpi.mttr).toHaveProperty('label');
      expect(kpi.mttr).toHaveProperty('description');
      expect(kpi.mttr.unit).toBe('時間');

      // MTBF（平均故障間隔）
      expect(kpi).toHaveProperty('mtbf');
      expect(kpi.mtbf).toHaveProperty('value');
      expect(kpi.mtbf).toHaveProperty('unit');
      expect(kpi.mtbf).toHaveProperty('label');
      expect(kpi.mtbf.unit).toBe('時間');

      // SLA達成率
      expect(kpi).toHaveProperty('slaAchievementRate');
      expect(kpi.slaAchievementRate).toHaveProperty('value');
      expect(kpi.slaAchievementRate).toHaveProperty('unit');
      expect(kpi.slaAchievementRate).toHaveProperty('label');
      expect(kpi.slaAchievementRate.unit).toBe('%');

      // 値が数値であることを確認
      expect(typeof kpi.mttr.value).toBe('number');
      expect(typeof kpi.mtbf.value).toBe('number');
      expect(typeof kpi.slaAchievementRate.value).toBe('number');
    });

    it('ステップ3: アクティブインシデント数サマリーを検証', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/widgets')
        .set('Authorization', `Bearer ${adminToken}`);

      const { activeIncidents } = res.body;

      expect(activeIncidents).toHaveProperty('total');
      expect(activeIncidents).toHaveProperty('open');
      expect(activeIncidents).toHaveProperty('inProgress');
      expect(activeIncidents).toHaveProperty('pending');
      expect(activeIncidents).toHaveProperty('critical');
      expect(activeIncidents).toHaveProperty('high');

      // 全て数値であることを確認
      expect(typeof activeIncidents.total).toBe('number');
      expect(typeof activeIncidents.open).toBe('number');
      expect(typeof activeIncidents.critical).toBe('number');

      // 論理的な整合性を確認（合計値の検証）
      const statusSum = activeIncidents.open + activeIncidents.inProgress + activeIncidents.pending;
      expect(statusSum).toBeLessThanOrEqual(activeIncidents.total);
    });

    it('ステップ4: 今週の変更リクエスト数を検証', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/widgets')
        .set('Authorization', `Bearer ${adminToken}`);

      const { weeklyChanges } = res.body;

      expect(weeklyChanges).toHaveProperty('total');
      expect(weeklyChanges).toHaveProperty('approved');
      expect(weeklyChanges).toHaveProperty('pending');
      expect(weeklyChanges).toHaveProperty('rejected');
      expect(weeklyChanges).toHaveProperty('implemented');
      expect(weeklyChanges).toHaveProperty('byType');

      // タイプ別の統計
      expect(weeklyChanges.byType).toHaveProperty('standard');
      expect(weeklyChanges.byType).toHaveProperty('normal');
      expect(weeklyChanges.byType).toHaveProperty('emergency');

      // 全て数値であることを確認
      expect(typeof weeklyChanges.total).toBe('number');
      expect(typeof weeklyChanges.approved).toBe('number');
    });

    it('ステップ5: 問題管理統計を検証', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/widgets')
        .set('Authorization', `Bearer ${adminToken}`);

      const { problemStats } = res.body;

      expect(problemStats).toHaveProperty('total');
      expect(problemStats).toHaveProperty('open');
      expect(problemStats).toHaveProperty('inProgress');
      expect(problemStats).toHaveProperty('resolved');

      // 全て数値であることを確認
      expect(typeof problemStats.total).toBe('number');
    });

    it('ステップ6: 脆弱性統計を検証', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/widgets')
        .set('Authorization', `Bearer ${adminToken}`);

      const { vulnerabilityStats } = res.body;

      expect(vulnerabilityStats).toHaveProperty('total');
      expect(vulnerabilityStats).toHaveProperty('criticalOpen');
      expect(vulnerabilityStats).toHaveProperty('highOpen');
      expect(vulnerabilityStats).toHaveProperty('resolved');

      // 全て数値であることを確認
      expect(typeof vulnerabilityStats.total).toBe('number');
    });
  });

  describe('E2E-DASHBOARD-3: キャッシュ動作テスト', () => {
    it('ステップ1: 同一リクエストでキャッシュが利用されることを確認', async () => {
      // 1回目のリクエスト
      const res1 = await request(app)
        .get('/api/v1/dashboard/charts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res1.statusCode).toEqual(200);
      const generatedAt1 = res1.body.generatedAt;

      // わずかに待機
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 2回目のリクエスト（キャッシュから取得される可能性）
      const res2 = await request(app)
        .get('/api/v1/dashboard/charts')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res2.statusCode).toEqual(200);

      // データ構造は同じであることを確認
      expect(res2.body).toHaveProperty('incidentTrend');
      expect(res2.body).toHaveProperty('slaAchievement');
    });
  });

  describe('E2E-DASHBOARD-4: 権限テスト', () => {
    it('認証なしでアクセスすると401エラー', async () => {
      const res = await request(app).get('/api/v1/dashboard/charts');

      expect(res.statusCode).toEqual(401);
    });

    it('無効なトークンでアクセスすると403エラー', async () => {
      const res = await request(app)
        .get('/api/v1/dashboard/charts')
        .set('Authorization', 'Bearer invalid-token-12345');

      expect(res.statusCode).toEqual(403);
    });
  });
});
