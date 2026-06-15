@echo off
chcp 65001 >nul
title HLS Loop Player

echo.
echo  正在啟動 HLS Loop Player...
echo.

:: 檢查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
  echo  [錯誤] 找不到 Node.js
  echo.
  echo  請先安裝 Node.js：https://nodejs.org
  echo.
  pause
  exit /b 1
)

:: 啟動 server 並自動開啟瀏覽器
start "" "http://localhost:3000"
node server.js

pause
