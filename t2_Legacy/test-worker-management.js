const { TemporalWorkerManager } = require('./scripts/temporal-worker-manager');

async function testWorkerManagement() {
    const manager = new TemporalWorkerManager();
    
    console.log('🧪 Testing Temporal Worker Management');
    console.log('=====================================');
    
    try {
        // Test 1: Start with 4 workers
        console.log('\n📋 Test 1: Starting 4 workers');
        await manager.startWorkers(4);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 2: Scale up to 8 workers
        console.log('\n📋 Test 2: Scaling up to 8 workers');
        await manager.startWorkers(8);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 3: Scale down to 6 workers
        console.log('\n📋 Test 3: Scaling down to 6 workers');
        await manager.startWorkers(6);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 4: Scale up to 10 workers
        console.log('\n📋 Test 4: Scaling up to 10 workers');
        await manager.startWorkers(10);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 5: Scale down to 4 workers
        console.log('\n📋 Test 5: Scaling down to 4 workers');
        await manager.startWorkers(4);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Final status check
        console.log('\n📋 Final Status Check');
        await manager.discoverExistingWorkers();
        const status = manager.getWorkerStatus();
        console.log(`📊 Final Worker Status: ${status.length} workers running`);
        status.forEach(worker => {
            console.log(`  Worker ${worker.workerId}: PID ${worker.pid} (${worker.running ? 'running' : 'stopped'})`);
        });
        
        console.log('\n✅ Worker management test completed successfully!');
        console.log('💡 Workers are still running. Use "npm run workers:stop" to stop them.');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testWorkerManagement().catch((err) => {
        console.error('❌ Test error:', err);
        process.exit(1);
    });
}

module.exports = { testWorkerManagement }; 