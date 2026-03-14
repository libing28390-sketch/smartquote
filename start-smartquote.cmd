@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\windows\start-smartquote.ps1"
set EXITCODE=%ERRORLEVEL%
echo.
if not "%EXITCODE%"=="0" (
  echo 启动失败，请检查上面的提示。
) else (
  echo 启动完成。
)
echo.
pause
exit /b %EXITCODE%