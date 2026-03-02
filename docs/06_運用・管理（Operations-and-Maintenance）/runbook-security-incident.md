# Runbook: セキュリティインシデント対応

## 概要

ITSM-Sec Nexus に対するセキュリティインシデントが検知された場合の対応手順書です。
NIST Cybersecurity Framework (CSF) 2.0 のインシデント対応プロセスに準拠しています。

---

## 1. インシデント分類

### 1.1 重大度レベル

| レベル | 定義 | 例 | 対応時間 |
|--------|------|-----|---------|
| P1 (緊急) | サービス侵害・データ漏洩 | 不正アクセス、DB流出 | 即時 |
| P2 (高) | 攻撃の試行・脆弱性悪用 | ブルートフォース、SQLi試行 | 1時間以内 |
| P3 (中) | 不審なアクティビティ | 異常ログイン、権限昇格試行 | 4時間以内 |
| P4 (低) | 情報収集・スキャン | ポートスキャン、脆弱性スキャン | 24時間以内 |

### 1.2 検知方法

```bash
# 監査ログからの異常検知
sqlite3 backend/itsm.db "
SELECT action, username, ip_address, COUNT(*) as cnt,
       MIN(created_at) as first, MAX(created_at) as last
FROM audit_logs
WHERE created_at > datetime('now', '-1 hour')
GROUP BY action, username, ip_address
HAVING cnt > 20
ORDER BY cnt DESC;
"

# 認証失敗の集計
sqlite3 backend/itsm.db "
SELECT ip_address, COUNT(*) as failures
FROM audit_logs
WHERE action = 'LOGIN_FAILURE'
  AND created_at > datetime('now', '-1 hour')
GROUP BY ip_address
HAVING failures > 5
ORDER BY failures DESC;
"

# 不正なAPIアクセスパターン
grep -E "401|403|500" /var/log/itsm/server.log | tail -50
```

---

## 2. 初動封じ込め（P1/P2: 15分以内）

### 2.1 即時対応

```bash
# 1. 証拠保全（最優先）
INCIDENT_ID="INC-$(date +%Y%m%d-%H%M%S)"
EVIDENCE_DIR="/tmp/evidence_${INCIDENT_ID}"
mkdir -p "${EVIDENCE_DIR}"

# ログ保全
cp /var/log/itsm/server.log "${EVIDENCE_DIR}/"
cp backend/itsm.db "${EVIDENCE_DIR}/itsm.db.snapshot"

# 監査ログのエクスポート
sqlite3 backend/itsm.db ".mode csv" ".headers on" \
  "SELECT * FROM audit_logs WHERE created_at > datetime('now', '-24 hours');" \
  > "${EVIDENCE_DIR}/audit_logs_24h.csv"

# 現在のネットワーク接続
ss -tnp > "${EVIDENCE_DIR}/network_connections.txt"
echo "証拠保全完了: ${EVIDENCE_DIR}"
```

### 2.2 攻撃元IPのブロック（該当する場合）

```bash
# 攻撃元IPを特定
ATTACKER_IP="<特定されたIP>"

# iptablesでブロック
sudo iptables -A INPUT -s "${ATTACKER_IP}" -j DROP
echo "ブロック済み: ${ATTACKER_IP}"

# ブロックリストに記録
echo "$(date +%Y-%m-%dT%H:%M:%S) ${ATTACKER_IP} ${INCIDENT_ID}" >> /etc/itsm/blocked_ips.log
```

### 2.3 侵害アカウントの無効化

```bash
# 侵害が疑われるアカウントの特定
sqlite3 backend/itsm.db "
SELECT id, username, email, role, last_login, is_active
FROM users
WHERE username = '<疑わしいユーザー名>';
"

# アカウントの無効化
sqlite3 backend/itsm.db "
UPDATE users SET is_active = 0 WHERE username = '<疑わしいユーザー名>';
"

# 該当ユーザーの全セッション（リフレッシュトークン）を無効化
sqlite3 backend/itsm.db "
DELETE FROM refresh_tokens WHERE user_id = (
  SELECT id FROM users WHERE username = '<疑わしいユーザー名>'
);
"
echo "アカウント無効化完了"
```

### 2.4 JWTトークンの一括無効化（最悪のケース）

JWTシークレットの漏洩が疑われる場合、全トークンを無効化します。

```bash
# 1. サービス停止
sudo systemctl stop itsm-system

# 2. JWT_SECRETを再生成
NEW_SECRET=$(openssl rand -hex 32)
echo "新しいJWT_SECRET: ${NEW_SECRET}"
# 環境変数または.envファイルを更新

# 3. 全リフレッシュトークンを削除
sqlite3 backend/itsm.db "DELETE FROM refresh_tokens;"

# 4. トークンブラックリストをクリア（新シークレットで旧トークンは無効）
sqlite3 backend/itsm.db "DELETE FROM token_blacklist;" 2>/dev/null

# 5. サービス再起動
sudo systemctl start itsm-system
echo "全セッション無効化完了 - 全ユーザーの再ログインが必要です"
```

---

## 3. 調査

### 3.1 タイムライン作成

```bash
# 直近24時間の監査ログをタイムライン形式で出力
sqlite3 backend/itsm.db "
SELECT created_at, action, username, ip_address, details
FROM audit_logs
WHERE created_at > datetime('now', '-24 hours')
ORDER BY created_at ASC;
" | tee "${EVIDENCE_DIR}/timeline.txt"
```

### 3.2 不正アクセスの範囲確認

```bash
# 侵害アカウントのアクティビティ
sqlite3 backend/itsm.db "
SELECT created_at, action, details, ip_address
FROM audit_logs
WHERE username = '<侵害ユーザー>'
ORDER BY created_at DESC
LIMIT 100;
"

# データへのアクセス履歴
sqlite3 backend/itsm.db "
SELECT created_at, action, details
FROM audit_logs
WHERE username = '<侵害ユーザー>'
  AND action LIKE '%READ%' OR action LIKE '%EXPORT%' OR action LIKE '%DOWNLOAD%'
ORDER BY created_at DESC;
"
```

### 3.3 影響範囲の評価

確認すべき項目:

- [ ] アクセスされたデータの種類（個人情報、インシデント情報、資産情報）
- [ ] データの変更・削除が行われたか
- [ ] 他のアカウントへの横展開があったか
- [ ] システム設定の変更があったか
- [ ] 外部へのデータ送信があったか

---

## 4. 報告

### 4.1 インシデント報告書テンプレート

GitHub Issue として以下のフォーマットで作成（ラベル: `security`）:

```markdown
## セキュリティインシデント報告

**インシデントID**: INC-YYYYMMDD-HHMMSS
**重大度**: P1/P2/P3/P4
**検知日時**: YYYY-MM-DD HH:MM
**報告者**: [氏名]

### 概要
[インシデントの概要を1-2文で]

### タイムライン
- HH:MM - [イベント1]
- HH:MM - [イベント2]

### 影響範囲
- 影響ユーザー数: X名
- 影響データ: [種類]
- サービス影響: [停止/劣化/影響なし]

### 対応内容
1. [実施した対応1]
2. [実施した対応2]

### 根本原因
[判明した原因]

### 再発防止策
- [ ] [改善項目1]
- [ ] [改善項目2]
```

### 4.2 報告先

| 重大度 | 報告先 | 報告期限 |
|--------|--------|---------|
| P1 | プロジェクトリーダー + 全チーム | 即時 |
| P2 | プロジェクトリーダー + セキュリティ担当 | 1時間以内 |
| P3 | セキュリティ担当 | 4時間以内 |
| P4 | GitHub Issue のみ | 翌営業日 |

---

## 5. 復旧

### 5.1 サービス復旧手順

```bash
# 1. 全ての封じ込め措置が完了していることを確認

# 2. 脆弱性が修正されていることを確認
npm audit

# 3. 依存関係の更新（セキュリティパッチ）
npm audit fix

# 4. サービス再起動
sudo systemctl restart itsm-system

# 5. 動作確認
curl -sk https://localhost:6443/api/v1/health
```

### 5.2 監視強化

インシデント後は一定期間、監視を強化します。

```bash
# 認証失敗の監視（10分間隔で実行）
sqlite3 backend/itsm.db "
SELECT ip_address, COUNT(*) as cnt
FROM audit_logs
WHERE action = 'LOGIN_FAILURE'
  AND created_at > datetime('now', '-10 minutes')
GROUP BY ip_address
HAVING cnt > 3;
"
```

---

## 6. エスカレーション

| 状況 | エスカレーション先 | アクション |
|------|-------------------|-----------|
| データ漏洩確認 | 経営層 + 法務 | 個人情報保護法に基づく報告義務の確認 |
| 外部からの継続的攻撃 | ISP / CSIRT | 上流でのブロック要請 |
| 内部犯行の疑い | 経営層 + 人事 | アクセス権限の全面見直し |
| ランサムウェア | 全チーム + 経営層 | ネットワーク隔離、バックアップ復旧 |

---

## 7. 事後対応

### 7.1 ポストモーテム会議

インシデント終結後48時間以内に実施:

1. タイムラインの最終確認
2. 検知から封じ込めまでの時間評価
3. 対応手順の改善点の洗い出し
4. 再発防止策の決定とアサイン

### 7.2 長期改善計画

- [ ] 侵入検知システム（IDS）の導入検討
- [ ] ログの集中管理・SIEM導入検討
- [ ] 定期的なペネトレーションテスト実施
- [ ] セキュリティ教育の実施
- [ ] インシデント対応訓練の定期実施

---

## 更新履歴

| 日付 | 内容 | 担当 |
|------|------|------|
| 2026-03-02 | 初版作成 | 運用チーム |
