const { ScheduledWalletClient } = require('./client/scheduled-wallet-client');

async function testScheduler() {
    const scheduler = new ScheduledWalletClient();
    
    console.log('🧪 Testing Scheduled Wallet Audit System');
    console.log('=========================================');
    
    try {
        // Test 1: Start the scheduler
        console.log('\n📋 Test 1: Starting scheduler with 4 workers');
        await scheduler.startScheduledAudit();
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Test 2: Check status
        console.log('\n📋 Test 2: Checking schedule status');
        await scheduler.getScheduleStatus();
        
        // Test 3: Scale to 6 workers
        console.log('\n📋 Test 3: Scaling to 6 workers');
        await scheduler.scaleWorkers(6);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 4: Check status again
        console.log('\n📋 Test 4: Checking status after scaling');
        await scheduler.getScheduleStatus();
        
        // Test 5: Scale to 8 workers
        console.log('\n📋 Test 5: Scaling to 8 workers');
        await scheduler.scaleWorkers(8);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 6: Trigger immediate run
        console.log('\n📋 Test 6: Triggering immediate run');
        await scheduler.triggerImmediateRun();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 7: Pause schedule
        console.log('\n📋 Test 7: Pausing schedule');
        await scheduler.pauseSchedule();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test 8: Resume schedule
        console.log('\n📋 Test 8: Resuming schedule');
        await scheduler.resumeSchedule();
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Test 9: Scale back to 4 workers
        console.log('\n📋 Test 9: Scaling back to 4 workers');
        await scheduler.scaleWorkers(4);
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Test 10: Final status check
        console.log('\n📋 Test 10: Final status check');
        await scheduler.getScheduleStatus();
        
        console.log('\n✅ All scheduler tests passed!');
        console.log('\n💡 Scheduler is still running. Use "npm run scheduler:stop" to stop it.');
        console.log('📋 Available commands:');
        console.log('  - npm run scheduler:status    (check status)');
        console.log('  - npm run scheduler:scale <N> (scale workers)');
        console.log('  - npm run scheduler:pause     (pause schedule)');
        console.log('  - npm run scheduler:resume    (resume schedule)');
        console.log('  - npm run scheduler:trigger   (trigger immediate run)');
        console.log('  - npm run scheduler:stop      (stop everything)');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        
        // Try to stop the scheduler if it's running
        try {
            await scheduler.stopScheduledAudit();
        } catch (stopError) {
            console.error('❌ Failed to stop scheduler:', stopError);
        }
        
        process.exit(1);
    }
}

// Run the test
if (require.main === module) {
    testScheduler().catch((err) => {
        console.error('❌ Test error:', err);
        process.exit(1);
    });
}

module.exports = { testScheduler }; 