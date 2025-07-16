const { redisQueueService } = require('./redis-queue');

class QueueMonitor {
    constructor() {
        this.monitoring = false;
        this.interval = null;
        this.statsHistory = [];
        this.maxHistorySize = 100;
    }

    async startMonitoring(intervalMs = 5000) {
        if (this.monitoring) {
            console.log('⚠️  Queue monitoring is already running');
            return;
        }

        console.log('🔍 Starting queue monitoring...');
        
        // Connect to Redis first
        const connected = await redisQueueService.connect();
        if (!connected) {
            console.error('❌ Failed to connect to Redis, cannot start monitoring');
            return;
        }

        this.monitoring = true;
        this.interval = setInterval(async () => {
            await this.updateStats();
        }, intervalMs);

        // Initial stats
        await this.updateStats();
        
        console.log(`✅ Queue monitoring started (interval: ${intervalMs}ms)`);
        console.log('📊 Press Ctrl+C to stop monitoring');
    }

    async stopMonitoring() {
        if (!this.monitoring) {
            console.log('⚠️  Queue monitoring is not running');
            return;
        }

        console.log('🛑 Stopping queue monitoring...');
        
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
        
        this.monitoring = false;
        await redisQueueService.disconnect();
        
        console.log('✅ Queue monitoring stopped');
    }

    async updateStats() {
        try {
            const stats = await redisQueueService.getQueueStats();
            const health = await redisQueueService.healthCheck();
            
            const statRecord = {
                timestamp: new Date().toISOString(),
                ...stats,
                health: health.status
            };

            this.statsHistory.push(statRecord);
            
            // Keep only recent history
            if (this.statsHistory.length > this.maxHistorySize) {
                this.statsHistory = this.statsHistory.slice(-this.maxHistorySize);
            }

            this.displayStats(stats, health);
            
        } catch (error) {
            console.error('❌ Failed to update queue stats:', error);
        }
    }

    displayStats(stats, health) {
        const timestamp = new Date().toLocaleTimeString();
        
        console.clear();
        console.log('📊 WALLET AUDIT QUEUE MONITOR');
        console.log('================================');
        console.log(`⏰ Last Updated: ${timestamp}`);
        console.log(`🔗 Redis Status: ${health.status.toUpperCase()}`);
        console.log('');
        
        console.log('📈 QUEUE STATISTICS:');
        console.log(`  📥 Pending:     ${stats.pending.toString().padStart(6)}`);
        console.log(`  ⚙️  Processing:   ${stats.processing.toString().padStart(6)}`);
        console.log(`  ❌ Failed:       ${stats.failed.toString().padStart(6)}`);
        console.log(`  📊 Total:        ${stats.total.toString().padStart(6)}`);
        console.log('');
        
        if (this.statsHistory.length > 1) {
            this.displayTrends();
        }
        
        console.log('💡 Commands:');
        console.log('  - npm run queue:clear (clear all queues)');
        console.log('  - Ctrl+C (stop monitoring)');
        console.log('');
    }

    displayTrends() {
        const recent = this.statsHistory.slice(-5);
        const oldest = recent[0];
        const newest = recent[recent.length - 1];
        
        const pendingChange = newest.pending - oldest.pending;
        const processingChange = newest.processing - oldest.processing;
        const failedChange = newest.failed - oldest.failed;
        
        console.log('📈 TRENDS (last 5 updates):');
        console.log(`  📥 Pending:     ${pendingChange >= 0 ? '+' : ''}${pendingChange}`);
        console.log(`  ⚙️  Processing:   ${processingChange >= 0 ? '+' : ''}${processingChange}`);
        console.log(`  ❌ Failed:       ${failedChange >= 0 ? '+' : ''}${failedChange}`);
        console.log('');
        
        // Alert if queue is growing
        if (newest.pending > 100) {
            console.log('⚠️  ALERT: High pending queue (>100 items)');
        }
        
        if (newest.failed > 10) {
            console.log('🚨 ALERT: High failed queue (>10 items)');
        }
    }

    async getStatsHistory() {
        return this.statsHistory;
    }

    async clearAllQueues() {
        console.log('🧹 Clearing all queues...');
        
        const connected = await redisQueueService.connect();
        if (!connected) {
            console.error('❌ Failed to connect to Redis');
            return false;
        }

        try {
            await Promise.all([
                redisQueueService.clearQueue('wallet_audit_events'),
                redisQueueService.clearQueue('wallet_audit_processing'),
                redisQueueService.clearQueue('wallet_audit_failed')
            ]);
            
            console.log('✅ All queues cleared successfully');
            return true;
        } catch (error) {
            console.error('❌ Failed to clear queues:', error);
            return false;
        } finally {
            await redisQueueService.disconnect();
        }
    }
}

// Create singleton instance
const queueMonitor = new QueueMonitor();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await queueMonitor.stopMonitoring();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await queueMonitor.stopMonitoring();
    process.exit(0);
});

// Allow running from command line
if (require.main === module) {
    const command = process.argv[2];
    
    async function main() {
        try {
            switch (command) {
                case 'start':
                    await queueMonitor.startMonitoring();
                    break;
                    
                case 'clear':
                    await queueMonitor.clearAllQueues();
                    break;
                    
                case 'stats':
                    await redisQueueService.connect();
                    const stats = await redisQueueService.getQueueStats();
                    const health = await redisQueueService.healthCheck();
                    console.log('📊 Current Queue Stats:');
                    console.log(JSON.stringify(stats, null, 2));
                    console.log('🔗 Redis Health:', health);
                    await redisQueueService.disconnect();
                    break;
                    
                default:
                    console.log('📊 Wallet Audit Queue Monitor');
                    console.log('=============================');
                    console.log('');
                    console.log('Usage:');
                    console.log('  node services/queue-monitor.js start    (start monitoring)');
                    console.log('  node services/queue-monitor.js clear    (clear all queues)');
                    console.log('  node services/queue-monitor.js stats    (show current stats)');
                    console.log('');
                    console.log('Or use npm scripts:');
                    console.log('  npm run queue:monitor                  (start monitoring)');
                    console.log('  npm run queue:clear                    (clear all queues)');
            }
        } catch (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }
    }
    
    main();
}

module.exports = {
    QueueMonitor,
    queueMonitor
}; 