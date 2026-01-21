@echo off
cd /d "%~dp0"
git add app.js
git commit -m "Fix: Make app work without Firebase"
git push origin main
pause
