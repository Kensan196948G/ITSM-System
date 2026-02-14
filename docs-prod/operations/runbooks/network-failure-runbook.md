# ネットワーク障害対応Runbook

**文書ID**: RB-NET-001
**対象システム**: ITSM-Sec Nexus
**最終更新**: 2026-02-14
**レビュー周期**: 四半期ごと

---

## 1. 概要

本Runbookは、ITSM-Sec Nexusに関連するネットワーク障害（接続不可、TLS/SSL問題、CORS問題、ポートブロック等）発生時における診断・対応・復旧手順を定義する。

### 対象障害

| 障害種別 | 症状 | 影響度 |
|---------|------|--------|
| サービス接続不可 | ブラウザでアクセス不可 | 重大 |
| TLS/SSL証明書エラー | HTTPS接続拒否、証明書警告 | 高 |
| CORSエラー | フロントエンドからAPIコール失敗 | 高 |
| ポートブロック | 特定ポートへの接続タイムアウト | 高 |
| DNS解決失敗 | ホスト名解決不可 | 重大 |
| レスポンス遅延 | タイムアウト多発 | 中 |

### ポート構成

| プロトコル | ポート | 用途 | 環境 |
|-----------|--------|------|------|
| HTTPS | 6443 | メインAPI（本番） | 本番 |
| HTTP | 8080 | 開発・デバッグ | 本番 |
| HTTPS | 5443 | メインAPI（開発） | 開発 |
| HTTP | 5000 | テスト用 | テスト |

### CORS設定

```
デフォルト許可オリジン:
  - https://localhost:3000
  - https://localhost:6443
カスタム: CORS_ORIGIN 環境変数で追加設定
```

---

## 2. 診断フローチャート

```
[ネットワーク障害検知/報告]
       │
       ▼
[1] サーバープロセス確認 ─── 停止 ──→ [A] サービス再起動
       │
       │ 稼働中
       ▼
[2] ローカル接続テスト ─── 失敗 ──→ [B] ポート・バインド確認
       │
       │ 成功
       ▼
[3] リモート接続テスト ─── 失敗 ──→ [C] ファイアウォール確認
       │
       │ 成功
       ▼
[4] HTTPS接続テスト ─── 失敗 ──→ [D] TLS/SSL証明書確認
       │
       │ 成功
       ▼
[5] APIレスポンス確認
       │
       ├─ CORSエラー → [E] CORS設定修正
       ├─ タイムアウト → [F] パフォーマンス調査
       └─ 正常 → アプリケーション層の問題（他Runbook参照）
```

---

## 3. 対応手順（ステップバイステップ）

### 手順 3.1: 初期診断

#### Step 1: サーバープロセス確認

```bash
# systemdサービス状態
sudo systemctl status itsm-nexus-prod
sudo systemctl status itsm-frontend-https

# Node.jsプロセス確認
ps aux | grep -E "node.*server"

# ポートリスニング確認
ss -tlnp | grep -E "6443|8080|5443"
# または
netstat -tlnp | grep -E "6443|8080|5443"
```

#### Step 2: ローカル接続テスト

```bash
# localhost経由でHTTPS接続テスト
curl -k -v https://localhost:6443/api/v1/health 2>&1

# HTTP接続テスト
curl -v http://localhost:8080/api/v1/health 2>&1

# 接続のみテスト（レスポンスは不要）
curl -k --connect-timeout 5 -o /dev/null -s -w "%{http_code}" https://localhost:6443/api/v1/health
```

#### Step 3: リモート接続テスト

```bash
# サーバーIPアドレス確認
hostname -I
ip addr show

# リモートからの接続テスト（別端末から実行）
curl -k --connect-timeout 10 https://SERVER_IP:6443/api/v1/health

# telnetによるポート到達確認
# （別端末から実行）
nc -zv SERVER_IP 6443
nc -zv SERVER_IP 8080
```

#### Step 4: HTTPS/TLS確認

```bash
# SSL証明書の確認
openssl s_client -connect localhost:6443 -servername localhost </dev/null 2>/dev/null | openssl x509 -noout -dates

# 証明書の詳細情報
openssl s_client -connect localhost:6443 </dev/null 2>/dev/null | openssl x509 -noout -text

# SSL証明書ファイルの存在確認
ls -la /mnt/LinuxHDD/ITSM-System/ssl/
```

#### Step 5: DNS確認

```bash
# DNS解決確認
nslookup $(hostname)
dig $(hostname)

# /etc/hosts確認
cat /etc/hosts

# DNS設定確認
cat /etc/resolv.conf
```

---

### 手順 3.2: 障害別対応

#### [A] サービス再起動

```bash
# 1. サービス停止
sudo systemctl stop itsm-nexus-prod

# 2. プロセス残留確認
ps aux | grep -E "node.*server"
# 残留プロセスがある場合
# kill -TERM <PID>

# 3. サービス起動
sudo systemctl start itsm-nexus-prod

# 4. 起動確認
sleep 5
sudo systemctl status itsm-nexus-prod
curl -k https://localhost:6443/api/v1/health

# 5. ログ確認（起動エラーがないか）
sudo journalctl -u itsm-nexus-prod --since "5 minutes ago" --no-pager
```

#### [B] ポート・バインド確認

**原因**: ポート競合、バインドアドレス不正、権限不足

```bash
# 1. ポート使用状況確認
ss -tlnp | grep -E "6443|8080"
sudo lsof -i :6443
sudo lsof -i :8080

# 2. ポート競合の解消
# 競合プロセスの特定
sudo fuser -v 6443/tcp
sudo fuser -v 8080/tcp

# 3. 競合プロセスの停止（必要に応じて）
# sudo fuser -k 6443/tcp  # 注意: プロセスを強制終了する

# 4. サービス再起動
sudo systemctl restart itsm-nexus-prod

# 5. バインドアドレスの確認（server.jsの設定）
grep -i "listen\|bind\|port" /mnt/LinuxHDD/ITSM-System/backend/server.js
```

#### [C] ファイアウォール確認

```bash
# 1. iptables ルール確認
sudo iptables -L -n | grep -E "6443|8080"

# 2. ufw 状態確認（Ubuntu）
sudo ufw status verbose

# 3. firewalld 状態確認（CentOS/RHEL）
sudo firewall-cmd --list-all 2>/dev/null

# 4. ファイアウォールにポートを追加（ufw）
sudo ufw allow 6443/tcp comment "ITSM-Nexus HTTPS"
sudo ufw allow 8080/tcp comment "ITSM-Nexus HTTP"

# 5. ファイアウォールにポートを追加（firewalld）
# sudo firewall-cmd --permanent --add-port=6443/tcp
# sudo firewall-cmd --permanent --add-port=8080/tcp
# sudo firewall-cmd --reload

# 6. SELinux確認（CentOS/RHEL）
getenforce 2>/dev/null
# Enforcing の場合、ポート許可が必要な場合がある
```

#### [D] TLS/SSL証明書の修復

**原因**: 証明書期限切れ、証明書ファイル破損、パス設定ミス

```bash
# 1. 証明書ファイルの確認
ls -la /mnt/LinuxHDD/ITSM-System/ssl/

# 2. 証明書の有効期限確認
openssl x509 -in /mnt/LinuxHDD/ITSM-System/ssl/server.crt -noout -dates 2>/dev/null
# notBefore / notAfter を確認

# 3. 証明書と秘密鍵の整合性確認
openssl x509 -in /mnt/LinuxHDD/ITSM-System/ssl/server.crt -noout -modulus | md5sum
openssl rsa -in /mnt/LinuxHDD/ITSM-System/ssl/server.key -noout -modulus | md5sum
# 両方のmd5sumが一致すること

# 4. 自己署名証明書の再生成（緊急時）
openssl req -x509 -nodes -days 365 \
  -newkey rsa:2048 \
  -keyout /mnt/LinuxHDD/ITSM-System/ssl/server.key \
  -out /mnt/LinuxHDD/ITSM-System/ssl/server.crt \
  -subj "/CN=localhost/O=ITSM-Nexus"

# 5. サービス再起動（証明書の反映）
sudo systemctl restart itsm-nexus-prod

# 6. HTTPS接続確認
curl -k https://localhost:6443/api/v1/health
```

#### [E] CORS設定修正

**原因**: フロントエンドのオリジンがCORS許可リストに含まれていない

```bash
# 1. 現在のCORS設定確認
grep -i "cors" /mnt/LinuxHDD/ITSM-System/backend/server.js

# 2. 環境変数確認
grep CORS_ORIGIN /mnt/LinuxHDD/ITSM-System/.env

# 3. CORS_ORIGIN の設定（.envファイル）
# CORS_ORIGIN=https://your-frontend-domain:port
# 複数指定の場合はカンマ区切り

# 4. ブラウザ側の確認
# 開発者ツール → Console で以下を確認:
# "Access to fetch at 'https://...' from origin 'https://...' has been blocked by CORS policy"
# → エラーメッセージ内の origin をCORS_ORIGINに追加

# 5. サービス再起動
sudo systemctl restart itsm-nexus-prod
```

> **注意**: CORS設定のデフォルトは `https://localhost:3000` と `https://localhost:6443` のみ。それ以外のオリジンからのアクセスには `CORS_ORIGIN` 環境変数の設定が必要。

#### [F] パフォーマンス調査

```bash
# 1. サーバーレスポンス時間計測
curl -k -o /dev/null -s -w "DNS: %{time_namelookup}s\nConnect: %{time_connect}s\nTLS: %{time_appconnect}s\nTotal: %{time_total}s\n" https://localhost:6443/api/v1/health

# 2. Prometheusメトリクス確認
curl -k https://localhost:6443/metrics 2>/dev/null | grep -E "http_request_duration|response_time"

# 3. システムリソース確認
top -bn1 | head -20
free -h
iostat -x 1 3 2>/dev/null

# 4. ネットワーク接続数確認
ss -s
ss -tnp | grep -c 6443

# 5. Node.jsのメモリ使用量
ps -o pid,rss,vsz,comm -p $(pgrep -f "node.*server")
```

---

## 4. エスカレーション基準

### エスカレーションレベル

| レベル | 条件 | 対応者 | 時間枠 |
|--------|------|--------|--------|
| **L1** | 単一ポートの接続問題、CORS設定ミス | 運用担当者 | 0〜30分 |
| **L2** | サーバー全面接続不可、TLS証明書問題 | システム管理者 | 即時〜30分 |
| **L2** | ファイアウォール・ネットワーク機器問題 | ネットワーク管理者 | 即時〜30分 |
| **L3** | インフラ全体障害、外部ネットワーク障害 | 管理職 + インフラチーム | 即時 |

### エスカレーション連絡テンプレート

```
【ネットワーク障害報告】
■ 発生日時: YYYY-MM-DD HH:MM
■ 障害種別: [接続不可 / TLS証明書 / CORS / ファイアウォール / DNS]
■ 影響範囲: [全ユーザー / 特定ネットワーク / 特定ブラウザ]
■ 影響サービス: ITSM-Sec Nexus (port 6443/8080)
■ ローカル接続: [可能 / 不可]
■ リモート接続: [可能 / 不可]
■ 実施済み対応:
  - [実施した手順を記載]
■ 現在の状態: [復旧済 / 対応中 / エスカレーション待ち]
■ 対応者: [担当者名]
```

---

## 5. 参考コマンド一覧

### 接続テスト

```bash
# ヘルスチェック（HTTPS）
curl -k https://localhost:6443/api/v1/health

# ヘルスチェック（HTTP）
curl http://localhost:8080/api/v1/health

# HTTPレスポンスコードのみ
curl -k -o /dev/null -s -w "%{http_code}\n" https://localhost:6443/api/v1/health

# レスポンス時間計測
curl -k -o /dev/null -s -w "Total: %{time_total}s\n" https://localhost:6443/api/v1/health
```

### ポート・プロセス

```bash
# リスニングポート一覧
ss -tlnp
sudo lsof -i -P -n | grep LISTEN

# 特定ポートの確認
ss -tlnp | grep 6443
sudo fuser -v 6443/tcp
```

### ファイアウォール

```bash
# ufw
sudo ufw status verbose
sudo ufw allow 6443/tcp

# iptables
sudo iptables -L -n -v
```

### SSL/TLS

```bash
# 証明書確認
openssl s_client -connect localhost:6443 </dev/null 2>/dev/null | openssl x509 -noout -text

# 有効期限
openssl s_client -connect localhost:6443 </dev/null 2>/dev/null | openssl x509 -noout -dates

# TLSバージョン確認
openssl s_client -connect localhost:6443 -tls1_2 </dev/null 2>/dev/null
openssl s_client -connect localhost:6443 -tls1_3 </dev/null 2>/dev/null
```

### サービス管理

```bash
sudo systemctl status itsm-nexus-prod
sudo systemctl restart itsm-nexus-prod
sudo journalctl -u itsm-nexus-prod -f
```

---

## 6. 復旧確認チェックリスト

| # | 確認項目 | コマンド/方法 | 合格基準 |
|---|---------|--------------|---------|
| 1 | プロセス稼働 | `systemctl status itsm-nexus-prod` | active (running) |
| 2 | ポートリスニング | `ss -tlnp \| grep 6443` | LISTEN状態 |
| 3 | ローカルHTTPS | `curl -k https://localhost:6443/api/v1/health` | 200 OK |
| 4 | ローカルHTTP | `curl http://localhost:8080/api/v1/health` | 200 OK |
| 5 | リモート接続 | 別端末から `curl -k https://SERVER_IP:6443/...` | 200 OK |
| 6 | TLS証明書 | `openssl s_client -connect localhost:6443` | 証明書有効 |
| 7 | ブラウザアクセス | ブラウザでURL入力 | 画面表示正常 |
| 8 | CORSテスト | ブラウザ開発者ツールでAPIコール | エラーなし |

---

## 改訂履歴

| 日付 | バージョン | 変更内容 | 担当 |
|------|-----------|---------|------|
| 2026-02-14 | 1.0 | 初版作成 | ops-runbook |
