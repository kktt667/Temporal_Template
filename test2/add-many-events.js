const { redisQueueService } = require('./services/redis-queue');

/**
 * Add many test events to Redis queue to force RLM scaling
 */

async function addManyEvents() {
    console.log('📥 Adding many test events to Redis queue to force scaling...\n');
    
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
        
        // Add 200 test events to force scaling
        for (let i = 1; i <= 200; i++) {
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
            
            if (i % 50 === 0) {
                console.log(`  📥 Added ${i}/200 test events`);
            }
        }
        
        const stats = await redisQueueService.getQueueStats();
        console.log(`\n✅ Successfully added ${testEvents.length} test events to queue`);
        console.log(`📊 Queue stats: ${JSON.stringify(stats)}`);
        
        // Calculate expected workers needed
        const avgProcessingTime = 1300; // ms per event
        const maxDuration = 3 * 60 * 1000; // 3 minutes
        const requiredWorkers = Math.ceil((200 * avgProcessingTime) / maxDuration);
        console.log(`🧮 Expected workers needed: ${requiredWorkers} (200 events × ${avgProcessingTime}ms ÷ ${maxDuration}ms)`);
        
    } catch (error) {
        console.error('❌ Failed to add test events:', error);
        process.exit(1);
    } finally {
        await redisQueueService.disconnect();
    }
}

// Run if this file is executed directly
if (require.main === module) {
    addManyEvents().catch(error => {
        console.error('❌ Failed to add test events:', error);
        process.exit(1);
    });
}

module.exports = {
    addManyEvents
}; 