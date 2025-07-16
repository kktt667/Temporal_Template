const { spawn } = require('child_process');
const path = require('path');

/**
 * RLM Worker Manager
 * 
 * Manages RLM-specific workers for processing queued events.
 * Separate from the audit system worker manager.
 */

class RLMWorkerManager {
    constructor() {
        this.workers = new Map(); // workerId -> process
        this.workerScript = path.join(__dirname, '../workers/rlm-worker.js');
        this.taskQueue = 'rlm-processing';
        this.maxWorkers = 20; // Maximum RLM workers allowed
        this.workerCounter = 0;
    }

    /**
     * Discover existing RLM worker processes
     */
    async discoverExistingWorkers() {
        console.log('🔍 [RLM Worker Manager] Discovering existing RLM workers...');
        
        const existingWorkers = [];
        
        // Check for existing RLM worker processes
        for (const [workerId, process] of this.workers.entries()) {
            if (process && !process.killed) {
                existingWorkers.push({
                    id: workerId,
                    pid: process.pid,
                    status: 'running'
                });
            } else {
                // Clean up dead workers
                this.workers.delete(workerId);
            }
        }
        
        console.log(`📋 [RLM Worker Manager] Found ${existingWorkers.length} existing RLM workers`);
        return existingWorkers;
    }

    /**
     * Start a new RLM worker
     */
    async startWorker(workerId = null) {
        if (!workerId) {
            this.workerCounter++;
            workerId = `rlm-worker-${this.workerCounter}`;
        }
        
        if (this.workers.size >= this.maxWorkers) {
            throw new Error(`Maximum RLM workers (${this.maxWorkers}) reached`);
        }
        
        console.log(`🚀 [RLM Worker Manager] Starting RLM worker: ${workerId}`);
        
        try {
            const workerProcess = spawn('node', [this.workerScript, workerId], {
                stdio: ['pipe', 'pipe', 'pipe'],
                detached: false
            });
            
            // Store worker process
            this.workers.set(workerId, workerProcess);
            
            // Handle worker output
            workerProcess.stdout.on('data', (data) => {
                console.log(`[${workerId}] ${data.toString().trim()}`);
            });
            
            workerProcess.stderr.on('data', (data) => {
                console.error(`[${workerId} ERROR] ${data.toString().trim()}`);
            });
            
            // Handle worker exit
            workerProcess.on('exit', (code, signal) => {
                console.log(`[${workerId}] Worker exited with code ${code} and signal ${signal}`);
                this.workers.delete(workerId);
            });
            
            // Handle worker errors
            workerProcess.on('error', (error) => {
                console.error(`[${workerId}] Worker error:`, error);
                this.workers.delete(workerId);
            });
            
            // Wait a moment for worker to start
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            console.log(`✅ [RLM Worker Manager] RLM worker ${workerId} started (PID: ${workerProcess.pid})`);
            
            return {
                workerId: workerId,
                pid: workerProcess.pid,
                status: 'started'
            };
            
        } catch (error) {
            console.error(`❌ [RLM Worker Manager] Failed to start RLM worker ${workerId}:`, error);
            throw error;
        }
    }

    /**
     * Stop a specific RLM worker
     */
    async stopWorker(workerId) {
        console.log(`🛑 [RLM Worker Manager] Stopping RLM worker: ${workerId}`);
        
        const workerProcess = this.workers.get(workerId);
        if (!workerProcess) {
            console.log(`⚠️ [RLM Worker Manager] RLM worker ${workerId} not found`);
            return false;
        }
        
        try {
            // Gracefully terminate the worker
            workerProcess.kill('SIGTERM');
            
            // Wait for graceful shutdown
            await new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.log(`⏰ [RLM Worker Manager] Force killing RLM worker ${workerId}`);
                    workerProcess.kill('SIGKILL');
                    resolve();
                }, 5000); // 5 second timeout
                
                workerProcess.on('exit', () => {
                    clearTimeout(timeout);
                    resolve();
                });
            });
            
            this.workers.delete(workerId);
            console.log(`✅ [RLM Worker Manager] RLM worker ${workerId} stopped`);
            return true;
            
        } catch (error) {
            console.error(`❌ [RLM Worker Manager] Failed to stop RLM worker ${workerId}:`, error);
            return false;
        }
    }

    /**
     * Scale RLM workers to target count
     */
    async scaleWorkers(targetCount) {
        console.log(`⚡ [RLM Worker Manager] Scaling RLM workers to ${targetCount}`);
        
        if (targetCount < 0 || targetCount > this.maxWorkers) {
            throw new Error(`Invalid target worker count: ${targetCount}. Must be between 0 and ${this.maxWorkers}`);
        }
        
        const currentWorkers = await this.discoverExistingWorkers();
        const currentCount = currentWorkers.length;
        
        console.log(`📊 [RLM Worker Manager] Current: ${currentCount}, Target: ${targetCount}`);
        
        if (currentCount === targetCount) {
            console.log(`✅ [RLM Worker Manager] No scaling needed`);
            return {
                action: 'none',
                currentWorkers: currentCount,
                targetWorkers: targetCount,
                startedWorkers: 0,
                stoppedWorkers: 0
            };
        }
        
        if (currentCount < targetCount) {
            // Scale up
            const workersToStart = targetCount - currentCount;
            console.log(`📈 [RLM Worker Manager] Scaling up: starting ${workersToStart} workers`);
            
            const startedWorkers = [];
            for (let i = 0; i < workersToStart; i++) {
                try {
                    const worker = await this.startWorker();
                    startedWorkers.push(worker);
                } catch (error) {
                    console.error(`❌ [RLM Worker Manager] Failed to start worker ${i + 1}:`, error);
                }
            }
            
            console.log(`✅ [RLM Worker Manager] Scaled up: ${startedWorkers.length} workers started`);
            
            return {
                action: 'scale_up',
                currentWorkers: currentCount + startedWorkers.length,
                targetWorkers: targetCount,
                startedWorkers: startedWorkers.length,
                stoppedWorkers: 0
            };
            
        } else {
            // Scale down
            const workersToStop = currentCount - targetCount;
            console.log(`📉 [RLM Worker Manager] Scaling down: stopping ${workersToStop} workers`);
            
            const stoppedWorkers = [];
            const workerIds = Array.from(this.workers.keys()).slice(0, workersToStop);
            
            for (const workerId of workerIds) {
                try {
                    const stopped = await this.stopWorker(workerId);
                    if (stopped) {
                        stoppedWorkers.push(workerId);
                    }
                } catch (error) {
                    console.error(`❌ [RLM Worker Manager] Failed to stop worker ${workerId}:`, error);
                }
            }
            
            console.log(`✅ [RLM Worker Manager] Scaled down: ${stoppedWorkers.length} workers stopped`);
            
            return {
                action: 'scale_down',
                currentWorkers: currentCount - stoppedWorkers.length,
                targetWorkers: targetCount,
                startedWorkers: 0,
                stoppedWorkers: stoppedWorkers.length
            };
        }
    }

    /**
     * Stop all RLM workers
     */
    async stopAllWorkers() {
        console.log(`🛑 [RLM Worker Manager] Stopping all RLM workers...`);
        
        const workerIds = Array.from(this.workers.keys());
        const stoppedWorkers = [];
        
        for (const workerId of workerIds) {
            try {
                const stopped = await this.stopWorker(workerId);
                if (stopped) {
                    stoppedWorkers.push(workerId);
                }
            } catch (error) {
                console.error(`❌ [RLM Worker Manager] Failed to stop worker ${workerId}:`, error);
            }
        }
        
        console.log(`✅ [RLM Worker Manager] Stopped ${stoppedWorkers.length} RLM workers`);
        
        return {
            totalWorkers: workerIds.length,
            stoppedWorkers: stoppedWorkers.length
        };
    }

    /**
     * Get current worker status
     */
    async getWorkerStatus() {
        const workers = await this.discoverExistingWorkers();
        
        return {
            totalWorkers: workers.length,
            maxWorkers: this.maxWorkers,
            workers: workers,
            taskQueue: this.taskQueue
        };
    }
}

// Create singleton instance
const rlmWorkerManager = new RLMWorkerManager();

/**
 * Scale RLM workers activity
 */
async function scaleRLMWorkers(targetCount) {
    console.log(`🎯 [RLM] Scaling RLM workers to ${targetCount}`);
    
    try {
        const result = await rlmWorkerManager.scaleWorkers(targetCount);
        
        console.log(`✅ [RLM] Worker scaling completed:`, result);
        
        return {
            success: true,
            activeWorkers: result.currentWorkers,
            scalingResult: result
        };
        
    } catch (error) {
        console.error(`❌ [RLM] Worker scaling failed:`, error);
        
        return {
            success: false,
            error: error.message,
            activeWorkers: 0
        };
    }
}

/**
 * Get RLM worker status activity
 */
async function getRLMWorkerStatus() {
    try {
        const status = await rlmWorkerManager.getWorkerStatus();
        return status;
    } catch (error) {
        console.error(`❌ [RLM] Failed to get worker status:`, error);
        return {
            error: error.message,
            totalWorkers: 0
        };
    }
}

module.exports = {
    scaleRLMWorkers,
    getRLMWorkerStatus,
    RLMWorkerManager,
    rlmWorkerManager
}; 