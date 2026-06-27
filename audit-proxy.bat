@echo off
setlocal enabledelayedexpansion

echo.
echo ================================================
echo   LLM Proxy Injection Audit - Single-Endpoint
echo ================================================
echo.

:: ---- Collect params ----
set /p BASE_URL="Proxy base URL (e.g. https://api.anthropic.com or https://newapi.v2.wobuqu.icu): "
if "%BASE_URL%"=="" (
    echo [ERROR] Base URL is required
    pause
    exit /b 1
)

set /p PROXY_KEY="Proxy API Key: "
if "%PROXY_KEY%"=="" (
    echo [ERROR] API Key is required
    pause
    exit /b 1
)

set /p PROXY_MODEL="Model [claude-sonnet-4-6]: "
if "%PROXY_MODEL%"=="" set PROXY_MODEL=claude-sonnet-4-6

echo.
echo   Select provider:
echo     [1] anthropic
echo     [2] openai    (new-api / one-api gateways)
set /p PROVIDER_CHOICE="  Enter 1 or 2 [1]: "
if "%PROVIDER_CHOICE%"=="2" (set PROXY_PROVIDER=openai) else (set PROXY_PROVIDER=anthropic)

:: ---- Strip trailing slash, then append path ----
set _URL=%BASE_URL%
if "%_URL:~-1%"=="/" set _URL=%_URL:~0,-1%

if "%PROXY_PROVIDER%"=="openai" (
    set PROXY_URL=%_URL%/v1/chat/completions
) else (
    set PROXY_URL=%_URL%/v1/messages
)

echo.
echo ---- Audit Config ----
echo   Base URL:  %BASE_URL%
echo   Full endpoint: %PROXY_URL%
echo   Model:     %PROXY_MODEL%
echo   Provider:  %PROXY_PROVIDER%
echo   Honeytools: 5
echo   Test prompts: 3
echo.

set /p CONFIRM="Start audit? [Y/n]: "
if /i not "%CONFIRM%"=="Y" if /i not "%CONFIRM%"=="" (
    echo Cancelled.
    pause
    exit /b 0
)

echo.
echo Running audit... (may take 1-2 minutes)
echo.

:: ---- Run ----
cd /d "%~dp0claude-scene"
node src/scripts/audit-proxy.js

echo.
pause
