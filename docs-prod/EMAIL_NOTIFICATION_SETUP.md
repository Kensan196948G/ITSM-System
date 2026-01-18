# メール通知機能セットアップガイド

## 概要

ITSM-Sec Nexusのメール通知機能の設定方法を説明します。

## 機能

- ✅ パスワードリセット通知
- ✅ Critical脆弱性検出アラート
- ✅ SLA違反通知
- ✅ HTMLテンプレート対応（Handlebars）

## SMTP設定

### .envファイルの設定

```bash
# SMTP Configuration
SMTP_HOST=smtp.gmail.com           # SMTPサーバーホスト
SMTP_PORT=587                       # SMTPポート（587=TLS, 465=SSL）
SMTP_SECURE=false                   # trueの場合SSL、falseの場合TLS
SMTP_USER=your-email@gmail.com      # SMTPユーザー名
SMTP_PASSWORD=your-app-password     # SMTPパスワード
SMTP_FROM=ITSM-Sec Nexus <noreply@itsm.local>  # 送信元

# Email Notifications
ENABLE_EMAIL_NOTIFICATIONS=true     # メール通知の有効化
ADMIN_EMAIL=admin@example.com       # 管理者メールアドレス
SECURITY_TEAM_EMAIL=security@example.com  # セキュリティチームメール
```

### Gmail使用時の設定

1. Googleアカウントで「アプリパスワード」を生成
   - https://myaccount.google.com/apppasswords
   - 2段階認証を有効化する必要があります

2. .envに設定
   ```bash
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=your-email@gmail.com
   SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx  # アプリパスワード
   ```

### その他のSMTPサーバー

#### SendGrid
```bash
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=apikey
SMTP_PASSWORD=your-sendgrid-api-key
```

#### Amazon SES
```bash
SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-ses-smtp-username
SMTP_PASSWORD=your-ses-smtp-password
```

#### Office 365
```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@yourdomain.com
SMTP_PASSWORD=your-password
```

## 使用方法

### パスワードリセット通知

```javascript
const { sendPasswordResetEmail } = require('./services/emailService');

await sendPasswordResetEmail(
  'user@example.com',
  'ユーザー名',
  'reset-token-here'
);
```

### Critical脆弱性アラート

```javascript
const { sendVulnerabilityAlert } = require('./services/emailService');

await sendVulnerabilityAlert(
  'security@example.com',
  {
    vulnerability_id: 'CVE-2025-0001',
    title: 'Critical SQL Injection',
    severity: 'Critical',
    cvss_score: 9.8,
    affected_asset: 'SRV-001',
    detection_date: '2026-01-01',
    status: 'Identified',
    description: '重大な脆弱性が検出されました'
  }
);
```

### SLA違反通知

```javascript
const { sendSlaViolationAlert } = require('./services/emailService');

await sendSlaViolationAlert(
  'admin@example.com',
  {
    sla_id: 'SLA-001',
    service_name: 'Webサービス',
    metric_name: '可用性',
    target_value: '99.9%',
    actual_value: '98.5%',
    achievement_rate: 98.5,
    measurement_period: '2026年1月',
    status: 'Violated'
  }
);
```

### テストメール送信

```javascript
const { sendTestEmail } = require('./services/emailService');

await sendTestEmail('your-email@example.com');
```

## テンプレート

メールテンプレートは`backend/templates/email/`に配置されています：

- `password-reset.hbs` - パスワードリセット通知
- `vulnerability-alert.hbs` - 脆弱性アラート
- `sla-violation.hbs` - SLA違反通知

### テンプレートのカスタマイズ

Handlebars形式でカスタマイズ可能です：

```handlebars
<h1>{{title}}</h1>
<p>{{username}} 様</p>
<a href="{{resetUrl}}">パスワードをリセット</a>
```

## トラブルシューティング

### メールが送信されない

1. SMTP設定を確認
   ```bash
   cat .env | grep SMTP
   ```

2. SMTP接続をテスト
   - サーバー起動時のログを確認
   - `[EmailService] SMTP server is ready` が表示されるか

3. ファイアウォール確認
   - ポート587（TLS）または465（SSL）が開いているか

### Gmailで「安全性の低いアプリ」エラー

- 「アプリパスワード」を使用してください（通常のパスワードではなく）
- https://myaccount.google.com/apppasswords

### テンプレートが見つからない

- `backend/templates/email/`ディレクトリが存在するか確認
- テンプレートファイルの拡張子が`.hbs`であることを確認

## セキュリティ考慮事項

- ✅ SMTP認証情報を`.env`で管理（.gitignore対象）
- ✅ TLS/SSL暗号化通信
- ✅ 送信ログを記録
- ✅ レート制限（スパム防止）

## 次のステップ

1. `.env`にSMTP設定を追加
2. サーバーを再起動
3. テストメールを送信して動作確認
4. パスワードリセット機能と統合
5. 脆弱性検出時の自動通知を実装

---

**本番環境では必ずSMTP設定を行ってください。**
