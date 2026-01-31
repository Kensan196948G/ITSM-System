# Windows PowerShell - 全サービス停止スクリプト
# ITSM-Sec Nexus Stop All Services

Write-Host "==========================================" -ForegroundColor Red
Write-Host "🛑 ITSM-Sec Nexus - 全サービス停止" -ForegroundColor Red
Write-Host "==========================================" -ForegroundColor Red
Write-Host ""

# Node.jsプロセスを停止
Write-Host "1. Node.jsプロセスを停止中..." -ForegroundColor Yellow
$nodeProcesses = Get-Process -Name "node" -ErrorAction SilentlyContinue
if ($nodeProcesses) {
    $nodeProcesses | Stop-Process -Force
    Write-Host "   ✅ Node.jsプロセスを停止しました ($($nodeProcesses.Count)個)" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  実行中のNode.jsプロセスはありません" -ForegroundColor Gray
}

# Pythonプロセスを停止（http.server）
Write-Host ""
Write-Host "2. Pythonプロセスを停止中..." -ForegroundColor Yellow
$pythonProcesses = Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*http.server*" }
if ($pythonProcesses) {
    $pythonProcesses | Stop-Process -Force
    Write-Host "   ✅ Pythonプロセスを停止しました ($($pythonProcesses.Count)個)" -ForegroundColor Green
} else {
    Write-Host "   ℹ️  実行中のPythonプロセスはありません" -ForegroundColor Gray
}

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ 全サービス停止完了" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
