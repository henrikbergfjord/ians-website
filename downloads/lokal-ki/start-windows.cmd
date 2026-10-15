@echo off
cd /d "%~dp0"
where py >nul 2>nul
if errorlevel 1 (
 echo Install Python 3.10+ from https://www.python.org/downloads/ first.
 exit /b 1
)
py -3 ians_chat.py %*
