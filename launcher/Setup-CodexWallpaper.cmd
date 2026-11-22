@echo off
setlocal
pushd "%~dp0.." || exit /b 1

node.exe --no-use-env-proxy -e "process.exit(Number(process.versions.node.split('.')[0]) >= 24 ? 0 : 1)" >nul 2>&1
if errorlevel 1 (
    echo Install Windows x64 Node.js 24 or newer and reopen this setup.
    goto failed
)

call npm.cmd exec --yes --package=pnpm@11.25.0 -- pnpm install --frozen-lockfile --prod --ignore-scripts
if errorlevel 1 goto failed
if not exist "node_modules\webwallgl\webwallgl.global.min.js" goto failed

echo.
echo Setup complete. Run Codex-Wallpaper.cmd from the launcher folder.
popd
pause
exit /b 0

:failed
echo.
echo Setup could not install the wallpaper runtime. See the repository README.
popd
pause
exit /b 1
