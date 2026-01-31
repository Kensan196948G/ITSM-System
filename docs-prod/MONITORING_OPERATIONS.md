# 監視・ヘルスチェック機能 運用ガイド

**作成日**: 2026-01-31
**バージョン**: 1.0
**対象システム**: ITSM-Sec Nexus
**対象読者**: システム管理者、運用担当者

---

## 目次

1. [概要](#1-概要)
2. [監視ダッシュボードの使い方](#2-監視ダッシュボードの使い方)
3. [メトリクスの理解](#3-メトリクスの理解)
4. [アラートルール設定](#4-アラートルール設定)
5. [通知チャネル設定](#5-通知チャネル設定)
6. [アラート対応フロー](#6-アラート対応フロー)
7. [トラブルシューティング](#7-トラブルシューティング)
8. [API仕様](#8-api仕様)

---

## 1. 概要

### 1.1 目的

ITSM-Sec Nexusの監視・ヘルスチェック機能は、システムの安定運用とビジネス目標の達成を支援します。リアルタイムの監視とプロアクティブなアラート機能により、問題の早期発見と迅速な対応を実現します。

### 1.2 機能範囲

本機能は以下のコンポーネントで構成されています。

#### 監視対象

- **システムメトリクス**: CPU、メモリ、ディスク、稼働時間
- **ビジネスメトリクス**: SLA達成率、インシデント統計、セキュリティインシデント
- **パフォーマンスメトリクス**: APIレスポンスタイム、キャッシュヒット率、エラー率

#### 主要機能

- **監視ダッシュボード**: リアルタイムメトリクス表示（自動更新）
- **アラートルール管理**: 閾値ベースのアラート設定
- **アラート履歴**: 発火履歴、確認・解決ワークフロー
- **通知チャネル**: メール、Slack、カスタムWebhook
- **メトリクス履歴**: 30日間の履歴データ保存

### 1.3 対応コンプライアンス

- **ISO 20000-1:2018**: サービス監視および報告
- **NIST CSF 2.0**: DETECT（検知）機能の実装
- **監査証跡**: すべての監視操作を記録

### 1.4 システム要件

| 項目 | 要件 |
|------|------|
| **権限** | Admin, Manager, Analyst（閲覧のみ） |
| **ブラウザ** | Chrome 90+, Firefox 88+, Edge 90+ |
| **ネットワーク** | HTTPS接続必須（TLS 1.2以上） |

---

## 2. 監視ダッシュボードの使い方

### 2.1 アクセス方法

#### ステップ1: ログイン

```
https://192.168.0.187:6443/
```

管理者またはマネージャーアカウントでログインしてください。

#### ステップ2: 監視ダッシュボードに移動

サイドバーから「監視ダッシュボード」をクリックします。

```
URL: https://192.168.0.187:6443/views/monitoring.html
```

### 2.2 画面構成

監視ダッシュボードは以下のセクションで構成されています。

```
┌─────────────────────────────────────────────────────────────┐
│ [ヘッダー] ITSM-Sec Nexus - 監視ダッシュボード                │
├─────────────────────────────────────────────────────────────┤
│ [アクティブアラート バー]                                    │
│ 🔴 Critical: 2件 | ⚠️ Warning: 5件 | ℹ️ Info: 1件         │
├─────────────────────────────────────────────────────────────┤
│ [システムステータス概要]                                     │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│ │ CPU      │ │ Memory   │ │ Disk     │ │ Uptime   │      │
│ │ 45.2%    │ │ 62.3%    │ │ 55.1%    │ │ 5d 12h   │      │
│ │ [ゲージ] │ │ [ゲージ] │ │ [ゲージ] │ │          │      │
│ └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
├─────────────────────────────────────────────────────────────┤
│ [ビジネスメトリクス]                                         │
│ ┌───────────────────┐ ┌───────────────────┐              │
│ │ SLA達成率         │ │ オープンインシデント│              │
│ │ 98.5%             │ │ 12件              │              │
│ │ [折れ線グラフ]    │ │ [棒グラフ]        │              │
│ └───────────────────┘ └───────────────────┘              │
├─────────────────────────────────────────────────────────────┤
│ [パフォーマンスメトリクス]                                   │
│ ┌───────────────────┐ ┌───────────────────┐              │
│ │ APIレスポンスタイム│ │ キャッシュヒット率 │              │
│ │ 125ms (P95)       │ │ 85.2%             │              │
│ │ [折れ線グラフ]    │ │ [折れ線グラフ]    │              │
│ └───────────────────┘ └───────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

### 2.3 システムメトリクスの見方

#### CPU使用率

**表示**: ゲージ + パーセンテージ（0-100%）

**色分け**:
- 緑色（0-79%）: 正常
- 黄色（80-89%）: 警告
- 赤色（90-100%）: 危険

**推奨アクション**:
- **80%以上が継続**: プロセスを確認し、不要なサービスを停止
- **90%以上が継続**: スケールアップまたはリソース分散を検討

#### メモリ使用率

**表示**: ゲージ + パーセンテージ（0-100%）

**色分け**:
- 緑色（0-79%）: 正常
- 黄色（80-89%）: 警告
- 赤色（90-100%）: 危険

**推奨アクション**:
- **80%以上が継続**: メモリリークの可能性を確認
- **90%以上が継続**: サーバーの再起動またはメモリ増設を検討

#### ディスク使用率

**表示**: ゲージ + パーセンテージ（0-100%）

**色分け**:
- 緑色（0-79%）: 正常
- 黄色（80-89%）: 警告
- 赤色（90-100%）: 危険

**推奨アクション**:
- **80%以上**: 古いログファイルやバックアップを削除
- **90%以上**: ディスク拡張またはストレージ追加が必要

#### 稼働時間（Uptime）

**表示**: `5d 12h 30m 45s`形式

**意味**:
- システムが最後に起動してからの経過時間
- 長期間稼働している場合、計画メンテナンスを検討

#### アクティブユーザー数

**表示**: 数値 + トレンドアイコン

**トレンド**:
- ↑（上昇）: 前回測定より増加
- →（安定）: 変化なし
- ↓（下降）: 前回測定より減少

#### リクエスト数/分

**表示**: 数値 + トレンドアイコン

**正常範囲**: 50-200リクエスト/分（環境により異なる）

**異常パターン**:
- **急増**: DDoS攻撃の可能性、レート制限を確認
- **急減**: サービス停止またはネットワーク問題の可能性

### 2.4 ビジネスメトリクスの見方

#### SLA達成率

**表示**: 折れ線グラフ（過去24時間）+ 現在値パーセンテージ

**目標値**: 95%以上

**計算式**:
```
SLA達成率 = (SLA達成インシデント数 / 全インシデント数) × 100
```

**アクション**:
- **95%未満**: アラートが発火、原因インシデントを特定
- **90%未満**: エスカレーション、経営層への報告

#### オープンインシデント数

**表示**: 棒グラフ（優先度別）+ 総数

**優先度別の色分け**:
- 🔴 Critical（重大）: 赤色
- 🟠 High（高）: オレンジ色
- 🟡 Medium（中）: 黄色
- 🟢 Low（低）: 緑色

**正常範囲**:
- Critical: 0-2件
- High: 0-5件
- Medium: 0-10件
- Low: 0-15件

**アクション**:
- Critical件数が3件以上: 緊急対応体制を確立
- 総数が30件以上: リソース不足の可能性、増員を検討

#### インシデント作成数/日

**表示**: 折れ線グラフ（過去7日間）

**正常範囲**: 5-15件/日（環境により異なる）

**異常パターン**:
- **急増**: システム障害またはセキュリティ侵害の可能性
- **ゼロ件**: インシデント報告プロセスの停止を確認

#### セキュリティインシデント数

**表示**: 数値 + トレンドアイコン

**目標値**: 0件

**アクション**:
- **1件以上**: セキュリティチームへ即座にエスカレーション
- **増加傾向**: 脅威分析と対策強化が必要

#### 平均解決時間（MTTR）

**表示**: 時間単位の数値 + トレンドアイコン

**目標値**: 4時間以内

**計算式**:
```
MTTR = Σ(解決日時 - 作成日時) / 解決済みインシデント数
```

**アクション**:
- **6時間以上**: プロセス改善が必要
- **増加傾向**: リソース不足またはスキルギャップを確認

### 2.5 パフォーマンスメトリクスの見方

#### APIレスポンスタイム

**表示**: 折れ線グラフ（P50/P95/P99）+ 現在値（ミリ秒）

**パーセンタイル説明**:
- **P50（中央値）**: リクエストの50%がこの値以下
- **P95**: リクエストの95%がこの値以下
- **P99**: リクエストの99%がこの値以下

**目標値**:
- P50: 100ms以下
- P95: 200ms以下
- P99: 500ms以下

**アクション**:
- **P95が500ms以上**: データベースクエリの最適化を検討
- **P99が2秒以上**: タイムアウト設定の見直し

#### キャッシュヒット率

**表示**: 折れ線グラフ + 現在値パーセンテージ

**目標値**: 80%以上

**計算式**:
```
キャッシュヒット率 = (キャッシュヒット数 / 総リクエスト数) × 100
```

**アクション**:
- **70%未満**: キャッシュTTL設定を見直し
- **急減**: キャッシュサーバーの問題を確認

#### データベースクエリ数/分

**表示**: 折れ線グラフ

**正常範囲**: 200-500クエリ/分（環境により異なる）

**異常パターン**:
- **急増**: N+1問題またはキャッシュ失効を確認
- **急減**: データベース接続問題の可能性

#### 認証エラー率

**表示**: 折れ線グラフ + 現在値パーセンテージ

**目標値**: 1%未満

**アクション**:
- **3%以上**: ブルートフォース攻撃の可能性、IPブロックを検討
- **急増**: 認証サービスの障害を確認

#### エラー率（4xx/5xx）

**表示**: 折れ線グラフ（2系統）

**目標値**:
- 4xxエラー: 5%未満
- 5xxエラー: 1%未満

**アクション**:
- **4xxエラー急増**: APIクライアントの問題を確認
- **5xxエラー急増**: サーバー側の障害、ログを確認

### 2.6 グラフの操作方法

#### ズーム

マウスドラッグでグラフの一部を拡大できます。

```
1. グラフ上でマウスをドラッグ
2. 選択範囲がハイライトされる
3. 範囲が拡大表示される
```

#### リセット

ズームをリセットするには、グラフ右上の「リセット」ボタンをクリックします。

#### 時間範囲変更

ダッシュボード右上のドロップダウンで表示時間範囲を変更できます。

- 過去1時間
- 過去6時間
- 過去24時間
- 過去7日間

#### データポイント確認

グラフ上にマウスカーソルを合わせると、詳細な値がツールチップで表示されます。

### 2.7 自動更新

ダッシュボードは以下の頻度で自動更新されます。

| セクション | 更新間隔 |
|-----------|---------|
| システムステータス | 10秒 |
| ビジネスメトリクス | 30秒 |
| パフォーマンスメトリクス | 15秒 |
| アラート履歴 | 5秒 |

自動更新は画面右上のトグルボタンで一時停止できます。

---

## 3. メトリクスの理解

### 3.1 システムメトリクス

#### 3.1.1 CPU使用率（itsm_cpu_usage_percent）

**データソース**: `process.cpuUsage()`

**正常範囲**: 0-70%

**閾値**:
- 警告: 80%以上が5分継続
- 危険: 90%以上が5分継続

**影響**:
- レスポンス遅延
- タイムアウトエラー増加
- ユーザー体験の低下

**対処方法**:
```bash
# CPU使用率上位プロセス確認
top -b -n 1 | head -20

# Node.jsプロセス確認
ps aux | grep node

# サービス再起動（最終手段）
sudo systemctl restart itsm-nexus-prod
```

#### 3.1.2 メモリ使用率（itsm_memory_usage_percent）

**データソース**: `os.freemem() / os.totalmem()`

**正常範囲**: 0-70%

**閾値**:
- 警告: 80%以上が5分継続
- 危険: 90%以上が5分継続

**影響**:
- OOMエラー（Out of Memory）
- サービスクラッシュ
- スワップによる性能低下

**対処方法**:
```bash
# メモリ使用状況確認
free -h

# プロセス別メモリ使用量
ps aux --sort=-%mem | head -10

# サービス再起動
sudo systemctl restart itsm-nexus-prod

# メモリキャッシュクリア（慎重に）
sudo sync; echo 3 | sudo tee /proc/sys/vm/drop_caches
```

#### 3.1.3 ディスク使用率（itsm_disk_usage_percent）

**データソース**: `fs.statfsSync()`

**正常範囲**: 0-70%

**閾値**:
- 警告: 80%以上
- 危険: 90%以上

**影響**:
- ログ書き込み失敗
- バックアップ失敗
- データベース肥大化防止

**対処方法**:
```bash
# ディスク使用量確認
df -h

# 容量を多く使用しているディレクトリ
du -sh /* | sort -h | tail -10

# 古いログ削除
sudo find /var/log -type f -mtime +30 -delete

# 古いバックアップ削除
sudo find /backups -type f -mtime +90 -delete
```

### 3.2 ビジネスメトリクス

#### 3.2.1 SLA達成率（itsm_sla_compliance_rate）

**計算式**:
```sql
SELECT
  COUNT(CASE WHEN resolved_at <= sla_due_date THEN 1 END) * 100.0 / COUNT(*)
FROM incidents
WHERE resolved_at IS NOT NULL;
```

**目標値**: 95%以上

**測定期間**: 過去24時間

**影響要因**:
- インシデント解決時間
- 人員配置
- 技術的難易度

**改善方法**:
- 優先度の正確な設定
- 自動化の推進
- ナレッジベースの充実

#### 3.2.2 オープンインシデント数（itsm_incidents_open）

**データソース**: `SELECT COUNT(*) FROM incidents WHERE status != 'resolved'`

**正常範囲**:
- Critical: 0-2件
- High: 0-5件
- Medium: 0-10件
- Low: 0-15件

**アクション閾値**:
- 総数30件以上: リソース不足警告
- Critical 3件以上: 緊急対応体制

**改善方法**:
- インシデント解決の優先順位付け
- 根本原因分析の徹底
- 予防的メンテナンスの実施

### 3.3 パフォーマンスメトリクス

#### 3.3.1 APIレスポンスタイム（itsm_http_request_duration_seconds）

**測定単位**: ミリ秒（ms）

**目標値**:
- P50: 100ms以下
- P95: 200ms以下
- P99: 500ms以下

**影響要因**:
- データベースクエリ
- 外部API呼び出し
- ネットワーク遅延

**改善方法**:
- クエリ最適化（インデックス追加）
- キャッシュの活用
- 非同期処理の導入

#### 3.3.2 キャッシュヒット率（itsm_cache_hit_rate）

**目標値**: 80%以上

**計算式**:
```
キャッシュヒット率 = (キャッシュヒット数 / 総リクエスト数) × 100
```

**影響要因**:
- キャッシュTTL設定
- キャッシュサイズ
- データ更新頻度

**改善方法**:
- TTLの最適化
- キャッシュメモリ増加
- キャッシュウォーミング

---

## 4. アラートルール設定

### 4.1 アラートルール作成手順（Web UI）

#### ステップ1: アラートルール管理画面にアクセス

```
URL: https://192.168.0.187:6443/views/monitoring-alerts.html
```

#### ステップ2: 「新規ルール作成」ボタンをクリック

画面右上の「+ 新規ルール作成」ボタンをクリックします。

#### ステップ3: ルール情報を入力

**フォーム項目**:

| 項目 | 説明 | 例 |
|------|------|-----|
| **ルール名** | ルールの識別名（重複不可） | `High CPU Usage` |
| **メトリクス** | 監視対象メトリクス | `itsm_cpu_usage_percent` |
| **条件** | 判定条件 | `>` （より大きい） |
| **閾値** | 判定基準値 | `80.0` |
| **継続時間** | 条件が継続する秒数 | `300` （5分） |
| **重要度** | Critical/Warning/Info | `Warning` |
| **通知チャネル** | 通知先（複数選択可） | `email-ops`, `slack-alerts` |
| **有効/無効** | ルールの状態 | 有効（チェック） |

#### ステップ4: 「保存」ボタンをクリック

入力内容を確認し、「保存」ボタンをクリックします。

#### ステップ5: 確認

ルール一覧に新しいルールが表示されることを確認します。

### 4.2 アラートルール作成手順（API）

```bash
curl -X POST https://192.168.0.187:6443/api/v1/monitoring/alert-rules \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_name": "High CPU Usage",
    "metric_name": "itsm_cpu_usage_percent",
    "condition": ">",
    "threshold": 80.0,
    "duration": 300,
    "severity": "warning",
    "enabled": true,
    "notification_channels": ["email-ops", "slack-alerts"]
  }'
```

**レスポンス（成功）**:
```json
{
  "id": 1,
  "rule_name": "High CPU Usage",
  "metric_name": "itsm_cpu_usage_percent",
  "condition": ">",
  "threshold": 80.0,
  "duration": 300,
  "severity": "warning",
  "enabled": true,
  "notification_channels": ["email-ops", "slack-alerts"],
  "created_at": "2026-01-31T10:00:00Z",
  "updated_at": "2026-01-31T10:00:00Z"
}
```

### 4.3 推奨アラートルール一覧

以下の15個のアラートルールを設定することを推奨します。

#### 4.3.1 システムリソースアラート（5個）

**1. 高CPU使用率（Critical）**

```json
{
  "rule_name": "Critical CPU Usage",
  "metric_name": "itsm_cpu_usage_percent",
  "condition": ">",
  "threshold": 90.0,
  "duration": 300,
  "severity": "critical",
  "notification_channels": ["email-ops", "slack-alerts"],
  "enabled": true
}
```

**2. 高CPU使用率（Warning）**

```json
{
  "rule_name": "High CPU Usage",
  "metric_name": "itsm_cpu_usage_percent",
  "condition": ">",
  "threshold": 80.0,
  "duration": 300,
  "severity": "warning",
  "notification_channels": ["email-ops"],
  "enabled": true
}
```

**3. 高メモリ使用率（Critical）**

```json
{
  "rule_name": "Critical Memory Usage",
  "metric_name": "itsm_memory_usage_percent",
  "condition": ">",
  "threshold": 90.0,
  "duration": 300,
  "severity": "critical",
  "notification_channels": ["email-ops", "slack-alerts"],
  "enabled": true
}
```

**4. 高メモリ使用率（Warning）**

```json
{
  "rule_name": "High Memory Usage",
  "metric_name": "itsm_memory_usage_percent",
  "condition": ">",
  "threshold": 80.0,
  "duration": 300,
  "severity": "warning",
  "notification_channels": ["email-ops"],
  "enabled": true
}
```

**5. 低ディスク容量（Warning）**

```json
{
  "rule_name": "Low Disk Space",
  "metric_name": "itsm_disk_usage_percent",
  "condition": ">",
  "threshold": 80.0,
  "duration": 60,
  "severity": "warning",
  "notification_channels": ["email-ops"],
  "enabled": true
}
```

#### 4.3.2 アプリケーションエラーアラート（4個）

**6. 高5xxエラー率（Critical）**

```json
{
  "rule_name": "High 5xx Error Rate",
  "metric_name": "itsm_http_5xx_errors_percent",
  "condition": ">",
  "threshold": 5.0,
  "duration": 120,
  "severity": "critical",
  "notification_channels": ["email-ops", "slack-alerts"],
  "enabled": true
}
```

**7. 高4xxエラー率（Warning）**

```json
{
  "rule_name": "High 4xx Error Rate",
  "metric_name": "itsm_http_4xx_errors_percent",
  "condition": ">",
  "threshold": 10.0,
  "duration": 300,
  "severity": "warning",
  "notification_channels": ["email-ops"],
  "enabled": true
}
```

**8. 認証失敗多発（Warning）**

```json
{
  "rule_name": "High Authentication Failures",
  "metric_name": "itsm_auth_errors_total",
  "condition": ">",
  "threshold": 10,
  "duration": 60,
  "severity": "warning",
  "notification_channels": ["email-ops", "slack-security"],
  "enabled": true
}
```

**9. 高レスポンスタイム（Warning）**

```json
{
  "rule_name": "High API Response Time",
  "metric_name": "itsm_http_request_duration_p95_ms",
  "condition": ">",
  "threshold": 2000,
  "duration": 300,
  "severity": "warning",
  "notification_channels": ["email-ops"],
  "enabled": true
}
```

#### 4.3.3 ビジネスメトリクスアラート（4個）

**10. SLA違反（Critical）**

```json
{
  "rule_name": "SLA Compliance Low",
  "metric_name": "itsm_sla_compliance_rate",
  "condition": "<",
  "threshold": 95.0,
  "duration": 300,
  "severity": "critical",
  "notification_channels": ["email-ops", "slack-alerts", "email-management"],
  "enabled": true
}
```

**11. 高優先度インシデント多発（Warning）**

```json
{
  "rule_name": "High Priority Incidents Spike",
  "metric_name": "itsm_incidents_open_critical",
  "condition": ">",
  "threshold": 3,
  "duration": 60,
  "severity": "warning",
  "notification_channels": ["email-ops", "slack-alerts"],
  "enabled": true
}
```

**12. セキュリティインシデント発生（Critical）**

```json
{
  "rule_name": "Security Incident Detected",
  "metric_name": "itsm_security_incidents_total",
  "condition": ">",
  "threshold": 0,
  "duration": 60,
  "severity": "critical",
  "notification_channels": ["email-security", "slack-security"],
  "enabled": true
}
```

**13. MTTR増加（Warning）**

```json
{
  "rule_name": "High Mean Time To Resolve",
  "metric_name": "itsm_mttr_hours",
  "condition": ">",
  "threshold": 6.0,
  "duration": 3600,
  "severity": "warning",
  "notification_channels": ["email-management"],
  "enabled": true
}
```

#### 4.3.4 パフォーマンスアラート（2個）

**14. 低キャッシュヒット率（Warning）**

```json
{
  "rule_name": "Low Cache Hit Rate",
  "metric_name": "itsm_cache_hit_rate",
  "condition": "<",
  "threshold": 70.0,
  "duration": 600,
  "severity": "warning",
  "notification_channels": ["email-ops"],
  "enabled": true
}
```

**15. 高データベースクエリ数（Info）**

```json
{
  "rule_name": "High Database Query Rate",
  "metric_name": "itsm_database_queries_per_minute",
  "condition": ">",
  "threshold": 1000,
  "duration": 300,
  "severity": "info",
  "notification_channels": ["email-ops"],
  "enabled": true
}
```

### 4.4 閾値の調整方法

#### ステップ1: ベースライン測定

新しい環境では、まず1週間の測定期間を設けます。

```bash
# メトリクス履歴を取得
curl -X GET "https://192.168.0.187:6443/api/v1/monitoring/metrics/history?metric_name=itsm_cpu_usage_percent&period=7d" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### ステップ2: 統計分析

取得したデータから以下を計算します。

- **平均値**: 通常の負荷レベル
- **P95値**: 高負荷時のレベル
- **最大値**: ピーク時のレベル

#### ステップ3: 閾値設定

以下の基準で閾値を設定します。

```
Warning閾値 = P95値 + 10%
Critical閾値 = P95値 + 20%
```

例:
```
CPU使用率のP95値が70%の場合:
- Warning閾値: 70% + 10% = 77% → 80%（丸め）
- Critical閾値: 70% + 20% = 84% → 85%（丸め）
```

#### ステップ4: フラッピング防止

アラートが頻繁に発火・解決を繰り返す「フラッピング」を防ぐため、`duration`（継続時間）を設定します。

**推奨値**:
- システムリソース: 300秒（5分）
- アプリケーションエラー: 120秒（2分）
- ビジネスメトリクス: 600秒（10分）

#### ステップ5: 定期的な見直し

3ヶ月ごとに閾値を見直し、環境の変化に対応します。

---

## 5. 通知チャネル設定

### 5.1 メール通知設定

#### ステップ1: 通知チャネル管理画面にアクセス

```
URL: https://192.168.0.187:6443/views/monitoring-notifications.html
```

#### ステップ2: 「新規チャネル作成」ボタンをクリック

#### ステップ3: メール設定を入力

**フォーム項目**:

| 項目 | 説明 | 例 |
|------|------|-----|
| **チャネル名** | 識別名（重複不可） | `email-ops` |
| **チャネルタイプ** | `email` を選択 | `email` |
| **受信者** | メールアドレス（複数可） | `ops@example.com` |
| **有効/無効** | チャネルの状態 | 有効（チェック） |

#### ステップ4: 「保存」ボタンをクリック

#### API例:

```bash
curl -X POST https://192.168.0.187:6443/api/v1/monitoring/notification-channels \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_name": "email-ops",
    "channel_type": "email",
    "config": {
      "recipients": ["ops@example.com", "admin@example.com"]
    },
    "enabled": true
  }'
```

### 5.2 Slack Webhook設定

#### ステップ1: Slack Incoming Webhook URLを取得

1. Slackワークスペースにログイン
2. https://api.slack.com/apps にアクセス
3. 「Create New App」→「From scratch」を選択
4. App名を入力（例: `ITSM Alert Bot`）
5. Workspaceを選択
6. 「Incoming Webhooks」を有効化
7. 「Add New Webhook to Workspace」をクリック
8. 通知先チャネルを選択（例: `#alerts`）
9. Webhook URLをコピー（例: `https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX`）

#### ステップ2: 通知チャネル作成

**Web UI**:

| 項目 | 値 |
|------|-----|
| **チャネル名** | `slack-alerts` |
| **チャネルタイプ** | `slack` |
| **Webhook URL** | （上記で取得したURL） |
| **ユーザー名** | `ITSM Alert Bot` |
| **アイコン絵文字** | `:warning:` |

**API例**:

```bash
curl -X POST https://192.168.0.187:6443/api/v1/monitoring/notification-channels \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_name": "slack-alerts",
    "channel_type": "slack",
    "config": {
      "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX",
      "username": "ITSM Alert Bot",
      "icon_emoji": ":warning:"
    },
    "enabled": true
  }'
```

### 5.3 カスタムWebhook設定

#### ステップ1: Webhook受信エンドポイントを用意

受信側のシステムで、以下のペイロードを処理するエンドポイントを実装します。

**ペイロード例**:
```json
{
  "severity": "critical",
  "rule_name": "High CPU Usage",
  "metric_name": "itsm_cpu_usage_percent",
  "current_value": 85.3,
  "threshold": 80.0,
  "message": "CPU使用率が80%を超えました",
  "fired_at": "2026-01-31T10:15:00Z"
}
```

#### ステップ2: 通知チャネル作成

**API例**:

```bash
curl -X POST https://192.168.0.187:6443/api/v1/monitoring/notification-channels \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_name": "webhook-pagerduty",
    "channel_type": "webhook",
    "config": {
      "webhook_url": "https://api.pagerduty.com/incidents",
      "http_method": "POST",
      "custom_headers": {
        "Authorization": "Bearer YOUR_PAGERDUTY_TOKEN",
        "Content-Type": "application/json"
      },
      "payload_template": "{\"severity\":\"{{severity}}\",\"summary\":\"{{rule_name}}: {{message}}\",\"source\":\"ITSM-Sec Nexus\"}"
    },
    "enabled": true
  }'
```

### 5.4 テスト送信手順

#### Web UI

1. 通知チャネル一覧で、テストしたいチャネルの「テスト送信」ボタンをクリック
2. テストメッセージが送信される
3. 受信を確認（メール受信トレイ、Slackチャネルなど）

#### API

```bash
curl -X POST "https://192.168.0.187:6443/api/v1/monitoring/notification-channels/email-ops/test" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**レスポンス（成功）**:
```json
{
  "status": "sent",
  "message": "テスト通知が正常に送信されました",
  "timestamp": "2026-01-31T10:20:00Z"
}
```

**レスポンス（失敗）**:
```json
{
  "status": "failed",
  "error": "SMTP connection timeout",
  "timestamp": "2026-01-31T10:20:00Z"
}
```

---

## 6. アラート対応フロー

### 6.1 アラート受信時の確認手順

#### ステップ1: アラート通知を受信

メール、Slack、またはダッシュボードでアラートを確認します。

**メール通知例**:
```
件名: [CRITICAL] High CPU Usage

アラート詳細:
- ルール名: High CPU Usage
- メトリクス: itsm_cpu_usage_percent
- 現在値: 85.3%
- 閾値: 80.0%
- 重要度: Critical
- 発火時刻: 2026-01-31 10:15:00

ダッシュボード: https://192.168.0.187:6443/views/monitoring.html
```

#### ステップ2: ダッシュボードで詳細確認

1. 監視ダッシュボードにアクセス
2. システムメトリクスセクションでCPU使用率を確認
3. グラフで推移を確認（急上昇か、徐々に上昇か）

#### ステップ3: 影響範囲の確認

- ユーザーからの問い合わせ有無
- エラーログの増加有無
- 他のメトリクスへの影響

### 6.2 Acknowledge（確認）の実施

アラートを確認したことを記録します。

#### Web UI

1. アラート履歴画面にアクセス
2. 対象アラートの「確認」ボタンをクリック
3. コメントを入力（オプション）
4. 「確認」ボタンをクリック

#### API

```bash
curl -X POST "https://192.168.0.187:6443/api/v1/monitoring/alerts/123/acknowledge" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "原因を調査中"
  }'
```

**効果**:
- アラートステータスが `firing` → `acknowledged` に変更
- 重複通知の抑制
- 対応者の明確化

### 6.3 原因調査と対応

#### CPU使用率高の場合

```bash
# CPU使用率上位プロセス確認
top -b -n 1 | head -20

# Node.jsプロセスのCPU使用率
ps aux | grep node

# プロセスの詳細確認
pidstat -u -p $(pgrep -f "node.*server.js") 1 5

# 対処: プロセス再起動
sudo systemctl restart itsm-nexus-prod
```

#### メモリ使用率高の場合

```bash
# メモリ使用状況確認
free -h

# プロセス別メモリ使用量
ps aux --sort=-%mem | head -10

# メモリリークの可能性確認
sudo journalctl -u itsm-nexus-prod | grep -i "memory"

# 対処: プロセス再起動
sudo systemctl restart itsm-nexus-prod
```

#### SLA違反の場合

```bash
# 違反インシデント確認
curl -X GET "https://192.168.0.187:6443/api/v1/incidents?sla_violated=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# インシデント詳細確認
curl -X GET "https://192.168.0.187:6443/api/v1/incidents/INC-20260131-001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 対処: 優先度の見直し、リソース追加配分
```

### 6.4 Resolve（解決）の実施

問題が解決したら、アラートを解決済みにします。

#### Web UI

1. アラート履歴画面にアクセス
2. 対象アラートの「解決」ボタンをクリック
3. 解決コメントを入力（必須）
4. 「解決」ボタンをクリック

#### API

```bash
curl -X POST "https://192.168.0.187:6443/api/v1/monitoring/alerts/123/resolve" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "comment": "プロセスを再起動し、CPU使用率が正常範囲に戻りました"
  }'
```

**効果**:
- アラートステータスが `acknowledged` → `resolved` に変更
- 解決日時が記録される
- MTTR（平均解決時間）の計算に使用される

### 6.5 アラート対応SLA

| 重要度 | 確認時間 | 解決時間 |
|--------|---------|---------|
| **Critical** | 15分以内 | 1時間以内 |
| **Warning** | 1時間以内 | 4時間以内 |
| **Info** | 24時間以内 | 48時間以内 |

---

## 7. トラブルシューティング

### 7.1 メトリクスが表示されない

#### 症状

- ダッシュボードでメトリクスが「N/A」と表示される
- グラフが空白

#### 原因と対処

**原因1: スケジューラーが停止している**

```bash
# サービス状態確認
sudo systemctl status itsm-nexus-prod

# 対処: サービス再起動
sudo systemctl restart itsm-nexus-prod

# ログ確認
sudo journalctl -u itsm-nexus-prod -f | grep -i "monitoring"
```

**原因2: データベース接続エラー**

```bash
# データベースファイル確認
ls -lh /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db

# データベース整合性チェック
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA integrity_check;"

# 対処: データベースが破損している場合、バックアップから復元
```

**原因3: メトリクス収集の失敗**

```bash
# メトリクステーブル確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT COUNT(*) FROM metric_history WHERE timestamp > datetime('now', '-1 hour');"

# ゼロ件の場合、スケジューラーが動作していない
# 対処: サービス再起動
sudo systemctl restart itsm-nexus-prod
```

### 7.2 アラートが発火しない

#### 症状

- 閾値を超えているのにアラートが発火しない
- アラート履歴に記録されない

#### 原因と対処

**原因1: アラートルールが無効**

```bash
# アラートルール確認
curl -X GET "https://192.168.0.187:6443/api/v1/monitoring/alert-rules/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 対処: ルールを有効化
curl -X PUT "https://192.168.0.187:6443/api/v1/monitoring/alert-rules/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"enabled": true}'
```

**原因2: 継続時間（duration）が長すぎる**

閾値を超えていても、指定した継続時間（duration）に達していない場合、アラートは発火しません。

```bash
# ルール確認
# duration: 300（5分）の場合、5分間継続して閾値を超える必要がある

# 対処: durationを短縮（例: 300 → 120）
curl -X PUT "https://192.168.0.187:6443/api/v1/monitoring/alert-rules/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"duration": 120}'
```

**原因3: アラート評価が停止している**

```bash
# スケジューラーログ確認
sudo journalctl -u itsm-nexus-prod | grep -i "alert evaluation"

# 対処: サービス再起動
sudo systemctl restart itsm-nexus-prod
```

### 7.3 通知が届かない

#### 症状

- アラートは発火しているが、通知が届かない
- 通知履歴に「失敗」と記録される

#### 原因と対処（メール）

**原因: SMTP設定エラー**

```bash
# .env.productionを確認
cat config/env/.env.production | grep SMTP

# 必要項目:
# SMTP_HOST=smtp.gmail.com
# SMTP_PORT=587
# SMTP_USER=your-email@gmail.com
# SMTP_PASSWORD=your-app-password

# 対処: 設定を修正
sudo nano config/env/.env.production

# サービス再起動
sudo systemctl restart itsm-nexus-prod
```

**テスト送信**:

```bash
curl -X POST "https://192.168.0.187:6443/api/v1/monitoring/notification-channels/email-ops/test" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### 原因と対処（Slack）

**原因: Webhook URL無効**

```bash
# Webhook URL確認
curl -X GET "https://192.168.0.187:6443/api/v1/monitoring/notification-channels/slack-alerts" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 対処: Webhook URLを再取得し、更新
curl -X PUT "https://192.168.0.187:6443/api/v1/monitoring/notification-channels/slack-alerts" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "config": {
      "webhook_url": "NEW_WEBHOOK_URL",
      "username": "ITSM Alert Bot",
      "icon_emoji": ":warning:"
    }
  }'
```

**手動テスト**:

```bash
curl -X POST "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Test notification from ITSM-Sec Nexus"
  }'
```

### 7.4 グラフが更新されない

#### 症状

- ダッシュボードのグラフが古いデータのまま
- 最新データが反映されない

#### 原因と対処

**原因1: 自動更新が無効**

画面右上の自動更新トグルボタンを確認し、有効化します。

**原因2: ブラウザキャッシュ**

```
Ctrl + Shift + R（Windows/Linux）
Cmd + Shift + R（Mac）
```

でページを強制リロードします。

**原因3: API接続エラー**

```bash
# ブラウザのコンソール（F12）でネットワークエラーを確認

# APIエンドポイント確認
curl -X GET "https://192.168.0.187:6443/api/v1/monitoring/metrics/system" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 7.5 ダッシュボードが遅い

#### 症状

- ダッシュボードの読み込みが遅い
- グラフの更新に時間がかかる

#### 原因と対処

**原因1: 履歴データが大量**

```bash
# メトリクス履歴件数確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT COUNT(*) FROM metric_history;"

# 30日以上のデータを削除
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "DELETE FROM metric_history WHERE timestamp < datetime('now', '-30 days');"
```

**原因2: データベースインデックス不足**

```bash
# インデックス確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='metric_history';"

# 対処: マイグレーションを実行してインデックスを作成
# （通常は自動的に作成されています）
```

**原因3: サーバー負荷**

```bash
# CPU/メモリ確認
top

# 対処: リソース不足の場合、スケールアップを検討
```

### 7.6 アラートが頻繁に発火する（フラッピング）

#### 症状

- 同じアラートが数分おきに発火・解決を繰り返す
- 通知が大量に届く

#### 原因と対処

**原因: 閾値がギリギリの値で設定されている**

```bash
# ルール確認
curl -X GET "https://192.168.0.187:6443/api/v1/monitoring/alert-rules/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 対処1: 閾値を調整（少し高めに設定）
# 例: 80% → 85%

# 対処2: 継続時間を長くする
# 例: duration: 120 → 300

curl -X PUT "https://192.168.0.187:6443/api/v1/monitoring/alert-rules/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "threshold": 85.0,
    "duration": 300
  }'
```

### 7.7 通知履歴が表示されない

#### 症状

- 通知履歴画面に何も表示されない
- 「データがありません」と表示される

#### 原因と対処

**原因: 通知が送信されていない**

```bash
# 通知履歴確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT * FROM notification_history ORDER BY sent_at DESC LIMIT 10;"

# アラート履歴確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT * FROM alert_history ORDER BY created_at DESC LIMIT 10;"

# 対処: アラートが発火していない場合、アラートルールを確認
```

### 7.8 権限エラー

#### 症状

- 「権限がありません」エラーが表示される
- アラートルールの作成・編集ができない

#### 原因と対処

```bash
# ユーザー権限確認
curl -X GET "https://192.168.0.187:6443/api/v1/auth/me" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 対処: Admin または Manager 権限が必要
# 権限が不足している場合、管理者に権限変更を依頼
```

**必要権限**:

| 操作 | Admin | Manager | Analyst | Viewer |
|------|-------|---------|---------|--------|
| ダッシュボード閲覧 | ✓ | ✓ | ✓ | ✓ |
| アラートルール作成 | ✓ | ✓ | ✗ | ✗ |
| アラートルール編集 | ✓ | ✓ | ✗ | ✗ |
| アラートルール削除 | ✓ | ✗ | ✗ | ✗ |
| 通知チャネル管理 | ✓ | ✗ | ✗ | ✗ |

---

## 8. API仕様

### 8.1 メトリクスAPI

#### 8.1.1 システムメトリクス取得

```
GET /api/v1/monitoring/metrics/system
```

**権限**: Admin, Manager, Analyst, Viewer

**レスポンス**:
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "metrics": {
    "cpu": {
      "usage_percent": 45.2,
      "threshold_status": "normal"
    },
    "memory": {
      "total_mb": 4096,
      "used_mb": 2560,
      "usage_percent": 62.5,
      "threshold_status": "normal"
    },
    "disk": {
      "total_gb": 500,
      "used_gb": 275,
      "free_gb": 225,
      "usage_percent": 55.0,
      "threshold_status": "normal"
    },
    "uptime": {
      "seconds": 475200,
      "formatted": "5d 12h 00m 00s"
    }
  }
}
```

#### 8.1.2 ビジネスメトリクス取得

```
GET /api/v1/monitoring/metrics/business
```

**権限**: Admin, Manager, Analyst, Viewer

**レスポンス**:
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "metrics": {
    "sla_compliance": {
      "current_rate": 98.5,
      "history_24h": [...]
    },
    "incidents_open": {
      "total": 12,
      "by_priority": {
        "critical": 2,
        "high": 5,
        "medium": 3,
        "low": 2
      }
    },
    "mttr_hours": {
      "current": 4.5,
      "trend": "down"
    }
  }
}
```

#### 8.1.3 パフォーマンスメトリクス取得

```
GET /api/v1/monitoring/metrics/performance
```

**権限**: Admin, Manager, Analyst, Viewer

**レスポンス**:
```json
{
  "timestamp": "2026-01-31T10:00:00Z",
  "metrics": {
    "response_time": {
      "p50_ms": 85,
      "p95_ms": 125,
      "p99_ms": 250,
      "history_1h": [...]
    },
    "cache_hit_rate": {
      "current_percent": 85.2,
      "history_1h": [...]
    }
  }
}
```

#### 8.1.4 メトリクス履歴取得

```
GET /api/v1/monitoring/metrics/history?metric_name=itsm_cpu_usage_percent&period=24h
```

**権限**: Admin, Manager, Analyst

**クエリパラメータ**:
| パラメータ | 説明 | 例 |
|-----------|------|-----|
| metric_name | メトリクス名 | `itsm_cpu_usage_percent` |
| period | 期間 | `1h`, `6h`, `24h`, `7d`, `30d` |
| limit | 件数制限 | `100` |

**レスポンス**:
```json
{
  "metric_name": "itsm_cpu_usage_percent",
  "period": "24h",
  "data": [
    {"timestamp": "2026-01-30T10:00:00Z", "value": 42.1},
    {"timestamp": "2026-01-30T10:05:00Z", "value": 43.5},
    ...
  ]
}
```

#### 8.1.5 カスタムメトリクス登録

```
POST /api/v1/monitoring/metrics/custom
```

**権限**: Admin, Manager

**リクエスト**:
```json
{
  "metric_name": "itsm_custom_metric",
  "metric_value": 123.45,
  "labels": {
    "service": "backup",
    "environment": "production"
  }
}
```

**レスポンス**:
```json
{
  "id": 12345,
  "metric_name": "itsm_custom_metric",
  "metric_value": 123.45,
  "timestamp": "2026-01-31T10:00:00Z"
}
```

### 8.2 アラートルールAPI

#### 8.2.1 アラートルール一覧取得

```
GET /api/v1/monitoring/alert-rules?severity=critical&enabled=true&sort=rule_name&order=asc
```

**権限**: Admin, Manager, Analyst, Viewer

**クエリパラメータ**:
| パラメータ | 説明 | 例 |
|-----------|------|-----|
| severity | 重要度フィルター | `critical`, `warning`, `info` |
| enabled | 有効/無効フィルター | `true`, `false` |
| sort | ソート項目 | `rule_name`, `created_at`, `severity` |
| order | ソート順 | `asc`, `desc` |
| limit | 件数制限 | `50` |
| offset | オフセット | `0` |

**レスポンス**:
```json
{
  "total": 25,
  "rules": [
    {
      "id": 1,
      "rule_name": "High CPU Usage",
      "metric_name": "itsm_cpu_usage_percent",
      "condition": ">",
      "threshold": 80.0,
      "duration": 300,
      "severity": "warning",
      "enabled": true,
      "notification_channels": ["email-ops", "slack-alerts"],
      "last_fired_at": "2026-01-31T09:45:00Z",
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-20T14:30:00Z"
    }
  ]
}
```

#### 8.2.2 アラートルール詳細取得

```
GET /api/v1/monitoring/alert-rules/:id
```

**権限**: Admin, Manager, Analyst, Viewer

**レスポンス**: 8.2.1と同じルールオブジェクト

#### 8.2.3 アラートルール作成

```
POST /api/v1/monitoring/alert-rules
```

**権限**: Admin, Manager

**リクエスト**:
```json
{
  "rule_name": "High CPU Usage",
  "metric_name": "itsm_cpu_usage_percent",
  "condition": ">",
  "threshold": 80.0,
  "duration": 300,
  "severity": "warning",
  "enabled": true,
  "notification_channels": ["email-ops", "slack-alerts"]
}
```

**レスポンス**: 作成されたルールオブジェクト（201 Created）

#### 8.2.4 アラートルール更新

```
PUT /api/v1/monitoring/alert-rules/:id
```

**権限**: Admin, Manager

**リクエスト**: 8.2.3と同じ

**レスポンス**: 更新されたルールオブジェクト（200 OK）

#### 8.2.5 アラートルール削除

```
DELETE /api/v1/monitoring/alert-rules/:id
```

**権限**: Admin

**レスポンス**:
```json
{
  "message": "アラートルールが削除されました",
  "deleted_id": 1
}
```

#### 8.2.6 アラートルールトグル（有効/無効切り替え）

```
PATCH /api/v1/monitoring/alert-rules/:id/toggle
```

**権限**: Admin, Manager

**レスポンス**:
```json
{
  "id": 1,
  "enabled": false,
  "message": "アラートルールを無効化しました"
}
```

### 8.3 アラート履歴API

#### 8.3.1 アラート履歴一覧取得

```
GET /api/v1/monitoring/alerts?status=firing&severity=critical&limit=50
```

**権限**: Admin, Manager, Analyst, Viewer

**クエリパラメータ**:
| パラメータ | 説明 | 例 |
|-----------|------|-----|
| status | ステータスフィルター | `firing`, `acknowledged`, `resolved` |
| severity | 重要度フィルター | `critical`, `warning`, `info` |
| rule_id | ルールIDフィルター | `1` |
| limit | 件数制限 | `50` |
| offset | オフセット | `0` |

**レスポンス**:
```json
{
  "total": 8,
  "alerts": [
    {
      "id": 123,
      "rule_id": 1,
      "rule_name": "High CPU Usage",
      "metric_name": "itsm_cpu_usage_percent",
      "current_value": 85.3,
      "threshold": 80.0,
      "severity": "warning",
      "status": "acknowledged",
      "message": "CPU使用率が80%を超えました",
      "acknowledged_by": {
        "id": 5,
        "username": "admin"
      },
      "acknowledged_at": "2026-01-31T10:20:00Z",
      "resolved_at": null,
      "created_at": "2026-01-31T10:15:00Z"
    }
  ]
}
```

#### 8.3.2 アラート詳細取得

```
GET /api/v1/monitoring/alerts/:id
```

**権限**: Admin, Manager, Analyst, Viewer

**レスポンス**: 8.3.1と同じアラートオブジェクト

#### 8.3.3 アラート確認（Acknowledge）

```
POST /api/v1/monitoring/alerts/:id/acknowledge
```

**権限**: Admin, Manager, Analyst

**リクエスト**:
```json
{
  "comment": "原因を調査中"
}
```

**レスポンス**:
```json
{
  "id": 123,
  "status": "acknowledged",
  "acknowledged_by": {
    "id": 5,
    "username": "admin"
  },
  "acknowledged_at": "2026-01-31T10:20:00Z"
}
```

#### 8.3.4 アラート解決（Resolve）

```
POST /api/v1/monitoring/alerts/:id/resolve
```

**権限**: Admin, Manager, Analyst

**リクエスト**:
```json
{
  "comment": "プロセスを再起動し、CPU使用率が正常範囲に戻りました"
}
```

**レスポンス**:
```json
{
  "id": 123,
  "status": "resolved",
  "resolved_at": "2026-01-31T10:30:00Z"
}
```

#### 8.3.5 アラート統計取得

```
GET /api/v1/monitoring/alerts/statistics?period=7d
```

**権限**: Admin, Manager

**レスポンス**:
```json
{
  "period": "7d",
  "total_alerts": 145,
  "by_severity": {
    "critical": 12,
    "warning": 98,
    "info": 35
  },
  "by_status": {
    "firing": 8,
    "acknowledged": 15,
    "resolved": 122
  },
  "avg_resolution_time_minutes": 42.5,
  "top_rules": [
    {
      "rule_name": "High CPU Usage",
      "count": 25
    }
  ]
}
```

### 8.4 通知チャネルAPI

#### 8.4.1 通知チャネル一覧取得

```
GET /api/v1/monitoring/notification-channels?type=email&enabled=true
```

**権限**: Admin, Manager

**レスポンス**:
```json
{
  "total": 5,
  "channels": [
    {
      "id": 1,
      "channel_name": "email-ops",
      "channel_type": "email",
      "config": {
        "recipients": ["ops@example.com"]
      },
      "enabled": true,
      "created_at": "2026-01-15T10:00:00Z",
      "updated_at": "2026-01-20T14:30:00Z"
    }
  ]
}
```

#### 8.4.2 通知チャネル作成

```
POST /api/v1/monitoring/notification-channels
```

**権限**: Admin

**リクエスト（メール）**:
```json
{
  "channel_name": "email-ops",
  "channel_type": "email",
  "config": {
    "recipients": ["ops@example.com", "admin@example.com"]
  },
  "enabled": true
}
```

**リクエスト（Slack）**:
```json
{
  "channel_name": "slack-alerts",
  "channel_type": "slack",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/...",
    "username": "ITSM Alert Bot",
    "icon_emoji": ":warning:"
  },
  "enabled": true
}
```

**レスポンス**: 作成されたチャネルオブジェクト（201 Created）

#### 8.4.3 通知チャネル更新

```
PUT /api/v1/monitoring/notification-channels/:id
```

**権限**: Admin

**リクエスト**: 8.4.2と同じ

**レスポンス**: 更新されたチャネルオブジェクト（200 OK）

#### 8.4.4 通知チャネル削除

```
DELETE /api/v1/monitoring/notification-channels/:id
```

**権限**: Admin

**レスポンス**:
```json
{
  "message": "通知チャネルが削除されました",
  "deleted_id": 1
}
```

#### 8.4.5 通知チャネルテスト送信

```
POST /api/v1/monitoring/notification-channels/:id/test
```

**権限**: Admin, Manager

**レスポンス（成功）**:
```json
{
  "status": "sent",
  "message": "テスト通知が正常に送信されました",
  "timestamp": "2026-01-31T10:20:00Z"
}
```

**レスポンス（失敗）**:
```json
{
  "status": "failed",
  "error": "SMTP connection timeout",
  "timestamp": "2026-01-31T10:20:00Z"
}
```

### 8.5 通知履歴API

#### 8.5.1 通知履歴一覧取得

```
GET /api/v1/monitoring/notification-history?channel_id=1&status=sent&limit=50
```

**権限**: Admin, Manager

**レスポンス**:
```json
{
  "total": 250,
  "history": [
    {
      "id": 1,
      "channel_id": 1,
      "channel_name": "email-ops",
      "alert_id": 123,
      "subject": "[CRITICAL] High CPU Usage",
      "message": "CPU使用率が80%を超えました",
      "status": "sent",
      "error_message": null,
      "sent_at": "2026-01-31T10:15:05Z"
    }
  ]
}
```

### 8.6 ヘルスチェックAPI

#### 8.6.1 詳細ヘルスチェック

```
GET /api/v1/monitoring/health/detailed
```

**権限**: Admin, Manager

**レスポンス**:
```json
{
  "status": "healthy",
  "timestamp": "2026-01-31T10:00:00Z",
  "checks": {
    "database": {
      "status": "healthy",
      "response_time_ms": 5.2
    },
    "disk": {
      "status": "healthy",
      "usage_percent": 55.0,
      "free_gb": 225
    },
    "memory": {
      "status": "healthy",
      "usage_percent": 62.5
    },
    "cache": {
      "status": "healthy",
      "hit_rate": 85.2
    },
    "scheduler": {
      "status": "healthy",
      "next_run": "2026-01-31T10:05:00Z"
    }
  }
}
```

---

## 付録

### A. コマンドリファレンス

#### 監視操作

```bash
# ダッシュボードアクセス
https://192.168.0.187:6443/views/monitoring.html

# サービス状態確認
sudo systemctl status itsm-nexus-prod

# ログ確認（リアルタイム）
sudo journalctl -u itsm-nexus-prod -f | grep -i monitoring

# ログ確認（過去1時間）
sudo journalctl -u itsm-nexus-prod --since "1 hour ago" | grep -i alert
```

#### メトリクス確認

```bash
# システムメトリクス
curl -X GET "https://192.168.0.187:6443/api/v1/monitoring/metrics/system" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# メトリクス履歴
curl -X GET "https://192.168.0.187:6443/api/v1/monitoring/metrics/history?metric_name=itsm_cpu_usage_percent&period=24h" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### アラート操作

```bash
# アラート一覧
curl -X GET "https://192.168.0.187:6443/api/v1/monitoring/alerts?status=firing" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# アラート確認
curl -X POST "https://192.168.0.187:6443/api/v1/monitoring/alerts/123/acknowledge" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "調査中"}'

# アラート解決
curl -X POST "https://192.168.0.187:6443/api/v1/monitoring/alerts/123/resolve" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "解決しました"}'
```

### B. メトリクス一覧

| メトリクス名 | 説明 | 単位 | 正常範囲 |
|------------|------|------|---------|
| itsm_cpu_usage_percent | CPU使用率 | % | 0-70 |
| itsm_memory_usage_percent | メモリ使用率 | % | 0-70 |
| itsm_disk_usage_percent | ディスク使用率 | % | 0-70 |
| itsm_uptime_seconds | 稼働時間 | 秒 | - |
| itsm_sla_compliance_rate | SLA達成率 | % | 95-100 |
| itsm_incidents_open | オープンインシデント数 | 件 | 0-30 |
| itsm_mttr_hours | 平均解決時間 | 時間 | 0-4 |
| itsm_http_request_duration_p95_ms | APIレスポンスタイムP95 | ms | 0-200 |
| itsm_cache_hit_rate | キャッシュヒット率 | % | 80-100 |
| itsm_auth_errors_total | 認証エラー数 | 件 | 0-5 |

### C. エラーコード一覧

| コード | 説明 | 対処 |
|--------|------|------|
| 400 | リクエストパラメータ不正 | リクエスト内容を確認 |
| 401 | 認証エラー | JWTトークンを確認 |
| 403 | 権限不足 | 管理者に権限変更を依頼 |
| 404 | リソースが存在しない | IDを確認 |
| 409 | 重複エラー（ルール名など） | 別の名前で再試行 |
| 500 | サーバーエラー | ログを確認、管理者に連絡 |

### D. 関連ドキュメント

- [アラート設定ガイド](ALERT_CONFIGURATION.md)
- [バックアップ運用ガイド](BACKUP_OPERATIONS.md)
- [ディザスタリカバリRunbook](DISASTER_RECOVERY.md)
- [監視アーキテクチャ設計書](../docs-dev/MONITORING_ARCHITECTURE.md)
- [要件定義書](../specs/phase9-2-monitoring-requirements.md)

---

**ドキュメント履歴**:
- 2026-01-31: 初版作成
