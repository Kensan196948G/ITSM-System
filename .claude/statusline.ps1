# Claude Code Statusline - ITSM-System Edition
# Windows PowerShell版 - 3行表示（プログレスバー付き）

# UTF-8エンコーディング設定
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'

# 絵文字定義
$E = @{
    Dir = [System.Char]::ConvertFromUtf32(0x1F4C1)      # 📁
    Git = [System.Char]::ConvertFromUtf32(0x1F33F)      # 🌿
    AI = [System.Char]::ConvertFromUtf32(0x1F916)       # 🤖
    Brain = [System.Char]::ConvertFromUtf32(0x1F9E0)    # 🧠
    Time = [System.Char]::ConvertFromUtf32(0x23F1)      # ⏱
    Chart = [System.Char]::ConvertFromUtf32(0x1F4CA)    # 📊
    Money = [System.Char]::ConvertFromUtf32(0x1F4B0)    # 💰
    Check = [System.Char]::ConvertFromUtf32(0x2705)     # ✅
    Bar = [System.Char]::ConvertFromUtf32(0x25A0)       # ■
    Server = [System.Char]::ConvertFromUtf32(0x1F5A5)   # 🖥
}

# 標準入力からJSONを読み取る（$inputは予約語なので$jsonInputを使用）
$jsonInput = @()
while ($null -ne ($line = [Console]::In.ReadLine())) {
    $jsonInput += $line
}
$jsonString = $jsonInput -join "`n"

$session = $null
try {
    if ($jsonString) {
        $session = $jsonString | ConvertFrom-Json -ErrorAction Stop
    }
} catch {
    # JSONパース失敗時はエラー情報を出力（デバッグ用）
    # Write-Output "⚠ JSON parse error: $_"
    # デフォルト値で続行
}

# ディレクトリパス短縮
function Get-ShortPath {
    param([string]$Path)
    if (-not $Path) { return "Unknown" }

    $home = $env:USERPROFILE
    if ($Path.StartsWith($home)) {
        $Path = "~" + $Path.Substring($home.Length)
    }

    # 最後のディレクトリ名のみ取得
    $dirName = Split-Path -Leaf $Path
    if (-not $dirName) { $dirName = $Path }

    return $dirName
}

# Git情報取得
function Get-GitInfo {
    try {
        $branch = git branch --show-current 2>$null
        if (-not $branch) { return $null }

        $status = git status --porcelain 2>$null
        $m = ($status | Where-Object { $_ -match '^ ?M' }).Count
        $a = ($status | Where-Object { $_ -match '^A' }).Count
        $u = ($status | Where-Object { $_ -match '^\?\?' }).Count

        $s = ""
        if ($m -gt 0) { $s += "M:$m " }
        if ($a -gt 0) { $s += "A:$a " }
        if ($u -gt 0) { $s += "?:$u " }

        if ($s) { return "$branch [$($s.Trim())]" }
        return $branch
    } catch { return $null }
}

# プログレスバー生成
function Get-ProgressBar {
    param([int]$Percentage, [int]$Width = 10)
    # 1%でも表示されるように調整
    $filled = [math]::Max(0, [math]::Ceiling($Width * $Percentage / 100))
    if ($Percentage -gt 0 -and $filled -eq 0) { $filled = 1 }
    $empty = $Width - $filled
    return "[$($E.Bar * $filled)$('-' * $empty)]"
}

# トークン数フォーマット
function Format-TokenCount {
    param([long]$Count)
    if ($Count -ge 1000000) { return "{0:N1}M" -f ($Count / 1000000) }
    if ($Count -ge 1000) { return "{0:N0}K" -f ($Count / 1000) }
    return "$Count"
}

# セッション時間フォーマット
function Format-Duration {
    param([long]$Milliseconds)
    if (-not $Milliseconds -or $Milliseconds -le 0) { return "0m" }

    $seconds = [math]::Floor($Milliseconds / 1000)
    $minutes = [math]::Floor($seconds / 60)
    $hours = [math]::Floor($minutes / 60)

    if ($hours -gt 0) {
        $m = $minutes % 60
        return "${hours}h ${m}m"
    } elseif ($minutes -gt 0) {
        return "${minutes}m"
    } else {
        return "${seconds}s"
    }
}

# === データ抽出 ===

# モデル名
$modelName = "Unknown"
if ($session.model) {
    if ($session.model.display_name) {
        $modelName = $session.model.display_name
    } elseif ($session.model.id) {
        $modelName = $session.model.id -replace 'claude-', '' -replace '-\d{8}.*', ''
    }
}

# ディレクトリ
$currentDir = "Unknown"
if ($session.workspace -and $session.workspace.current_dir) {
    $currentDir = Get-ShortPath $session.workspace.current_dir
} elseif ($session.cwd) {
    $currentDir = Get-ShortPath $session.cwd
}

# Git情報
$gitInfo = Get-GitInfo

# トークン情報
$inputTokens = 0
$outputTokens = 0
$cacheTokens = 0
$totalTokens = 0
$contextSize = 200000  # デフォルト値

if ($session.context_window) {
    if ($session.context_window.context_window_size) {
        $contextSize = $session.context_window.context_window_size
    }

    if ($session.context_window.current_usage) {
        $usage = $session.context_window.current_usage
        if ($usage.input_tokens) { $inputTokens = $usage.input_tokens }
        if ($usage.output_tokens) { $outputTokens = $usage.output_tokens }
        if ($usage.cache_creation_input_tokens) { $cacheTokens += $usage.cache_creation_input_tokens }
        if ($usage.cache_read_input_tokens) { $cacheTokens += $usage.cache_read_input_tokens }
    }
}

$totalTokens = $inputTokens + $outputTokens
$contextPercentage = 0
if ($contextSize -gt 0 -and $totalTokens -gt 0) {
    $contextPercentage = [math]::Min(100, [math]::Floor(($totalTokens / $contextSize) * 100))
}

# コスト情報
$totalCost = 0.0
if ($session.cost -and $session.cost.total_cost_usd) {
    $totalCost = $session.cost.total_cost_usd
}

# セッション時間
$sessionTime = "0m"
if ($session.cost -and $session.cost.total_duration_ms) {
    $sessionTime = Format-Duration $session.cost.total_duration_ms
}

# === 3行表示生成 ===

# 1行目: ディレクトリ + Git + モデル
$line1 = "$($E.Dir) $currentDir"
if ($gitInfo) {
    $line1 += " $($E.Git) $gitInfo"
}
$line1 += " $($E.AI) $modelName"

# 2行目: コンテキスト使用率 + プログレスバー + セッション時間
$progressBar = Get-ProgressBar -Percentage $contextPercentage -Width 10
$line2 = "$($E.Brain) Context: $contextPercentage% $progressBar $($E.Time) $sessionTime"

# 3行目: トークン情報 + コスト
$tokensUsed = Format-TokenCount $totalTokens
$tokensTotal = Format-TokenCount $contextSize
$line3 = "$($E.Chart) Tokens: $tokensUsed / $tokensTotal ($contextPercentage%)"
$costFormatted = "{0:F4}" -f $totalCost
$line3 += " $($E.Money) `$$costFormatted"

# キャッシュトークンがあれば表示
if ($cacheTokens -gt 0) {
    $cacheFormatted = Format-TokenCount $cacheTokens
    $line3 += " $($E.Check) Cache: $cacheFormatted"
}

# === 出力 ===
Write-Output $line1
Write-Output $line2
Write-Output $line3
