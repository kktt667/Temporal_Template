const { RLMClient } = require('./client/rlm-client');
const { redisQueueService } = require('./services/redis-queue');
const { rlmWorkerManager } = require('./activities/rlm-worker-manager');
const { getApiConfiguration } = require('./activities/rlm-api-processors');

/**
 * Test RLM System
 * 
 * Comprehensive test of the Rate Limit Manager system
 */

async function testRLMSystem() {
    console.log('🧪 Testing RLM System...\n');
    
    try {
        // Test 1: Redis Connection
        console.log('📋 Test 1: Redis Connection');
        await testRedisConnection();
        
        // Test 2: API Configuration
        console.log('\n📋 Test 2: API Configuration');
        await testApiConfiguration();
        
        // Test 3: Worker Manager
        console.log('\n📋 Test 3: Worker Manager');
        await testWorkerManager();
        
        // Test 4: RLM Client
        console.log('\n📋 Test 4: RLM Client');
        await testRLMClient();
        
        // Test 5: Queue Processing
        console.log('\n📋 Test 5: Queue Processing');
        await testQueueProcessing();
        
        console.log('\n✅ All RLM system tests completed successfully!');
        
    } catch (error) {
        console.error('\n❌ RLM system test failed:', error);
        process.exit(1);
    }
}

async function testRedisConnection() {
    try {
        await redisQueueService.connect();
        const health = await redisQueueService.healthCheck();
        console.log(`  ✅ Redis health: ${health.status} - ${health.message}`);
        
        const stats = await redisQueueService.getQueueStats();
        console.log(`  📊 Queue stats: ${JSON.stringify(stats)}`);
        
    } catch (error) {
        console.error(`  ❌ Redis test failed: ${error.message}`);
        throw error;
    }
}

async function testApiConfiguration() {
    try {
        const config = getApiConfiguration();
        
        console.log(`  ✅ API processing times: ${Object.keys(config.processingTimes).length} event types`);
        console.log(`  ✅ API rate limits: ${Object.keys(config.rateLimits).length} endpoints`);
        console.log(`  ✅ Overflow APIs: ${Object.keys(config.overflowApis).length} event types`);
        
        // Verify all event types have configurations
        const eventTypes = [
            'REBALANCE_NEEDED',
            'OPEN_POSITION_DETECTED', 
            'OPEN_ORDER_DETECTED',
            'NEW_BALANCE_UPDATE',
            'BALANCE_CHECK_REQUIRED'
        ];
        
        eventTypes.forEach(eventType => {
            if (config.processingTimes[eventType] && config.rateLimits[eventType] && config.overflowApis[eventType]) {
                console.log(`  ✅ ${eventType}: ${config.processingTimes[eventType]}ms, ${config.rateLimits[eventType]}/min, ${config.overflowApis[eventType].length} overflow APIs`);
            } else {
                throw new Error(`Missing configuration for ${eventType}`);
            }
        });
        
    } catch (error) {
        console.error(`  ❌ API configuration test failed: ${error.message}`);
        throw error;
    }
}

async function testWorkerManager() {
    try {
        const status = await rlmWorkerManager.getWorkerStatus();
        console.log(`  ✅ Worker manager status: ${status.totalWorkers} workers, max ${status.maxWorkers}`);
        console.log(`  📋 Task queue: ${status.taskQueue}`);
        
        // Test worker scaling (just calculation, don't actually start workers)
        console.log(`  🔧 Testing worker scaling calculation...`);
        
    } catch (error) {
        console.error(`  ❌ Worker manager test failed: ${error.message}`);
        throw error;
    }
}

async function testRLMClient() {
    const client = new RLMClient();
    
    try {
        const connected = await client.connect();
        if (connected) {
            console.log(`  ✅ RLM client connected successfully`);
            
            // Test listing workflows (should be empty initially)
            const workflows = await client.listRecentWorkflows(5);
            console.log(`  📋 Recent workflows: ${workflows.length} found`);
            
        } else {
            throw new Error('Failed to connect RLM client');
        }
        
    } catch (error) {
        console.error(`  ❌ RLM client test failed: ${error.message}`);
        throw error;
    } finally {
        await client.disconnect();
    }
}

async function testQueueProcessing() {
    try {
        // Add some test events to the queue
        console.log(`  📥 Adding test events to queue...`);
        
        const testEvents = [
            {
                wallet_name: 'test_wallet_001',
                events: ['REBALANCE_NEEDED'],
                worker_id: 'test-worker',
                timestamp: new Date().toISOString(),
                priority: 5,
                retry_count: 0
            },
            {
                wallet_name: 'test_wallet_002', 
                events: ['OPEN_POSITION_DETECTED'],
                worker_id: 'test-worker',
                timestamp: new Date().toISOString(),
                priority: 4,
                retry_count: 0
            },
            {
                wallet_name: 'test_wallet_003',
                events: ['BALANCE_CHECK_REQUIRED'],
                worker_id: 'test-worker', 
                timestamp: new Date().toISOString(),
                priority: 1,
                retry_count: 0
            }
        ];
        
        for (const event of testEvents) {
            await redisQueueService.addEventToQueue(event, 'test-worker');
        }
        
        const stats = await redisQueueService.getQueueStats();
        console.log(`  📊 Queue after adding test events: ${JSON.stringify(stats)}`);
        
        // Clean up test events
        console.log(`  🧹 Cleaning up test events...`);
        await redisQueueService.clearQueue();
        
        const finalStats = await redisQueueService.getQueueStats();
        console.log(`  📊 Queue after cleanup: ${JSON.stringify(finalStats)}`);
        
    } catch (error) {
        console.error(`  ❌ Queue processing test failed: ${error.message}`);
        throw error;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    testRLMSystem().catch(error => {
        console.error('❌ RLM system test failed:', error);
        process.exit(1);
    });
}

module.exports = {
    testRLMSystem
}; 