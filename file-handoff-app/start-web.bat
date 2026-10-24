@echo off
setlocal
cd /d "%~dp0"

echo Checking Flutter...
where flutter >nul 2>nul
if errorlevel 1 (
  echo Flutter not found in PATH.
  pause
  exit /b 1
)

echo Enabling web support...
call flutter config --enable-web >nul

echo Getting dependencies...
call flutter pub get
if errorlevel 1 (
  echo Pub get failed.
  pause
  exit /b 1
)

echo Starting web app in Chrome...
call flutter run -d chrome --web-port 8080

endlocal