# アラート設定ガイド

**作成日**: 2026-01-31
**バージョン**: 1.0
**対象システム**: ITSM-Sec Nexus
**対象読者**: システム管理者、運用担当者

---

## 目次

1. [概要](#1-概要)
2. [推奨アラートルール設定集](#2-推奨アラートルール設定集)
3. [閾値の決定方法](#3-閾値の決定方法)
4. [通知チャネル設定例](#4-通知チャネル設定例)
5. [アラート対応プレイブック](#5-アラート対応プレイブック)
6. [エスカレーションフロー](#6-エスカレーションフロー)

---

## 1. 概要

### 1.1 アラート機能の目的

ITSM-Sec Nexusのアラート機能は、システムの異常やビジネス目標からの逸脱を早期に検知し、迅速な対応を可能にします。プロアクティブな監視により、ダウンタイムの最小化とサービス品質の維持を実現します。

### 1.2 アラートの種類

| 重要度 | 説明 | 対応時間 | 通知先 |
|--------|------|---------|--------|
| **Critical（重大）** | サービス停止、データ損失の危険性 | 15分以内 | 運用チーム、管理者、経営層 |
| **Warning（警告）** | パフォーマンス低下、リソース逼迫 | 1時間以内 | 運用チーム、管理者 |
| **Info（情報）** | 通常の動作、統計情報 | 24時間以内 | 運用チーム |

### 1.3 アラート設計原則

#### 1.3.1 シグナル対ノイズ比

**原則**: アラートは実際に対応が必要な事象のみに設定します。

**避けるべき設定**:
- 過度に低い閾値（頻繁に発火）
- 瞬間的な値での判定（フラッピング）
- 対応不要な情報アラート

**推奨設定**:
- 適切な閾値（ベースライン + マージン）
- 継続時間（duration）の設定（5分以上推奨）
- 実際の影響に基づく重要度設定

#### 1.3.2 アクション可能性

**原則**: すべてのアラートには明確な対応手順が存在する必要があります。

**チェックリスト**:
- [ ] 対応手順が文書化されているか
- [ ] 対応者が明確か
- [ ] 必要なツール・権限が利用可能か
- [ ] エスカレーションパスが定義されているか

#### 1.3.3 継続時間（Duration）の重要性

瞬間的なスパイクではなく、持続的な問題に対してアラートを発火させます。

**推奨値**:
- システムリソース（CPU、メモリ、ディスク）: 300秒（5分）
- アプリケーションエラー: 120秒（2分）
- ビジネスメトリクス（SLA、MTTR）: 600秒（10分）

**理由**:
- 一時的な負荷変動によるノイズを削減
- 真の問題のみを検知
- 通知疲れの防止

### 1.4 アラートライフサイクル

```
┌─────────────┐
│   Firing    │ ← 閾値を超えた状態が継続時間（duration）維持
└──────┬──────┘
       │
       │ 通知送信
       ▼
┌─────────────┐
│Acknowledged │ ← 担当者が確認
└──────┬──────┘
       │
       │ 対応完了
       ▼
┌─────────────┐
│  Resolved   │ ← 問題解決
└─────────────┘
```

---

## 2. 推奨アラートルール設定集

### 2.1 システムメトリクスアラート（10個）

#### 2.1.1 Critical CPU Usage（重大なCPU使用率）

**目的**: システムの応答性が著しく低下する前に検知

**設定**:
```json
{
  "rule_name": "Critical CPU Usage",
  "metric_name": "itsm_cpu_usage_percent",
  "condition": ">",
  "threshold": 90.0,
  "duration": 300,
  "severity": "critical",
  "notification_channels": ["email-ops", "slack-alerts", "webhook-pagerduty"],
  "enabled": true
}
```

**トリガー条件**:
- CPU使用率が90%を超える状態が5分間継続

**影響**:
- APIレスポンスタイムの大幅な遅延
- タイムアウトエラーの増加
- ユーザー体験の著しい低下

**対応アクション**:
1. CPU使用率上位プロセスを特定（`top`コマンド）
2. 不要なプロセスを停止
3. サービス再起動（`sudo systemctl restart itsm-nexus-prod`）
4. スケールアップの検討

**curlコマンド例**:
```bash
curl -X POST https://192.168.0.187:6443/api/v1/monitoring/alert-rules \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_name": "Critical CPU Usage",
    "metric_name": "itsm_cpu_usage_percent",
    "condition": ">",
    "threshold": 90.0,
    "duration": 300,
    "severity": "critical",
    "notification_channels": ["email-ops", "slack-alerts"],
    "enabled": true
  }'
```

---

#### 2.1.2 High CPU Usage（高CPU使用率）

**目的**: リソース逼迫の早期警告

**設定**:
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

**トリガー条件**:
- CPU使用率が80%を超える状態が5分間継続

**影響**:
- レスポンスタイムの軽微な遅延
- 今後の負荷増加に対する余裕の減少

**対応アクション**:
1. 負荷の傾向を監視
2. ピークタイムの確認
3. 必要に応じてリソース計画を見直し

---

#### 2.1.3 Critical Memory Usage（重大なメモリ使用率）

**目的**: OOMエラーによるサービス停止を防止

**設定**:
```json
{
  "rule_name": "Critical Memory Usage",
  "metric_name": "itsm_memory_usage_percent",
  "condition": ">",
  "threshold": 90.0,
  "duration": 300,
  "severity": "critical",
  "notification_channels": ["email-ops", "slack-alerts", "webhook-pagerduty"],
  "enabled": true
}
```

**トリガー条件**:
- メモリ使用率が90%を超える状態が5分間継続

**影響**:
- OOMキラーによるプロセス強制終了のリスク
- サービスクラッシュの可能性
- スワップによる性能低下

**対応アクション**:
1. メモリ使用率上位プロセスを特定（`ps aux --sort=-%mem`）
2. メモリリークの可能性を調査
3. サービス再起動
4. メモリ増設の検討

---

#### 2.1.4 High Memory Usage（高メモリ使用率）

**設定**:
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

**トリガー条件**:
- メモリ使用率が80%を超える状態が5分間継続

---

#### 2.1.5 Critical Disk Space（重大なディスク容量不足）

**目的**: ディスク満杯によるサービス停止を防止

**設定**:
```json
{
  "rule_name": "Critical Disk Space",
  "metric_name": "itsm_disk_usage_percent",
  "condition": ">",
  "threshold": 95.0,
  "duration": 60,
  "severity": "critical",
  "notification_channels": ["email-ops", "slack-alerts"],
  "enabled": true
}
```

**トリガー条件**:
- ディスク使用率が95%を超える状態が1分間継続

**影響**:
- ログ書き込み失敗
- データベース書き込みエラー
- バックアップ失敗

**対応アクション**:
1. ディスク使用状況を確認（`df -h`）
2. 容量を多く使用しているディレクトリを特定（`du -sh /* | sort -h`）
3. 古いログ・バックアップを削除
4. ディスク拡張の実施

---

#### 2.1.6 Low Disk Space（低ディスク容量）

**設定**:
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

**トリガー条件**:
- ディスク使用率が80%を超える状態が1分間継続

---

#### 2.1.7 High Uptime（長時間稼働）

**目的**: 計画的な再起動の促進

**設定**:
```json
{
  "rule_name": "High Uptime",
  "metric_name": "itsm_uptime_days",
  "condition": ">",
  "threshold": 90,
  "duration": 3600,
  "severity": "info",
  "notification_channels": ["email-ops"],
  "enabled": true
}
```

**トリガー条件**:
- 稼働日数が90日を超える

**対応アクション**:
1. カーネルアップデートの確認
2. セキュリティパッチの適用状況確認
3. 計画メンテナンスのスケジュール

---

#### 2.1.8 High Active Users（高アクティブユーザー数）

**目的**: 通常範囲を超えるアクセス数の検知

**設定**:
```json
{
  "rule_name": "High Active Users",
  "metric_name": "itsm_active_users_total",
  "condition": ">",
  "threshold": 100,
  "duration": 300,
  "severity": "info",
  "notification_channels": ["email-ops"],
  "enabled": true
}
```

**トリガー条件**:
- アクティブユーザー数が100人を超える状態が5分間継続

**影響**:
- リソース使用率の増加
- レスポンスタイムの低下可能性

**対応アクション**:
1. アクセスパターンの確認
2. 正常なアクセス増加か異常なアクセスかを判断
3. 必要に応じてスケールアウト

---

#### 2.1.9 High Request Rate（高リクエスト率）

**設定**:
```json
{
  "rule_name": "High Request Rate",
  "metric_name": "itsm_http_requests_per_minute",
  "condition": ">",
  "threshold": 500,
  "duration": 300,
  "severity": "warning",
  "notification_channels": ["email-ops"],
  "enabled": true
}
```

**トリガー条件**:
- リクエスト数が500/分を超える状態が5分間継続

---

#### 2.1.10 Low Request Rate（低リクエスト率）

**目的**: サービス停止またはネットワーク問題の検知

**設定**:
```json
{
  "rule_name": "Low Request Rate",
  "metric_name": "itsm_http_requests_per_minute",
  "condition": "<",
  "threshold": 10,
  "duration": 600,
  "severity": "warning",
  "notification_channels": ["email-ops", "slack-alerts"],
  "enabled": true
}
```

**トリガー条件**:
- リクエスト数が10/分未満の状態が10分間継続

**影響**:
- サービス利用不可の可能性
- ユーザーアクセス障害

**対応アクション**:
1. サービスステータス確認（`systemctl status`）
2. ネットワーク接続確認
3. ファイアウォール設定確認
4. DNSレコード確認

---

### 2.2 ビジネスメトリクスアラート（8個）

#### 2.2.1 SLA Compliance Critical（SLA達成率重大）

**目的**: SLA違反の即座の検知と対応

**設定**:
```json
{
  "rule_name": "SLA Compliance Critical",
  "metric_name": "itsm_sla_compliance_rate",
  "condition": "<",
  "threshold": 90.0,
  "duration": 300,
  "severity": "critical",
  "notification_channels": ["email-ops", "slack-alerts", "email-management"],
  "enabled": true
}
```

**トリガー条件**:
- SLA達成率が90%未満の状態が5分間継続

**影響**:
- 顧客満足度の低下
- SLA違反ペナルティのリスク
- 評判の損失

**対応アクション**:
1. SLA違反インシデントを特定
2. 優先順位の再評価
3. リソースの追加配分
4. 管理層へのエスカレーション

**curlコマンド例**:
```bash
curl -X POST https://192.168.0.187:6443/api/v1/monitoring/alert-rules \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_name": "SLA Compliance Critical",
    "metric_name": "itsm_sla_compliance_rate",
    "condition": "<",
    "threshold": 90.0,
    "duration": 300,
    "severity": "critical",
    "notification_channels": ["email-ops", "slack-alerts", "email-management"],
    "enabled": true
  }'
```

---

#### 2.2.2 SLA Compliance Warning（SLA達成率警告）

**設定**:
```json
{
  "rule_name": "SLA Compliance Warning",
  "metric_name": "itsm_sla_compliance_rate",
  "condition": "<",
  "threshold": 95.0,
  "duration": 600,
  "severity": "warning",
  "notification_channels": ["email-ops"],
  "enabled": true
}
```

**トリガー条件**:
- SLA達成率が95%未満の状態が10分間継続

---

#### 2.2.3 High Critical Incidents（重大インシデント多発）

**目的**: システム全体の安定性問題の検知

**設定**:
```json
{
  "rule_name": "High Critical Incidents",
  "metric_name": "itsm_incidents_open_critical",
  "condition": ">",
  "threshold": 3,
  "duration": 60,
  "severity": "critical",
  "notification_channels": ["email-ops", "slack-alerts", "email-management"],
  "enabled": true
}
```

**トリガー条件**:
- Criticalインシデントが3件を超える状態が1分間継続

**影響**:
- サービス停止の可能性
- 複数の顧客への影響

**対応アクション**:
1. 緊急対応体制の確立
2. インシデント司令官の指名
3. リソースの集中投入
4. ステークホルダーへの通知

---

#### 2.2.4 High Open Incidents（オープンインシデント多発）

**設定**:
```json
{
  "rule_name": "High Open Incidents",
  "metric_name": "itsm_incidents_open_total",
  "condition": ">",
  "threshold": 30,
  "duration": 300,
  "severity": "warning",
  "notification_channels": ["email-ops", "email-management"],
  "enabled": true
}
```

**トリガー条件**:
- オープンインシデント総数が30件を超える状態が5分間継続

**影響**:
- リソース不足
- 対応遅延のリスク

**対応アクション**:
1. リソース配分の見直し
2. 優先度の再評価
3. 増員の検討

---

#### 2.2.5 Security Incident Detected（セキュリティインシデント検知）

**目的**: セキュリティ侵害の即座の検知

**設定**:
```json
{
  "rule_name": "Security Incident Detected",
  "metric_name": "itsm_security_incidents_total",
  "condition": ">",
  "threshold": 0,
  "duration": 60,
  "severity": "critical",
  "notification_channels": ["email-security", "slack-security", "email-management"],
  "enabled": true
}
```

**トリガー条件**:
- セキュリティインシデントが1件以上発生

**影響**:
- データ侵害のリスク
- コンプライアンス違反の可能性
- 評判の損失

**対応アクション**:
1. セキュリティチームへの即座のエスカレーション
2. インシデント対応プロセスの開始
3. 影響範囲の特定
4. 封じ込めアクションの実施

---

#### 2.2.6 High MTTR（高平均解決時間）

**目的**: インシデント解決プロセスの効率性監視

**設定**:
```json
{
  "rule_name": "High MTTR",
  "metric_name": "itsm_mttr_hours",
  "condition": ">",
  "threshold": 6.0,
  "duration": 3600,
  "severity": "warning",
  "notification_channels": ["email-management"],
  "enabled": true
}
```

**トリガー条件**:
- MTTRが6時間を超える状態が1時間継続

**影響**:
- 顧客満足度の低下
- SLA達成率の低下

**対応アクション**:
1. 長時間オープンのインシデントを特定
2. ボトルネックの分析
3. プロセス改善の実施
4. トレーニングの検討

---

#### 2.2.7 Incident Creation Spike（インシデント急増）

**設定**:
```json
{
  "rule_name": "Incident Creation Spike",
  "metric_name": "itsm_incidents_created_today",
  "condition": ">",
  "threshold": 25,
  "duration": 300,
  "severity": "warning",
  "notification_channels": ["email-ops", "slack-alerts"],
  "enabled": true
}
```

**トリガー条件**:
- 1日のインシデント作成数が25件を超える

**影響**:
- システム障害の可能性
- リソース逼迫

**対応アクション**:
1. 共通原因の調査
2. 関連インシデントのグルーピング
3. 問題管理への移行検討

---

#### 2.2.8 Low Incident Resolution Rate（低インシデント解決率）

**設定**:
```json
{
  "rule_name": "Low Incident Resolution Rate",
  "metric_name": "itsm_incident_resolution_rate_daily",
  "condition": "<",
  "threshold": 80.0,
  "duration": 3600,
  "severity": "warning",
  "notification_channels": ["email-management"],
  "enabled": true
}
```

**トリガー条件**:
- 1日のインシデント解決率が80%未満

---

### 2.3 セキュリティアラート（5個）

#### 2.3.1 Authentication Failures Spike（認証失敗急増）

**目的**: ブルートフォース攻撃の検知

**設定**:
```json
{
  "rule_name": "Authentication Failures Spike",
  "metric_name": "itsm_auth_errors_total",
  "condition": ">",
  "threshold": 10,
  "duration": 60,
  "severity": "critical",
  "notification_channels": ["email-security", "slack-security"],
  "enabled": true
}
```

**トリガー条件**:
- 認証失敗が1分間に10回を超える

**影響**:
- ブルートフォース攻撃のリスク
- アカウント侵害の可能性

**対応アクション**:
1. 攻撃元IPアドレスの特定
2. IPブロックリストへの追加
3. レート制限の強化
4. アカウントロックの検討

**curlコマンド例**:
```bash
curl -X POST https://192.168.0.187:6443/api/v1/monitoring/alert-rules \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "rule_name": "Authentication Failures Spike",
    "metric_name": "itsm_auth_errors_total",
    "condition": ">",
    "threshold": 10,
    "duration": 60,
    "severity": "critical",
    "notification_channels": ["email-security", "slack-security"],
    "enabled": true
  }'
```

---

#### 2.3.2 High 5xx Error Rate（高5xxエラー率）

**設定**:
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

**トリガー条件**:
- 5xxエラー率が5%を超える状態が2分間継続

---

#### 2.3.3 High 4xx Error Rate（高4xxエラー率）

**設定**:
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

**トリガー条件**:
- 4xxエラー率が10%を超える状態が5分間継続

---

#### 2.3.4 Unauthorized Access Attempts（不正アクセス試行）

**設定**:
```json
{
  "rule_name": "Unauthorized Access Attempts",
  "metric_name": "itsm_http_403_errors_total",
  "condition": ">",
  "threshold": 20,
  "duration": 120,
  "severity": "warning",
  "notification_channels": ["email-security"],
  "enabled": true
}
```

**トリガー条件**:
- 403エラーが2分間に20回を超える

---

#### 2.3.5 Token Validation Failures（トークン検証失敗）

**設定**:
```json
{
  "rule_name": "Token Validation Failures",
  "metric_name": "itsm_jwt_validation_errors_total",
  "condition": ">",
  "threshold": 15,
  "duration": 300,
  "severity": "warning",
  "notification_channels": ["email-security"],
  "enabled": true
}
```

**トリガー条件**:
- JWT検証失敗が5分間に15回を超える

---

### 2.4 パフォーマンスアラート（2個）

#### 2.4.1 High API Response Time（高APIレスポンスタイム）

**目的**: ユーザー体験低下の早期検知

**設定**:
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

**トリガー条件**:
- P95レスポンスタイムが2000msを超える状態が5分間継続

**影響**:
- ユーザー体験の低下
- タイムアウトエラーのリスク

**対応アクション**:
1. 遅いAPIエンドポイントを特定
2. データベースクエリの最適化
3. キャッシュの活用
4. インデックスの追加

---

#### 2.4.2 Low Cache Hit Rate（低キャッシュヒット率）

**目的**: キャッシュ効率の監視

**設定**:
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

**トリガー条件**:
- キャッシュヒット率が70%未満の状態が10分間継続

**影響**:
- データベース負荷の増加
- レスポンスタイムの低下

**対応アクション**:
1. キャッシュTTL設定の見直し
2. キャッシュウォーミングの実施
3. キャッシュメモリの増加

---

## 3. 閾値の決定方法

### 3.1 ベースライン測定

#### ステップ1: データ収集期間の設定

新しい環境または新しいメトリクスの場合、最低1週間のベースライン測定期間を設けます。

**理由**:
- 週次のパターン（平日と週末の違い）を把握
- 業務時間と非業務時間の負荷の違いを把握
- 異常値の特定

#### ステップ2: メトリクス履歴の取得

```bash
# 過去7日間のCPU使用率を取得
curl -X GET "https://192.168.0.187:6443/api/v1/monitoring/metrics/history?metric_name=itsm_cpu_usage_percent&period=7d" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  > cpu_baseline.json
```

#### ステップ3: 統計分析

取得したデータから以下を計算します。

**Excel/Googleスプレッドシートでの分析例**:

```
平均値: =AVERAGE(B2:B10000)
P50値（中央値）: =PERCENTILE(B2:B10000, 0.5)
P95値: =PERCENTILE(B2:B10000, 0.95)
P99値: =PERCENTILE(B2:B10000, 0.99)
最大値: =MAX(B2:B10000)
```

**Python での分析例**:

```python
import numpy as np
import json

# データ読み込み
with open('cpu_baseline.json') as f:
    data = json.load(f)

values = [entry['value'] for entry in data['data']]

# 統計計算
mean = np.mean(values)
p50 = np.percentile(values, 50)
p95 = np.percentile(values, 95)
p99 = np.percentile(values, 99)
max_value = np.max(values)

print(f"平均値: {mean:.2f}%")
print(f"P50: {p50:.2f}%")
print(f"P95: {p95:.2f}%")
print(f"P99: {p99:.2f}%")
print(f"最大値: {max_value:.2f}%")
```

**出力例**:
```
平均値: 42.50%
P50: 40.20%
P95: 68.50%
P99: 82.30%
最大値: 95.80%
```

### 3.2 閾値設定の計算式

#### 3.2.1 システムリソース（CPU、メモリ、ディスク）

**Warning閾値**:
```
Warning閾値 = P95値 + (100 - P95値) × 0.5
```

**Critical閾値**:
```
Critical閾値 = P95値 + (100 - P95値) × 0.75
```

**例**（CPU使用率P95が68.5%の場合）:
```
Warning閾値 = 68.5 + (100 - 68.5) × 0.5 = 68.5 + 15.75 = 84.25 → 80%（丸め）
Critical閾値 = 68.5 + (100 - 68.5) × 0.75 = 68.5 + 23.63 = 92.13 → 90%（丸め）
```

#### 3.2.2 ビジネスメトリクス（SLA、MTTR）

**ビジネス目標から逆算**:

**SLA達成率**:
- 目標: 95%以上
- Warning閾値: 目標値（95%）
- Critical閾値: 目標値 - 5%（90%）

**MTTR**:
- 目標: 4時間以内
- Warning閾値: 目標値 × 1.5（6時間）
- Critical閾値: 目標値 × 2（8時間）

#### 3.2.3 パフォーマンスメトリクス（レスポンスタイム、キャッシュ）

**ユーザー体験基準**:

**APIレスポンスタイム**:
- 良好: P95 < 200ms
- 許容可能: P95 < 1000ms
- 悪い: P95 > 2000ms

したがって:
- Warning閾値: 1000ms
- Critical閾値: 2000ms

### 3.3 環境別の調整

#### 3.3.1 本番環境（Production）

**特徴**:
- 高い可用性要求
- 厳格なSLA

**推奨設定**:
- 低めの閾値（早期警告）
- 短い継続時間（迅速な検知）

**例**:
```json
{
  "threshold": 80.0,
  "duration": 300
}
```

#### 3.3.2 開発環境（Development）

**特徴**:
- 負荷が不規則
- アラートノイズ許容

**推奨設定**:
- 高めの閾値（ノイズ削減）
- 長い継続時間（安定性重視）

**例**:
```json
{
  "threshold": 90.0,
  "duration": 600
}
```

#### 3.3.3 テスト環境（Test）

**特徴**:
- 負荷テスト実施
- 一時的な高負荷

**推奨設定**:
- 情報アラートのみ
- 長い継続時間

**例**:
```json
{
  "severity": "info",
  "threshold": 95.0,
  "duration": 900
}
```

### 3.4 継続時間（Duration）の設定

#### 3.4.1 推奨値

| メトリクスカテゴリ | 推奨Duration | 理由 |
|------------------|-------------|------|
| システムリソース（CPU、メモリ） | 300秒（5分） | 瞬間的な負荷変動を除外 |
| ディスク使用率 | 60秒（1分） | 急速に悪化する可能性 |
| エラー率（4xx、5xx） | 120秒（2分） | エラーバーストを検知 |
| SLA、MTTR | 600秒（10分） | ビジネスメトリクスは安定性重視 |
| セキュリティ（認証失敗） | 60秒（1分） | 攻撃の早期検知 |

#### 3.4.2 フラッピング防止

**症状**:
- アラートが数分おきに発火・解決を繰り返す
- 通知が大量に届く

**原因**:
- 閾値がギリギリの値
- Durationが短すぎる

**対策**:

1. **Durationを延長**:
```json
{
  "duration": 120  // 2分 → 5分に変更
}
```

2. **閾値にマージンを追加**:
```json
{
  "threshold": 80.0  // 80% → 85%に変更
}
```

3. **ヒステリシス（Hysteresis）の導入**（将来実装予定）:
```
アラート発火: 値 > 80%
アラート解決: 値 < 75%（5%のマージン）
```

### 3.5 定期的な見直し

#### 3.5.1 見直し頻度

| 環境 | 見直し頻度 | 理由 |
|------|----------|------|
| 本番環境 | 3ヶ月ごと | 負荷パターンの変化 |
| 開発環境 | 6ヶ月ごと | 柔軟性重視 |
| 新規システム | 1ヶ月ごと | 初期調整期間 |

#### 3.5.2 見直しトリガー

以下のイベント発生時は、スケジュール外でも見直しを実施します。

- インフラ変更（スケールアップ、スケールアウト）
- アプリケーション大規模アップデート
- 負荷パターンの大幅な変化
- アラート過多（1日に10回以上）
- アラート不足（重大障害を検知できなかった）

#### 3.5.3 見直しプロセス

1. **過去3ヶ月のアラート履歴を分析**:
```bash
curl -X GET "https://192.168.0.187:6443/api/v1/monitoring/alerts/statistics?period=90d" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

2. **問題のあるルールを特定**:
- 発火回数が多すぎるルール（>20回/月）
- 発火回数が少なすぎるルール（0回/月）

3. **閾値の再計算**:
- 最新のベースラインデータで再計算

4. **ルールの更新**:
```bash
curl -X PUT "https://192.168.0.187:6443/api/v1/monitoring/alert-rules/1" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "threshold": 85.0,
    "duration": 300
  }'
```

---

## 4. 通知チャネル設定例

### 4.1 メールチャネル設定

#### 4.1.1 運用チーム宛（email-ops）

**用途**: 日常的なアラート通知

**設定**:
```json
{
  "channel_name": "email-ops",
  "channel_type": "email",
  "config": {
    "recipients": [
      "ops-team@example.com",
      "admin@example.com"
    ]
  },
  "enabled": true
}
```

**curlコマンド**:
```bash
curl -X POST https://192.168.0.187:6443/api/v1/monitoring/notification-channels \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "channel_name": "email-ops",
    "channel_type": "email",
    "config": {
      "recipients": ["ops-team@example.com", "admin@example.com"]
    },
    "enabled": true
  }'
```

---

#### 4.1.2 経営層宛（email-management）

**用途**: 重大アラート、SLA違反

**設定**:
```json
{
  "channel_name": "email-management",
  "channel_type": "email",
  "config": {
    "recipients": [
      "cto@example.com",
      "cio@example.com"
    ]
  },
  "enabled": true
}
```

---

#### 4.1.3 セキュリティチーム宛（email-security）

**用途**: セキュリティインシデント

**設定**:
```json
{
  "channel_name": "email-security",
  "channel_type": "email",
  "config": {
    "recipients": [
      "security-team@example.com",
      "ciso@example.com"
    ]
  },
  "enabled": true
}
```

---

### 4.2 Slackチャネル設定

#### 4.2.1 一般アラート（slack-alerts）

**用途**: リアルタイムアラート通知

**Slack設定手順**:
1. Slackワークスペースにログイン
2. https://api.slack.com/apps にアクセス
3. 「Create New App」→「From scratch」
4. App名: `ITSM Alert Bot`
5. 「Incoming Webhooks」を有効化
6. 「Add New Webhook to Workspace」
7. チャネル選択: `#alerts`
8. Webhook URLをコピー

**ITSM-Sec Nexus設定**:
```json
{
  "channel_name": "slack-alerts",
  "channel_type": "slack",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/T00000000/B00000000/XXXXXXXXXXXXXXXXXXXX",
    "username": "ITSM Alert Bot",
    "icon_emoji": ":warning:"
  },
  "enabled": true
}
```

**curlコマンド**:
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

---

#### 4.2.2 セキュリティアラート（slack-security）

**用途**: セキュリティ関連の緊急通知

**設定**:
```json
{
  "channel_name": "slack-security",
  "channel_type": "slack",
  "config": {
    "webhook_url": "https://hooks.slack.com/services/T00000000/B11111111/YYYYYYYYYYYYYYYYYYYY",
    "username": "Security Alert Bot",
    "icon_emoji": ":rotating_light:"
  },
  "enabled": true
}
```

---

### 4.3 カスタムWebhook設定

#### 4.3.1 PagerDuty統合（webhook-pagerduty）

**用途**: 24時間オンコール体制

**PagerDuty設定手順**:
1. PagerDutyにログイン
2. 「Services」→「New Service」
3. Integration Type: 「Use our API directly」
4. Integration Keyをコピー

**ITSM-Sec Nexus設定**:
```json
{
  "channel_name": "webhook-pagerduty",
  "channel_type": "webhook",
  "config": {
    "webhook_url": "https://events.pagerduty.com/v2/enqueue",
    "http_method": "POST",
    "custom_headers": {
      "Content-Type": "application/json"
    },
    "payload_template": "{\"routing_key\":\"YOUR_INTEGRATION_KEY\",\"event_action\":\"trigger\",\"payload\":{\"summary\":\"{{rule_name}}: {{message}}\",\"severity\":\"{{severity}}\",\"source\":\"ITSM-Sec Nexus\",\"custom_details\":{\"metric_name\":\"{{metric_name}}\",\"current_value\":{{current_value}},\"threshold\":{{threshold}}}}}"
  },
  "enabled": true
}
```

---

#### 4.3.2 カスタムWebhook（webhook-custom）

**用途**: 社内システム連携

**設定**:
```json
{
  "channel_name": "webhook-custom",
  "channel_type": "webhook",
  "config": {
    "webhook_url": "https://internal-system.example.com/api/alerts",
    "http_method": "POST",
    "custom_headers": {
      "Authorization": "Bearer CUSTOM_TOKEN",
      "Content-Type": "application/json"
    },
    "payload_template": "{\"alert\":{\"name\":\"{{rule_name}}\",\"severity\":\"{{severity}}\",\"message\":\"{{message}}\",\"timestamp\":\"{{fired_at}}\"}}"
  },
  "enabled": true
}
```

---

## 5. アラート対応プレイブック

### 5.1 Critical アラート対応（15分以内）

#### 5.1.1 初動対応（0-5分）

**1. アラート確認**:
```bash
# ダッシュボードにアクセス
https://192.168.0.187:6443/views/monitoring.html

# アラート詳細をAPI経由で取得
curl -X GET "https://192.168.0.187:6443/api/v1/monitoring/alerts?status=firing&severity=critical" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**2. アラートを確認（Acknowledge）**:
```bash
curl -X POST "https://192.168.0.187:6443/api/v1/monitoring/alerts/123/acknowledge" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "調査を開始します"}'
```

**3. 影響範囲の確認**:
- ユーザー影響の有無
- サービス停止の有無
- エラーログの増加

---

#### 5.1.2 原因調査（5-10分）

**Critical CPU Usage の場合**:
```bash
# CPU使用率確認
top -b -n 1 | head -20

# プロセス別CPU使用率
ps aux --sort=-%cpu | head -10

# Node.jsプロセス確認
pidstat -u -p $(pgrep -f "node.*server.js") 1 5
```

**Critical Memory Usage の場合**:
```bash
# メモリ使用状況
free -h

# プロセス別メモリ使用率
ps aux --sort=-%mem | head -10

# メモリリーク確認
sudo journalctl -u itsm-nexus-prod | grep -i "memory"
```

**SLA Compliance Critical の場合**:
```bash
# SLA違反インシデント取得
curl -X GET "https://192.168.0.187:6443/api/v1/incidents?sla_violated=true" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# 違反インシデントの詳細確認
curl -X GET "https://192.168.0.187:6443/api/v1/incidents/INC-20260131-001" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

#### 5.1.3 対応実施（10-15分）

**CPU/メモリ問題**:
```bash
# サービス再起動
sudo systemctl restart itsm-nexus-prod

# 再起動後の確認
sudo systemctl status itsm-nexus-prod
```

**SLA違反**:
1. 優先度の再評価
2. リソースの追加配分
3. 必要に応じて増員

---

#### 5.1.4 アラート解決とエスカレーション

**問題解決の場合**:
```bash
curl -X POST "https://192.168.0.187:6443/api/v1/monitoring/alerts/123/resolve" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "サービスを再起動し、CPU使用率が正常範囲に戻りました"}'
```

**エスカレーションが必要な場合**:
1. 管理者への連絡（電話）
2. インシデント司令官の指名
3. 緊急対応体制の確立

---

### 5.2 Warning アラート対応（1時間以内）

#### 5.2.1 初動対応（0-15分）

**1. アラート確認とAcknowledge**:
```bash
curl -X POST "https://192.168.0.187:6443/api/v1/monitoring/alerts/124/acknowledge" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "確認しました"}'
```

**2. トレンド分析**:
- 過去24時間のメトリクス推移を確認
- 一時的なスパイクか、継続的な増加か

---

#### 5.2.2 対応計画（15-30分）

**High CPU Usage の場合**:
1. 負荷のピーク時刻を特定
2. スケジューリングの調整を検討
3. 必要に応じてスケールアップを計画

**Low Cache Hit Rate の場合**:
1. キャッシュTTL設定を確認
2. キャッシュウォーミングの実施を検討
3. キャッシュメモリの増加を検討

---

#### 5.2.3 対応実施（30-60分）

設定変更、最適化の実施

---

### 5.3 Info アラート対応（24時間以内）

#### 5.3.1 確認と記録

**1. アラート確認**:
```bash
curl -X POST "https://192.168.0.187:6443/api/v1/monitoring/alerts/125/acknowledge" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment": "情報として記録"}'
```

**2. チケット作成**:
- 改善タスクとしてチケット化
- 次回メンテナンス時に対応

---

## 6. エスカレーションフロー

### 6.1 エスカレーションレベル

#### レベル1: 運用担当者

**対象アラート**:
- Warning（警告）
- Info（情報）

**対応内容**:
- 初動対応
- 標準的なトラブルシューティング
- アラートの確認と記録

**対応時間**:
- Warning: 1時間以内
- Info: 24時間以内

---

#### レベル2: システム管理者

**対象アラート**:
- Critical（重大）
- 15分以内に解決しないWarning

**対応内容**:
- 高度なトラブルシューティング
- システム再起動
- 設定変更

**対応時間**:
- 15分以内に参加
- 1時間以内に解決

**エスカレーション条件**:
- 運用担当者が解決できない
- サービス停止が発生
- データ損失のリスク

---

#### レベル3: 経営層

**対象アラート**:
- 2時間以上継続するCritical
- セキュリティインシデント
- SLA違反

**対応内容**:
- リソースの追加承認
- 顧客への説明
- 事業継続計画の発動

**対応時間**:
- 即座に通知
- 30分以内に意思決定

**エスカレーション条件**:
- 長時間のサービス停止
- セキュリティ侵害
- SLA違反によるペナルティリスク

---

### 6.2 エスカレーションフローチャート

```
┌───────────────────┐
│  アラート発火     │
└─────────┬─────────┘
          │
          ▼
    ┌─────────┐
    │Severity?│
    └─────┬───┘
          │
    ┌─────┴─────┬─────────────┐
    │           │             │
    ▼           ▼             ▼
┌────────┐ ┌─────────┐ ┌──────────┐
│Critical│ │Warning  │ │Info      │
└───┬────┘ └────┬────┘ └────┬─────┘
    │           │            │
    │           │            ▼
    │           │      ┌──────────┐
    │           │      │Level 1   │
    │           │      │運用担当者 │
    │           │      │24h以内   │
    │           │      └──────────┘
    │           │
    │           ▼
    │     ┌──────────┐
    │     │Level 1   │
    │     │運用担当者 │
    │     │1h以内    │
    │     └────┬─────┘
    │          │
    │          │15分経過?
    │          │
    ▼          ▼
┌──────────────────┐
│Level 2           │
│システム管理者     │
│15分以内参加      │
└────┬─────────────┘
     │
     │1時間経過?
     │
     ▼
┌──────────────────┐
│Level 3           │
│経営層            │
│即座に通知        │
└──────────────────┘
```

### 6.3 連絡方法

#### レベル1 → レベル2

**トリガー**:
- Criticalアラート発火
- Warningアラートが15分以内に解決しない

**連絡方法**:
1. Slackメンション（`@admin`）
2. メール（email-admin@example.com）
3. 電話（緊急時）

---

#### レベル2 → レベル3

**トリガー**:
- Criticalアラートが2時間継続
- セキュリティインシデント
- SLA違反

**連絡方法**:
1. 電話（即座）
2. メール（email-management@example.com）
3. Slackメンション（`@executives`）

---

### 6.4 オンコール体制

#### ローテーション例

| 曜日 | 運用担当者（L1） | システム管理者（L2） |
|------|----------------|-------------------|
| 月曜 | Alice | Bob |
| 火曜 | Charlie | David |
| 水曜 | Alice | Bob |
| 木曜 | Charlie | David |
| 金曜 | Alice | Bob |
| 土曜 | Charlie | David |
| 日曜 | Alice | Bob |

#### オンコール責任

**運用担当者（L1）**:
- 24時間365日の対応
- アラート確認と初動対応
- 必要に応じてL2へエスカレーション

**システム管理者（L2）**:
- 業務時間外の対応（平日18:00-翌9:00、土日祝日）
- 高度なトラブルシューティング
- 必要に応じてL3へエスカレーション

---

## 付録

### A. アラートルール一覧表

| ルール名 | メトリクス | 条件 | 閾値 | Duration | 重要度 |
|---------|----------|------|------|---------|--------|
| Critical CPU Usage | itsm_cpu_usage_percent | > | 90.0 | 300s | Critical |
| High CPU Usage | itsm_cpu_usage_percent | > | 80.0 | 300s | Warning |
| Critical Memory Usage | itsm_memory_usage_percent | > | 90.0 | 300s | Critical |
| High Memory Usage | itsm_memory_usage_percent | > | 80.0 | 300s | Warning |
| Critical Disk Space | itsm_disk_usage_percent | > | 95.0 | 60s | Critical |
| Low Disk Space | itsm_disk_usage_percent | > | 80.0 | 60s | Warning |
| SLA Compliance Critical | itsm_sla_compliance_rate | < | 90.0 | 300s | Critical |
| SLA Compliance Warning | itsm_sla_compliance_rate | < | 95.0 | 600s | Warning |
| High Critical Incidents | itsm_incidents_open_critical | > | 3 | 60s | Critical |
| Security Incident Detected | itsm_security_incidents_total | > | 0 | 60s | Critical |
| Authentication Failures Spike | itsm_auth_errors_total | > | 10 | 60s | Critical |
| High 5xx Error Rate | itsm_http_5xx_errors_percent | > | 5.0 | 120s | Critical |
| High API Response Time | itsm_http_request_duration_p95_ms | > | 2000 | 300s | Warning |
| Low Cache Hit Rate | itsm_cache_hit_rate | < | 70.0 | 600s | Warning |
| High MTTR | itsm_mttr_hours | > | 6.0 | 3600s | Warning |

### B. 通知チャネル一覧表

| チャネル名 | タイプ | 用途 | 受信者 |
|-----------|-------|------|--------|
| email-ops | email | 運用アラート | ops-team@example.com |
| email-management | email | 経営層通知 | cto@example.com, cio@example.com |
| email-security | email | セキュリティアラート | security-team@example.com |
| slack-alerts | slack | リアルタイム通知 | #alerts |
| slack-security | slack | セキュリティ緊急通知 | #security |
| webhook-pagerduty | webhook | オンコール | PagerDuty |

### C. トラブルシューティングコマンド集

**システムリソース**:
```bash
# CPU
top -b -n 1 | head -20
ps aux --sort=-%cpu | head -10

# メモリ
free -h
ps aux --sort=-%mem | head -10

# ディスク
df -h
du -sh /* | sort -h | tail -10
```

**サービス**:
```bash
# 状態確認
sudo systemctl status itsm-nexus-prod

# 再起動
sudo systemctl restart itsm-nexus-prod

# ログ確認
sudo journalctl -u itsm-nexus-prod -f
```

**データベース**:
```bash
# 整合性チェック
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA integrity_check;"

# テーブルサイズ確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db ".tables"
```

### D. 関連ドキュメント

- [監視運用ガイド](MONITORING_OPERATIONS.md)
- [バックアップ運用ガイド](BACKUP_OPERATIONS.md)
- [ディザスタリカバリRunbook](DISASTER_RECOVERY.md)
- [監視アーキテクチャ設計書](../docs-dev/MONITORING_ARCHITECTURE.md)
- [要件定義書](../specs/phase9-2-monitoring-requirements.md)

---

**ドキュメント履歴**:
- 2026-01-31: 初版作成
