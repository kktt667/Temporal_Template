#!/bin/bash

echo "Starting multiple Temporal workers for parallel processing..."
echo

echo "Starting Worker 1..."
node workers/wallet-worker.js 1 &
WORKER1_PID=$!

echo "Starting Worker 2..."
node workers/wallet-worker.js 2 &
WORKER2_PID=$!

echo "Starting Worker 3..."
node workers/wallet-worker.js 3 &
WORKER3_PID=$!

echo "Starting Worker 4..."
node workers/wallet-worker.js 4 &
WORKER4_PID=$!

echo
echo "All 4 workers started!"
echo "Worker PIDs: $WORKER1_PID, $WORKER2_PID, $WORKER3_PID, $WORKER4_PID"
echo "You can now run the client to start the workflow."
echo
echo "Press Ctrl+C to stop all workers"
echo

# Function to cleanup workers on exit
cleanup() {
    echo "Stopping all workers..."
    kill $WORKER1_PID $WORKER2_PID $WORKER3_PID $WORKER4_PID 2>/dev/null
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Wait for all workers
wait 