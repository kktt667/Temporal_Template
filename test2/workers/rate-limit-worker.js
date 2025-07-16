const { Worker } = require('@temporalio/worker');
const { rateLimitManagerWorkflow } = require('../workflows/rate-limit-manager');
const { 
    processAuditEvent, 
    getQueueStats, 
    scaleWorkers, 
    getQueueDetails 
} = require('../activities/rate-limit-activities');

async function runRateLimitWorker(workerId = 'rate-limit-worker') {
    console.log(`🚀 Starting Rate Limit Manager Worker ${workerId}...`);
    
    const worker = await Worker.create({
        workflowsPath: require.resolve('../workflows/rate-limit-manager'),
        activities: {
            processAuditEvent,
            getQueueStats,
            scaleWorkers,
            getQueueDetails
        },
        taskQueue: 'rate-limit-processing',
        identity: `rate-limit-worker-${workerId}`,
        shutdownGraceTime: '30s'
    });

    console.log('✅ Rate Limit Manager Worker created');
    console.log('📋 Task Queue: rate-limit-processing');
    console.log('🆔 Worker Identity: rate-limit-worker');
    
    await worker.run();
    console.log('✅ Rate Limit Manager Worker started. Listening for tasks...');
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    process.exit(0);
});

// Start the worker
if (require.main === module) {
    const workerId = process.argv[2] || 'rate-limit-worker';
    runRateLimitWorker(workerId).catch((err) => {
        console.error('❌ Rate Limit Manager Worker failed:', err);
        process.exit(1);
    });
}

module.exports = { runRateLimitWorker }; 