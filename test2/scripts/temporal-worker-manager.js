const { Worker } = require('@temporalio/worker');
const { processWalletRange } = require('../activities/wallet-activities');
const { processAllWallets } = require('../workflows/wallet-workflow');
const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

class TemporalWorkerManager {
    constructor() {
        this.workers = new Map(); // Map of workerId -> { process, worker }
        this.workerPidFile = path.join(__dirname, '../.temporal-worker-pids.json');
        this.loadWorkerPids();
    }

    loadWorkerPids() {
        try {
            if (fs.existsSync(this.workerPidFile)) {
                const data = fs.readFileSync(this.workerPidFile, 'utf8');
                this.savedPids = JSON.parse(data);
            } else {
                this.savedPids = {};
            }
        } catch (error) {
            this.savedPids = {};
        }
    }

    saveWorkerPids() {
        const pids = {};
        this.workers.forEach((workerInfo, workerId) => {
            pids[workerId] = workerInfo.process.pid;
        });
        fs.writeFileSync(this.workerPidFile, JSON.stringify(pids, null, 2));
    }

    async discoverExistingWorkers() {
        console.log('🔍 Discovering existing Temporal worker processes...');
        
        try {
            const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH');
            const lines = stdout.split('\n').filter(line => line.trim());
            
            const existingWorkers = [];
            
            for (const line of lines) {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const pid = parseInt(parts[1].replace(/"/g, ''));
                    
                    try {
                        const { stdout: cmdline } = await execAsync(`wmic process where "ProcessId=${pid}" get CommandLine /format:list`);
                        if (cmdline.includes('wallet-worker.js')) {
                            const match = cmdline.match(/wallet-worker\.js\s+(\d+)/);
                            if (match) {
                                const workerId = parseInt(match[1]);
                                existingWorkers.push({ workerId, pid });
                                console.log(`  Found Temporal Worker ${workerId}: PID ${pid}`);
                            }
                        }
                    } catch (error) {
                        // Process might have died, skip it
                    }
                }
            }
            
            // Clear existing workers and add discovered ones
            this.workers.clear();
            existingWorkers.forEach(worker => {
                this.workers.set(worker.workerId, { 
                    process: { pid: worker.pid },
                    existing: true,
                    workerId: worker.workerId 
                });
            });
            
            console.log(`📋 Discovered ${existingWorkers.length} existing Temporal workers`);
            return existingWorkers.length;
            
        } catch (error) {
            console.log('📋 No existing workers found or error discovering workers');
            this.workers.clear();
            return 0;
        }
    }

    async startWorkers(targetCount) {
        console.log(`🔄 Managing Temporal workers: target ${targetCount}`);
        
        // First, discover any existing workers
        await this.discoverExistingWorkers();
        
        const currentCount = this.workers.size;
        console.log(`📊 Current worker count: ${currentCount}`);
        
        if (currentCount === targetCount) {
            console.log(`✅ Already have ${targetCount} workers running`);
            return;
        }
        
        if (currentCount > targetCount) {
            // Need to stop some workers
            console.log(`📉 Scaling down from ${currentCount} to ${targetCount} workers`);
            await this.stopWorkers(currentCount - targetCount);
        } else {
            // Need to start more workers
            console.log(`📈 Scaling up from ${currentCount} to ${targetCount} workers`);
            await this.startAdditionalWorkers(targetCount - currentCount);
        }
        
        // Verify final count and ensure proper cleanup
        await this.verifyWorkerCount(targetCount);
        console.log(`✅ Temporal worker management complete: ${this.workers.size} workers active`);
    }

    async startAdditionalWorkers(count) {
        // Find the next available worker ID
        const existingIds = Array.from(this.workers.keys()).sort((a, b) => a - b);
        let nextId = 1;
        
        for (const id of existingIds) {
            if (id === nextId) {
                nextId++;
            } else {
                break;
            }
        }
        
        console.log(`🚀 Starting ${count} additional Temporal workers from ID ${nextId}`);
        
        for (let i = 0; i < count; i++) {
            const workerId = nextId + i;
            await this.startWorker(workerId);
        }
    }

    async startWorker(workerId) {
        console.log(`  Starting Temporal Worker ${workerId}...`);
        
        const worker = spawn('node', ['workers/wallet-worker.js', workerId.toString()], {
            stdio: 'pipe',
            shell: true,
            detached: false
        });
        
        worker.stdout.on('data', (data) => {
            console.log(`[Worker ${workerId}] ${data.toString().trim()}`);
        });
        
        worker.stderr.on('data', (data) => {
            console.error(`[Worker ${workerId} ERROR] ${data.toString().trim()}`);
        });
        
        worker.on('error', (error) => {
            console.error(`❌ Worker ${workerId} error:`, error);
            this.workers.delete(workerId);
        });
        
        worker.on('exit', (code) => {
            console.log(`  Worker ${workerId} exited with code ${code}`);
            this.workers.delete(workerId);
            this.saveWorkerPids();
        });
        
        this.workers.set(workerId, { process: worker, workerId });
        this.saveWorkerPids();
        
        // Wait for worker to start and connect to Temporal
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log(`✅ Temporal Worker ${workerId} started (PID: ${worker.pid})`);
    }

    async stopWorkers(count) {
        const workerIds = Array.from(this.workers.keys()).sort((a, b) => b - a).slice(0, count);
        
        console.log(`🛑 Stopping Temporal workers: ${workerIds.join(', ')}`);
        
        for (const workerId of workerIds) {
            await this.stopWorker(workerId);
        }
        
        // Wait for processes to fully terminate and disconnect from Temporal
        await new Promise(resolve => setTimeout(resolve, 5000));
    }

    async stopWorker(workerId) {
        const workerInfo = this.workers.get(workerId);
        if (!workerInfo) return;
        
        console.log(`  Stopping Temporal Worker ${workerId}...`);
        
        if (workerInfo.existing) {
            // This is an existing worker, send SIGINT first for graceful shutdown
            try {
                // Try graceful shutdown first
                process.kill(workerInfo.process.pid, 'SIGINT');
                console.log(`  Sent SIGINT to Worker ${workerId} for graceful shutdown`);
                
                // Wait a bit for graceful shutdown
                await new Promise(resolve => setTimeout(resolve, 3000));
                
                // Check if process is still running
                if (this.isProcessRunning(workerInfo.process.pid)) {
                    console.log(`  Force killing Worker ${workerId}`);
                    await execAsync(`taskkill /PID ${workerInfo.process.pid} /F`);
                }
                
                console.log(`✅ Worker ${workerId} (existing) stopped`);
                this.workers.delete(workerId);
                this.saveWorkerPids();
            } catch (error) {
                console.log(`⚠️  Worker ${workerId} already stopped or not found`);
                this.workers.delete(workerId);
                this.saveWorkerPids();
            }
            return;
        }
        
        return new Promise((resolve) => {
            const worker = workerInfo.process;
            
            worker.on('exit', () => {
                console.log(`✅ Worker ${workerId} stopped gracefully`);
                this.workers.delete(workerId);
                this.saveWorkerPids();
                resolve();
            });
            
            // Send SIGINT for graceful shutdown
            worker.kill('SIGINT');
            
            // Force kill after 5 seconds if graceful shutdown fails
            setTimeout(() => {
                if (this.workers.has(workerId)) {
                    console.log(`⚠️  Force killing Worker ${workerId}`);
                    try {
                        worker.kill('SIGKILL');
                    } catch (error) {
                        // Process might already be dead
                    }
                }
            }, 5000);
        });
    }

    async stopAllWorkers() {
        console.log('🛑 Stopping all Temporal workers...');
        await this.discoverExistingWorkers();
        
        const workerIds = Array.from(this.workers.keys());
        
        for (const workerId of workerIds) {
            await this.stopWorker(workerId);
        }
        
        // Wait for all processes to terminate and disconnect from Temporal
        await new Promise(resolve => setTimeout(resolve, 8000));
        
        // Final cleanup
        await this.discoverExistingWorkers();
        console.log('✅ All Temporal workers stopped');
    }

    async verifyWorkerCount(expectedCount) {
        console.log(`🔍 Verifying worker count (expected: ${expectedCount})...`);
        
        // Wait a moment for processes to fully start/stop
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Rediscover workers to get accurate count
        await this.discoverExistingWorkers();
        
        const actualCount = this.workers.size;
        console.log(`📊 Actual worker count: ${actualCount}`);
        
        if (actualCount !== expectedCount) {
            console.log(`⚠️  Worker count mismatch! Expected: ${expectedCount}, Actual: ${actualCount}`);
            
            if (actualCount > expectedCount) {
                // Stop extra workers
                const extraCount = actualCount - expectedCount;
                console.log(`🛑 Stopping ${extraCount} extra workers...`);
                await this.stopWorkers(extraCount);
            } else if (actualCount < expectedCount) {
                // Start missing workers
                const missingCount = expectedCount - actualCount;
                console.log(`🚀 Starting ${missingCount} missing workers...`);
                await this.startAdditionalWorkers(missingCount);
            }
            
            // Final verification
            await new Promise(resolve => setTimeout(resolve, 2000));
            await this.discoverExistingWorkers();
            console.log(`📊 Final worker count: ${this.workers.size}`);
        } else {
            console.log(`✅ Worker count verified: ${actualCount}`);
        }
    }

    getWorkerCount() {
        return this.workers.size;
    }

    getWorkerStatus() {
        const status = [];
        this.workers.forEach((workerInfo, workerId) => {
            status.push({
                workerId,
                pid: workerInfo.process.pid,
                running: !workerInfo.existing || this.isProcessRunning(workerInfo.process.pid),
                existing: workerInfo.existing || false
            });
        });
        return status;
    }

    isProcessRunning(pid) {
        try {
            process.kill(pid, 0);
            return true;
        } catch (error) {
            return false;
        }
    }
}

// Export for use in other modules
module.exports = { TemporalWorkerManager };

// Allow running standalone
if (require.main === module) {
    const command = process.argv[2];
    const count = process.argv[3] ? parseInt(process.argv[3]) : 4;
    
    const manager = new TemporalWorkerManager();
    
    async function main() {
        try {
            switch (command) {
                case 'start':
                    await manager.startWorkers(count);
                    break;
                case 'stop':
                    await manager.stopAllWorkers();
                    break;
                case 'status':
                    await manager.discoverExistingWorkers();
                    const status = manager.getWorkerStatus();
                    console.log(`📊 Temporal Worker Status: ${status.length} workers running`);
                    status.forEach(worker => {
                        console.log(`  Worker ${worker.workerId}: PID ${worker.pid} (${worker.running ? 'running' : 'stopped'}) ${worker.existing ? '[existing]' : ''}`);
                    });
                    break;
                default:
                    console.error('Usage: node scripts/temporal-worker-manager.js <command> [count]');
                    console.error('Commands: start, stop, status');
                    console.error('Examples:');
                    console.error('  node scripts/temporal-worker-manager.js start 6');
                    console.error('  node scripts/temporal-worker-manager.js stop');
                    console.error('  node scripts/temporal-worker-manager.js status');
                    process.exit(1);
            }
        } catch (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }
    }
    
    main();
} 