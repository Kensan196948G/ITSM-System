/**
 * Notification Service Unit Tests
 * 通知サービスの単体テスト
 */

/* eslint-disable global-require */

const axios = require('axios');

jest.mock('axios');

// emailServiceをモック
jest.mock('../../../services/emailService', () => ({
  sendSlaViolationAlert: jest.fn().mockResolvedValue({ success: true })
}));

describe('Notification Service Unit Tests', () => {
  let notificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    axios.post.mockResolvedValue({ status: 200 });
    notificationService = require('../../../services/notificationService');
  });

  describe('sendSlackNotification', () => {
    it('Webhook URLが設定されていない場合はエラーを返す', async () => {
      const result = await notificationService.sendSlackNotification(null, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('正常にSlack通知を送信できる', async () => {
      const result = await notificationService.sendSlackNotification(
        'https://hooks.slack.com/services/xxx/yyy/zzz',
        { text: 'Test message' }
      );
      expect(result.success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/xxx/yyy/zzz',
        { text: 'Test message' },
        expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
      );
    });

    it('Slack通知送信時のエラーを処理できる', async () => {
      axios.post.mockRejectedValueOnce(new Error('Network error'));
      const result = await notificationService.sendSlackNotification(
        'https://hooks.slack.com/services/xxx/yyy/zzz',
        { text: 'Test' }
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Network error');
    });
  });

  describe('sendTeamsNotification', () => {
    it('Webhook URLが設定されていない場合はエラーを返す', async () => {
      const result = await notificationService.sendTeamsNotification(null, {});
      expect(result.success).toBe(false);
      expect(result.error).toContain('not configured');
    });

    it('正常にTeams通知を送信できる', async () => {
      const card = { type: 'message', text: 'Test' };
      const result = await notificationService.sendTeamsNotification(
        'https://outlook.webhook.office.com/xxx',
        card
      );
      expect(result.success).toBe(true);
      expect(axios.post).toHaveBeenCalledWith(
        'https://outlook.webhook.office.com/xxx',
        card,
        expect.objectContaining({ headers: { 'Content-Type': 'application/json' } })
      );
    });

    it('Teams通知送信時のエラーを処理できる', async () => {
      axios.post.mockRejectedValueOnce(new Error('Connection timeout'));
      const result = await notificationService.sendTeamsNotification(
        'https://outlook.webhook.office.com/xxx',
        {}
      );
      expect(result.success).toBe(false);
      expect(result.error).toBe('Connection timeout');
    });
  });

  describe('buildSlackIncidentMessage', () => {
    it('インシデント作成用のSlackメッセージを構築できる', () => {
      const incident = {
        ticket_id: 'INC-123456',
        title: 'テストインシデント',
        priority: 'High',
        status: 'New',
        is_security_incident: false,
        id: 1
      };

      const message = notificationService.buildSlackIncidentMessage(incident, 'created');

      expect(message.attachments).toBeDefined();
      expect(message.attachments[0].color).toBe('#FF6600'); // High priority color
      expect(message.attachments[0].blocks).toBeDefined();
    });

    it('セキュリティインシデントを正しく表示する', () => {
      const incident = {
        ticket_id: 'INC-123456',
        title: 'セキュリティインシデント',
        priority: 'Critical',
        status: 'Open',
        is_security_incident: true,
        id: 1
      };

      const message = notificationService.buildSlackIncidentMessage(incident, 'created');

      expect(message.attachments[0].color).toBe('#FF0000'); // Critical priority color
    });
  });

  describe('buildSlackSlaViolationMessage', () => {
    it('SLA違反用のSlackメッセージを構築できる', () => {
      const sla = {
        service_name: 'Webサービス',
        metric_name: '応答時間',
        target_value: '99.9%',
        actual_value: '98.5%',
        achievement_rate: 98.5,
        status: 'Violated'
      };

      const message = notificationService.buildSlackSlaViolationMessage(sla);

      expect(message.attachments).toBeDefined();
      expect(message.attachments[0].color).toBe('#FF0000'); // Violated color
    });

    it('SLAリスク状態用のメッセージを構築できる', () => {
      const sla = {
        service_name: 'Webサービス',
        metric_name: '応答時間',
        target_value: '99.9%',
        actual_value: '99.2%',
        achievement_rate: 99.2,
        status: 'At-Risk'
      };

      const message = notificationService.buildSlackSlaViolationMessage(sla);

      expect(message.attachments).toBeDefined();
      expect(message.attachments[0].color).toBe('#FF6600'); // At-Risk color
    });
  });

  describe('buildTeamsIncidentCard', () => {
    it('インシデント用のAdaptive Cardを構築できる', () => {
      const incident = {
        ticket_id: 'INC-123456',
        title: 'テストインシデント',
        priority: 'Medium',
        status: 'In Progress',
        description: 'テスト説明',
        is_security_incident: false,
        id: 1
      };

      const card = notificationService.buildTeamsIncidentCard(incident, 'updated');

      expect(card.type).toBe('message');
      expect(card.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
      expect(card.attachments[0].content.type).toBe('AdaptiveCard');
    });
  });

  describe('buildTeamsSlaViolationCard', () => {
    it('SLA違反用のAdaptive Cardを構築できる', () => {
      const sla = {
        service_name: 'Webサービス',
        metric_name: '可用性',
        target_value: '99.9%',
        actual_value: '98.0%',
        achievement_rate: 98.0,
        status: 'Violated'
      };

      const card = notificationService.buildTeamsSlaViolationCard(sla);

      expect(card.type).toBe('message');
      expect(card.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
    });
  });

  describe('sendTestNotification', () => {
    it('Slackテスト通知を送信できる', async () => {
      const result = await notificationService.sendTestNotification(
        'slack',
        'https://hooks.slack.com/services/xxx/yyy/zzz'
      );
      expect(result.success).toBe(true);
    });

    it('Teamsテスト通知を送信できる', async () => {
      const result = await notificationService.sendTestNotification(
        'teams',
        'https://outlook.webhook.office.com/xxx'
      );
      expect(result.success).toBe(true);
    });

    it('不明なチャネルタイプの場合はエラーを返す', async () => {
      const result = await notificationService.sendTestNotification(
        'unknown',
        'https://example.com'
      );
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown channel type');
    });
  });

  describe('NOTIFICATION_CHANNELS', () => {
    it('正しいチャネルタイプが定義されている', () => {
      const { NOTIFICATION_CHANNELS } = notificationService;
      expect(NOTIFICATION_CHANNELS.EMAIL).toBe('email');
      expect(NOTIFICATION_CHANNELS.SLACK).toBe('slack');
      expect(NOTIFICATION_CHANNELS.TEAMS).toBe('teams');
    });
  });

  describe('NOTIFICATION_TYPES', () => {
    it('正しい通知タイプが定義されている', () => {
      const { NOTIFICATION_TYPES } = notificationService;
      expect(NOTIFICATION_TYPES.INCIDENT_CREATED).toBe('incident_created');
      expect(NOTIFICATION_TYPES.INCIDENT_UPDATED).toBe('incident_updated');
      expect(NOTIFICATION_TYPES.INCIDENT_RESOLVED).toBe('incident_resolved');
      expect(NOTIFICATION_TYPES.SLA_VIOLATION).toBe('sla_violation');
      expect(NOTIFICATION_TYPES.SLA_AT_RISK).toBe('sla_at_risk');
    });
  });

  describe('PRIORITY_COLORS', () => {
    it('優先度に対応する色が定義されている', () => {
      const { PRIORITY_COLORS } = notificationService;
      expect(PRIORITY_COLORS.critical).toBe('#FF0000');
      expect(PRIORITY_COLORS.high).toBe('#FF6600');
      expect(PRIORITY_COLORS.medium).toBe('#FFCC00');
      expect(PRIORITY_COLORS.low).toBe('#00CC00');
    });
  });
});
