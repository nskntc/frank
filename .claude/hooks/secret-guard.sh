#!/usr/bin/env bash
# PreToolUse hook (Bash|PowerShell): barra `git commit` com segredo no diff.
# A logica esta em secret-guard.js; este wrapper existe porque o harness, no Windows,
# prepende `bash ` ao command do hook (ver memoria reference_claude_hooks_windows).
exec node "$(dirname "$0")/secret-guard.js"
