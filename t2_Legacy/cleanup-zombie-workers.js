const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function cleanupZombieWorkers() {
    console.log('🧹 Cleaning up zombie workers...');
    console.log('==============================');
    
    try {
        // Find all Node.js processes
        const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH');
        const lines = stdout.split('\n').filter(line => line.trim());
        
        const zombieWorkers = [];
        
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
                            zombieWorkers.push({ workerId, pid });
                            console.log(`  Found zombie worker ${workerId}: PID ${pid}`);
                        }
                    }
                } catch (error) {
                    // Process might have died, skip it
                }
            }
        }
        
        if (zombieWorkers.length === 0) {
            console.log('✅ No zombie workers found');
            return;
        }
        
        console.log(`📊 Found ${zombieWorkers.length} zombie workers`);
        
        // Kill all zombie workers
        for (const worker of zombieWorkers) {
            try {
                console.log(`  Killing zombie worker ${worker.workerId} (PID: ${worker.pid})...`);
                
                // Try graceful shutdown first
                process.kill(worker.pid, 'SIGINT');
                console.log(`    Sent SIGINT to worker ${worker.workerId}`);
                
                // Wait a moment for graceful shutdown
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Check if process is still running
                try {
                    process.kill(worker.pid, 0);
                    console.log(`    Force killing worker ${worker.workerId}`);
                    await execAsync(`taskkill /PID ${worker.pid} /F`);
                } catch (error) {
                    console.log(`    Worker ${worker.workerId} already stopped`);
                }
                
                console.log(`✅ Zombie worker ${worker.workerId} cleaned up`);
                
            } catch (error) {
                console.error(`❌ Failed to kill zombie worker ${worker.workerId}:`, error.message);
            }
        }
        
        console.log('\n✅ Zombie worker cleanup completed');
        
        // Final check
        console.log('\n🔍 Final check for remaining workers...');
        const { stdout: finalCheck } = await execAsync('tasklist /FI "IMAGENAME eq node.exe" /FO CSV /NH');
        const finalLines = finalCheck.split('\n').filter(line => line.trim());
        
        let remainingWorkers = 0;
        for (const line of finalLines) {
            const parts = line.split(',');
            if (parts.length >= 2) {
                const pid = parseInt(parts[1].replace(/"/g, ''));
                
                try {
                    const { stdout: cmdline } = await execAsync(`wmic process where "ProcessId=${pid}" get CommandLine /format:list`);
                    if (cmdline.includes('wallet-worker.js')) {
                        remainingWorkers++;
                    }
                } catch (error) {
                    // Process might have died, skip it
                }
            }
        }
        
        console.log(`📊 Remaining workers: ${remainingWorkers}`);
        
    } catch (error) {
        console.error('❌ Cleanup failed:', error);
        process.exit(1);
    }
}

// Run the cleanup
if (require.main === module) {
    cleanupZombieWorkers().catch((err) => {
        console.error('❌ Cleanup error:', err);
        process.exit(1);
    });
}

module.exports = { cleanupZombieWorkers }; 