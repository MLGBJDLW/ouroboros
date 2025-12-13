@echo off
cd /d "%~dp0..\.."
py .ouroboros/scripts/ouroboros_toggle.py %*
if errorlevel 1 (
    python .ouroboros/scripts/ouroboros_toggle.py %*
    if errorlevel 1 (
        python3 .ouroboros/scripts/ouroboros_toggle.py %*
    )
)
