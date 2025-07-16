const { proxyActivities, log } = require('@temporalio/workflow');

// Import activities
const { processAuditEvent, getQueueStats } = proxyActivities({
    startToCloseTimeout: '5 minutes',
    retry: {
        initialInterval: '1 second',
        maximumInterval: '60 seconds',
        maximumAttempts: 5,
        backoffCoefficient: 2,
        nonRetryableErrorTypes: ['ValidationError', 'RateLimitExceeded', 'InvalidWalletError']
    }
});

/**
 * Rate Limit Manager Workflow
 * 
 * Processes audit events from Redis queue with dynamic scaling:
 * - Rate limit: 20 events/minute (1 event every 3 seconds)
 * - Target: Complete queue within 3 minutes
 * - Dynamic worker scaling based on queue size
 * - Exception handling and overflow management
 */
async function rateLimitManagerWorkflow() {
    const workflowId = `rate-limit-manager-${Date.now()}`;
    log.info(`🚀 Starting Rate Limit Manager Workflow: ${workflowId}`);
    
    // Configuration
    const RATE_LIMIT_EVENTS_PER_MINUTE = 20;
    const TARGET_COMPLETION_TIME_MINUTES = 3;
    const EVENT_PROCESSING_TIME_SECONDS = 5; // Average processing time (2-8 seconds)
    const MAX_WORKERS = 20; // Can scale beyond 5 base workers
    const MIN_WORKERS = 1;
    
    let currentWorkerCount = 0;
    let totalEventsProcessed = 0;
    let totalEventsFailed = 0;
    let startTime = Date.now();
    
    log.info(`📊 Rate Limit Config: ${RATE_LIMIT_EVENTS_PER_MINUTE} events/minute`);
    log.info(`⏰ Target completion time: ${TARGET_COMPLETION_TIME_MINUTES} minutes`);
    log.info(`⚡ Event processing time: ${EVENT_PROCESSING_TIME_SECONDS} seconds`);
    
    // Main processing loop
    while (true) {
        try {
            // Get current queue stats
            const queueStats = await getQueueStats();
            const pendingEvents = queueStats.pending;
            
            log.info(`📋 Queue Status: ${pendingEvents} pending, ${queueStats.processing} processing, ${queueStats.failed} failed`);
            
            // Check if queue is empty
            if (pendingEvents === 0 && queueStats.processing === 0) {
                log.info(`✅ Queue is empty! All events processed successfully`);
                log.info(`📊 Final Stats: ${totalEventsProcessed} processed, ${totalEventsFailed} failed`);
                break;
            }
            
            // Calculate optimal worker count
            const optimalWorkerCount = calculateOptimalWorkerCount(
                pendingEvents,
                RATE_LIMIT_EVENTS_PER_MINUTE,
                TARGET_COMPLETION_TIME_MINUTES,
                EVENT_PROCESSING_TIME_SECONDS,
                MAX_WORKERS,
                MIN_WORKERS
            );
            
            log.info(`🧮 Calculated optimal workers: ${optimalWorkerCount} (current: ${currentWorkerCount})`);
            
            // Scale workers if needed
            if (optimalWorkerCount !== currentWorkerCount) {
                await scaleWorkers(optimalWorkerCount, currentWorkerCount);
                currentWorkerCount = optimalWorkerCount;
                log.info(`📈 Scaled to ${currentWorkerCount} workers`);
            }
            
            // Process events - each field has its own rate limit, so we can process more
            const eventsToProcess = Math.min(
                pendingEvents,
                currentWorkerCount * 2 // Each worker can handle multiple events per batch
            );
            
            if (eventsToProcess > 0) {
                log.info(`🚀 Processing ${eventsToProcess} events with ${currentWorkerCount} workers`);
                
                // Create child workflows for parallel processing
                const processingPromises = [];
                const eventsPerWorker = Math.ceil(eventsToProcess / currentWorkerCount);
                
                for (let i = 0; i < currentWorkerCount; i++) {
                    const workerEvents = Math.min(eventsPerWorker, eventsToProcess - (i * eventsPerWorker));
                    if (workerEvents > 0) {
                        const promise = processEventsBatch(workerEvents, i + 1);
                        processingPromises.push(promise);
                    }
                }
                
                // Wait for all workers to complete with timeout
                const results = await Promise.allSettled(processingPromises);
                
                // Process results
                for (const result of results) {
                    if (result.status === 'fulfilled') {
                        totalEventsProcessed += result.value.processed;
                        totalEventsFailed += result.value.failed;
                    } else {
                        log.error(`❌ Worker batch failed:`, result.reason);
                        totalEventsFailed += eventsPerWorker;
                    }
                }
                
                log.info(`✅ Batch completed: ${totalEventsProcessed} total processed, ${totalEventsFailed} total failed`);
            }
            
            // Check if we're approaching the time limit
            const elapsedMinutes = (Date.now() - startTime) / 60000;
            if (elapsedMinutes >= TARGET_COMPLETION_TIME_MINUTES) {
                log.warn(`⏰ Time limit approaching! Elapsed: ${elapsedMinutes.toFixed(1)} minutes`);
                
                // Scale up aggressively if we still have pending events
                if (pendingEvents > 0 && currentWorkerCount < MAX_WORKERS) {
                    const emergencyWorkers = Math.min(MAX_WORKERS, currentWorkerCount + 2);
                    await scaleWorkers(emergencyWorkers, currentWorkerCount);
                    currentWorkerCount = emergencyWorkers;
                    log.info(`🚨 Emergency scaling to ${emergencyWorkers} workers`);
                }
            }
            
            // Wait before next iteration (rate limiting)
            await new Promise(resolve => setTimeout(resolve, 10000)); // 10 seconds
            
        } catch (error) {
            log.error(`❌ Rate limit manager error:`, error);
            
            // Implement exponential backoff for errors
            await new Promise(resolve => setTimeout(resolve, 30000)); // 30 seconds
        }
    }
    
    // Final cleanup
    if (currentWorkerCount > MIN_WORKERS) {
        await scaleWorkers(MIN_WORKERS, currentWorkerCount);
        log.info(`🧹 Scaled down to minimum workers: ${MIN_WORKERS}`);
    }
    
    const totalTime = (Date.now() - startTime) / 60000;
    log.info(`🎉 Rate Limit Manager completed in ${totalTime.toFixed(1)} minutes`);
    log.info(`📊 Final Summary: ${totalEventsProcessed} processed, ${totalEventsFailed} failed`);
    
    return {
        totalEventsProcessed,
        totalEventsFailed,
        totalTime: totalTime,
        success: totalEventsFailed === 0
    };
}

/**
 * Calculate optimal number of workers based on queue size and constraints
 * Each wallet field has its own 20/minute rate limit, so workers can process different fields in parallel
 */
function calculateOptimalWorkerCount(pendingEvents, rateLimitPerMinute, targetMinutes, processingTimeSeconds, maxWorkers, minWorkers) {
    if (pendingEvents === 0) {
        return minWorkers;
    }
    
    // Convert to seconds
    const L = targetMinutes * 60; // Total time allowed in seconds
    const D = processingTimeSeconds; // Duration of each task in seconds
    const T = pendingEvents; // Total number of tasks
    
    // Step 1: Calculate how many events can be processed per field in the time window
    const eventsPerFieldPerMinute = rateLimitPerMinute; // 20 events per minute per field
    const eventsPerFieldInTimeWindow = Math.floor(eventsPerFieldPerMinute * targetMinutes);
    
    // Step 2: Calculate how many fields we need to process all events
    const fieldsNeeded = Math.ceil(T / eventsPerFieldInTimeWindow);
    
    // Step 3: Calculate how many workers we need to finish within 3 minutes
    // Each worker (API endpoint) can process 20 events/minute
    const eventsPerWorkerPerMinute = rateLimitPerMinute; // 20 events per minute per worker
    const eventsPerWorkerInTimeWindow = Math.floor(eventsPerWorkerPerMinute * targetMinutes);
    
    // Step 4: Calculate workers needed to process all events in time
    const workersNeeded = Math.ceil(T / eventsPerWorkerInTimeWindow);
    
    // Step 5: We start with 5 base workers (wallet fields), but can scale up with new API endpoints
    const BASE_WORKERS = 5; // Base workers from wallet fields
    const optimalWorkers = Math.min(workersNeeded, maxWorkers);
    
    log.info(`🧮 Worker Calculation:`);
    log.info(`  📊 Total tasks: ${T}, Target time: ${targetMinutes}min, Processing time: ${D}s`);
    log.info(`  📈 Events per worker per minute: ${eventsPerWorkerPerMinute}`);
    log.info(`  ⏰ Events per worker in ${targetMinutes}min: ${eventsPerWorkerInTimeWindow}`);
    log.info(`  🔢 Workers needed: ${workersNeeded} (base: ${BASE_WORKERS}, max: ${maxWorkers})`);
    log.info(`  🚦 Each worker (API endpoint) has ${rateLimitPerMinute}/min rate limit`);
    log.info(`  📊 Optimal workers: ${optimalWorkers}`);
    
    // Check if we can meet deadline
    if (workersNeeded > maxWorkers) {
        log.warn(`⚠️ Cannot process all events in time! Need ${workersNeeded} workers but max is ${maxWorkers}`);
        log.warn(`💡 Consider: Increase max workers or extend time limit`);
        return maxWorkers;
    }
    
    // Use optimal workers based on parallel field processing
    log.info(`✅ Using optimal workers: ${optimalWorkers} workers`);
    return Math.max(minWorkers, optimalWorkers);
}

/**
 * Scale workers up or down
 */
async function scaleWorkers(targetCount, currentCount) {
    if (targetCount === currentCount) return;
    
    if (targetCount > currentCount) {
        log.info(`📈 Scaling up from ${currentCount} to ${targetCount} workers`);
        // In a real implementation, this would trigger worker scaling
        // For now, we'll simulate it
        await new Promise(resolve => setTimeout(resolve, 2000));
    } else {
        log.info(`📉 Scaling down from ${currentCount} to ${targetCount} workers`);
        // Gracefully shut down excess workers
        await new Promise(resolve => setTimeout(resolve, 2000));
    }
}

/**
 * Process a batch of events with a specific worker
 */
async function processEventsBatch(eventCount, workerId) {
    log.info(`👷 Worker ${workerId} processing ${eventCount} events`);
    
    let processed = 0;
    let failed = 0;
    
    for (let i = 0; i < eventCount; i++) {
        try {
            // Process single event with rate limiting
            await processAuditEvent(workerId);
            processed++;
            
            // Rate limiting: wait between events
            await new Promise(resolve => setTimeout(resolve, 3000)); // 3 seconds between events
            
        } catch (error) {
            log.error(`❌ Worker ${workerId} failed to process event ${i + 1}:`, error);
            failed++;
            
            // Continue processing other events even if one fails
        }
    }
    
    log.info(`✅ Worker ${workerId} completed: ${processed} processed, ${failed} failed`);
    return { processed, failed };
}

module.exports = {
    rateLimitManagerWorkflow
}; 