@echo off
cd /d %~dp0
set ROS_VER=1
:loop
node backend\server.js
timeout /t 1 /nobreak >nul
goto loop
