# Windows PowerShell - 開発環境起動スクリプト
# ITSM-Sec Nexus Development Environment Startup

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "🚀 ITSM-Sec Nexus - 開発環境起動" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# プロジェクトルートに移動
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Join-Path $scriptPath "../.."
Set-Location $projectRoot

# 環境設定
Write-Host "1. 環境設定を読み込み中..." -ForegroundColor Yellow
Copy-Item "config\env\.env.development" ".env" -Force
$env:NODE_ENV = "development"
Write-Host "   ✅ 開発環境設定を適用しました" -ForegroundColor Green

# データベース確認
Write-Host ""
Write-Host "2. データベース確認中..." -ForegroundColor Yellow
$dbPath = "backend\databases\dev\itsm_dev.db"
if (Test-Path $dbPath) {
    $dbSize = (Get-Item $dbPath).Length / 1MB
    Write-Host "   ✅ データベース: $dbPath ($("{0:N2}" -f $dbSize) MB)" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  データベースが見つかりません" -ForegroundColor Yellow
    Write-Host "   🔧 初回起動時に自動作成されます" -ForegroundColor Yellow
}

# Node.jsバージョン確認
Write-Host ""
Write-Host "3. Node.jsバージョン確認..." -ForegroundColor Yellow
$nodeVersion = node --version
Write-Host "   Node.js: $nodeVersion" -ForegroundColor Green

# バックエンド起動
Write-Host ""
Write-Host "4. バックエンドサーバー起動中..." -ForegroundColor Yellow
Write-Host "   ポート: 5443 (HTTPS)" -ForegroundColor Cyan
Write-Host "   IP: 192.168.0.187" -ForegroundColor Cyan

Start-Process -NoNewWindow -FilePath "node" -ArgumentList "backend\server.js"
Start-Sleep -Seconds 3

# フロントエンド起動
Write-Host ""
Write-Host "5. フロントエンドサーバー起動中..." -ForegroundColor Yellow
Write-Host "   ポート: 5050" -ForegroundColor Cyan

Start-Process -NoNewWindow -FilePath "python" -ArgumentList "-m","http.server","5050","--bind","0.0.0.0"

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ 開発環境起動完了" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📍 アクセスURL:" -ForegroundColor Cyan
Write-Host "   フロントエンド: http://192.168.0.187:5050" -ForegroundColor White
Write-Host "   バックエンドAPI: https://192.168.0.187:5443" -ForegroundColor White
Write-Host "   Swagger API Docs: https://192.168.0.187:5443/api-docs" -ForegroundColor White
Write-Host ""
Write-Host "📝 次のステップ:" -ForegroundColor Cyan
Write-Host "   - ブラウザでフロントエンドにアクセス" -ForegroundColor White
Write-Host "   - ログ確認: Get-Content backend.log -Wait" -ForegroundColor White
Write-Host "   - 停止: .\scripts\Windows\stop-all.ps1" -ForegroundColor White
Write-Host ""
