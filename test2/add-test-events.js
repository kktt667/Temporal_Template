const { redisQueueService } = require('./services/redis-queue');

/**
 * Add test events to Redis queue for RLM testing
 */

async function addTestEvents() {
    console.log('📥 Adding test events to Redis queue...\n');
    
    try {
        await redisQueueService.connect();
        
        // Create test events
        const testEvents = [];
        const eventTypes = [
            'REBALANCE_NEEDED',
            'OPEN_POSITION_DETECTED', 
            'OPEN_ORDER_DETECTED',
            'NEW_BALANCE_UPDATE',
            'BALANCE_CHECK_REQUIRED'
        ];
        
        // Add 50 test events
        for (let i = 1; i <= 50; i++) {
            const eventType = eventTypes[i % eventTypes.length];
            const event = {
                id: `test-${Date.now()}-${i}`,
                wallet_name: `test_wallet_${i.toString().padStart(3, '0')}`,
                events: [eventType],
                worker_id: 'test-worker',
                timestamp: new Date().toISOString(),
                priority: Math.floor(Math.random() * 5) + 1,
                retry_count: 0
            };
            
            await redisQueueService.addEventToQueue(event, 'test-worker');
            testEvents.push(event);
            
            if (i % 10 === 0) {
                console.log(`  📥 Added ${i}/50 test events`);
            }
        }
        
        const stats = await redisQueueService.getQueueStats();
        console.log(`\n✅ Successfully added ${testEvents.length} test events to queue`);
        console.log(`📊 Queue stats: ${JSON.stringify(stats)}`);
        
    } catch (error) {
        console.error('❌ Failed to add test events:', error);
        process.exit(1);
    } finally {
        await redisQueueService.disconnect();
    }
}

// Run if this file is executed directly
if (require.main === module) {
    addTestEvents().catch(error => {
        console.error('❌ Failed to add test events:', error);
        process.exit(1);
    });
}

module.exports = {
    addTestEvents
}; 