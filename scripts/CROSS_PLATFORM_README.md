# Windows/Linux両対応スクリプトガイド

## 概要

ITSM-Sec Nexus プロジェクトでは、Windows と Linux の両プラットフォームで開発・運用できるよう、環境別のスクリプトを提供しています。

---

## 📁 新規追加スクリプト一覧

### プロジェクトルート

| スクリプト | 説明 | プラットフォーム |
|-----------|------|-----------------|
| `run-claude.sh` | Claude Code起動・DevTools接続管理 | Linux/macOS |

### scripts/Linux/

| スクリプト | 説明 | 用途 |
|-----------|------|------|
| `start-dev.sh` | 開発環境一括起動 | Backend + Frontend 起動 |
| `stop-all.sh` | 全サービス停止 | 開発環境のクリーンアップ |

### scripts/Windows/

| スクリプト | 説明 | 用途 |
|-----------|------|------|
| `start-dev.ps1` | 開発環境一括起動 | Backend + Frontend 起動 |
| `stop-all.ps1` | 全サービス停止 | 開発環境のクリーンアップ |

---

## 🚀 クイックスタート

### Linux 開発環境

```bash
# プロジェクトルートで実行
cd /path/to/ITSM-System

# 開発環境起動
./scripts/Linux/start-dev.sh

# 停止
./scripts/Linux/stop-all.sh
```

### Windows 開発環境

```powershell
# プロジェクトルートで実行
cd C:\path\to\ITSM-System

# 開発環境起動
.\scripts\Windows\start-dev.ps1

# 停止
.\scripts\Windows\stop-all.ps1
```

---

## 📋 詳細仕様

### 1. run-claude.sh (Linux/macOS)

**目的:** Claude Code の起動と Chrome DevTools プロトコル接続を管理

**機能:**
- Chrome DevTools の応答確認（リトライ機能付き）
- 環境変数の自動設定（`CLAUDE_CHROME_DEBUG_PORT`, `MCP_CHROME_DEBUG_PORT`）
- 初期プロンプトの自動入力
- クラッシュ時の自動再起動

**環境変数:**
```bash
PORT=9222                # DevTools ポート
RESTART_DELAY=3          # 再起動待機時間（秒）
```

**初期プロンプト:**
```
以降、日本語で対応願います。全SubAgent機能＋全Hooks機能（並列実行機能）＋
全MCP機能+標準機能を利用してください。Memory MCPに記録された内容から
続きの開発フェーズを続けてください。
```

**使用例:**
```bash
# 基本的な使用
./run-claude.sh

# DevTools ポートを変更
PORT=9223 ./run-claude.sh
```

**エラーハンドリング:**
- DevTools 接続失敗時: 最大10回リトライ（2秒間隔）
- Claude クラッシュ時: 3秒待機後に自動再起動
- Ctrl+C で正常終了

---

### 2. start-dev.sh / start-dev.ps1 (開発環境起動)

**目的:** Backend と Frontend を一括起動して開発環境を準備

#### 共通機能

1. **環境設定**
   - `.env.development` を `.env` にコピー
   - `NODE_ENV=development` を設定

2. **データベース確認**
   - `backend/databases/dev/itsm_dev.db` の存在確認
   - 存在しない場合は警告（初回起動時に自動作成）

3. **Node.js バージョン確認**
   - インストール済み Node.js バージョンを表示

4. **バックエンド起動**
   - ポート: `5443` (HTTPS)
   - IP: `192.168.0.187`
   - コマンド: `node backend/server.js`

5. **フロントエンド起動**
   - ポート: `5050`
   - IP: `0.0.0.0` (全インターフェース)
   - コマンド: `python3 -m http.server 5050 --bind 0.0.0.0`

#### プラットフォーム別の違い

| 項目 | Linux | Windows |
|------|-------|---------|
| プロセス起動 | `nohup ... &` | `Start-Process -NoNewWindow` |
| PID 取得 | `$!` | プロセスオブジェクト |
| ログ出力 | `> backend-dev.log 2>&1` | なし（コンソール統合） |
| 待機時間 | `sleep 3` | `Start-Sleep -Seconds 3` |

#### アクセスURL

```
フロントエンド:     http://192.168.0.187:5050
バックエンドAPI:    https://192.168.0.187:5443
Swagger API Docs:   https://192.168.0.187:5443/api-docs
```

#### 注意事項

**Linux:**
- バックグラウンド実行（nohup）のため、ログは `backend-dev.log` / `frontend-dev.log` に出力
- `python3` が必要（未インストールの場合はインストール）
- 実行権限が必要: `chmod +x scripts/Linux/start-dev.sh`

**Windows:**
- PowerShell 5.1 以上が必要
- `python` コマンドが PATH に含まれている必要がある
- 実行ポリシー確認: `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser`

---

### 3. stop-all.sh / stop-all.ps1 (全サービス停止)

**目的:** 開発環境で起動した全サービスを安全に停止

#### 共通機能

1. **Node.js プロセス停止**
   - `node backend/server.js` を検索して停止
   - SIGTERM → SIGKILL の段階的停止

2. **Python プロセス停止**
   - `python -m http.server` を検索して停止
   - フロントエンドサーバーのみを対象

3. **ログファイル確認**（Linux のみ）
   - `backend-dev.log` / `frontend-dev.log` の存在確認
   - 行数を表示

#### プラットフォーム別の違い

| 項目 | Linux | Windows |
|------|-------|---------|
| プロセス検索 | `pgrep -f` | `Get-Process -Name` |
| プロセス停止 | `kill` / `kill -9` | `Stop-Process -Force` |
| フィルタリング | コマンドライン引数で判定 | `CommandLine` プロパティで判定 |

#### 使用例

**Linux:**
```bash
./scripts/Linux/stop-all.sh

# 出力例:
# 1. Node.jsプロセスを停止中...
#    ✅ Node.jsプロセスを停止しました (PID: 12345)
# 2. Pythonプロセスを停止中...
#    ✅ Pythonプロセスを停止しました (PID: 12346)
```

**Windows:**
```powershell
.\scripts\Windows\stop-all.ps1

# 出力例:
# 1. Node.jsプロセスを停止中...
#    ✅ Node.jsプロセスを停止しました (2個)
# 2. Pythonプロセスを停止中...
#    ✅ Pythonプロセスを停止しました (1個)
```

---

## 🔧 トラブルシューティング

### Linux

#### ポート5443が既に使用中
```bash
# ポート使用状況確認
sudo lsof -i :5443

# プロセス強制終了
sudo kill -9 <PID>
```

#### Python http.serverが起動しない
```bash
# Python3 インストール確認
python3 --version

# インストール（Ubuntu/Debian）
sudo apt-get install python3

# インストール（RHEL/CentOS）
sudo yum install python3
```

#### 実行権限エラー
```bash
# 実行権限付与
chmod +x scripts/Linux/*.sh

# 確認
ls -la scripts/Linux/*.sh
```

### Windows

#### PowerShell実行ポリシーエラー
```powershell
# 現在のポリシー確認
Get-ExecutionPolicy

# ポリシー変更（管理者権限不要）
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# 確認
Get-ExecutionPolicy -List
```

#### ポート5443が既に使用中
```powershell
# ポート使用状況確認
netstat -ano | findstr :5443

# プロセス強制終了
taskkill /PID <PID> /F
```

#### Pythonが見つからない
```powershell
# Python インストール確認
python --version

# PATH 確認
$env:PATH -split ';' | Select-String python

# Python インストール（公式サイトからダウンロード）
# https://www.python.org/downloads/
```

---

## 📊 スクリプト対応表

| 機能 | Linux | Windows | 説明 |
|------|-------|---------|------|
| Claude Code起動 | `run-claude.sh` | ❌ | DevTools接続管理 |
| 開発環境起動 | `start-dev.sh` | `start-dev.ps1` | Backend + Frontend |
| 全サービス停止 | `stop-all.sh` | `stop-all.ps1` | プロセス一括停止 |
| 本番環境セットアップ | `setup/*.sh` | ❌ | SSL/systemd設定 |
| データベースバックアップ | `operations/backup.sh` | ❌ | 自動バックアップ |

---

## 🔐 セキュリティ考慮事項

### 1. 環境変数

- `.env` ファイルは `.gitignore` に含まれている
- 本番環境では `.env.production` を使用
- JWT_SECRET などの秘密鍵は自動生成（`setup-environment.sh`）

### 2. ポート設定

| 環境 | プロトコル | ポート | 用途 |
|------|-----------|--------|------|
| 開発 | HTTPS | 5443 | Backend API |
| 開発 | HTTP | 5050 | Frontend |
| 本番 | HTTPS | 6443 | Backend API（推奨） |
| 本番 | HTTP | 8080 | Backend API（デバッグ用） |

### 3. ファイアウォール設定

**Linux:**
```bash
# 開発環境ポート開放
sudo ufw allow 5443/tcp
sudo ufw allow 5050/tcp

# 本番環境ポート開放
sudo ufw allow 6443/tcp
sudo ufw allow 8080/tcp
```

**Windows:**
```powershell
# 開発環境ポート開放
New-NetFirewallRule -DisplayName "ITSM-Backend-Dev" -Direction Inbound -Protocol TCP -LocalPort 5443 -Action Allow
New-NetFirewallRule -DisplayName "ITSM-Frontend-Dev" -Direction Inbound -Protocol TCP -LocalPort 5050 -Action Allow
```

---

## 📝 開発フロー

### 日常的な開発作業

```bash
# 1. 開発環境起動
./scripts/Linux/start-dev.sh        # Linux
.\scripts\Windows\start-dev.ps1     # Windows

# 2. コード変更
# ... (エディタで編集)

# 3. ログ確認
tail -f backend-dev.log             # Linux
Get-Content backend-dev.log -Wait   # Windows

# 4. 開発環境停止
./scripts/Linux/stop-all.sh         # Linux
.\scripts\Windows\stop-all.ps1      # Windows
```

### Claude Code を使った開発（Linux）

```bash
# 1. Chrome DevTools を有効化してChromeを起動
google-chrome --remote-debugging-port=9222

# 2. Claude Code 起動
./run-claude.sh

# 3. Claude に指示
# 例: "開発環境を起動して、最新のコミットの内容をレビューしてください"

# 4. 終了
# Ctrl+C で Claude を終了
```

---

## 🧪 テスト

### スクリプト構文チェック

**Linux:**
```bash
# Bash構文チェック
bash -n scripts/Linux/start-dev.sh
bash -n scripts/Linux/stop-all.sh
bash -n run-claude.sh

# 全スクリプト一括チェック
find scripts/Linux -name "*.sh" -exec bash -n {} \; && echo "✅ All scripts OK"
```

**Windows:**
```powershell
# PowerShell構文チェック
$ErrorActionPreference = "Stop"
$null = [System.Management.Automation.PSParser]::Tokenize((Get-Content scripts\Windows\start-dev.ps1 -Raw), [ref]$null)
$null = [System.Management.Automation.PSParser]::Tokenize((Get-Content scripts\Windows\stop-all.ps1 -Raw), [ref]$null)
Write-Host "✅ All scripts OK"
```

### 動作テスト

```bash
# Linux
./scripts/Linux/start-dev.sh
sleep 10
curl -k https://192.168.0.187:5443/api/v1/health
./scripts/Linux/stop-all.sh

# Windows
.\scripts\Windows\start-dev.ps1
Start-Sleep -Seconds 10
Invoke-WebRequest -Uri https://192.168.0.187:5443/api/v1/health -SkipCertificateCheck
.\scripts\Windows\stop-all.ps1
```

---

## 📚 関連ドキュメント

- [scripts/README.md](./README.md) - Linux本番環境スクリプト詳細
- [CLAUDE.md](../CLAUDE.md) - プロジェクト開発ルール
- [README.md](../README.md) - プロジェクト全体概要
- [config/env/](../config/env/) - 環境変数設定例

---

## 🤝 貢献

スクリプトの改善提案は Issue または Pull Request でお願いします。

### 改善検討事項

- [ ] Windows版 `run-claude.sh` 相当の実装
- [ ] macOS 対応確認
- [ ] Docker Compose 対応
- [ ] CI/CD パイプライン統合
- [ ] ヘルスチェック機能の強化

---

## 📄 変更履歴

| 日付 | 変更内容 |
|------|---------|
| 2026-01-31 | Windows/Linux両対応スクリプト初版作成 |
| 2026-01-31 | `run-claude.sh` 追加（DevTools接続管理） |
| 2026-01-31 | `start-dev.sh/ps1`, `stop-all.sh/ps1` 追加 |

---

## 📄 ライセンス

ITSM-System プロジェクトのライセンスに準じます。
