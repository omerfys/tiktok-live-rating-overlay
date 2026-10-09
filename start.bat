@echo off
chcp 65001 >nul
title TikTok Live Rating Overlay
cd /d "%~dp0"

echo ====================================================
echo   TikTok Live Studio 1-10 Puanlama ve Leaderboard
echo ====================================================
echo.
echo Sunucu baslatiliyor...
echo.
echo [1] Kontrol Paneli: http://localhost:3000/admin.html
echo [2] Overlay Ekrani: http://localhost:3000/overlay.html
echo.

start http://localhost:3000/admin.html

node server.js

echo.
echo Sunucu kapandi.
pause
