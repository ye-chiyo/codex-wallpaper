@echo off
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -File "%~dp0Start-CodexWallpaper.ps1" -Launch
set "LAUNCH_RESULT=%ERRORLEVEL%"
echo.
pause
exit /b %LAUNCH_RESULT%
