const { Client } = require('@temporalio/client');

async function checkWorkers() {
    const client = new Client();
    
    try {
        console.log('Checking Temporal worker status...\n');
        
        // Get workflow executions
        const workflows = await client.workflow.list();
        
        console.log(`Found ${workflows.length} total workflow executions:\n`);
        
        let walletWorkflows = 0;
        for (const workflow of workflows) {
            if (workflow.type && workflow.type.name === 'processAllWallets') {
                walletWorkflows++;
                console.log(`Wallet Processing Workflow:`);
                console.log(`  ID: ${workflow.workflowId}`);
                console.log(`  Status: ${workflow.status.name}`);
                console.log(`  Start Time: ${workflow.startTime}`);
                console.log(`  End Time: ${workflow.closeTime || 'Still running'}`);
                console.log(`  Task Queue: ${workflow.taskQueue}`);
                console.log('---');
            }
        }
        
        if (walletWorkflows === 0) {
            console.log('No wallet processing workflows found.');
        }
        
        // You can also check the Temporal UI at http://localhost:8233
        console.log('\nFor detailed worker information, visit:');
        console.log('Temporal UI: http://localhost:8233');
        console.log('Look for multiple workers in the "Workers" section');
        console.log('\nTo see true parallel processing:');
        console.log('1. Make sure you ran start-workers.bat (which opens 4 worker windows)');
        console.log('2. Check the Temporal UI Workers section');
        console.log('3. You should see multiple worker processes handling tasks in parallel');
        
    } catch (error) {
        console.error('Error checking workers:', error);
    } finally {
        await client.connection.close();
    }
}

if (require.main === module) {
    checkWorkers().catch(console.error);
}

module.exports = { checkWorkers }; 