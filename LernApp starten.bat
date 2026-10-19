@echo off
title LernApp VF11
cd /d "%~dp0"
where node >nul 2>nul
if %errorlevel%==0 (
  node server.js
  goto :eof
)
if exist "%USERPROFILE%\node.exe" (
  "%USERPROFILE%\node.exe" server.js
  goto :eof
)
where python >nul 2>nul
if %errorlevel%==0 (
  start "" http://localhost:5180
  python -m http.server 5180 --bind 127.0.0.1
  goto :eof
)
echo Weder Node.js noch Python gefunden. Bitte Node.js installieren: https://nodejs.org
pause
