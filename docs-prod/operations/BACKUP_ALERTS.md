# バックアップアラート設定・運用手順書

| 項目 | 内容 |
|------|------|
| **ドキュメントID** | OP-BKP-ALT-001 |
| **バージョン** | 1.0 |
| **作成日** | 2026-02-15 |
| **最終更新日** | 2026-02-15 |
| **対象読者** | システム管理者、運用担当者 |
| **分類** | 運用手順書 |
| **準拠規格** | ISO 20000, NIST CSF 2.0 (PR.DS, DE.AE) |

---

## 目次

1. [概要](#1-概要)
2. [アーキテクチャ](#2-アーキテクチャ)
3. [環境変数設定](#3-環境変数設定)
4. [SMTP サーバー設定](#4-smtp-サーバー設定)
5. [通知メールの内容](#5-通知メールの内容)
6. [設定手順（ステップバイステップ）](#6-設定手順ステップバイステップ)
7. [テスト手順](#7-テスト手順)
8. [代替通知チャネル（Slack / Microsoft Teams）](#8-代替通知チャネルslack--microsoft-teams)
9. [ログの確認方法](#9-ログの確認方法)
10. [トラブルシューティング](#10-トラブルシューティング)
11. [FAQ](#11-faq)
12. [設定チェックリスト](#12-設定チェックリスト)
13. [エスカレーション基準](#13-エスカレーション基準)
14. [関連ドキュメント](#14-関連ドキュメント)
15. [改訂履歴](#15-改訂履歴)

---

## 1. 概要

### 1.1 目的

本ドキュメントは、ITSM-Sec Nexus のバックアップ失敗時メール通知機能の設定および運用手順を定めます。

バックアップはシステムの可用性維持に不可欠です。バックアップ処理が失敗した場合、速やかに管理者へ通知し、手動バックアップの実行やエラー原因の調査を促す必要があります。本機能はこの目的を達成するためのアラート通知メカニズムです。

### 1.2 通知タイミング

バックアップアラートは **バックアップ失敗時のみ** 発火します。

| イベント | 通知 | 備考 |
|----------|------|------|
| バックアップ成功 | 通知しない | 正常系はログ記録のみ |
| バックアップ失敗 | **メール通知** | `BACKUP_ALERT_EMAIL` 設定時のみ |
| リストア成功 | 通知しない | 監査ログに記録 |
| リストア失敗 | 通知しない | 監査ログに記録（将来拡張予定） |

### 1.3 通知内容

失敗通知メールには以下の情報が含まれます。

- **バックアップID**: `BKP-YYYYMMDDHHMMSS-{type}` 形式の一意識別子
- **バックアップ種別**: daily / weekly / monthly / manual
- **発生時刻**: ISO 8601 形式のタイムスタンプ
- **エラー内容**: 失敗の原因となったエラーメッセージ
- **システムURL**: ITSM-Sec Nexus の管理画面URL

### 1.4 設計方針

- **独立性**: メール送信の成否はバックアップ処理の結果に影響しません
  - メール送信に失敗しても、バックアップの失敗ログは正常に記録されます
  - メール送信エラーは別途ログに記録されます
- **シンプルさ**: 環境変数 `BACKUP_ALERT_EMAIL` を設定するだけで有効化されます
- **安全性**: メール送信処理は try-catch で保護されており、システム全体の安定性に影響しません

---

## 2. アーキテクチャ

### 2.1 処理フロー

```
バックアップ実行
    |
    v
createBackup() [backupService.js]
    |
    +-- 成功 --> backup_logs 更新 (status: success) --> 終了
    |
    +-- 失敗 --> backup_logs 更新 (status: failure)
                    |
                    v
              BACKUP_ALERT_EMAIL 設定あり？
                    |
                    +-- なし --> throw error（メール通知スキップ）
                    |
                    +-- あり --> sendBackupFailureAlert() [emailService.js]
                                    |
                                    +-- 送信成功 --> ログ記録 --> throw error
                                    |
                                    +-- 送信失敗 --> エラーログ記録 --> throw error
```

### 2.2 関連コンポーネント

| コンポーネント | ファイルパス | 役割 |
|---------------|-------------|------|
| BackupService | `backend/services/backupService.js` | バックアップ実行・失敗時にメール通知をトリガー |
| EmailService | `backend/services/emailService.js` | メール送信処理（nodemailer + handlebars） |
| NotificationService | `backend/services/notificationService.js` | マルチチャネル通知基盤（Slack/Teams） |
| Backup API | `backend/routes/backups.js` | REST API エンドポイント |

### 2.3 依存パッケージ

| パッケージ | 用途 |
|-----------|------|
| `nodemailer` | SMTP メール送信 |
| `handlebars` | メールテンプレートエンジン |

---

## 3. 環境変数設定

### 3.1 バックアップアラート専用設定

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `BACKUP_ALERT_EMAIL` | いいえ | (未設定=無効) | バックアップ失敗時の通知先メールアドレス |

**重要**: `BACKUP_ALERT_EMAIL` が未設定の場合、メール通知機能は無効化されます。バックアップ失敗はログにのみ記録されます。

### 3.2 SMTP 設定（メール送信に必須）

| 変数名 | 必須 | デフォルト | 説明 |
|--------|------|-----------|------|
| `SMTP_HOST` | はい | `localhost` | SMTP サーバーホスト名 |
| `SMTP_PORT` | はい | `587` | SMTP ポート番号 |
| `SMTP_SECURE` | いいえ | `false` | TLS/SSL 使用 (`true` = ポート465向け) |
| `SMTP_USER` | はい | (なし) | SMTP 認証ユーザー名 |
| `SMTP_PASSWORD` | はい | (なし) | SMTP 認証パスワード |
| `SMTP_FROM` | いいえ | `ITSM-Sec Nexus <noreply@itsm.local>` | 送信元メールアドレス |

### 3.3 複数宛先の設定

`BACKUP_ALERT_EMAIL` にカンマ区切りで複数のメールアドレスを指定できます。

```bash
# 単一宛先
BACKUP_ALERT_EMAIL=admin@example.com

# 複数宛先（カンマ区切り）
BACKUP_ALERT_EMAIL=admin@example.com,ops-team@example.com,manager@example.com
```

> **注意**: カンマの前後にスペースを入れないでください。

---

## 4. SMTP サーバー設定

### 4.1 Gmail を使用する場合

Gmail の「アプリパスワード」を使用します。Google アカウントで2段階認証を有効にした上で、アプリパスワードを生成してください。

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-account@gmail.com
SMTP_PASSWORD=xxxx-xxxx-xxxx-xxxx
SMTP_FROM=ITSM-Sec Nexus <your-account@gmail.com>
```

### 4.2 Microsoft 365 (Outlook) を使用する場合

```bash
SMTP_HOST=smtp.office365.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-account@company.onmicrosoft.com
SMTP_PASSWORD=your-password
SMTP_FROM=ITSM-Sec Nexus <your-account@company.onmicrosoft.com>
```

### 4.3 社内 SMTP サーバーを使用する場合

```bash
SMTP_HOST=mail.internal.company.co.jp
SMTP_PORT=25
SMTP_SECURE=false
SMTP_USER=itsm-service
SMTP_PASSWORD=smtp-password
SMTP_FROM=ITSM-Sec Nexus <itsm-noreply@company.co.jp>
```

> **注意**: ポート25を使用する場合、認証不要な中継設定が多いですが、セキュリティポリシーに従ってください。

### 4.4 TLS/SSL 接続（ポート465）

```bash
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=user@example.com
SMTP_PASSWORD=password
```

---

## 5. 通知メールの内容

### 5.1 件名フォーマット

```
【緊急】バックアップ失敗: {backupId}
```

例:
```
【緊急】バックアップ失敗: BKP-20260215-030000-daily
```

### 5.2 本文フォーマット（プレーンテキスト）

```
【緊急】バックアップ処理が失敗しました

バックアップID: BKP-20260215-030000-daily
種別: daily
発生時刻: 2026-02-15T03:00:15.123Z
エラー内容: Backup script failed with exit code 1: disk full

速やかに原因を確認し、手動バックアップの実行を検討してください。

システムURL: https://192.168.0.187:5050

---
ITSM-Sec Nexus バックアップアラート
```

### 5.3 HTML テンプレート

HTMLテンプレートが `backend/templates/email/backup-failure.hbs` に配置されている場合、自動的にリッチフォーマットのメールが送信されます。テンプレートが存在しない場合は、上記プレーンテキスト版が使用されます。

### 5.4 テンプレートで使用可能な変数

| 変数 | 説明 | 例 |
|------|------|-----|
| `{{backupInfo.backupId}}` | バックアップID | `BKP-20260215-030000-daily` |
| `{{backupInfo.type}}` | バックアップ種別 | `daily` |
| `{{backupInfo.timestamp}}` | 失敗発生時刻 | `2026-02-15T03:00:15.123Z` |
| `{{backupInfo.error}}` | エラーメッセージ | `disk full` |
| `{{systemUrl}}` | システムURL | `https://192.168.0.187:5050` |

---

## 6. 設定手順（ステップバイステップ）

### Step 1: .env ファイルのバックアップ

```bash
cd /opt/itsm-system
cp .env .env.backup.$(date +%Y%m%d%H%M%S)
```

### Step 2: SMTP 設定の追加

`.env` ファイルを編集し、SMTP 設定を追加します。

```bash
vi .env
```

以下を追加（または既存の値を確認）:

```bash
# === SMTP Configuration ===
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=itsm-alerts@company.com
SMTP_PASSWORD=your-app-password
SMTP_FROM=ITSM-Sec Nexus <itsm-alerts@company.com>
```

### Step 3: バックアップアラートメールの設定

同じ `.env` ファイルに以下を追加:

```bash
# === Backup Alert Configuration ===
BACKUP_ALERT_EMAIL=admin@company.com,ops-team@company.com
```

### Step 4: アプリケーションの再起動

環境変数の変更を反映するため、アプリケーションを再起動します。

```bash
# systemd を使用している場合
sudo systemctl restart itsm-nexus

# PM2 を使用している場合
pm2 restart itsm-nexus

# Docker を使用している場合
docker-compose restart app
```

### Step 5: 設定の確認

アプリケーションログで SMTP 接続を確認します。

```bash
# systemd
journalctl -u itsm-nexus -n 20 --no-pager | grep -i smtp

# PM2
pm2 logs itsm-nexus --lines 20 | grep -i smtp

# Docker
docker-compose logs --tail=20 app | grep -i smtp
```

正常な場合、以下のログが出力されます:
```
[EmailService] SMTP server is ready to send emails
```

エラーの場合:
```
[EmailService] SMTP connection error: {エラーメッセージ}
```

---

## 7. テスト手順

### 7.1 テストメール送信（SMTP 接続確認）

まず、SMTP 設定が正しいことをテストメール送信で確認します。

```bash
# テストメール送信 API（管理者権限が必要）
curl -k -X POST https://localhost:6443/api/v1/notifications/test-email \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@company.com"
  }'
```

### 7.2 JWT トークンの取得

テスト用の JWT トークンを取得します。

```bash
# ログインしてトークンを取得
JWT_TOKEN=$(curl -sk -X POST https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "your-admin-password"}' \
  | jq -r '.token')

echo "Token: ${JWT_TOKEN}"
```

### 7.3 バックアップ失敗のシミュレーション

実際のバックアップ失敗を安全にシミュレートする方法:

#### 方法 A: バックアップスクリプトを一時的に無効化

```bash
# バックアップスクリプトを一時的にリネーム
cd /opt/itsm-system
mv scripts/Linux/operations/backup.sh scripts/Linux/operations/backup.sh.bak

# バックアップを実行（スクリプトが見つからないため失敗する）
curl -k -X POST https://localhost:6443/api/v1/backups \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"type": "manual"}'

# バックアップスクリプトを元に戻す（必ず実施）
mv scripts/Linux/operations/backup.sh.bak scripts/Linux/operations/backup.sh
```

#### 方法 B: ディスク容量不足のシミュレーション（非推奨）

本番環境では実施しないでください。テスト環境でのみ実施します。

```bash
# テスト環境で一時ファイルでディスクを埋める
dd if=/dev/zero of=/tmp/fill_disk bs=1M count=10000

# バックアップを実行
curl -k -X POST https://localhost:6443/api/v1/backups \
  -H "Authorization: Bearer ${JWT_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"type": "manual"}'

# 一時ファイルを削除（必ず実施）
rm /tmp/fill_disk
```

### 7.4 メール受信の確認

1. 指定した `BACKUP_ALERT_EMAIL` のメールボックスを確認
2. 件名が「【緊急】バックアップ失敗:」で始まるメールを確認
3. 本文にバックアップID、種別、発生時刻、エラー内容が記載されていることを確認

### 7.5 アプリケーションログの確認

```bash
# 成功時のログ
grep "Failure alert email sent" /var/log/itsm-nexus/app.log

# 失敗時のログ
grep "Failed to send failure alert email" /var/log/itsm-nexus/app.log
```

---

## 8. 代替通知チャネル（Slack / Microsoft Teams）

メール通知に加えて、Slack や Microsoft Teams への通知も設定できます。これらは `notificationService.js` の既存のマルチチャネル通知基盤を利用します。

### 8.1 Slack 通知

#### 8.1.1 Slack Incoming Webhook の設定

1. Slack ワークスペースで「Incoming Webhooks」アプリを追加
2. 通知先チャネルを選択
3. Webhook URL をコピー

#### 8.1.2 環境変数の設定

```bash
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR_WORKSPACE/YOUR_CHANNEL/YOUR_WEBHOOK_TOKENXXXX
```

#### 8.1.3 通知チャネルの登録（DB設定）

```sql
INSERT INTO notification_channels (
  channel_name,
  channel_type,
  webhook_url,
  is_active,
  notification_types
) VALUES (
  'backup-alerts-slack',
  'slack',
  'https://hooks.slack.com/services/T00000000/B00000000/XXXX',
  1,
  'backup_failure'
);
```

### 8.2 Microsoft Teams 通知

#### 8.2.1 Teams Incoming Webhook の設定

1. Teams チャネルの「コネクタ」から「Incoming Webhook」を追加
2. Webhook 名を「ITSM Backup Alerts」に設定
3. Webhook URL をコピー

#### 8.2.2 環境変数の設定

```bash
TEAMS_WEBHOOK_URL=https://company.webhook.office.com/webhookb2/XXXX/IncomingWebhook/XXXX
```

### 8.3 通知チャネルの優先順位

複数の通知チャネルが設定されている場合、すべてのチャネルに対して並行して通知が送信されます。いずれかのチャネルの送信失敗は他のチャネルに影響しません。

| 優先度 | チャネル | 用途 |
|--------|---------|------|
| 1 | Email | 正式な通知記録（監査証跡） |
| 2 | Slack | リアルタイム通知（即時対応） |
| 3 | Teams | チーム内共有（状況把握） |

---

## 9. ログの確認方法

### 9.1 バックアップ実行ログ

バックアップの成功・失敗はデータベースの `backup_logs` テーブルに記録されます。

```bash
# 失敗したバックアップの一覧を取得
curl -k -X GET "https://localhost:6443/api/v1/backups?status=failure&limit=10" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

### 9.2 メール送信ログ

#### 9.2.1 成功ログ

アプリケーションログに以下の形式で記録されます:

```
[INFO] [Backup] Failure alert email sent to admin@company.com
[INFO] [EmailService] Email sent successfully: { messageId: "xxx", to: "admin@company.com", subject: "【緊急】バックアップ失敗: BKP-..." }
```

#### 9.2.2 失敗ログ

```
[ERROR] [Backup] Failed to send failure alert email: Connection timeout
[ERROR] [EmailService] Error sending email: { code: "ECONNREFUSED", ... }
```

### 9.3 通知ログテーブル

`notification_logs` テーブルでマルチチャネル通知の履歴を確認できます。

```sql
-- 直近の通知ログを確認
SELECT
  notification_type,
  channel,
  recipient,
  subject,
  status,
  error_message,
  sent_at
FROM notification_logs
WHERE notification_type LIKE '%backup%'
ORDER BY sent_at DESC
LIMIT 20;
```

### 9.4 監査ログ

バックアップ操作の監査ログは `backup_audit_logs` テーブルに記録されます。

```sql
-- バックアップ操作の監査ログ
SELECT
  operation,
  backup_id,
  username,
  ip_address,
  status,
  details,
  created_at
FROM backup_audit_logs
ORDER BY created_at DESC
LIMIT 20;
```

---

## 10. トラブルシューティング

### 10.1 メールが届かない

#### 原因 1: `BACKUP_ALERT_EMAIL` が未設定

**確認方法**:
```bash
grep BACKUP_ALERT_EMAIL .env
```

**対処法**:
`.env` ファイルに `BACKUP_ALERT_EMAIL` を追加し、アプリケーションを再起動。

#### 原因 2: SMTP 設定が不正

**確認方法**:
```bash
# アプリケーションログで SMTP エラーを確認
grep -i "smtp" /var/log/itsm-nexus/app.log | tail -5
```

**よくあるエラーと対処法**:

| エラーメッセージ | 原因 | 対処法 |
|-----------------|------|--------|
| `ECONNREFUSED` | SMTP サーバーに接続できない | ホスト名・ポート番号を確認 |
| `EAUTH` | 認証失敗 | ユーザー名・パスワードを確認 |
| `ESOCKET` | TLS/SSL 設定不整合 | `SMTP_SECURE` の値を確認 |
| `ETIMEDOUT` | タイムアウト | ファイアウォール設定を確認 |

#### 原因 3: ファイアウォールでブロックされている

**確認方法**:
```bash
# SMTP ポートへの接続テスト
telnet smtp.gmail.com 587

# または nc コマンド
nc -zv smtp.gmail.com 587
```

**対処法**:
```bash
# iptables でポート開放（例: 587）
sudo iptables -A OUTPUT -p tcp --dport 587 -j ACCEPT

# ufw の場合
sudo ufw allow out 587/tcp
```

#### 原因 4: スパムフィルタ

**確認方法**:
- 迷惑メールフォルダを確認
- メールヘッダーを確認（SPF/DKIM/DMARC の評価結果）

**対処法**:
- 送信元ドメインに SPF レコードを設定
- `SMTP_FROM` のアドレスをホワイトリストに追加
- 社内メールサーバーの場合、送信元IPを許可リストに追加

### 10.2 メール送信は成功するが内容が不正

#### 原因: テンプレートファイルの破損

**確認方法**:
```bash
# テンプレートファイルの存在確認
ls -la backend/templates/email/backup-failure.hbs

# テンプレートの内容確認
cat backend/templates/email/backup-failure.hbs
```

**対処法**:
テンプレートファイルが破損している場合、プレーンテキスト版のメールが自動的に使用されます。テンプレートを修復するか、削除してプレーンテキスト版を使用してください。

### 10.3 バックアップは失敗しているが通知が来ない

#### 原因: メール送信自体が失敗している

**確認方法**:
```bash
# メール送信失敗のログを確認
grep "Failed to send failure alert email" /var/log/itsm-nexus/app.log
```

**対処法**:
1. SMTP 設定を確認（セクション 4 参照）
2. テストメールを送信して接続を確認（セクション 7.1 参照）
3. それでも解決しない場合、Slack / Teams の代替チャネルを検討（セクション 8 参照）

### 10.4 メールが大量に送信される

#### 原因: バックアップスケジューラが短時間で複数回失敗

**確認方法**:
```bash
# 直近の失敗回数を確認
curl -k -X GET "https://localhost:6443/api/v1/backups?status=failure&limit=50" \
  -H "Authorization: Bearer ${JWT_TOKEN}" | jq '.data.total'
```

**対処法**:
1. バックアップ失敗の根本原因を特定・解消
2. 一時的に `BACKUP_ALERT_EMAIL` をコメントアウトしてアラート停止
3. スケジューラ設定（cron）を確認し、過剰な実行頻度を修正

---

## 11. FAQ

### Q1: バックアップが成功した場合も通知されますか？

**A**: いいえ。バックアップアラートは **失敗時のみ** 送信されます。成功したバックアップは `backup_logs` テーブルに `status: success` として記録されますが、メール通知は行われません。

バックアップの成功確認は、管理画面の「バックアップ管理」セクションまたは API で確認してください。

```bash
# 直近の成功バックアップを確認
curl -k -X GET "https://localhost:6443/api/v1/backups?status=success&limit=5" \
  -H "Authorization: Bearer ${JWT_TOKEN}"
```

---

### Q2: メール送信に失敗した場合、バックアップ処理も失敗しますか？

**A**: いいえ。メール送信処理はバックアップ処理から **独立** しています。

実装コード（`backupService.js` 202-217行）では、メール送信は try-catch で保護されています。

```
バックアップ失敗
  |
  +-> backup_logs に failure を記録（必ず実行）
  +-> メール送信を試行
        |
        +-> 成功: ログに記録
        +-> 失敗: エラーログに記録（バックアップ処理には影響なし）
  |
  +-> エラーを上位に throw（API レスポンスで失敗を返却）
```

---

### Q3: 複数のメールアドレスに通知できますか？

**A**: はい。`BACKUP_ALERT_EMAIL` にカンマ区切りで複数のアドレスを指定できます。

```bash
BACKUP_ALERT_EMAIL=admin@company.com,ops-team@company.com,manager@company.com
```

すべての宛先に同一の通知メールが送信されます。

---

### Q4: 通知メールの件名や本文をカスタマイズできますか？

**A**: HTML テンプレートをカスタマイズすることで、メールの見た目を変更できます。

1. `backend/templates/email/backup-failure.hbs` を編集
2. Handlebars テンプレート構文を使用
3. 使用可能な変数はセクション 5.4 を参照
4. アプリケーションの再起動は不要（テンプレートは送信時に毎回読み込まれます）

件名の変更は `emailService.js` のコード変更が必要となるため、運用担当者レベルでは推奨しません。

---

### Q5: 特定の種別（daily など）のバックアップ失敗のみ通知できますか？

**A**: 現在の実装では、バックアップ種別によるフィルタリング機能はありません。すべての種別の失敗が通知されます。

種別ごとのフィルタリングが必要な場合は、開発チームに機能要望を提出してください。

---

### Q6: メール通知の代わりに Slack だけ使えますか？

**A**: はい。`BACKUP_ALERT_EMAIL` を未設定のままにし、Slack Webhook を設定することで、Slack のみの通知構成が可能です。ただし、現時点のバックアップ失敗通知は `emailService.js` の `sendBackupFailureAlert()` を直接呼び出しているため、Slack 通知には `notificationService.js` の通知チャネル設定が追加で必要です。

将来的にはバックアップ失敗イベントもマルチチャネル通知基盤に統合される予定です。

---

### Q7: テスト環境ではメール送信をスキップできますか？

**A**: はい。テスト環境（`NODE_ENV=test`）では SMTP 接続確認がスキップされます。また、`BACKUP_ALERT_EMAIL` を未設定にすることでメール送信自体をスキップできます。

テスト環境で意図的にメール送信をテストしたい場合は、MailHog や MailCatcher などのローカル SMTP サーバーを使用してください。

```bash
# MailHog を使用する場合
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
```

---

## 12. 設定チェックリスト

### 12.1 初期設定チェックリスト

| # | 項目 | 確認 |
|---|------|------|
| 1 | `.env` ファイルをバックアップした | [ ] |
| 2 | `SMTP_HOST` が正しく設定されている | [ ] |
| 3 | `SMTP_PORT` が正しく設定されている（587 or 465） | [ ] |
| 4 | `SMTP_SECURE` がポートに合った値になっている | [ ] |
| 5 | `SMTP_USER` が設定されている | [ ] |
| 6 | `SMTP_PASSWORD` が設定されている | [ ] |
| 7 | `SMTP_FROM` が設定されている | [ ] |
| 8 | `BACKUP_ALERT_EMAIL` が設定されている | [ ] |
| 9 | アプリケーションを再起動した | [ ] |
| 10 | SMTP 接続成功ログを確認した | [ ] |
| 11 | テストメール送信に成功した | [ ] |
| 12 | バックアップ失敗シミュレーションを実施した | [ ] |
| 13 | アラートメールの受信を確認した | [ ] |

### 12.2 定期確認チェックリスト（月次）

| # | 項目 | 確認 |
|---|------|------|
| 1 | `BACKUP_ALERT_EMAIL` の宛先が最新か確認 | [ ] |
| 2 | SMTP パスワードの有効期限を確認 | [ ] |
| 3 | テストメール送信が成功するか確認 | [ ] |
| 4 | 直近のバックアップ失敗ログを確認 | [ ] |
| 5 | メール送信失敗ログがないか確認 | [ ] |
| 6 | 通知先メンバーの退職・異動がないか確認 | [ ] |

---

## 13. エスカレーション基準

### Level 1: 運用担当者対応

| 状況 | 対応 |
|------|------|
| バックアップ失敗のアラートメール受信 | 原因調査・手動バックアップ実行 |
| メール送信設定の変更 | `.env` 修正・アプリ再起動 |
| テストメール送信の確認 | セクション 7 の手順実施 |

### Level 2: システム管理者対応

| 状況 | 対応 |
|------|------|
| SMTP 接続が確立できない | ネットワーク・ファイアウォール調査 |
| バックアップが連続3回以上失敗 | ディスク容量・権限・スクリプト調査 |
| メール送信エラーが継続 | SMTPサーバー管理者に連絡 |

### Level 3: 開発チーム対応

| 状況 | 対応 |
|------|------|
| EmailService のコードエラー | バグ修正・パッチ適用 |
| 通知テンプレートの破損 | テンプレート修復 |
| 新しい通知チャネルの追加要望 | 機能追加の検討 |

---

## 14. 関連ドキュメント

| ドキュメント | パス | 説明 |
|-------------|------|------|
| バックアップリストア手順書 | `docs-prod/operations/BACKUP_RESTORE_PROCEDURES.md` | バックアップ・リストアの詳細手順 |
| バックアップ障害ランブック | `docs-prod/operations/runbooks/backup-failure-runbook.md` | バックアップ障害時の対応フロー |
| Phase 9.1 要件仕様書 | `specs/phase9-1-backup-requirements.md` | バックアップ機能の要件定義 |
| 環境変数設定例 | `config/env/.env.example` | 全環境変数の設定例 |

---

## 15. 改訂履歴

| バージョン | 日付 | 変更内容 | 変更者 |
|-----------|------|---------|--------|
| 1.0 | 2026-02-15 | 初版作成 | ops-runbook |
