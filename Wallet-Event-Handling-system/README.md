# Temporal Wallet Processing System

A scalable Temporal workflow system for processing wallet data with automated scheduling and dynamic worker scaling.

## Features

- **Automated Scheduling**: Runs wallet audits every 3 minutes
- **Dynamic Scaling**: Scale workers up or down without restarting
- **1:1 Worker-to-Activity Model**: Each worker handles exactly one activity
- **Graceful Shutdown**: Proper worker lifecycle management
- **Process Discovery**: Automatically manages workers across sessions

## Quick Start

### 1. Setup

```bash
# Install dependencies
npm install

# Start Temporal server (if not running)
temporal server start-dev
```

### 2. Start the Scheduler

```bash
# Start with 4 workers (runs every 3 minutes)
npm run scheduler:start
```

### 3. Manage the System

```bash
# Check status
npm run scheduler:status

# Scale workers
npm run scheduler:scale 6
npm run scheduler:scale 8

# Pause/Resume
npm run scheduler:pause
npm run scheduler:resume

# Trigger immediate run
npm run scheduler:trigger

# Stop everything
npm run scheduler:stop
```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run scheduler:start` | Start scheduler with 4 workers |
| `npm run scheduler:scale <N>` | Scale to N workers |
| `npm run scheduler:status` | Check schedule status |
| `npm run scheduler:pause` | Pause schedule |
| `npm run scheduler:resume` | Resume schedule |
| `npm run scheduler:trigger` | Trigger immediate run |
| `npm run scheduler:stop` | Stop schedule and workers |
| `npm run scheduler:list` | List all schedules |

## How It Works

- **Schedule**: Runs every 3 minutes automatically
- **Workers**: Each worker processes ~50 wallets (200 total / N workers)
- **Scaling**: Change worker count dynamically without downtime
- **Overlap Protection**: Prevents multiple simultaneous runs
- **Database**: SQLite with 200 wallet records

## Example Output

```
✅ Scheduled wallet audit system started successfully!
📅 Next Run: 2025-06-24T20:45:00.000Z
👥 Current Workers: 4
🔄 Overlap Policy: SKIP

[Worker 1] Processing wallets 1 to 50
[Worker 2] Processing wallets 51 to 100
[Worker 3] Processing wallets 101 to 150
[Worker 4] Processing wallets 151 to 200

🎉 === PROCESSING COMPLETE ===
💼 Total wallets processed: 200
📊 Total events found: 108
```

## Troubleshooting

### Workers Not Stopping
```bash
npm run scheduler:stop
```

### Check Status
```bash
npm run scheduler:status
```

### Force Restart
```bash
npm run scheduler:stop
npm run scheduler:start
```

## Project Structure

```
test2/
├── client/
│   └── scheduled-wallet-client.js    # Main scheduler
├── workers/
│   └── wallet-worker.js              # Worker implementation
├── workflows/
│   └── wallet-workflow.js            # Workflow definition
├── activities/
│   └── wallet-activities.js          # Activity implementations
├── database/
│   └── wallet_data.db                # SQLite database
└── package.json                      # Dependencies and scripts
```

## Dependencies

- `@temporalio/client`: Temporal client library
- `@temporalio/worker`: Temporal worker library
- `@temporalio/workflow`: Temporal workflow library
- `@temporalio/activity`: Temporal activity library
- `sqlite3`: Database operations 