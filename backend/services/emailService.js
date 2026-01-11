/**
 * Email Service
 * メール送信機能（nodemailer + handlebars）
 */

const fs = require('fs');
const path = require('path');
const nodemailer = require('nodemailer');
const handlebars = require('handlebars');

/**
 * SMTPトランスポーターを作成
 * @returns {nodemailer.Transporter} SMTPトランスポーター
 */
function createTransporter() {
  // 環境変数からSMTP設定を読み込み
  const config = {
    host: process.env.SMTP_HOST || 'localhost',
    port: parseInt(process.env.SMTP_PORT || '587', 10),
    secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD
    }
  };

  // 認証情報がない場合（開発環境用）
  if (!process.env.SMTP_USER || !process.env.SMTP_PASSWORD) {
    console.warn('[EmailService] SMTP authentication not configured, using test account');
    // nodemailerのテストアカウントを使用可能
    // 本番環境では必ず設定すること
  }

  const transporter = nodemailer.createTransport(config);

  // SMTP接続確認（オプション）
  transporter.verify((error) => {
    if (error) {
      console.error('[EmailService] SMTP connection error:', error.message);
    } else {
      console.log('[EmailService] SMTP server is ready to send emails');
    }
  });

  return transporter;
}

// グローバルトランスポーター
let transporter = null;

/**
 * トランスポーターを取得（シングルトン）
 * @returns {nodemailer.Transporter}
 */
function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

/**
 * HTMLテンプレートを読み込んでコンパイル
 * @param {string} templateName - テンプレートファイル名（拡張子なし）
 * @param {Object} data - テンプレートに渡すデータ
 * @returns {string} コンパイルされたHTML
 */
function compileTemplate(templateName, data) {
  const templatePath = path.join(__dirname, '..', 'templates', 'email', `${templateName}.hbs`);

  try {
    const templateSource = fs.readFileSync(templatePath, 'utf8');
    const template = handlebars.compile(templateSource);
    return template(data);
  } catch (error) {
    console.error(`[EmailService] Error loading template ${templateName}:`, error);
    // テンプレートが見つからない場合はプレーンテキストを返す
    return null;
  }
}

/**
 * メールを送信
 * @param {Object} options - メール送信オプション
 * @param {string} options.to - 送信先メールアドレス
 * @param {string} options.subject - 件名
 * @param {string} options.text - プレーンテキスト本文
 * @param {string} options.html - HTML本文（オプション）
 * @param {string} options.template - テンプレート名（オプション）
 * @param {Object} options.templateData - テンプレートデータ（オプション）
 * @returns {Promise<Object>} 送信結果
 */
async function sendEmail(options) {
  const { to, subject, text, html, template, templateData } = options;

  // テンプレートが指定されている場合
  let htmlContent = html;
  if (template && templateData) {
    htmlContent = compileTemplate(template, templateData);
  }

  const mailOptions = {
    from: process.env.SMTP_FROM || 'ITSM-Sec Nexus <noreply@itsm.local>',
    to,
    subject,
    text,
    html: htmlContent
  };

  try {
    const transporterInstance = getTransporter();
    const info = await transporterInstance.sendMail(mailOptions);

    console.log('[EmailService] Email sent successfully:', {
      messageId: info.messageId,
      to,
      subject
    });

    return {
      success: true,
      messageId: info.messageId,
      response: info.response
    };
  } catch (error) {
    console.error('[EmailService] Error sending email:', error);
    throw error;
  }
}

/**
 * パスワードリセット通知メールを送信
 * @param {string} email - 送信先メールアドレス
 * @param {string} username - ユーザー名
 * @param {string} token - リセットトークン
 * @returns {Promise<Object>} 送信結果
 */
async function sendPasswordResetEmail(email, username, token) {
  const resetUrl = `https://${process.env.SYSTEM_IP || '192.168.0.187'}:5050/reset-password?token=${token}`;

  const subject = '【ITSM-Sec Nexus】パスワードリセットのご案内';

  const text = `
${username} 様

ITSM-Sec Nexusのパスワードリセット要求を受け付けました。

以下のリンクをクリックして、新しいパスワードを設定してください：
${resetUrl}

このリンクは1時間有効です。

もしパスワードリセットを要求していない場合は、このメールを無視してください。

---
ITSM-Sec Nexus
セキュリティチーム
  `;

  const templateData = {
    username,
    resetUrl,
    expiresIn: '1時間',
    systemName: 'ITSM-Sec Nexus',
    systemUrl: `https://${process.env.SYSTEM_IP || '192.168.0.187'}:5050`
  };

  return sendEmail({
    to: email,
    subject,
    text,
    template: 'password-reset',
    templateData
  });
}

/**
 * Critical脆弱性検出アラートメールを送信
 * @param {string} email - 送信先メールアドレス
 * @param {Object} vulnerability - 脆弱性情報
 * @returns {Promise<Object>} 送信結果
 */
async function sendVulnerabilityAlert(email, vulnerability) {
  const subject = `【重要】Critical脆弱性検出: ${vulnerability.title}`;

  const text = `
【緊急】Critical脆弱性が検出されました

脆弱性ID: ${vulnerability.vulnerability_id}
タイトル: ${vulnerability.title}
深刻度: ${vulnerability.severity}
CVSS Score: ${vulnerability.cvss_score}
影響資産: ${vulnerability.affected_asset}

詳細を確認し、速やかに対応してください。

システムURL: https://${process.env.SYSTEM_IP || '192.168.0.187'}:5050

---
ITSM-Sec Nexus セキュリティアラート
  `;

  const templateData = {
    vulnerability,
    systemUrl: `https://${process.env.SYSTEM_IP || '192.168.0.187'}:5050`,
    dashboardUrl: `https://${process.env.SYSTEM_IP || '192.168.0.187'}:5050/#/security-dashboard`
  };

  return sendEmail({
    to: email,
    subject,
    text,
    template: 'vulnerability-alert',
    templateData
  });
}

/**
 * SLA違反通知メールを送信
 * @param {string} email - 送信先メールアドレス
 * @param {Object} sla - SLA情報
 * @returns {Promise<Object>} 送信結果
 */
async function sendSlaViolationAlert(email, sla) {
  const subject = `【警告】SLA違反: ${sla.service_name}`;

  const text = `
SLA違反が発生しました

サービス名: ${sla.service_name}
メトリクス: ${sla.metric_name}
目標値: ${sla.target_value}
実績値: ${sla.actual_value}
達成率: ${sla.achievement_rate}%

早急に対応をお願いします。

システムURL: https://${process.env.SYSTEM_IP || '192.168.0.187'}:5050

---
ITSM-Sec Nexus SLAアラート
  `;

  const templateData = {
    sla,
    systemUrl: `https://${process.env.SYSTEM_IP || '192.168.0.187'}:5050`
  };

  return sendEmail({
    to: email,
    subject,
    text,
    template: 'sla-violation',
    templateData
  });
}

/**
 * テストメールを送信
 * @param {string} email - 送信先メールアドレス
 * @returns {Promise<Object>} 送信結果
 */
async function sendTestEmail(email) {
  const subject = 'ITSM-Sec Nexus メール送信テスト';
  const text = 'このメールは、ITSM-Sec Nexusのメール送信機能のテストです。';

  return sendEmail({
    to: email,
    subject,
    text,
    html: '<h1>テストメール</h1><p>メール送信機能が正常に動作しています。</p>'
  });
}

module.exports = {
  sendEmail,
  sendPasswordResetEmail,
  sendVulnerabilityAlert,
  sendSlaViolationAlert,
  sendTestEmail,
  getTransporter
};
