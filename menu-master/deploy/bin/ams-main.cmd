@echo off
setlocal
node "%~dp0ams-main.mjs" %*
endlocal & exit /b %ERRORLEVEL%
