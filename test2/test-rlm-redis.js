const { redisQueueService } = require('./services/redis-queue');
const { consumeQueueEvents } = require('./activities/rlm-queue-processor');

/**
 * Test RLM Redis Connection and Queue Access
 */

async function testRLMRedis() {
    console.log('🧪 Testing RLM Redis Connection...\n');
    
    try {
        // Test 1: Direct Redis connection
        console.log('📋 Test 1: Direct Redis Connection');
        await redisQueueService.connect();
        const health = await redisQueueService.healthCheck();
        console.log(`  ✅ Redis health: ${health.status} - ${health.message}`);
        
        const stats = await redisQueueService.getQueueStats();
        console.log(`  📊 Queue stats: ${JSON.stringify(stats)}`);
        
        // Test 2: RLM Activity Redis connection
        console.log('\n📋 Test 2: RLM Activity Redis Connection');
        const queueData = await consumeQueueEvents();
        console.log(`  📥 Consumed events: ${queueData.totalEvents}`);
        console.log(`  📋 Event type counts:`, queueData.eventTypeCounts || {});
        
        if (queueData.totalEvents > 0) {
            console.log(`  ✅ Successfully consumed ${queueData.totalEvents} events from queue`);
        } else {
            console.log(`  ⚠️ No events found in queue`);
        }
        
        console.log('\n✅ RLM Redis test completed successfully!');
        
    } catch (error) {
        console.error('\n❌ RLM Redis test failed:', error);
        process.exit(1);
    } finally {
        await redisQueueService.disconnect();
    }
}

// Run test if this file is executed directly
if (require.main === module) {
    testRLMRedis().catch(error => {
        console.error('❌ Failed to run RLM Redis test:', error);
        process.exit(1);
    });
}

module.exports = {
    testRLMRedis
}; 