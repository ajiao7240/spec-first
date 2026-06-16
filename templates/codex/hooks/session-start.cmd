@echo off
setlocal
"__CODEX_SESSION_START_NODE__" "%~dp0session-start"
exit /b %ERRORLEVEL%
