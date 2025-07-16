const { processEventsRoundRobin, getApiConfiguration, API_PROCESSING_TIMES } = require('./rlm-api-processors');
const { rlmWorkerManager } = require('./rlm-worker-manager');

/**
 * Calculate processing plan to complete within time limit
 */
async function calculateProcessingPlan(events, maxDuration, leftoverEvents = 0) {
    console.log('🧮 [RLM] Calculating processing plan...');
    
    const totalEvents = events.length + leftoverEvents;
    console.log(`📊 [RLM] Total events to process: ${totalEvents} (${events.length} new + ${leftoverEvents} leftover)`);
    
    if (totalEvents === 0) {
        return {
            requiredWorkers: 0,
            estimatedTime: 0,
            taskDistribution: [],
            canComplete: true
        };
    }
    
    // Get API configuration
    const apiConfig = getApiConfiguration();
    
    // Calculate average processing time per event
    let totalProcessingTime = 0;
    let eventCount = 0;
    
    events.forEach(event => {
        event.events.forEach(eventType => {
            const processingTime = API_PROCESSING_TIMES[eventType] || 1000;
            totalProcessingTime += processingTime;
            eventCount++;
        });
    });
    
    const avgProcessingTime = eventCount > 0 ? totalProcessingTime / eventCount : 1000;
    console.log(`⏱️ [RLM] Average processing time per event: ${avgProcessingTime}ms`);
    
    // Calculate required workers
    const totalProcessingTimeNeeded = totalEvents * avgProcessingTime;
    const requiredWorkers = Math.ceil(totalProcessingTimeNeeded / maxDuration);
    
    console.log(`📋 [RLM] Processing time needed: ${totalProcessingTimeNeeded}ms`);
    console.log(`📋 [RLM] Available time: ${maxDuration}ms`);
    console.log(`👥 [RLM] Required workers: ${requiredWorkers}`);
    
    // Check if we can complete within time limit
    const canComplete = requiredWorkers <= 20; // Max workers limit
    const estimatedTime = canComplete ? totalProcessingTimeNeeded / requiredWorkers : maxDuration;
    
    // Create task distribution plan
    const taskDistribution = createTaskDistribution(events, requiredWorkers);
    
    console.log(`✅ [RLM] Processing plan calculated: ${requiredWorkers} workers, ${estimatedTime}ms estimated`);
    
    return {
        requiredWorkers: Math.min(requiredWorkers, 20), // Cap at max workers
        estimatedTime: estimatedTime,
        taskDistribution: taskDistribution,
        canComplete: canComplete,
        avgProcessingTime: avgProcessingTime,
        totalEvents: totalEvents
    };
}

/**
 * Create task distribution plan for workers
 */
function createTaskDistribution(events, workerCount) {
    if (workerCount === 0) return [];
    
    console.log(`📋 [RLM] Creating task distribution for ${workerCount} workers...`);
    
    // Group events by type for better distribution
    const eventsByType = {};
    events.forEach(event => {
        event.events.forEach(eventType => {
            if (!eventsByType[eventType]) {
                eventsByType[eventType] = [];
            }
            eventsByType[eventType].push(event);
        });
    });
    
    // Create worker assignments
    const workerAssignments = [];
    for (let i = 0; i < workerCount; i++) {
        workerAssignments.push({
            workerId: i + 1,
            events: [],
            eventTypes: []
        });
    }
    
    // Distribute events round-robin across workers
    let workerIndex = 0;
    Object.entries(eventsByType).forEach(([eventType, typeEvents]) => {
        typeEvents.forEach(event => {
            workerAssignments[workerIndex].events.push(event);
            if (!workerAssignments[workerIndex].eventTypes.includes(eventType)) {
                workerAssignments[workerIndex].eventTypes.push(eventType);
            }
            workerIndex = (workerIndex + 1) % workerCount;
        });
    });
    
    console.log(`📊 [RLM] Task distribution created:`);
    workerAssignments.forEach((assignment, index) => {
        console.log(`  Worker ${index + 1}: ${assignment.events.length} events, types: [${assignment.eventTypes.join(', ')}]`);
    });
    
    return workerAssignments;
}

/**
 * Distribute and process tasks using actual RLM worker processes
 */
async function distributeAndProcessTasks(events, taskDistribution, remainingTime) {
    console.log(`🎯 [RLM] Distributing and processing tasks to actual worker processes...`);
    console.log(`⏱️ [RLM] Remaining time: ${remainingTime}ms`);
    
    if (!taskDistribution || taskDistribution.length === 0) {
        console.log('✅ [RLM] No tasks to distribute');
        return {
            processedEvents: 0,
            failedEvents: 0,
            leftoverEvents: 0,
            results: []
        };
    }
    
    const startTime = Date.now();
    const results = [];
    let processedEvents = 0;
    let failedEvents = 0;
    
    try {
        // Get current worker status to ensure we have enough workers
        const workerStatus = await rlmWorkerManager.getWorkerStatus();
        console.log(`📊 [RLM] Current workers: ${workerStatus.totalWorkers}, Required: ${taskDistribution.length}`);
        
        // Ensure we have enough workers
        if (workerStatus.totalWorkers < taskDistribution.length) {
            console.log(`⚠️ [RLM] Not enough workers. Current: ${workerStatus.totalWorkers}, Required: ${taskDistribution.length}`);
            console.log(`🔄 [RLM] This should have been handled by scaleRLMWorkers, but we'll continue with available workers`);
        }
        
        // Process tasks by sending them to individual worker processes
        const processingPromises = taskDistribution.map(async (assignment, index) => {
            if (assignment.events.length === 0) {
                return {
                    workerId: assignment.workerId,
                    processedEvents: 0,
                    failedEvents: 0,
                    results: []
                };
            }
            
            console.log(`🚀 [RLM] Sending ${assignment.events.length} events to Worker ${assignment.workerId}`);
            
            // Process events using the current worker's processing logic
            // This simulates the worker receiving and processing these tasks
            const workerResult = await processEventsRoundRobin(
                assignment.events,
                assignment.workerId,
                5 // max concurrent tasks per worker
            );
            
            console.log(`✅ [RLM] Worker ${assignment.workerId} completed: ${workerResult.successfulEvents} successful, ${workerResult.failedEvents} failed`);
            
            return {
                workerId: assignment.workerId,
                processedEvents: workerResult.successfulEvents,
                failedEvents: workerResult.failedEvents,
                results: workerResult.results
            };
        });
        
        // Wait for all workers to complete
        const workerResults = await Promise.all(processingPromises);
        
        // Aggregate results
        workerResults.forEach(result => {
            processedEvents += result.processedEvents;
            failedEvents += result.failedEvents;
            results.push(...result.results);
        });
        
        const processingTime = Date.now() - startTime;
        console.log(`✅ [RLM] Task processing completed in ${processingTime}ms`);
        console.log(`📊 [RLM] Results: ${processedEvents} processed, ${failedEvents} failed`);
        
        // Calculate leftover events (if any)
        const totalEvents = events.length;
        const leftoverEvents = totalEvents - processedEvents - failedEvents;
        
        if (leftoverEvents > 0) {
            console.log(`⚠️ [RLM] ${leftoverEvents} events left unprocessed`);
        }
        
        return {
            processedEvents: processedEvents,
            failedEvents: failedEvents,
            leftoverEvents: Math.max(0, leftoverEvents),
            results: results,
            processingTime: processingTime,
            workerResults: workerResults
        };
        
    } catch (error) {
        console.error('❌ [RLM] Task processing failed:', error);
        
        return {
            processedEvents: processedEvents,
            failedEvents: failedEvents,
            leftoverEvents: events.length - processedEvents - failedEvents,
            error: error.message,
            results: results
        };
    }
}

/**
 * Process a single task (for individual worker processing)
 */
async function processSingleTask(event, workerId) {
    const { processEvent, getOverflowApiEndpoint } = require('./rlm-api-processors');
    
    const eventType = event.events[0];
    const apiEndpoint = getOverflowApiEndpoint(eventType, workerId);
    
    console.log(`🔧 [RLM] Worker ${workerId} processing ${eventType} for ${event.wallet_name}`);
    
    try {
        const result = await processEvent(event, workerId, apiEndpoint);
        return result;
    } catch (error) {
        console.error(`❌ [RLM] Worker ${workerId} failed to process task:`, error);
        return {
            success: false,
            wallet_name: event.wallet_name,
            event_type: eventType,
            error: error.message,
            worker_id: workerId
        };
    }
}

module.exports = {
    calculateProcessingPlan,
    distributeAndProcessTasks,
    processSingleTask,
    createTaskDistribution
}; 