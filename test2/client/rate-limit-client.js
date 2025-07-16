const { Client } = require('@temporalio/client');
const { rateLimitManagerWorkflow } = require('../workflows/rate-limit-manager');

class RateLimitManagerClient {
    constructor() {
        this.client = new Client();
        this.workflowId = 'rate-limit-manager';
    }

    /**
     * Start the rate limit manager workflow
     */
    async startManager() {
        try {
            console.log('🚀 Starting Rate Limit Manager Workflow...');
            
            const handle = await this.client.workflow.start(rateLimitManagerWorkflow, {
                taskQueue: 'rate-limit-processing',
                workflowId: `${this.workflowId}-${Date.now()}`,
                executionTimeout: '30 minutes'
            });

            console.log(`✅ Rate Limit Manager started with workflow ID: ${handle.workflowId}`);
            console.log(`🔗 Workflow URL: http://localhost:8233/namespaces/default/workflows/${handle.workflowId}`);
            
            return handle;
        } catch (error) {
            console.error('❌ Failed to start rate limit manager:', error);
            throw error;
        }
    }

    /**
     * Get workflow status
     */
    async getStatus(workflowId) {
        try {
            const handle = this.client.workflow.getHandle(workflowId);
            const status = await handle.describe();
            
            console.log(`📊 Workflow Status: ${status.status.name}`);
            console.log(`⏰ Started: ${status.startTime}`);
            console.log(`🆔 Workflow ID: ${status.workflowId}`);
            
            return status;
        } catch (error) {
            console.error('❌ Failed to get workflow status:', error);
            throw error;
        }
    }

    /**
     * Stop the rate limit manager workflow
     */
    async stopManager(workflowId) {
        try {
            const handle = this.client.workflow.getHandle(workflowId);
            await handle.cancel();
            
            console.log(`🛑 Rate Limit Manager workflow ${workflowId} cancelled`);
            return true;
        } catch (error) {
            console.error('❌ Failed to stop rate limit manager:', error);
            throw error;
        }
    }

    /**
     * Get workflow result
     */
    async getResult(workflowId) {
        try {
            const handle = this.client.workflow.getHandle(workflowId);
            const result = await handle.result();
            
            console.log('📊 Rate Limit Manager Results:');
            console.log(`  ✅ Events Processed: ${result.totalEventsProcessed}`);
            console.log(`  ❌ Events Failed: ${result.totalEventsFailed}`);
            console.log(`  ⏱️ Total Time: ${result.totalTime.toFixed(2)} minutes`);
            console.log(`  🎯 Success: ${result.success ? 'Yes' : 'No'}`);
            
            return result;
        } catch (error) {
            console.error('❌ Failed to get workflow result:', error);
            throw error;
        }
    }

    /**
     * List running workflows
     */
    async listWorkflows() {
        try {
            const workflows = await this.client.workflow.list({
                query: 'WorkflowType="rateLimitManagerWorkflow"'
            });

            console.log('📋 Running Rate Limit Manager Workflows:');
            for await (const workflow of workflows) {
                console.log(`  🆔 ${workflow.workflowId} - ${workflow.status.name}`);
            }
            
            return workflows;
        } catch (error) {
            console.error('❌ Failed to list workflows:', error);
            throw error;
        }
    }
}

// CLI interface
async function main() {
    const client = new RateLimitManagerClient();
    const command = process.argv[2];
    const workflowId = process.argv[3];

    try {
        switch (command) {
            case 'start':
                await client.startManager();
                break;
                
            case 'status':
                if (!workflowId) {
                    console.error('❌ Please provide workflow ID');
                    process.exit(1);
                }
                await client.getStatus(workflowId);
                break;
                
            case 'stop':
                if (!workflowId) {
                    console.error('❌ Please provide workflow ID');
                    process.exit(1);
                }
                await client.stopManager(workflowId);
                break;
                
            case 'result':
                if (!workflowId) {
                    console.error('❌ Please provide workflow ID');
                    process.exit(1);
                }
                await client.getResult(workflowId);
                break;
                
            case 'list':
                await client.listWorkflows();
                break;
                
            default:
                console.log(`
📊 Rate Limit Manager Client
============================

Usage:
  node client/rate-limit-client.js start                    (start manager)
  node client/rate-limit-client.js status <workflowId>      (check status)
  node client/rate-limit-client.js stop <workflowId>        (stop manager)
  node client/rate-limit-client.js result <workflowId>      (get results)
  node client/rate-limit-client.js list                     (list workflows)

Or use npm scripts:
  npm run rate-limit:start                                  (start manager)
  npm run rate-limit:status <workflowId>                    (check status)
  npm run rate-limit:stop <workflowId>                      (stop manager)
  npm run rate-limit:result <workflowId>                    (get results)
  npm run rate-limit:list                                   (list workflows)
                `);
                break;
        }
    } catch (error) {
        console.error('❌ Command failed:', error);
        process.exit(1);
    }
}

if (require.main === module) {
    main();
}

module.exports = { RateLimitManagerClient }; 