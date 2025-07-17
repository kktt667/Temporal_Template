const { redisQueueService } = require('./redis-queue');

async function clearAllQueues() {
    console.log('🧹 Clearing all wallet audit queues...');
    
    try {
        const connected = await redisQueueService.connect();
        if (!connected) {
            console.error('❌ Failed to connect to Redis');
            process.exit(1);
        }

        const stats = await redisQueueService.getQueueStats();
        console.log('📊 Current queue status:');
        console.log(`  📥 Pending: ${stats.pending}`);
        console.log(`  ⚙️  Processing: ${stats.processing}`);
        console.log(`  ❌ Failed: ${stats.failed}`);
        console.log('');

        if (stats.total === 0) {
            console.log('✅ All queues are already empty');
            await redisQueueService.disconnect();
            return;
        }

        // Clear all queues
        await Promise.all([
            redisQueueService.clearQueue('wallet_audit_events'),
            redisQueueService.clearQueue('wallet_audit_processing'),
            redisQueueService.clearQueue('wallet_audit_failed')
        ]);

        console.log('✅ All queues cleared successfully');
        
        // Verify queues are empty
        const newStats = await redisQueueService.getQueueStats();
        console.log('📊 Queue status after clearing:');
        console.log(`  📥 Pending: ${newStats.pending}`);
        console.log(`  ⚙️  Processing: ${newStats.processing}`);
        console.log(`  ❌ Failed: ${newStats.failed}`);

        await redisQueueService.disconnect();
        
    } catch (error) {
        console.error('❌ Failed to clear queues:', error);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    clearAllQueues();
}

module.exports = { clearAllQueues }; 