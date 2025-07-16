const { Client } = require('@temporalio/client');

/**
 * RLM Client
 * 
 * Client for triggering and managing Rate Limit Manager workflows
 */

class RLMClient {
    constructor() {
        this.client = null;
        this.workflowId = null;
    }

    async connect() {
        try {
            this.client = new Client({
                namespace: 'default'
            });
            
            console.log('✅ [RLM Client] Connected to Temporal');
            return true;
        } catch (error) {
            console.error('❌ [RLM Client] Failed to connect to Temporal:', error);
            return false;
        }
    }

    async disconnect() {
        if (this.client) {
            await this.client.connection.close();
            console.log('🔌 [RLM Client] Disconnected from Temporal');
        }
    }

    /**
     * Start the Rate Limit Manager workflow
     */
    async startRLMWorkflow() {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        this.workflowId = `rlm-workflow-${Date.now()}`;
        
        console.log(`🚀 [RLM Client] Starting RLM workflow: ${this.workflowId}`);
        
        try {
            const handle = await this.client.workflow.start('rateLimitManagerWorkflow', {
                taskQueue: 'rlm-processing',
                workflowId: this.workflowId,
                args: []
            });
            
            console.log(`✅ [RLM Client] RLM workflow started: ${handle.workflowId}`);
            
            return {
                workflowId: handle.workflowId,
                runId: handle.firstExecutionRunId
            };
            
        } catch (error) {
            console.error('❌ [RLM Client] Failed to start RLM workflow:', error);
            throw error;
        }
    }

    /**
     * Get workflow status
     */
    async getWorkflowStatus(workflowId = null) {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        const targetWorkflowId = workflowId || this.workflowId;
        if (!targetWorkflowId) {
            throw new Error('No workflow ID specified');
        }

        try {
            const handle = this.client.workflow.getHandle(targetWorkflowId);
            const status = await handle.describe();
            
            console.log(`📊 [RLM Client] Workflow status: ${status.status.name}`);
            
            return {
                workflowId: targetWorkflowId,
                status: status.status.name,
                runId: status.runId,
                startTime: status.startTime,
                closeTime: status.closeTime
            };
            
        } catch (error) {
            console.error('❌ [RLM Client] Failed to get workflow status:', error);
            throw error;
        }
    }

    /**
     * Get workflow result
     */
    async getWorkflowResult(workflowId = null) {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        const targetWorkflowId = workflowId || this.workflowId;
        if (!targetWorkflowId) {
            throw new Error('No workflow ID specified');
        }

        try {
            const handle = this.client.workflow.getHandle(targetWorkflowId);
            const result = await handle.result();
            
            console.log(`📋 [RLM Client] Workflow result:`, result);
            
            return result;
            
        } catch (error) {
            console.error('❌ [RLM Client] Failed to get workflow result:', error);
            throw error;
        }
    }

    /**
     * Cancel workflow
     */
    async cancelWorkflow(workflowId = null) {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        const targetWorkflowId = workflowId || this.workflowId;
        if (!targetWorkflowId) {
            throw new Error('No workflow ID specified');
        }

        try {
            const handle = this.client.workflow.getHandle(targetWorkflowId);
            await handle.cancel();
            
            console.log(`🛑 [RLM Client] Workflow cancelled: ${targetWorkflowId}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ [RLM Client] Failed to cancel workflow:', error);
            throw error;
        }
    }

    /**
     * List recent workflows
     */
    async listRecentWorkflows(limit = 10) {
        if (!this.client) {
            throw new Error('Client not connected');
        }

        try {
            const iterator = await this.client.workflow.list({
                query: 'WorkflowType="rateLimitManagerWorkflow"',
                limit: limit
            });
            const workflows = [];
            for await (const wf of iterator) {
                workflows.push(wf);
            }
            console.log(`📋 [RLM Client] Found ${workflows.length} recent RLM workflows`);
            return workflows.map(wf => ({
                workflowId: wf.workflowId,
                runId: wf.runId,
                status: wf.status?.name || 'UNKNOWN',
                startTime: wf.startTime,
                closeTime: wf.closeTime
            }));
            
        } catch (error) {
            console.error('❌ [RLM Client] Failed to list workflows:', error);
            throw error;
        }
    }
}

/**
 * Main function for command-line usage
 */
async function main() {
    const command = process.argv[2];
    const rlmClient = new RLMClient();
    
    try {
        await rlmClient.connect();
        
        switch (command) {
            case 'start':
                const result = await rlmClient.startRLMWorkflow();
                console.log('🎉 RLM workflow started successfully:', result);
                break;
                
            case 'status':
                const workflowId = process.argv[3];
                const status = await rlmClient.getWorkflowStatus(workflowId);
                console.log('📊 Workflow status:', status);
                break;
                
            case 'result':
                const targetWorkflowId = process.argv[3];
                const workflowResult = await rlmClient.getWorkflowResult(targetWorkflowId);
                console.log('📋 Workflow result:', workflowResult);
                break;
                
            case 'cancel':
                const cancelWorkflowId = process.argv[3];
                await rlmClient.cancelWorkflow(cancelWorkflowId);
                console.log('🛑 Workflow cancelled');
                break;
                
            case 'list':
                const limit = parseInt(process.argv[3]) || 10;
                const workflows = await rlmClient.listRecentWorkflows(limit);
                console.log('📋 Recent workflows:', workflows);
                break;
                
            default:
                console.log(`
🚀 RLM Client - Rate Limit Manager

Usage:
  node rlm-client.js start                    (start RLM workflow)
  node rlm-client.js status [workflowId]      (get workflow status)
  node rlm-client.js result [workflowId]      (get workflow result)
  node rlm-client.js cancel [workflowId]      (cancel workflow)
  node rlm-client.js list [limit]             (list recent workflows)

Examples:
  node rlm-client.js start
  node rlm-client.js status rlm-workflow-1234567890
  node rlm-client.js list 5
                `);
        }
        
    } catch (error) {
        console.error('❌ RLM Client error:', error);
        process.exit(1);
    } finally {
        await rlmClient.disconnect();
    }
}

// Run main function if this file is executed directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Failed to run RLM client:', error);
        process.exit(1);
    });
}

module.exports = {
    RLMClient
}; 