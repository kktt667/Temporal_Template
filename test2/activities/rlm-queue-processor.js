const { redisQueueService } = require('../services/redis-queue');

/**
 * Consume events from Redis queue for processing
 * Returns all events in the queue along with statistics
 */
async function consumeQueueEvents() {
    console.log('📥 [RLM] Consuming events from Redis queue...');
    
    try {
        // Ensure Redis is connected
        if (!redisQueueService.isConnected) {
            console.log('🔌 [RLM] Connecting to Redis...');
            await redisQueueService.connect();
        }
        
        // Get queue statistics
        const stats = await redisQueueService.getQueueStats();
        console.log(`📊 [RLM] Queue stats: ${JSON.stringify(stats)}`);
        
        if (stats.pending === 0) {
            console.log('✅ [RLM] No events in queue');
            return {
                events: [],
                totalEvents: 0,
                leftoverEvents: 0
            };
        }
        
        // Consume all events from the queue
        const events = [];
        let eventCount = 0;
        const maxEvents = stats.pending; // Process all pending events
        
        console.log(`🔄 [RLM] Consuming ${maxEvents} events from queue...`);
        
        while (eventCount < maxEvents) {
            try {
                // Pop event from queue (FIFO - first in, first out)
                const eventData = await redisQueueService.client.rPop(redisQueueService.queueName);
                
                if (!eventData) {
                    console.log('📭 [RLM] No more events in queue');
                    break;
                }
                
                const event = JSON.parse(eventData);
                events.push(event);
                eventCount++;
                
                if (eventCount % 10 === 0) {
                    console.log(`📥 [RLM] Consumed ${eventCount}/${maxEvents} events`);
                }
                
            } catch (error) {
                console.error(`❌ [RLM] Error consuming event ${eventCount + 1}:`, error);
                // Continue processing other events
                eventCount++;
            }
        }
        
        console.log(`✅ [RLM] Successfully consumed ${events.length} events from queue`);
        
        // Group events by type for processing analysis
        const eventTypeCounts = {};
        events.forEach(event => {
            event.events.forEach(eventType => {
                eventTypeCounts[eventType] = (eventTypeCounts[eventType] || 0) + 1;
            });
        });
        
        console.log(`📋 [RLM] Event type distribution:`, eventTypeCounts);
        
        return {
            events: events,
            totalEvents: events.length,
            eventTypeCounts: eventTypeCounts,
            leftoverEvents: 0 // Will be updated by previous run results
        };
        
    } catch (error) {
        console.error('❌ [RLM] Failed to consume queue events:', error);
        throw new Error(`Queue consumption failed: ${error.message}`);
    }
}

/**
 * Get partial results in case of workflow failure
 */
async function getPartialResults() {
    try {
        // Ensure Redis is connected
        if (!redisQueueService.isConnected) {
            await redisQueueService.connect();
        }
        
        const stats = await redisQueueService.getQueueStats();
        return {
            queueStats: stats,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('❌ [RLM] Failed to get partial results:', error);
        return {
            error: error.message,
            timestamp: new Date().toISOString()
        };
    }
}

module.exports = {
    consumeQueueEvents,
    getPartialResults
}; 