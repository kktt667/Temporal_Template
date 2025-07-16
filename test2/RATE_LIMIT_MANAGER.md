# 🚀 Temporal Rate Limit Manager

A comprehensive rate limiting and dynamic scaling system for processing wallet audit events from Redis queues using Temporal workflows.

## 📋 Overview

The Rate Limit Manager is designed to:
- **Process audit events** from Redis queue with configurable rate limits
- **Dynamically scale workers** based on queue size and time constraints
- **Handle exceptions and overflow** with Temporal's built-in retry mechanisms
- **Complete processing within 3 minutes** before the next scheduled audit
- **Maintain rate limits** of 20 events/minute (1 event every 3 seconds)

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Wallet Audit  │───▶│   Redis Queue    │───▶│ Rate Limit      │
│   Scheduler     │    │   (108 events)   │    │ Manager         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                                         │
                                                         ▼
                                              ┌─────────────────┐
                                              │ Dynamic Worker  │
                                              │ Scaling (1-10)  │
                                              └─────────────────┘
```

## ⚙️ Configuration

### Rate Limits
- **Events per minute**: 20
- **Event processing time**: 10 seconds
- **Target completion time**: 3 minutes
- **Worker scaling range**: 1-10 workers

### Event Types & Processing Times
- `REBALANCE_NEEDED`: 8 seconds
- `OPEN_POSITION_DETECTED`: 6 seconds
- `OPEN_ORDER_DETECTED`: 4 seconds
- `NEW_BALANCE_UPDATE`: 3 seconds
- `BALANCE_CHECK_REQUIRED`: 2 seconds

## 🚀 Quick Start

### 1. Start the Complete System
```bash
npm run rate-limit:system
```

This starts:
- Rate Limit Worker
- Rate Limit Manager Workflow
- System monitoring

### 2. Manual Start (Step by Step)

#### Start Rate Limit Worker
```bash
npm run rate-limit:worker
```

#### Start Rate Limit Manager Workflow
```bash
npm run rate-limit:start
```

## 📊 Monitoring & Management

### Check Queue Status
```bash
npm run queue:stats
```

### Monitor Rate Limit Manager
```bash
# List running workflows
npm run rate-limit:list

# Check workflow status
npm run rate-limit:status <workflowId>

# Get workflow results
npm run rate-limit:result <workflowId>

# Stop workflow
npm run rate-limit:stop <workflowId>
```

### Monitor Redis Queue
```bash
# Monitor queue in real-time
npm run queue:monitor

# Clear all queues
npm run queue:clear
```

## 🔧 How It Works

### 1. Queue Processing
- **FIFO Processing**: Events are processed in First-In-First-Out order
- **Priority Handling**: High-priority events (REBALANCE_NEEDED) are processed first
- **Rate Limiting**: Maximum 20 events per minute across all workers

### 2. Dynamic Worker Scaling
The system calculates optimal worker count based on:
```
Optimal Workers = min(
    Required Workers (based on queue size),
    Rate Limited Workers (based on rate limit),
    Max Workers (10)
)
```

**Calculation Example:**
- Queue has 108 events
- Target: Complete in 3 minutes
- Rate limit: 20 events/minute
- Processing time: 10 seconds per event

**Required Workers:**
- Events per worker per minute = 60/10 = 6
- Required workers = 108 / (6 × 3) = 6 workers

**Rate Limited Workers:**
- Max events in 3 minutes = 20 × 3 = 60
- Rate limited workers = 60 / (6 × 3) = 3.33 → 4 workers

**Result:** 4 workers (minimum of required and rate-limited)

### 3. Exception Handling
- **API Failures**: 5% failure rate simulation
- **Slow Responses**: 10% chance of 2x processing time
- **Retry Logic**: Failed events moved to failed queue
- **Graceful Degradation**: System continues processing other events

### 4. Overflow Management
- **Emergency Scaling**: If approaching time limit, scale up aggressively
- **Worker Cleanup**: Scale down to minimum workers when queue is empty
- **Temporal Retries**: Built-in retry mechanisms for transient failures

## 📁 File Structure

```
test2/
├── workflows/
│   └── rate-limit-manager.js          # Main workflow logic
├── activities/
│   └── rate-limit-activities.js       # Activity implementations
├── workers/
│   └── rate-limit-worker.js           # Worker process
├── client/
│   └── rate-limit-client.js           # Client for workflow management
├── services/
│   └── redis-queue.js                 # Enhanced Redis queue service
├── start-rate-limit-system.js         # Complete system startup
└── RATE_LIMIT_MANAGER.md              # This documentation
```

## 🔍 Key Features

### ✅ Rate Limiting
- Configurable events per minute
- Per-worker rate limiting
- Global rate limit enforcement

### ✅ Dynamic Scaling
- Automatic worker scaling based on queue size
- Time-based scaling (emergency mode)
- Graceful scale-down when queue is empty

### ✅ Exception Handling
- API failure simulation
- Slow response handling
- Retry mechanisms
- Failed event queue

### ✅ Monitoring
- Real-time queue statistics
- Workflow status monitoring
- Performance metrics
- Health checks

### ✅ Temporal Integration
- Built-in retry policies
- Workflow timeouts
- Activity timeouts
- Graceful shutdown

## 🎯 Performance Characteristics

### Processing Capacity
- **Normal Mode**: 20 events/minute
- **Emergency Mode**: Up to 60 events/minute (with scaling)
- **Worker Efficiency**: 1:1 worker-to-activity ratio

### Scaling Behavior
- **Minimum Workers**: 1
- **Maximum Workers**: 10
- **Scaling Threshold**: Queue size > 0
- **Emergency Threshold**: Time limit approaching

### Queue Management
- **Processing Queue**: Events currently being processed
- **Failed Queue**: Events that failed processing
- **Retry Logic**: Up to 3 retries for failed events

## 🛠️ Troubleshooting

### Common Issues

1. **Worker Not Starting**
   - Check Temporal server is running
   - Verify Redis connection
   - Check task queue configuration

2. **Queue Not Processing**
   - Verify events are in Redis queue
   - Check worker is connected to correct task queue
   - Monitor workflow status

3. **Rate Limiting Issues**
   - Check rate limit configuration
   - Monitor worker scaling
   - Verify processing times

### Debug Commands
```bash
# Check Redis connection
npm run test:redis

# Monitor queue in real-time
npm run queue:monitor

# Check workflow status
npm run rate-limit:list
```

## 🔮 Future Enhancements

1. **Advanced Scaling Algorithms**
   - Machine learning-based scaling
   - Historical performance analysis
   - Predictive scaling

2. **Enhanced Monitoring**
   - Prometheus metrics
   - Grafana dashboards
   - Alerting system

3. **Queue Optimization**
   - Priority queuing
   - Dead letter queues
   - Event batching

4. **API Integration**
   - Real API endpoints
   - Authentication
   - Rate limit headers

## 📈 Performance Metrics

The system is designed to handle:
- **Peak Load**: 108 events in 3 minutes
- **Normal Load**: 20 events per minute
- **Worker Utilization**: 100% during processing
- **Failure Rate**: < 5% (configurable)
- **Recovery Time**: < 30 seconds

## 🎉 Success Criteria

The Rate Limit Manager is successful when:
- ✅ All events processed within 3 minutes
- ✅ Rate limits maintained
- ✅ Workers scale appropriately
- ✅ Exceptions handled gracefully
- ✅ System remains stable under load 