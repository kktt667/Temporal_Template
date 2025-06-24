const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const execAsync = promisify(exec);

class WorkerManager {
    constructor() {
        this.workers = new Map(); // Map of workerId -> process
        this.workerPidFile = path.join(__dirname, '../.worker-pids.json');
        this.workerLockFile = path.join(__dirname, '../.worker-lock.json');
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
        this.workers.forEach((process, workerId) => {
            pids[workerId] = process.pid;
        });
        fs.writeFileSync(this.workerPidFile, JSON.stringify(pids, null, 2));
    }

    async discoverExistingWorkers() {
        console.log('🔍 Discovering existing worker processes...');
        
        try {
            // Use a more reliable method to find our specific workers
            const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH');
            const lines = stdout.split('\n').filter(line => line.trim());
            
            const existingWorkers = [];
            
            for (const line of lines) {
                const parts = line.split(',');
                if (parts.length >= 2) {
                    const pid = parseInt(parts[1].replace(/"/g, ''));
                    
                    // Check if this process is running our worker
                    try {
                        const { stdout: cmdline } = await execAsync(`wmic process where "ProcessId=${pid}" get CommandLine /format:list`);
                        if (cmdline.includes('wallet-worker.js')) {
                            // Extract worker ID from command line
                            const match = cmdline.match(/wallet-worker\.js\s+(\d+)/);
                            if (match) {
                                const workerId = parseInt(match[1]);
                                existingWorkers.push({ workerId, pid });
                                console.log(`  Found Worker ${workerId}: PID ${pid}`);
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
                    pid: worker.pid, 
                    existing: true,
                    workerId: worker.workerId 
                });
            });
            
            console.log(`📋 Discovered ${existingWorkers.length} existing workers`);
            return existingWorkers.length;
            
        } catch (error) {
            console.log('📋 No existing workers found or error discovering workers');
            this.workers.clear();
            return 0;
        }
    }

    async startWorkers(targetCount) {
        console.log(`🔄 Managing workers: target ${targetCount}`);
        
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
        
        // Verify final count
        await this.discoverExistingWorkers();
        console.log(`✅ Worker management complete: ${this.workers.size} workers active`);
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
        
        console.log(`🚀 Starting ${count} additional workers from ID ${nextId}`);
        
        for (let i = 0; i < count; i++) {
            const workerId = nextId + i;
            await this.startWorker(workerId);
        }
    }

    async startWorker(workerId) {
        console.log(`  Starting Worker ${workerId}...`);
        
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
        
        this.workers.set(workerId, worker);
        this.saveWorkerPids();
        
        // Wait a moment for worker to start
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`✅ Worker ${workerId} started (PID: ${worker.pid})`);
    }

    async stopWorkers(count) {
        const workerIds = Array.from(this.workers.keys()).sort((a, b) => b - a).slice(0, count);
        
        console.log(`🛑 Stopping workers: ${workerIds.join(', ')}`);
        
        for (const workerId of workerIds) {
            await this.stopWorker(workerId);
        }
        
        // Wait a moment for processes to fully terminate
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    async stopWorker(workerId) {
        const worker = this.workers.get(workerId);
        if (!worker) return;
        
        console.log(`  Stopping Worker ${workerId}...`);
        
        if (worker.existing) {
            // This is an existing worker, kill by PID
            try {
                await execAsync(`taskkill /PID ${worker.pid} /F`);
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
            worker.on('exit', () => {
                console.log(`✅ Worker ${workerId} stopped`);
                this.workers.delete(workerId);
                this.saveWorkerPids();
                resolve();
            });
            
            worker.kill('SIGINT');
            
            // Force kill after 3 seconds if graceful shutdown fails
            setTimeout(() => {
                if (this.workers.has(workerId)) {
                    console.log(`⚠️  Force killing Worker ${workerId}`);
                    try {
                        worker.kill('SIGKILL');
                    } catch (error) {
                        // Process might already be dead
                    }
                }
            }, 3000);
        });
    }

    async stopAllWorkers() {
        console.log('🛑 Stopping all workers...');
        await this.discoverExistingWorkers(); // Make sure we have all workers
        
        const workerIds = Array.from(this.workers.keys());
        
        for (const workerId of workerIds) {
            await this.stopWorker(workerId);
        }
        
        // Wait for all processes to terminate
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Final cleanup
        await this.discoverExistingWorkers();
        console.log('✅ All workers stopped');
    }

    getWorkerCount() {
        return this.workers.size;
    }

    getWorkerStatus() {
        const status = [];
        this.workers.forEach((worker, workerId) => {
            status.push({
                workerId,
                pid: worker.pid,
                running: !worker.existing || this.isProcessRunning(worker.pid),
                existing: worker.existing || false
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
module.exports = { WorkerManager };

// Allow running standalone
if (require.main === module) {
    const command = process.argv[2];
    const count = process.argv[3] ? parseInt(process.argv[3]) : 4;
    
    const manager = new WorkerManager();
    
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
                    console.log(`📊 Worker Status: ${status.length} workers running`);
                    status.forEach(worker => {
                        console.log(`  Worker ${worker.workerId}: PID ${worker.pid} (${worker.running ? 'running' : 'stopped'}) ${worker.existing ? '[existing]' : ''}`);
                    });
                    break;
                default:
                    console.error('Usage: node scripts/worker-manager.js <command> [count]');
                    console.error('Commands: start, stop, status');
                    console.error('Examples:');
                    console.error('  node scripts/worker-manager.js start 6');
                    console.error('  node scripts/worker-manager.js stop');
                    console.error('  node scripts/worker-manager.js status');
                    process.exit(1);
            }
        } catch (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }
    }
    
    main();
} 