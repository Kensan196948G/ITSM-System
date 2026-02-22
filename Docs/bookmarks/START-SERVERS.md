# 🚀 ITSM-Sec Nexus サーバー起動手順

## Windows環境でのサーバー起動

### 方法1: バッチファイルを使用（推奨）

**開発サーバー起動:**
```batch
Z:\ITSM-System\scripts\start-dev-server.bat
```

**本番サーバー起動:**
```batch
Z:\ITSM-System\scripts\start-prod-server.bat
```

### 方法2: コマンドラインから直接起動

**開発サーバー（ポート5443）:**
```powershell
cd Z:\ITSM-System
$env:NODE_ENV = "development"
node backend\server.js
```

**本番サーバー（ポート6443）:**
```powershell
cd Z:\ITSM-System
$env:NODE_ENV = "production"
node backend\server.js
```

### 方法3: npm スクリプトを使用

```bash
# 開発サーバー
npm run dev

# 本番サーバー
npm run start
```

## サーバー起動後の確認

### ポート確認
```powershell
netstat -an | Select-String "5443|6443"
```

### アクセスURL

| 環境 | Backend | Frontend |
|------|---------|----------|
| 【開発】 | https://192.168.0.145:5443 | https://192.168.0.145:5050 |
| 【本番】 | https://192.168.0.145:6443 | https://192.168.0.145:6050 |

## 自動起動設定（Windows再起動後も自動起動）

```powershell
# スタートアップショートカットを作成
powershell -ExecutionPolicy Bypass -File Z:\ITSM-System\scripts\create-startup-shortcuts.ps1
```

## サーバー停止

```batch
Z:\ITSM-System\scripts\stop-servers.bat
```

## トラブルシューティング

### ポートが使用中の場合
```powershell
# 使用中のプロセスを確認
netstat -ano | Select-String "5443"

# プロセスを終了（PIDを指定）
taskkill /PID <PID番号> /F
```

### SSL証明書エラー
ブラウザで「詳細設定」→「安全でないページに進む」を選択してください。

### ログ確認
- 開発サーバー: `Z:\ITSM-System\logs\dev-server.log`
- 本番サーバー: `Z:\ITSM-System\logs\prod-server.log`
