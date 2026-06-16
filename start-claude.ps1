# ==============================================
# Claude Code 启动脚本 (PowerShell 版)
# 完全避免 cmd 编码问题，直接用 UTF-8
# ==============================================

[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

$ProjectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectDir

Write-Host ""
Write-Host "=============================================="
Write-Host "[OK] Claude Code launcher (Mix-Coding project)" -ForegroundColor Green
Write-Host "=============================================="
Write-Host "Working dir: $ProjectDir"
Write-Host "Commands: /audit /bugfix /feature /review /design /analyze /hunt /optimize /refactor /simplify /ui-polish /new-project /release"
Write-Host "=============================================="
Write-Host ""

# 读取 system prompt（UTF-8 编码）
$PromptFile = Join-Path $ProjectDir ".claude\system-prompt.txt"
if (Test-Path $PromptFile) {
    $PromptContent = Get-Content -Path $PromptFile -Raw -Encoding UTF8
    $env:ANTHROPIC_SYSTEM_PROMPT = $PromptContent
    Write-Host "[INFO] System prompt loaded: $($PromptContent.Length) chars" -ForegroundColor DarkGray
}

# 启动 Claude Code
try {
    claude
} catch {
    Write-Host "[ERROR] Claude Code failed to start: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "Claude Code exited"
Write-Host ""
Read-Host "Press Enter to continue"
