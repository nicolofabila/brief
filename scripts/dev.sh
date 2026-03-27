#!/usr/bin/env bash
# Free port 3000 so `next dev` does not silently move to 3001 (easy to open the wrong tab and think the app is stuck).
set -e

# macOS: raise soft open-file limit (helps EMFILE) without forcing slow polling. If you still see
# EMFILE errors, use `npm run dev:poll` instead of `npm run dev`.
ulimit -n 10240 2>/dev/null || ulimit -n 4096 2>/dev/null || true

pids=$(lsof -tiTCP:3000 -sTCP:LISTEN 2>/dev/null || true)
if [ -n "${pids}" ]; then
  echo "Port 3000 is in use (PID(s): ${pids}). Stopping so this dev server can bind to 3000."
  kill -9 ${pids} 2>/dev/null || true
  sleep 0.3
fi
echo ""
echo "  After “Ready”, the terminal stays quiet until a page is requested."
echo "  Open http://localhost:3000 (home redirects to /feed or /onboarding)."
echo ""
exec next dev -p 3000
