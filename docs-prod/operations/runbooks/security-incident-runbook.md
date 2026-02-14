# セキュリティインシデント対応Runbook

**文書ID**: RB-SEC-001
**対象システム**: ITSM-Sec Nexus
**最終更新**: 2026-02-14
**レビュー周期**: 四半期ごと

---

## 1. 概要

本Runbookは、ITSM-Sec Nexusにおけるセキュリティインシデント発生時の検知・封じ込め・根絶・復旧・事後対応手順を定義する。NIST Cybersecurity Framework (CSF) 2.0 に準拠した対応フレームワークに基づく。

### 対象インシデント

| インシデント種別 | 例 | 深刻度 |
|----------------|---|--------|
| 不正アクセス | 管理者アカウントへの不正ログイン | 重大 |
| ブルートフォース攻撃 | 大量ログイン試行 | 高 |
| XSS攻撃 | 悪意あるスクリプトの挿入 | 高 |
| SQLインジェクション | DBへの不正クエリ | 重大 |
| データ漏洩 | 個人情報・機密情報の流出 | 重大 |
| JWT トークン窃取 | セッションハイジャック | 重大 |
| サービス妨害 (DoS) | 大量リクエストによるサービス停止 | 高 |
| 不正な権限昇格 | viewerがadmin操作を実行 | 重大 |
| マルウェア感染 | サーバー上の不正プロセス | 重大 |

### NIST CSF 2.0 対応フェーズ

```
[IDENTIFY] → [PROTECT] → [DETECT] → [RESPOND] → [RECOVER]
  識別         保護        検知       対応        復旧
```

### セキュリティ対策の現状

| 対策 | 状態 | 備考 |
|------|------|------|
| Helmet (HTTPヘッダー) | 導入済 | HSTS, CSP等 |
| Rate Limiting | 導入済 | Express rate-limit |
| ブルートフォース検知 | 導入済 | 脅威検知サービス |
| CORS制限 | 導入済 | 許可オリジン制限 |
| 入力検証 | 導入済 | バリデーション |
| JWT認証 | 導入済 | localStorage保存（既知のリスク） |
| TLS 1.2/1.3 | 導入済 | HTTPS対応 |

---

## 2. 診断フローチャート

```
[セキュリティインシデント検知/報告]
       │
       ▼
[1] インシデント分類
       │
       ├─ 不正アクセス/認証異常 → [A] 不正アクセス対応
       │
       ├─ 攻撃検知（ブルートフォース/DoS）→ [B] 攻撃対応
       │
       ├─ データ漏洩の疑い → [C] データ漏洩対応
       │
       ├─ アプリケーション脆弱性悪用 → [D] 脆弱性対応
       │
       └─ 不審なプロセス/ファイル → [E] マルウェア対応

       │
       ▼ (全種別共通)
[2] 封じ込め
       │
       ▼
[3] 証拠保全
       │
       ▼
[4] 根絶
       │
       ▼
[5] 復旧
       │
       ▼
[6] 事後対応・報告
```

---

## 3. 対応手順（ステップバイステップ）

### 手順 3.0: 初動対応（全インシデント共通）

#### Step 0-1: インシデント記録開始

```
記録すべき情報:
- 検知日時
- 報告者
- 検知方法（アラート/ユーザー報告/ログ分析）
- 初期症状
- 影響範囲の初期見積り
```

#### Step 0-2: 初期影響評価

```bash
# サービス稼働確認
curl -k https://localhost:6443/api/v1/health

# アクティブセッション数の推定
ss -tnp | grep -c 6443

# ログの異常確認（直近1時間）
sudo journalctl -u itsm-nexus-prod --since "1 hour ago" | grep -ciE "error|fail|denied|unauthorized|forbidden"
```

---

### 手順 3.1: [A] 不正アクセス対応

#### Step A-1: 検知・確認

```bash
# 1. 認証ログの確認
sudo journalctl -u itsm-nexus-prod | grep -iE "login|auth" | tail -50

# 2. 失敗ログインの確認
sudo journalctl -u itsm-nexus-prod | grep -iE "failed.*login\|invalid.*credentials\|401" | tail -50

# 3. 不審なIPアドレスの抽出
sudo journalctl -u itsm-nexus-prod | grep -iE "login\|auth" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" | sort | uniq -c | sort -rn | head -20

# 4. 管理者操作の監査
sudo journalctl -u itsm-nexus-prod | grep -iE "admin.*action\|user.*create\|user.*delete\|role.*change" | tail -20

# 5. DBでのユーザー異常確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT id, username, role, is_active, created_at FROM users ORDER BY created_at DESC LIMIT 10;"
```

#### Step A-2: 封じ込め

```bash
# 1. 不正アカウントの無効化
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "UPDATE users SET is_active = 0 WHERE username = 'SUSPICIOUS_USER';"

# 2. JWT_SECRETの変更（全トークン無効化）
# .envファイルのJWT_SECRETを新しい値に変更
# openssl rand -hex 64  # 新しいシークレット生成

# 3. サービス再起動（新しいJWT_SECRETの反映）
sudo systemctl restart itsm-nexus-prod

# 4. 不審なIPからのアクセスブロック（iptables）
sudo iptables -A INPUT -s SUSPICIOUS_IP -j DROP
```

#### Step A-3: 証拠保全

```bash
# 1. ログの保全
sudo journalctl -u itsm-nexus-prod --since "24 hours ago" > /tmp/incident_log_$(date +%Y%m%d%H%M%S).log

# 2. DBのスナップショット
cp /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
   /tmp/itsm_nexus_evidence_$(date +%Y%m%d%H%M%S).db

# 3. ネットワーク接続情報
ss -tnp > /tmp/network_connections_$(date +%Y%m%d%H%M%S).txt

# 4. プロセス一覧
ps auxf > /tmp/process_list_$(date +%Y%m%d%H%M%S).txt
```

---

### 手順 3.2: [B] 攻撃対応（ブルートフォース / DoS）

#### Step B-1: 検知・確認

```bash
# 1. ブルートフォース検知ログ
sudo journalctl -u itsm-nexus-prod | grep -iE "brute.force|rate.limit|too many|429"

# 2. リクエスト頻度の分析
sudo journalctl -u itsm-nexus-prod --since "1 hour ago" | grep -oE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" | sort | uniq -c | sort -rn | head -20

# 3. 接続数の確認
ss -tnp | awk '{print $5}' | cut -d: -f1 | sort | uniq -c | sort -rn | head -20

# 4. HTTPステータスコードの分布
sudo journalctl -u itsm-nexus-prod --since "1 hour ago" | grep -oE "HTTP/[0-9.]+ [0-9]+" | sort | uniq -c | sort -rn
```

#### Step B-2: 封じ込め

```bash
# 1. 攻撃元IPのブロック
sudo iptables -A INPUT -s ATTACKER_IP -j DROP

# 2. 複数IPからの場合、サブネットブロック
# sudo iptables -A INPUT -s ATTACKER_SUBNET/24 -j DROP

# 3. レート制限の一時的な強化（サービス再起動が必要）
# .envファイルでレート制限値を調整

# 4. 緊急時のサービス一時停止（DoS攻撃の場合）
# sudo systemctl stop itsm-nexus-prod
# → ファイアウォールルール適用後に再起動
```

#### Step B-3: 復旧

```bash
# 1. ファイアウォールルール確認
sudo iptables -L -n --line-numbers

# 2. サービス再起動
sudo systemctl restart itsm-nexus-prod

# 3. ヘルスチェック
curl -k https://localhost:6443/api/v1/health

# 4. 正常ユーザーのアクセス確認
curl -k -X POST https://localhost:6443/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "'"$ADMIN_PASSWORD"'"}'
```

---

### 手順 3.3: [C] データ漏洩対応

#### Step C-1: 影響範囲特定

```bash
# 1. DBへの不正アクセス確認
sudo journalctl -u itsm-nexus-prod | grep -iE "SELECT.*FROM.*users\|export\|download" | tail -30

# 2. 大量データ取得の痕跡
sudo journalctl -u itsm-nexus-prod | grep -iE "offset\|limit.*[0-9]{4,}" | tail -20

# 3. ファイルアクセスの確認
sudo journalctl -u itsm-nexus-prod | grep -iE "file\|download\|export\|backup" | tail -20

# 4. 影響テーブルの確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT name FROM sqlite_master WHERE type='table';"
# 各テーブルのレコード数確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT 'users', COUNT(*) FROM users UNION ALL SELECT 'incidents', COUNT(*) FROM incidents;"
```

#### Step C-2: 封じ込め

```bash
# 1. 不正アクセス元のブロック（手順A-2参照）

# 2. JWT_SECRET変更による全セッション無効化（手順A-2参照）

# 3. 全ユーザーのパスワードリセット要求
# 管理画面またはDB直接操作でパスワードリセットフラグを設定

# 4. APIアクセスの一時制限
# 必要に応じてサービスを停止
```

#### Step C-3: 証拠保全（手順A-3参照）

> **重要**: データ漏洩の場合、法的・規制上の報告義務がある場合がある。L3（管理職）への即時エスカレーション必須。

---

### 手順 3.4: [D] 脆弱性悪用対応

#### Step D-1: 検知・確認

```bash
# 1. XSS攻撃の痕跡
sudo journalctl -u itsm-nexus-prod | grep -iE "<script|javascript:|onerror|onload" | tail -20

# 2. SQLインジェクションの痕跡
sudo journalctl -u itsm-nexus-prod | grep -iE "UNION.*SELECT\|OR.*1=1\|DROP.*TABLE\|--.*$" | tail -20

# 3. パストラバーサルの痕跡
sudo journalctl -u itsm-nexus-prod | grep -iE "\.\./\|%2e%2e\|/etc/passwd" | tail -20

# 4. CSPヘッダーの確認
curl -k -I https://localhost:6443/ 2>/dev/null | grep -i "content-security-policy"

# 5. 入力検証の確認
# 特殊文字を含むリクエストのテスト
curl -k -X POST https://localhost:6443/api/v1/incidents \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"title": "<script>alert(1)</script>", "description": "test"}'
# → 入力検証でブロックされるべき
```

#### Step D-2: 緩和策

```bash
# 1. WAF的なリクエストフィルタリング（iptables + string match）
# 緊急時の一時措置
sudo iptables -A INPUT -p tcp --dport 6443 -m string --string "UNION SELECT" --algo bm -j DROP

# 2. サービス再起動（メモリ上の不正データクリア）
sudo systemctl restart itsm-nexus-prod

# 3. DBの整合性確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db "PRAGMA integrity_check;"

# 4. 不正データの確認・除去
# XSSペイロードが保存されていないか確認
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "SELECT id, title FROM incidents WHERE title LIKE '%<script%' OR title LIKE '%javascript:%';"
```

---

### 手順 3.5: [E] マルウェア対応

#### Step E-1: 検知・確認

```bash
# 1. 不審なプロセスの確認
ps auxf | grep -v grep | head -50

# 2. 不審なリスニングポート
ss -tlnp | grep -vE "6443|8080|22|80|443"

# 3. 最近変更されたファイル
find /mnt/LinuxHDD/ITSM-System/ -mmin -60 -type f -ls 2>/dev/null

# 4. crontabの確認
crontab -l 2>/dev/null
sudo crontab -l 2>/dev/null
ls -la /etc/cron.d/

# 5. 起動スクリプトの確認
sudo systemctl list-unit-files --state=enabled | head -30
```

#### Step E-2: 封じ込め

```bash
# 1. ネットワーク隔離（外部通信の遮断）
# sudo iptables -A OUTPUT -j DROP  # 注意: 全外部通信を遮断

# 2. 不審なプロセスの停止
# kill -STOP <PID>  # 一時停止（証拠保全のため）
# kill -TERM <PID>  # 終了

# 3. 証拠保全（手順A-3参照）

# 4. サービス停止
sudo systemctl stop itsm-nexus-prod
```

> **重要**: マルウェア検知時は必ずL3へ即時エスカレーション。証拠保全を優先し、安易にファイルを削除しない。

---

## 4. エスカレーション基準

### エスカレーションレベル

| レベル | 条件 | 対応者 | 時間枠 |
|--------|------|--------|--------|
| **L1** | ブルートフォース検知（自動ブロック済） | 運用担当者 | 即時確認 |
| **L1** | レート制限発動 | 運用担当者 | 即時確認 |
| **L2** | 不正アクセス成功の疑い | システム管理者 | 即時 |
| **L2** | 脆弱性悪用の痕跡 | システム管理者 + セキュリティ担当 | 即時 |
| **L3** | データ漏洩確認 | 管理職 + 法務 + セキュリティチーム | 即時 |
| **L3** | マルウェア検知 | 管理職 + 外部セキュリティベンダー | 即時 |
| **L3** | 管理者アカウント侵害 | 管理職 + 全関係者 | 即時 |

### 深刻度判定マトリクス

```
          影響範囲
          小     中     大
深  低  [  L1  | L1  | L2  ]
刻  中  [  L1  | L2  | L3  ]
度  高  [  L2  | L3  | L3  ]
```

### エスカレーション連絡テンプレート

```
【セキュリティインシデント報告】
■ 検知日時: YYYY-MM-DD HH:MM
■ インシデント種別: [不正アクセス / ブルートフォース / XSS / SQLi / データ漏洩 / マルウェア]
■ 深刻度: [低 / 中 / 高]
■ 影響範囲: [特定ユーザー / 全ユーザー / システム全体 / 外部影響]
■ 検知方法: [アラート / ログ分析 / ユーザー報告]
■ 封じ込め状況: [完了 / 進行中 / 未着手]
■ データ漏洩の可能性: [あり / なし / 調査中]
■ 実施済み対応:
  - [実施した手順を記載]
■ 証拠保全: [完了 / 進行中]
■ 対応者: [担当者名]
■ 次のアクション: [記載]
```

---

## 5. 参考コマンド一覧

### ログ分析

```bash
# セキュリティ関連ログ
sudo journalctl -u itsm-nexus-prod | grep -iE "security|attack|brute|inject|xss|unauthorized"

# 認証ログ
sudo journalctl -u itsm-nexus-prod | grep -iE "auth|login|jwt|token|401|403"

# IPアドレス抽出
sudo journalctl -u itsm-nexus-prod | grep -oE "[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+" | sort | uniq -c | sort -rn

# HTTPステータスコード分布
sudo journalctl -u itsm-nexus-prod | grep -oE "status.*[0-9]{3}" | sort | uniq -c | sort -rn
```

### ファイアウォール

```bash
# IPブロック
sudo iptables -A INPUT -s ATTACKER_IP -j DROP

# ブロック解除
sudo iptables -D INPUT -s ATTACKER_IP -j DROP

# 現在のルール
sudo iptables -L -n --line-numbers

# ルール保存
sudo iptables-save > /tmp/iptables_rules_$(date +%Y%m%d).txt
```

### ユーザー管理（緊急時）

```bash
# アカウント無効化
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "UPDATE users SET is_active = 0 WHERE username = 'TARGET';"

# 全アカウント無効化（管理者以外）
sqlite3 /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db \
  "UPDATE users SET is_active = 0 WHERE role != 'admin';"

# JWT_SECRET変更（全トークン無効化）
# .envのJWT_SECRETを変更後:
sudo systemctl restart itsm-nexus-prod
```

### 証拠保全

```bash
# ログ保全
sudo journalctl -u itsm-nexus-prod --since "YYYY-MM-DD" > /tmp/incident_log.txt

# DB保全
cp /mnt/LinuxHDD/ITSM-System/backend/itsm_nexus.db /tmp/itsm_nexus_evidence.db

# ネットワーク情報
ss -tnp > /tmp/network_state.txt

# プロセス情報
ps auxf > /tmp/process_state.txt

# ファイルタイムスタンプ
find /mnt/LinuxHDD/ITSM-System/ -mmin -60 -ls > /tmp/recent_changes.txt
```

### サービス管理

```bash
sudo systemctl status itsm-nexus-prod
sudo systemctl stop itsm-nexus-prod
sudo systemctl start itsm-nexus-prod
sudo systemctl restart itsm-nexus-prod
```

---

## 6. 復旧確認チェックリスト

| # | 確認項目 | コマンド/方法 | 合格基準 |
|---|---------|--------------|---------|
| 1 | 攻撃元のブロック | `iptables -L -n` | ブロックルール適用済 |
| 2 | 不正アカウント無効化 | DB確認 | 該当アカウント is_active=0 |
| 3 | JWT_SECRET更新 | .env確認 | 新しいシークレット設定済 |
| 4 | サービス稼働 | `systemctl status` | active (running) |
| 5 | ヘルスチェック | `curl health endpoint` | healthy |
| 6 | 正常ログイン | 管理者ログインテスト | 成功 |
| 7 | DB整合性 | `PRAGMA integrity_check` | ok |
| 8 | ログ保全 | 保全ファイル確認 | 存在 |
| 9 | 監視アラート | アラート設定確認 | 有効 |

---

## 7. 事後対応

### インシデントレポート作成

インシデント終息後、以下を含むレポートを作成する:

1. **インシデント概要**: 種別、深刻度、影響範囲
2. **タイムライン**: 検知から復旧までの時系列
3. **根本原因分析**: なぜ発生したか、なぜ検知できたか/できなかったか
4. **対応の評価**: 対応手順の有効性、改善点
5. **再発防止策**: 技術的対策、プロセス改善
6. **教訓**: 今後に活かすべき学び

### 既知のセキュリティリスク

| リスク | 内容 | 現状 | 将来の対策 |
|--------|------|------|-----------|
| JWT in localStorage | XSSでトークン窃取可能 | CSPで緩和 | HttpOnly Cookie移行 |
| タイミング攻撃 | パスワードリセットでユーザー列挙可能 | 未対応 | 定時応答実装 |
| ハードコード設定 | 一部IPアドレスがハードコード | 一部対応 | 環境変数化 |
| SQLite | 本番環境でSQLite使用 | 運用中 | PostgreSQL移行検討 |

---

## 改訂履歴

| 日付 | バージョン | 変更内容 | 担当 |
|------|-----------|---------|------|
| 2026-02-14 | 1.0 | 初版作成 | ops-runbook |
