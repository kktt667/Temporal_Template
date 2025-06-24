const { TemporalWorkerManager } = require('./scripts/temporal-worker-manager');

async function testScalingDown() {
    const manager = new TemporalWorkerManager();
    
    console.log('🧪 Testing Scaling Down Functionality');
    console.log('=====================================');
    
    try {
        // Test 1: Start with 6 workers
        console.log('\n📋 Test 1: Starting 6 workers');
        await manager.startWorkers(6);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Verify we have 6 workers
        await manager.discoverExistingWorkers();
        const status1 = manager.getWorkerStatus();
        console.log(`📊 Workers after starting 6: ${status1.length}`);
        status1.forEach(worker => {
            console.log(`  Worker ${worker.workerId}: PID ${worker.pid} (${worker.running ? 'running' : 'stopped'})`);
        });
        
        // Test 2: Scale down to 4 workers
        console.log('\n📋 Test 2: Scaling down to 4 workers');
        await manager.startWorkers(4);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Longer wait for proper cleanup
        
        // Verify we have exactly 4 workers
        await manager.discoverExistingWorkers();
        const status2 = manager.getWorkerStatus();
        console.log(`📊 Workers after scaling down to 4: ${status2.length}`);
        status2.forEach(worker => {
            console.log(`  Worker ${worker.workerId}: PID ${worker.pid} (${worker.running ? 'running' : 'stopped'})`);
        });
        
        if (status2.length !== 4) {
            console.log(`❌ ERROR: Expected 4 workers, but found ${status2.length}`);
            console.log('🔄 Attempting to fix worker count...');
            await manager.verifyWorkerCount(4);
            
            // Final verification
            await manager.discoverExistingWorkers();
            const finalStatus = manager.getWorkerStatus();
            console.log(`📊 Final worker count after fix: ${finalStatus.length}`);
            finalStatus.forEach(worker => {
                console.log(`  Worker ${worker.workerId}: PID ${worker.pid} (${worker.running ? 'running' : 'stopped'})`);
            });
        } else {
            console.log('✅ Scaling down test passed!');
        }
        
        // Test 3: Scale up to 8 workers
        console.log('\n📋 Test 3: Scaling up to 8 workers');
        await manager.startWorkers(8);
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test 4: Scale down to 2 workers
        console.log('\n📋 Test 4: Scaling down to 2 workers');
        await manager.startWorkers(2);
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Final verification
        await manager.discoverExistingWorkers();
        const finalStatus = manager.getWorkerStatus();
        console.log(`📊 Final worker count: ${finalStatus.length}`);
        finalStatus.forEach(worker => {
            console.log(`  Worker ${worker.workerId}: PID ${worker.pid} (${worker.running ? 'running' : 'stopped'})`);
        });
        
        if (finalStatus.length === 2) {
            console.log('\n✅ All scaling down tests passed!');
        } else {
            console.log(`\n❌ Final test failed: Expected 2 workers, found ${finalStatus.length}`);
        }
        
        console.log('\n💡 Workers are still running. Use "npm run workers:stop" to stop them.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testScalingDown().catch((err) => {
        console.error('❌ Test error:', err);
        process.exit(1);
    });
}

module.exports = { testScalingDown }; 