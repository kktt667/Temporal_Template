const { spawn } = require('child_process');
const path = require('path');

class RateLimitSystemManager {
    constructor() {
        this.processes = new Map();
        this.isShuttingDown = false;
    }

    /**
     * Start the complete rate limit system
     */
    async startSystem() {
        console.log('🚀 Starting Complete Rate Limit System...');
        console.log('==========================================');
        
        try {
            // Start rate limit worker
            await this.startRateLimitWorker();
            
            // Wait a moment for worker to initialize
            await this.sleep(3000);
            
            // Start rate limit manager workflow
            await this.startRateLimitManager();
            
            console.log('\n✅ Rate Limit System Started Successfully!');
            console.log('📊 Monitor your system:');
            console.log('  - Temporal UI: http://localhost:8233');
            console.log('  - Redis Commander: http://localhost:8081');
            console.log('  - Queue Stats: npm run queue:stats');
            console.log('  - Rate Limit Status: npm run rate-limit:list');
            
        } catch (error) {
            console.error('❌ Failed to start rate limit system:', error);
            await this.shutdown();
            process.exit(1);
        }
    }

    /**
     * Start the rate limit worker
     */
    async startRateLimitWorker() {
        console.log('👷 Starting Rate Limit Worker...');
        
        const worker = spawn('npm', ['run', 'rate-limit:worker'], {
            stdio: 'pipe',
            shell: true
        });

        worker.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('✅ Rate Limit Manager Worker started')) {
                console.log('✅ Rate Limit Worker is ready');
            }
            process.stdout.write(`[Worker] ${output}`);
        });

        worker.stderr.on('data', (data) => {
            process.stderr.write(`[Worker Error] ${data}`);
        });

        worker.on('close', (code) => {
            if (!this.isShuttingDown) {
                console.log(`❌ Rate Limit Worker exited with code ${code}`);
            }
        });

        this.processes.set('rate-limit-worker', worker);
        
        // Wait for worker to be ready
        await this.waitForWorkerReady();
    }

    /**
     * Start the rate limit manager workflow
     */
    async startRateLimitManager() {
        console.log('🎯 Starting Rate Limit Manager Workflow...');
        
        const manager = spawn('npm', ['run', 'rate-limit:start'], {
            stdio: 'pipe',
            shell: true
        });

        manager.stdout.on('data', (data) => {
            const output = data.toString();
            if (output.includes('✅ Rate Limit Manager started')) {
                console.log('✅ Rate Limit Manager Workflow started');
            }
            process.stdout.write(`[Manager] ${output}`);
        });

        manager.stderr.on('data', (data) => {
            process.stderr.write(`[Manager Error] ${data}`);
        });

        manager.on('close', (code) => {
            if (!this.isShuttingDown) {
                console.log(`❌ Rate Limit Manager exited with code ${code}`);
            }
        });

        this.processes.set('rate-limit-manager', manager);
    }

    /**
     * Wait for worker to be ready
     */
    async waitForWorkerReady() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                // Check if worker is ready by looking for specific output
                // This is a simple check - in production you might want a more robust health check
                resolve();
                clearInterval(checkInterval);
            }, 1000);
            
            // Timeout after 30 seconds
            setTimeout(() => {
                clearInterval(checkInterval);
                resolve();
            }, 30000);
        });
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        if (this.isShuttingDown) return;
        
        this.isShuttingDown = true;
        console.log('\n🛑 Shutting down Rate Limit System...');
        
        // Stop all processes
        for (const [name, process] of this.processes) {
            console.log(`🛑 Stopping ${name}...`);
            process.kill('SIGTERM');
        }
        
        // Wait for processes to terminate
        await this.sleep(5000);
        
        // Force kill if still running
        for (const [name, process] of this.processes) {
            if (!process.killed) {
                console.log(`💀 Force killing ${name}...`);
                process.kill('SIGKILL');
            }
        }
        
        console.log('✅ Rate Limit System shutdown complete');
    }

    /**
     * Sleep utility
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Monitor system status
     */
    async monitorSystem() {
        console.log('\n📊 System Status:');
        console.log('================');
        
        for (const [name, process] of this.processes) {
            const status = process.killed ? '❌ Stopped' : '✅ Running';
            console.log(`  ${name}: ${status}`);
        }
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    if (global.systemManager) {
        await global.systemManager.shutdown();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    if (global.systemManager) {
        await global.systemManager.shutdown();
    }
    process.exit(0);
});

// Start the system
async function main() {
    const systemManager = new RateLimitSystemManager();
    global.systemManager = systemManager;
    
    await systemManager.startSystem();
    
    // Keep the process running
    console.log('\n🔄 Rate Limit System is running. Press Ctrl+C to stop.');
    
    // Monitor system every 30 seconds
    setInterval(() => {
        systemManager.monitorSystem();
    }, 30000);
}

if (require.main === module) {
    main().catch((error) => {
        console.error('❌ System startup failed:', error);
        process.exit(1);
    });
}

module.exports = { RateLimitSystemManager }; 