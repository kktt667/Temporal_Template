const { Client } = require('@temporalio/client');
const { processAllWallets } = require('../workflows/wallet-workflow');
const { TemporalWorkerManager } = require('../scripts/temporal-worker-manager');

async function runWorkflow(numWorkers) {
    // Validate input
    if (!numWorkers || numWorkers < 1) {
        throw new Error('numWorkers must be a positive integer');
    }
    
    const client = new Client();
    const workerManager = new TemporalWorkerManager();
    
    console.log(`🚀 Starting wallet processing workflow with ${numWorkers} workers`);
    console.log(`⚡ Worker-to-Activity ratio: 1:1`);
    console.log(`📦 Each worker will handle exactly one activity`);
    console.log(`💼 Wallets per worker: ${Math.ceil(200 / numWorkers)}`);
    console.log('');
    
    try {
        // Automatically manage workers (discover existing + scale as needed)
        console.log('🔄 Managing Temporal worker processes...');
        await workerManager.startWorkers(numWorkers);
        console.log('');
        
        // Start the workflow
        const handle = await client.workflow.start(processAllWallets, {
            args: [numWorkers],
            taskQueue: 'wallet-processing',
            workflowId: `wallet-processing-${Date.now()}`,
        });
        
        console.log(`📋 Workflow started with ID: ${handle.workflowId}`);
        console.log(`⏳ Waiting for ${numWorkers} workers to complete...`);
        console.log('');
        
        // Wait for the workflow to complete
        const result = await handle.result();
        
        console.log('\n🎉 === WORKFLOW COMPLETED ===');
        console.log(`📋 Workflow ID: ${handle.workflowId}`);
        console.log(`👥 Workers used: ${result.totalWorkers}`);
        console.log(`⚡ Activities executed: ${result.totalActivities}`);
        console.log(`⚡ Worker-to-Activity ratio: ${result.workerToActivityRatio}`);
        console.log(`💼 Total wallets processed: ${result.totalWalletsProcessed}`);
        console.log(`📊 Total events found: ${result.totalEventsFound}`);
        
        // Show some sample events
        if (result.allEvents.length > 0) {
            console.log('\n📋 Sample events found:');
            result.allEvents.slice(0, 10).forEach(event => {
                console.log(`  💳 ${event.wallet_name}: [${event.events.join(', ')}]`);
            });
            
            if (result.allEvents.length > 10) {
                console.log(`  ... and ${result.allEvents.length - 10} more events`);
            }
        }
        
        return result;
        
    } catch (error) {
        console.error('❌ Workflow execution error:', error);
        throw error;
    } finally {
        // Note: We don't stop workers here - they stay running for next use
        console.log('\n💡 Workers remain running for future use');
        console.log('   To stop workers: npm run workers:stop');
        console.log('   To check status: npm run workers:status');
    }
}

// Allow running from command line with required worker count
if (require.main === module) {
    const numWorkers = process.argv[2] ? parseInt(process.argv[2]) : null;
    
    if (!numWorkers || isNaN(numWorkers) || numWorkers < 1) {
        console.error('❌ Please provide a valid number of workers');
        console.error('Usage: node client/wallet-client.js <number_of_workers>');
        console.error('Examples:');
        console.error('  node client/wallet-client.js 4');
        console.error('  node client/wallet-client.js 8');
        console.error('  node client/wallet-client.js 12');
        process.exit(1);
    }
    
    runWorkflow(numWorkers).catch((err) => {
        console.error('❌ Workflow error:', err);
        process.exit(1);
    });
}

module.exports = { runWorkflow }; 