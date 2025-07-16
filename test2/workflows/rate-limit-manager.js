const { proxyActivities, log, startChild } = require('@temporalio/workflow');

// Import activities
const activities = proxyActivities({
    startToCloseTimeout: '4 minutes', // Slightly more than 3 minutes to allow for completion
    retry: {
        initialInterval: '1 second',
        maximumInterval: '10 seconds',
        maximumAttempts: 3,
        backoffCoefficient: 2,
    }
});

/**
 * Child workflow for processing tasks assigned to a specific worker
 */
async function workerTaskProcessorWorkflow(workerId, events, taskQueue) {
    log.info(`🚀 [Worker ${workerId}] Starting task processor workflow with ${events.length} events`);
    
    const startTime = Date.now();
    const results = [];
    let processedEvents = 0;
    let failedEvents = 0;
    
    try {
        // Process events using the worker's processing logic
        const processingResult = await activities.processEventsRoundRobin(events, workerId, 5);
        
        processedEvents = processingResult.successfulEvents;
        failedEvents = processingResult.failedEvents;
        results.push(...processingResult.results);
        
        const processingTime = Date.now() - startTime;
        log.info(`✅ [Worker ${workerId}] Task processor completed in ${processingTime}ms`);
        
        return {
            workerId: workerId,
            processedEvents: processedEvents,
            failedEvents: failedEvents,
            results: results,
            processingTime: processingTime
        };
        
    } catch (error) {
        log.error(`❌ [Worker ${workerId}] Task processor failed:`, error);
        
        return {
            workerId: workerId,
            processedEvents: processedEvents,
            failedEvents: failedEvents,
            results: results,
            error: error.message,
            processingTime: Date.now() - startTime
        };
    }
}

/**
 * Rate Limit Manager Workflow
 * 
 * Main workflow that:
 * 1. Consumes events from Redis queue
 * 2. Calculates required workers to complete within 3 minutes
 * 3. Scales workers up/down as needed
 * 4. Distributes tasks to workers using child workflows
 * 5. Ensures completion within 3-minute window
 */
async function rateLimitManagerWorkflow() {
    const workflowId = `rlm-${Date.now()}`;
    log.info(`🚀 Starting Rate Limit Manager Workflow: ${workflowId}`);
    
    const startTime = Date.now();
    const maxDuration = 3 * 60 * 1000; // 3 minutes in milliseconds
    
    try {
        // Step 1: Consume events from Redis queue
        log.info('📥 Step 1: Consuming events from Redis queue...');
        const queueData = await activities.consumeQueueEvents();
        
        if (!queueData.events || queueData.events.length === 0) {
            log.info('✅ No events in queue, workflow complete');
            return {
                status: 'completed',
                eventsProcessed: 0,
                workersUsed: 0,
                duration: Date.now() - startTime
            };
        }
        
        log.info(`📊 Found ${queueData.events.length} events to process`);
        
        // Step 2: Calculate required workers and processing strategy
        log.info('🧮 Step 2: Calculating required workers...');
        const processingPlan = await activities.calculateProcessingPlan(
            queueData.events,
            maxDuration,
            queueData.leftoverEvents || 0
        );
        
        log.info(`📋 Processing Plan: ${processingPlan.requiredWorkers} workers needed`);
        log.info(`⏱️ Estimated completion time: ${processingPlan.estimatedTime}ms`);
        
        // Step 3: Scale workers up/down
        log.info('⚡ Step 3: Scaling workers...');
        const workerStatus = await activities.scaleRLMWorkers(processingPlan.requiredWorkers);
        
        log.info(`👥 Worker Status: ${workerStatus.activeWorkers} workers active`);
        
        // Step 4: Distribute tasks to workers using child workflows
        log.info('🎯 Step 4: Distributing tasks to workers using child workflows...');
        
        const childWorkflowPromises = [];
        const results = [];
        let totalProcessedEvents = 0;
        let totalFailedEvents = 0;
        
        // Start child workflows for each worker's tasks
        processingPlan.taskDistribution.forEach((assignment, index) => {
            if (assignment.events.length === 0) {
                log.info(`⏭️ [Worker ${assignment.workerId}] No events assigned, skipping`);
                return;
            }
            
            log.info(`🚀 [Worker ${assignment.workerId}] Starting child workflow with ${assignment.events.length} events`);
            
            // Start child workflow for this worker's tasks
            const childWorkflowPromise = startChild(workerTaskProcessorWorkflow, {
                args: [assignment.workerId, assignment.events, 'rlm-processing'],
                taskQueue: 'rlm-processing',
                workflowId: `worker-${assignment.workerId}-${Date.now()}-${index}`,
                startToCloseTimeout: '4 minutes'
            });
            
            childWorkflowPromises.push(childWorkflowPromise);
        });
        
        // Wait for all child workflows to complete
        if (childWorkflowPromises.length > 0) {
            log.info(`⏳ Waiting for ${childWorkflowPromises.length} child workflows to complete...`);
            
            const childResults = await Promise.all(childWorkflowPromises);
            
            // Aggregate results from all child workflows
            childResults.forEach(result => {
                totalProcessedEvents += result.processedEvents;
                totalFailedEvents += result.failedEvents;
                results.push(...result.results);
                
                log.info(`✅ [Worker ${result.workerId}] Completed: ${result.processedEvents} processed, ${result.failedEvents} failed`);
            });
        }
        
        // Step 5: Final status and cleanup
        const endTime = Date.now();
        const totalDuration = endTime - startTime;
        
        log.info('✅ Rate Limit Manager Workflow completed successfully');
        
        return {
            status: 'completed',
            eventsProcessed: totalProcessedEvents,
            eventsFailed: totalFailedEvents,
            workersUsed: workerStatus.activeWorkers,
            duration: totalDuration,
            processingPlan: processingPlan,
            leftoverEvents: queueData.events.length - totalProcessedEvents - totalFailedEvents,
            childWorkflowResults: childWorkflowPromises.length
        };
        
    } catch (error) {
        log.error('❌ Rate Limit Manager Workflow failed:', error);
        
        // Attempt to get partial results
        const partialResults = await activities.getPartialResults();
        
        return {
            status: 'failed',
            error: error.message,
            partialResults: partialResults,
            duration: Date.now() - startTime
        };
    }
}

module.exports = {
    rateLimitManagerWorkflow,
    workerTaskProcessorWorkflow
}; 