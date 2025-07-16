const { Worker } = require('@temporalio/worker');

// Import all activities directly
const { 
    consumeQueueEvents, 
    getPartialResults 
} = require('../activities/rlm-queue-processor');

const { 
    scaleRLMWorkers, 
    getRLMWorkerStatus 
} = require('../activities/rlm-worker-manager');

const { 
    calculateProcessingPlan, 
    distributeAndProcessTasks, 
    processSingleTask 
} = require('../activities/rlm-task-distributor');

const { 
    processEvent, 
    processEventType, 
    processEventsRoundRobin 
} = require('../activities/rlm-api-processors');

// Import workflows
const { 
    rateLimitManagerWorkflow, 
    workerTaskProcessorWorkflow 
} = require('../workflows/rate-limit-manager');

/**
 * RLM Worker
 * 
 * Processes tasks from the RLM task queue with:
 * - Round-robin task distribution
 * - Overflow API support
 * - Rate limiting per event type
 * - Child workflow support for distributed processing
 */

async function runRLMWorker() {
    const workerId = process.argv[2] || `rlm-worker-${Date.now()}`;
    
    console.log(`🚀 [${workerId}] Starting RLM worker...`);
    console.log(`🆔 [${workerId}] Worker identity: ${workerId}`);
    
    try {
        // Create Temporal worker with activities object and workflows
        const worker = await Worker.create({
            workflowsPath: require.resolve('../workflows/rate-limit-manager'),
            activities: {
                // Queue processing activities
                consumeQueueEvents,
                getPartialResults,
                
                // Worker management activities
                scaleRLMWorkers,
                getRLMWorkerStatus,
                
                // Task distribution activities
                calculateProcessingPlan,
                distributeAndProcessTasks,
                processSingleTask,
                
                // API processing activities
                processEvent,
                processEventType,
                processEventsRoundRobin
            },
            taskQueue: 'rlm-processing',
            identity: workerId,
            shutdownGraceTime: '30s'
        });
        
        console.log(`✅ [${workerId}] RLM worker created successfully`);
        console.log(`🔧 [${workerId}] Registered activities: ${Object.keys(worker.activities || {}).join(', ')}`);
        console.log(`📋 [${workerId}] Registered workflows: rateLimitManagerWorkflow, workerTaskProcessorWorkflow`);
        
        // Start the worker
        await worker.run();
        
        console.log(`✅ [${workerId}] RLM worker started. Listening for tasks...`);
        
    } catch (error) {
        console.error(`❌ [${workerId}] Failed to start RLM worker:`, error);
        process.exit(1);
    }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log(`🛑 [${process.argv[2] || 'RLM Worker'}] Received SIGTERM, shutting down gracefully...`);
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log(`🛑 [${process.argv[2] || 'RLM Worker'}] Received SIGINT, shutting down gracefully...`);
    process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error(`💥 [${process.argv[2] || 'RLM Worker'}] Uncaught exception:`, error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error(`💥 [${process.argv[2] || 'RLM Worker'}] Unhandled rejection at:`, promise, 'reason:', reason);
    process.exit(1);
});

// Start the worker if this file is run directly
if (require.main === module) {
    runRLMWorker().catch(error => {
        console.error('❌ Failed to run RLM worker:', error);
        process.exit(1);
    });
}

module.exports = {
    runRLMWorker
}; 