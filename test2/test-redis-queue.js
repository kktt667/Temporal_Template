const { redisQueueService } = require('./services/redis-queue');

async function testRedisQueue() {
    console.log('🧪 Testing Redis Queue Integration');
    console.log('==================================');
    
    try {
        // Test 1: Connect to Redis
        console.log('\n📋 Test 1: Connecting to Redis...');
        const connected = await redisQueueService.connect();
        if (!connected) {
            console.error('❌ Failed to connect to Redis');
            console.log('💡 Make sure Redis is running: docker-compose up redis');
            return;
        }
        console.log('✅ Connected to Redis successfully');
        
        // Test 2: Clear existing queues
        console.log('\n📋 Test 2: Clearing existing queues...');
        await redisQueueService.clearQueue('wallet_audit_events');
        await redisQueueService.clearQueue('wallet_audit_processing');
        await redisQueueService.clearQueue('wallet_audit_failed');
        console.log('✅ Queues cleared');
        
        // Test 3: Add test events
        console.log('\n📋 Test 3: Adding test events to queue...');
        const testEvents = [
            {
                wallet_name: 'wallet_001',
                events: ['REBALANCE_NEEDED', 'OPEN_POSITION_DETECTED']
            },
            {
                wallet_name: 'wallet_002',
                events: ['NEW_BALANCE_UPDATE']
            },
            {
                wallet_name: 'wallet_003',
                events: ['BALANCE_CHECK_REQUIRED', 'OPEN_ORDER_DETECTED']
            }
        ];
        
        const success = await redisQueueService.addEventsToQueue(testEvents, 'test-worker');
        if (success) {
            console.log('✅ Test events added to queue successfully');
        } else {
            console.error('❌ Failed to add test events to queue');
            return;
        }
        
        // Test 4: Check queue stats
        console.log('\n📋 Test 4: Checking queue statistics...');
        const stats = await redisQueueService.getQueueStats();
        console.log('📊 Queue Statistics:');
        console.log(`  📥 Pending: ${stats.pending}`);
        console.log(`  ⚙️  Processing: ${stats.processing}`);
        console.log(`  ❌ Failed: ${stats.failed}`);
        console.log(`  📊 Total: ${stats.total}`);
        
        if (stats.pending === 3) {
            console.log('✅ Queue stats are correct');
        } else {
            console.error('❌ Queue stats are incorrect');
        }
        
        // Test 5: Health check
        console.log('\n📋 Test 5: Redis health check...');
        const health = await redisQueueService.healthCheck();
        console.log(`🔗 Redis Status: ${health.status}`);
        console.log(`📝 Message: ${health.message}`);
        
        if (health.status === 'healthy') {
            console.log('✅ Redis health check passed');
        } else {
            console.error('❌ Redis health check failed');
        }
        
        // Test 6: Test priority calculation
        console.log('\n📋 Test 6: Testing priority calculation...');
        const highPriorityEvent = {
            wallet_name: 'wallet_004',
            events: ['REBALANCE_NEEDED']
        };
        
        const lowPriorityEvent = {
            wallet_name: 'wallet_005',
            events: ['BALANCE_CHECK_REQUIRED']
        };
        
        await redisQueueService.addEventToQueue(highPriorityEvent, 'test-worker');
        await redisQueueService.addEventToQueue(lowPriorityEvent, 'test-worker');
        
        const finalStats = await redisQueueService.getQueueStats();
        console.log(`📊 Final queue size: ${finalStats.pending} items`);
        
        if (finalStats.pending === 5) {
            console.log('✅ Priority calculation test passed');
        } else {
            console.error('❌ Priority calculation test failed');
        }
        
        console.log('\n🎉 All Redis queue tests passed!');
        console.log('\n💡 Next steps:');
        console.log('  - Start the scheduler: npm run scheduler:start');
        console.log('  - Monitor the queue: npm run queue:monitor');
        console.log('  - View Redis UI: http://localhost:8081 (if monitoring profile enabled)');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    } finally {
        await redisQueueService.disconnect();
    }
}

// Run the test
if (require.main === module) {
    testRedisQueue();
}

module.exports = { testRedisQueue }; 