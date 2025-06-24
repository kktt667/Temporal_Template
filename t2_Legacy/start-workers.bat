@echo off
echo Starting 8 Temporal workers for parallel processing...
echo.

echo Starting Worker 1...
start "Worker 1" cmd /k "node workers/wallet-worker.js 1"

echo Starting Worker 2...
start "Worker 2" cmd /k "node workers/wallet-worker.js 2"

echo Starting Worker 3...
start "Worker 3" cmd /k "node workers/wallet-worker.js 3"

echo Starting Worker 4...
start "Worker 4" cmd /k "node workers/wallet-worker.js 4"

echo Starting Worker 5...
start "Worker 5" cmd /k "node workers/wallet-worker.js 5"

echo Starting Worker 6...
start "Worker 6" cmd /k "node workers/wallet-worker.js 6"

echo Starting Worker 7...
start "Worker 7" cmd /k "node workers/wallet-worker.js 7"

echo Starting Worker 8...
start "Worker 8" cmd /k "node workers/wallet-worker.js 8"

echo.
echo All 8 workers started! Each worker is running in its own window.
echo You can now run the client to start the workflow.
echo.
pause