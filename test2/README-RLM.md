# Rate Limit Manager (RLM) System

## 🎯 Overview

The Rate Limit Manager (RLM) is a Temporal-based system that processes wallet audit events from a Redis queue within a strict 3-minute time window. It dynamically scales workers up and down to ensure all events are processed efficiently while respecting API rate limits.

## 🏗️ Architecture

### Core Components

```
RLM System
├── Workflows
│   └── rate-limit-manager.js          # Main orchestration workflow
├── Activities
│   ├── rlm-queue-processor.js         # Redis queue consumption
│   ├── rlm-worker-manager.js          # Worker scaling (separate from audit system)
│   ├── rlm-task-distributor.js        # Task distribution and planning
│   └── rlm-api-processors.js          # Event processing with overflow APIs
├── Workers
│   └── rlm-worker.js                  # RLM-specific worker
└── Client
    └── rlm-client.js                  # Workflow management client
```

### Event Types & APIs

| Event Type | Processing Time | Rate Limit | Overflow APIs |
|------------|----------------|------------|---------------|
| REBALANCE_NEEDED | 2000ms | 30/min | 3 overflow APIs |
| OPEN_POSITION_DETECTED | 1500ms | 30/min | 3 overflow APIs |
| OPEN_ORDER_DETECTED | 1000ms | 30/min | 3 overflow APIs |
| NEW_BALANCE_UPDATE | 800ms | 30/min | 3 overflow APIs |
| BALANCE_CHECK_REQUIRED | 1200ms | 30/min | 3 overflow APIs |

## 🚀 Key Features

### ✅ **3-Minute Completion Guarantee**
- Pre-calculates required workers to complete within 3 minutes
- Incorporates leftover events from previous runs
- Scales workers dynamically based on processing requirements

### ✅ **Dynamic Worker Scaling**
- Separate worker management from audit system
- Scales up to 20 RLM workers maximum
- Graceful worker shutdown and startup

### ✅ **Overflow API Support**
- Each event type has multiple overflow API endpoints
- Workers automatically use overflow APIs when scaling up
- Maintains rate limits across multiple endpoints

### ✅ **Round-Robin Task Distribution**
- Events distributed evenly across workers
- Round-robin processing within each worker
- Load balancing for optimal performance

### ✅ **Temporal Reliability**
- Built-in retries for failed API calls
- Timeout handling for long-running operations
- Crash recovery and partial result handling

## 📋 Usage

### 1. Start RLM Workflow
```bash
npm run rlm:start
```

### 2. Check Workflow Status
```bash
npm run rlm:status [workflowId]
```

### 3. Get Workflow Results
```bash
npm run rlm:result [workflowId]
```

### 4. List Recent Workflows
```bash
npm run rlm:list [limit]
```

### 5. Cancel Workflow
```bash
npm run rlm:cancel [workflowId]
```

### 6. Start RLM Worker
```bash
npm run rlm:worker:start
```

### 7. Test RLM System
```bash
npm run test:rlm
```

## 🔧 Configuration

### API Processing Times
Edit `activities/rlm-api-processors.js`:
```javascript
const API_PROCESSING_TIMES = {
    'REBALANCE_NEEDED': 2000,        // 2 seconds
    'OPEN_POSITION_DETECTED': 1500,  // 1.5 seconds
    // ... adjust as needed
};
```

### Rate Limits
```javascript
const API_RATE_LIMITS = {
    'REBALANCE_NEEDED': 30,          // 30 calls per minute
    'OPEN_POSITION_DETECTED': 30,    // 30 calls per minute
    // ... adjust as needed
};
```

### Overflow APIs
```javascript
const OVERFLOW_APIS = {
    'REBALANCE_NEEDED': [
        'overflow_rebalance_api_1',
        'overflow_rebalance_api_2',
        'overflow_rebalance_api_3'
    ],
    // ... configure for each event type
};
```

## 🔄 Workflow Process

### Step 1: Queue Consumption
- Consumes all events from Redis queue
- Groups events by type for analysis
- Provides event statistics

### Step 2: Processing Plan Calculation
- Calculates average processing time per event
- Determines required workers for 3-minute completion
- Creates task distribution plan
- Incorporates leftover events from previous runs

### Step 3: Worker Scaling
- Scales workers up/down to meet requirements
- Starts new workers with overflow API support
- Gracefully shuts down excess workers

### Step 4: Task Distribution & Processing
- Distributes events round-robin across workers
- Processes events with appropriate API endpoints
- Handles failures with Temporal retries
- Tracks completion within time limit

### Step 5: Results & Cleanup
- Aggregates processing results
- Reports leftover events for next run
- Provides comprehensive completion statistics

## 📊 Monitoring

### Queue Statistics
```bash
npm run queue:stats
```

### Worker Status
```bash
npm run rlm:status
```

### Workflow History
```bash
npm run rlm:list 10
```

## 🛠️ Development

### Adding New Event Types
1. Add event type to `API_PROCESSING_TIMES`
2. Add rate limit to `API_RATE_LIMITS`
3. Add overflow APIs to `OVERFLOW_APIS`
4. Update processing logic in `rlm-api-processors.js`

### Modifying Worker Scaling
1. Edit `rlm-worker-manager.js`
2. Adjust `maxWorkers` limit
3. Modify scaling logic as needed

### Customizing Task Distribution
1. Edit `createTaskDistribution()` in `rlm-task-distributor.js`
2. Implement custom distribution algorithms
3. Add load balancing logic

## 🔍 Troubleshooting

### Common Issues

**Workflow fails to start:**
- Check Temporal server is running
- Verify Redis connection
- Check worker availability

**Events not processed within 3 minutes:**
- Increase worker count limit
- Reduce API processing times
- Add more overflow APIs

**Worker scaling issues:**
- Check worker manager logs
- Verify worker script paths
- Monitor system resources

### Debug Commands
```bash
# Check Redis health
npm run queue:monitor

# Test RLM system
npm run test:rlm

# Monitor worker status
npm run rlm:status

# View workflow history
npm run rlm:list
```

## 🎯 Integration with Audit System

The RLM system is completely separate from the audit system:
- **Audit System**: Runs every 3 minutes, processes wallets, adds events to Redis queue
- **RLM System**: Processes events from Redis queue within 3 minutes using scaled workers

Both systems can run independently without interference.

## 📈 Performance Optimization

### Scaling Strategies
- **Pre-calculation**: Determine workers needed before starting
- **Overflow APIs**: Use multiple endpoints to increase rate limits
- **Round-robin**: Distribute load evenly across workers
- **Temporal features**: Leverage retries and timeouts for reliability

### Monitoring Metrics
- Events processed per minute
- Worker utilization
- API response times
- Queue processing latency
- Completion time vs. 3-minute target

---

**🎉 The RLM system ensures your wallet audit events are processed efficiently and reliably within the 3-minute window!** 