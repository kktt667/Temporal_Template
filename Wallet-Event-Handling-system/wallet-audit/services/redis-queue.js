const redis = require('redis');

class RedisQueueService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.queueName = 'wallet_audit_events';
        this.processingQueueName = 'wallet_audit_processing';
        this.failedQueueName = 'wallet_audit_failed';
    }

    async connect() {
        try {
            this.client = redis.createClient({
                url: process.env.REDIS_URL || 'redis://localhost:6379',
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        console.error('❌ Redis server refused connection');
                        return new Error('Redis server refused connection');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        console.error('❌ Redis retry time exhausted');
                        return new Error('Retry time exhausted');
                    }
                    if (options.attempt > 10) {
                        console.error('❌ Redis max retry attempts reached');
                        return new Error('Max retry attempts reached');
                    }
                    return Math.min(options.attempt * 100, 3000);
                }
            });

            this.client.on('error', (err) => {
                console.error('❌ Redis Client Error:', err);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                console.log('✅ Connected to Redis');
                this.isConnected = true;
            });

            this.client.on('ready', () => {
                console.log('✅ Redis client ready');
            });

            this.client.on('end', () => {
                console.log('🔌 Redis connection ended');
                this.isConnected = false;
            });

            await this.client.connect();
            return true;
        } catch (error) {
            console.error('❌ Failed to connect to Redis:', error);
            return false;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.quit();
            this.isConnected = false;
        }
    }

    async addEventToQueue(event, workerId) {
        if (!this.isConnected) {
            console.error('❌ Redis not connected, falling back to logging');
            console.log(`[Worker ${workerId}] Wallet: ${event.wallet_name}, Events: [${event.events.join(', ')}]`);
            return false;
        }

        try {
            const queueItem = {
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                wallet_name: event.wallet_name,
                events: event.events,
                worker_id: workerId,
                timestamp: new Date().toISOString(),
                priority: this.calculatePriority(event.events),
                retry_count: 0
            };

            await this.client.lPush(this.queueName, JSON.stringify(queueItem));
            
            console.log(`📥 [Worker ${workerId}] Added to queue: ${event.wallet_name} (${event.events.length} events)`);
            return true;
        } catch (error) {
            console.error(`❌ [Worker ${workerId}] Failed to add event to queue:`, error);
            return false;
        }
    }

    async addEventsToQueue(events, workerId) {
        if (!this.isConnected) {
            console.error('❌ Redis not connected, falling back to logging');
            console.log(`[Worker ${workerId}] Adding events to queue:`);
            events.forEach(event => {
                console.log(`  [Worker ${workerId}] Wallet: ${event.wallet_name}, Events: [${event.events.join(', ')}]`);
            });
            return false;
        }

        try {
            console.log(`📥 [Worker ${workerId}] Adding ${events.length} events to queue...`);
            
            const queueItems = events.map(event => ({
                id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                wallet_name: event.wallet_name,
                events: event.events,
                worker_id: workerId,
                timestamp: new Date().toISOString(),
                priority: this.calculatePriority(event.events),
                retry_count: 0
            }));

            // Add all events to queue
            const pipeline = this.client.multi();
            queueItems.forEach(item => {
                pipeline.lPush(this.queueName, JSON.stringify(item));
            });
            
            await pipeline.exec();
            
            console.log(`✅ [Worker ${workerId}] Successfully added ${events.length} events to queue`);
            return true;
        } catch (error) {
            console.error(`❌ [Worker ${workerId}] Failed to add events to queue:`, error);
            return false;
        }
    }

    async getQueueLength() {
        if (!this.isConnected) return 0;
        
        try {
            const length = await this.client.lLen(this.queueName);
            return length;
        } catch (error) {
            console.error('❌ Failed to get queue length:', error);
            return 0;
        }
    }

    async getProcessingQueueLength() {
        if (!this.isConnected) return 0;
        
        try {
            const length = await this.client.lLen(this.processingQueueName);
            return length;
        } catch (error) {
            console.error('❌ Failed to get processing queue length:', error);
            return 0;
        }
    }

    async getFailedQueueLength() {
        if (!this.isConnected) return 0;
        
        try {
            const length = await this.client.lLen(this.failedQueueName);
            return length;
        } catch (error) {
            console.error('❌ Failed to get failed queue length:', error);
            return 0;
        }
    }

    async getQueueStats() {
        if (!this.isConnected) {
            return {
                pending: 0,
                processing: 0,
                failed: 0,
                total: 0
            };
        }

        try {
            const [pending, processing, failed] = await Promise.all([
                this.getQueueLength(),
                this.getProcessingQueueLength(),
                this.getFailedQueueLength()
            ]);

            return {
                pending,
                processing,
                failed,
                total: pending + processing + failed
            };
        } catch (error) {
            console.error('❌ Failed to get queue stats:', error);
            return {
                pending: 0,
                processing: 0,
                failed: 0,
                total: 0
            };
        }
    }

    async clearQueue(queueName = this.queueName) {
        if (!this.isConnected) return false;
        
        try {
            await this.client.del(queueName);
            console.log(`✅ Cleared queue: ${queueName}`);
            return true;
        } catch (error) {
            console.error(`❌ Failed to clear queue ${queueName}:`, error);
            return false;
        }
    }

    calculatePriority(events) {
        // Higher priority for critical events
        const priorityMap = {
            'REBALANCE_NEEDED': 5,
            'OPEN_POSITION_DETECTED': 4,
            'OPEN_ORDER_DETECTED': 3,
            'NEW_BALANCE_UPDATE': 2,
            'BALANCE_CHECK_REQUIRED': 1
        };

        const maxPriority = Math.max(...events.map(event => priorityMap[event] || 1));
        return maxPriority;
    }

    async healthCheck() {
        if (!this.isConnected) {
            return {
                status: 'disconnected',
                message: 'Redis client not connected'
            };
        }

        try {
            await this.client.ping();
            return {
                status: 'healthy',
                message: 'Redis connection is working'
            };
        } catch (error) {
            return {
                status: 'unhealthy',
                message: `Redis health check failed: ${error.message}`
            };
        }
    }
}

// Create singleton instance
const redisQueueService = new RedisQueueService();

module.exports = {
    RedisQueueService,
    redisQueueService
}; 