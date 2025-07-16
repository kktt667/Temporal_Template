/**
 * RLM API Processors
 * 
 * Handles processing of different event types with:
 * - Configurable processing time (simulating API calls)
 * - Overflow API support for scaling
 * - Rate limiting per API endpoint
 */

// API processing time configuration (in milliseconds)
const API_PROCESSING_TIMES = {
    'REBALANCE_NEEDED': 2000,        // 2 seconds
    'OPEN_POSITION_DETECTED': 1500,  // 1.5 seconds
    'OPEN_ORDER_DETECTED': 1000,     // 1 second
    'NEW_BALANCE_UPDATE': 800,       // 0.8 seconds
    'BALANCE_CHECK_REQUIRED': 1200   // 1.2 seconds
};

// Rate limits per API endpoint (calls per minute)
const API_RATE_LIMITS = {
    'REBALANCE_NEEDED': 30,
    'OPEN_POSITION_DETECTED': 30,
    'OPEN_ORDER_DETECTED': 30,
    'NEW_BALANCE_UPDATE': 30,
    'BALANCE_CHECK_REQUIRED': 30
};

// Overflow API endpoints for scaling
const OVERFLOW_APIS = {
    'REBALANCE_NEEDED': [
        'overflow_rebalance_api_1',
        'overflow_rebalance_api_2',
        'overflow_rebalance_api_3'
    ],
    'OPEN_POSITION_DETECTED': [
        'overflow_open_position_api_1',
        'overflow_open_position_api_2',
        'overflow_open_position_api_3'
    ],
    'OPEN_ORDER_DETECTED': [
        'overflow_open_order_api_1',
        'overflow_open_order_api_2',
        'overflow_open_order_api_3'
    ],
    'NEW_BALANCE_UPDATE': [
        'overflow_balance_update_api_1',
        'overflow_balance_update_api_2',
        'overflow_balance_update_api_3'
    ],
    'BALANCE_CHECK_REQUIRED': [
        'overflow_balance_check_api_1',
        'overflow_balance_check_api_2',
        'overflow_balance_check_api_3'
    ]
};

/**
 * Process a single event with specified API endpoint
 */
async function processEvent(event, workerId, apiEndpoint = null) {
    const eventType = event.events[0]; // Process first event type
    const walletName = event.wallet_name;
    
    console.log(`🔧 [Worker ${workerId}] Processing ${eventType} for ${walletName} using ${apiEndpoint || 'default API'}`);
    
    try {
        // Simulate API call with configurable processing time
        const processingTime = API_PROCESSING_TIMES[eventType] || 1000;
        
        console.log(`⏱️ [Worker ${workerId}] ${walletName}: Processing for ${processingTime}ms...`);
        
        // Simulate API processing time
        await new Promise(resolve => setTimeout(resolve, processingTime));
        
        // Simulate API response
        const result = {
            success: true,
            wallet_name: walletName,
            event_type: eventType,
            api_endpoint: apiEndpoint || `default_${eventType.toLowerCase()}_api`,
            processing_time: processingTime,
            timestamp: new Date().toISOString(),
            worker_id: workerId
        };
        
        console.log(`✅ [Worker ${workerId}] ${walletName}: ${eventType} processed successfully`);
        
        return result;
        
    } catch (error) {
        console.error(`❌ [Worker ${workerId}] ${walletName}: ${eventType} processing failed:`, error);
        
        return {
            success: false,
            wallet_name: walletName,
            event_type: eventType,
            api_endpoint: apiEndpoint || `default_${eventType.toLowerCase()}_api`,
            error: error.message,
            timestamp: new Date().toISOString(),
            worker_id: workerId
        };
    }
}

/**
 * Process multiple events for a specific event type
 */
async function processEventType(events, eventType, workerId, apiEndpoint = null) {
    console.log(`🎯 [Worker ${workerId}] Processing ${events.length} ${eventType} events...`);
    
    const results = [];
    const processingTime = API_PROCESSING_TIMES[eventType] || 1000;
    
    for (let i = 0; i < events.length; i++) {
        const event = events[i];
        const result = await processEvent(event, workerId, apiEndpoint);
        results.push(result);
        
        // Log progress
        if ((i + 1) % 5 === 0) {
            console.log(`📊 [Worker ${workerId}] ${eventType}: ${i + 1}/${events.length} completed`);
        }
    }
    
    console.log(`✅ [Worker ${workerId}] Completed ${results.length} ${eventType} events`);
    
    return {
        eventType: eventType,
        totalEvents: events.length,
        successfulEvents: results.filter(r => r.success).length,
        failedEvents: results.filter(r => !r.success).length,
        results: results,
        workerId: workerId,
        apiEndpoint: apiEndpoint
    };
}

/**
 * Get overflow API endpoint for scaling
 */
function getOverflowApiEndpoint(eventType, workerIndex) {
    const overflowApis = OVERFLOW_APIS[eventType] || [];
    const apiIndex = (workerIndex - 1) % overflowApis.length; // -1 because worker 1 uses first overflow API
    
    if (apiIndex < overflowApis.length) {
        return overflowApis[apiIndex];
    }
    
    return null; // No overflow API available
}

/**
 * Process events with round-robin distribution within worker
 */
async function processEventsRoundRobin(events, workerId, maxConcurrent = 5) {
    console.log(`🔄 [Worker ${workerId}] Processing ${events.length} events with round-robin distribution`);
    
    const results = [];
    const eventTypes = [...new Set(events.flatMap(e => e.events))];
    
    // Group events by type
    const eventsByType = {};
    eventTypes.forEach(type => {
        eventsByType[type] = events.filter(e => e.events.includes(type));
    });
    
    // Process events round-robin style
    let currentIndex = 0;
    const maxEvents = Math.max(...Object.values(eventsByType).map(e => e.length));
    
    for (let i = 0; i < maxEvents; i++) {
        const promises = [];
        
        // Process one event of each type in round-robin
        eventTypes.forEach(eventType => {
            const typeEvents = eventsByType[eventType];
            if (i < typeEvents.length) {
                const event = typeEvents[i];
                const apiEndpoint = getOverflowApiEndpoint(eventType, workerId);
                promises.push(processEvent(event, workerId, apiEndpoint));
            }
        });
        
        // Wait for current batch to complete
        if (promises.length > 0) {
            const batchResults = await Promise.all(promises);
            results.push(...batchResults);
        }
    }
    
    console.log(`✅ [Worker ${workerId}] Round-robin processing completed: ${results.length} events`);
    
    return {
        totalEvents: results.length,
        successfulEvents: results.filter(r => r.success).length,
        failedEvents: results.filter(r => !r.success).length,
        results: results,
        workerId: workerId
    };
}

/**
 * Get API configuration for planning
 */
function getApiConfiguration() {
    return {
        processingTimes: API_PROCESSING_TIMES,
        rateLimits: API_RATE_LIMITS,
        overflowApis: OVERFLOW_APIS
    };
}

module.exports = {
    processEvent,
    processEventType,
    processEventsRoundRobin,
    getOverflowApiEndpoint,
    getApiConfiguration,
    API_PROCESSING_TIMES,
    API_RATE_LIMITS,
    OVERFLOW_APIS
}; 