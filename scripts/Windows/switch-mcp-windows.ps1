# MCP設定をWindows用に切り替えるスクリプト
# Usage: .\switch-mcp-windows.ps1

$ErrorActionPreference = "Stop"

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent (Split-Path -Parent $scriptPath)

Write-Host "=== MCP設定をWindows用に切り替え ===" -ForegroundColor Cyan
Write-Host "プロジェクトルート: $projectRoot"

# Windows用設定をコピー
$windowsConfig = Join-Path $projectRoot ".mcp.json.windows"
$targetConfig = Join-Path $projectRoot ".mcp.json"

if (Test-Path $windowsConfig) {
    Copy-Item $windowsConfig $targetConfig -Force
    Write-Host "✅ .mcp.json を Windows用設定に更新しました" -ForegroundColor Green
} else {
    Write-Host "❌ .mcp.json.windows が見つかりません" -ForegroundColor Red
    exit 1
}

# 必要なディレクトリを作成
$memoryPath = Join-Path $env:USERPROFILE ".claude-memory"
$databasesPath = Join-Path $env:USERPROFILE ".databases"

if (-not (Test-Path $memoryPath)) {
    New-Item -ItemType Directory -Path $memoryPath -Force | Out-Null
}
if (-not (Test-Path $databasesPath)) {
    New-Item -ItemType Directory -Path $databasesPath -Force | Out-Null
}

Write-Host "✅ 必要なディレクトリを作成しました:" -ForegroundColor Green
Write-Host "   - $memoryPath"
Write-Host "   - $databasesPath"

Write-Host ""
Write-Host "🎉 完了！Claude Codeを再起動してください。" -ForegroundColor Yellow
