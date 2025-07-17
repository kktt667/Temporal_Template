const { Worker } = require('@temporalio/worker');
const { processWalletRange } = require('../activities/wallet-activities');
const { processAllWallets } = require('../workflows/wallet-workflow');

async function runWorker(workerId = 1) {
    console.log(`🚀 Starting Temporal worker ${workerId}...`);
    
    let worker = null;
    
    try {
        // Create a worker that connects to the default localhost:7233
        worker = await Worker.create({
            workflowsPath: require.resolve('../workflows/wallet-workflow'),
            activities: {
                processWalletRange
            },
            taskQueue: 'wallet-processing',
            // Add worker identity for better tracking
            identity: `wallet-worker-${workerId}`,
            // Add graceful shutdown handling
            shutdownGracePeriod: '30s',
        });

        console.log(`✅ Wallet processing worker ${workerId} started. Listening for tasks...`);
        console.log(`🆔 Worker identity: wallet-worker-${workerId}`);
        
        // Handle graceful shutdown
        const shutdown = async (signal) => {
            console.log(`🛑 Worker ${workerId} received ${signal}, shutting down gracefully...`);
            try {
                if (worker) {
                    await worker.shutdown();
                    console.log(`✅ Worker ${workerId} shut down successfully`);
                }
                process.exit(0);
            } catch (error) {
                console.error(`❌ Worker ${workerId} shutdown error:`, error);
                process.exit(1);
            }
        };
        
        // Listen for shutdown signals
        process.on('SIGINT', () => shutdown('SIGINT'));
        process.on('SIGTERM', () => shutdown('SIGTERM'));
        
        // Start the worker
        await worker.run();
        
    } catch (error) {
        console.error(`❌ Worker ${workerId} runtime error:`, error);
        if (worker) {
            try {
                await worker.shutdown();
            } catch (shutdownError) {
                console.error(`❌ Worker ${workerId} shutdown error:`, shutdownError);
            }
        }
        process.exit(1);
    }
}

// Allow running with worker ID from command line
if (require.main === module) {
    const workerId = process.argv[2] ? parseInt(process.argv[2]) : 1;
    runWorker(workerId).catch((err) => {
        console.error(`❌ Worker ${workerId} startup error:`, err);
        process.exit(1);
    });
}

module.exports = { runWorker }; 