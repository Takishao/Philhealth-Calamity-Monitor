@echo off
setlocal
pushd "%~dp0philhealth"
if errorlevel 1 (
  echo Could not open the philhealth application folder.
  pause
  exit /b 1
)

where node >nul 2>&1
if errorlevel 1 goto :missing_node
where npm.cmd >nul 2>&1
if errorlevel 1 goto :missing_node
node -e "const [major,minor]=process.versions.node.split('.').map(Number);process.exit(major>22||(major===22&&minor>=9)?0:1)"
if errorlevel 1 goto :missing_node

if not exist node_modules goto :install
rem Reinstall native modules if this folder was copied from macOS or Linux.
node -e "require('better-sqlite3')(':memory:').close();require('argon2')" >nul 2>&1
if errorlevel 1 goto :install
goto :run

:install
echo Installing locked dependencies for this Windows computer...
call npm.cmd ci
if errorlevel 1 goto :failed

:run
echo Starting PhilHealth Calamity Monitor...
echo Keep this window open. After startup, visit http://localhost:3000
call npm.cmd start
if errorlevel 1 goto :failed
popd
endlocal
exit /b 0

:missing_node
echo Install Node.js 22.9 or newer with npm, then reopen this starter.
goto :failed

:failed
echo Startup failed. Review the error above and the Windows instructions in README.md.
pause
popd
endlocal
exit /b 1
