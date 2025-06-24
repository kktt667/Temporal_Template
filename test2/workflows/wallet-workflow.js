const { proxyActivities } = require('@temporalio/workflow');

// Import activities
const { processWalletRange } = proxyActivities({
    startToCloseTimeout: '1 minute',
});

/**
 * Main workflow to process all wallets with 1:1 worker-to-activity relationship
 * Each worker will handle exactly one activity with a specific wallet range
 */
async function processAllWallets(numWorkers) {
    // Validate input
    if (!numWorkers || numWorkers < 1) {
        throw new Error('numWorkers must be a positive integer');
    }
    
    const totalWallets = 200;
    const walletsPerWorker = Math.ceil(totalWallets / numWorkers);
    
    console.log(`🚀 Starting wallet processing with ${numWorkers} workers`);
    console.log(`📦 Each worker will handle exactly 1 activity with ${walletsPerWorker} wallets`);
    console.log(`⚡ Worker-to-Activity ratio: 1:1`);
    
    // Create exactly one activity per worker
    const activities = [];
    for (let i = 0; i < numWorkers; i++) {
        const startWallet = i * walletsPerWorker + 1;
        const endWallet = Math.min((i + 1) * walletsPerWorker, totalWallets);
        const workerId = i + 1;
        
        activities.push({
            workerId,
            startWallet,
            endWallet,
            walletCount: endWallet - startWallet + 1
        });
    }
    
    console.log('\n📋 Activity assignments (1 activity per worker):');
    activities.forEach((activity) => {
        console.log(`  🎯 Activity ${activity.workerId} (Worker ${activity.workerId}): wallets ${activity.startWallet}-${activity.endWallet} (${activity.walletCount} wallets)`);
    });
    
    // Execute exactly one activity per worker
    console.log('\n⚡ Executing activities (1 per worker):');
    const promises = activities.map((activity) => {
        console.log(`  🚀 Starting Activity ${activity.workerId} for Worker ${activity.workerId}`);
        return processWalletRange(activity.startWallet, activity.endWallet, activity.workerId);
    });
    
    // Wait for all activities to complete
    const results = await Promise.all(promises);
    
    // Aggregate results
    const summary = {
        totalWorkers: numWorkers,
        totalActivities: numWorkers,
        workerToActivityRatio: '1:1',
        totalWalletsProcessed: 0,
        totalEventsFound: 0,
        workerResults: results,
        allEvents: []
    };
    
    console.log('\n✅ Activity completion results:');
    results.forEach((result) => {
        summary.totalWalletsProcessed += result.walletsProcessed;
        summary.totalEventsFound += result.eventsFound;
        summary.allEvents.push(...result.events);
        
        console.log(`   Activity ${result.workerId} (Worker ${result.workerId}) completed: ${result.walletsProcessed} wallets, ${result.eventsFound} events`);
    });
    
    console.log(`\n🎉 === PROCESSING COMPLETE ===`);
    console.log(`👥 Workers used: ${summary.totalWorkers}`);
    console.log(`⚡ Activities executed: ${summary.totalActivities}`);
    console.log(`⚡ Worker-to-Activity ratio: ${summary.workerToActivityRatio}`);
    console.log(`💼 Total wallets processed: ${summary.totalWalletsProcessed}`);
    console.log(` Total events found: ${summary.totalEventsFound}`);
    
    return summary;
}

module.exports = {
    processAllWallets
}; 