const { Client } = require('@temporalio/client');
const { processAllWallets } = require('../workflows/wallet-workflow');
const { TemporalWorkerManager } = require('../scripts/temporal-worker-manager');

class ScheduledWalletClient {
    constructor() {
        this.client = new Client();
        this.workerManager = new TemporalWorkerManager();
        this.scheduleId = 'wallet-audit-schedule';
        this.currentWorkerCount = 4; // Default worker count
        this.isRunning = false;
    }

    async startScheduledAudit() {
        console.log('🚀 Starting scheduled wallet audit system');
        console.log(`⏰ Schedule: Every 3 minutes`);
        console.log(`👥 Initial workers: ${this.currentWorkerCount}`);
        console.log(`🆔 Schedule ID: ${this.scheduleId}`);
        console.log('');

        try {
            // Start with default number of workers
            console.log('🔄 Starting initial workers...');
            await this.workerManager.startWorkers(this.currentWorkerCount);
            console.log('');

            // Create the schedule
            await this.createSchedule();
            
            this.isRunning = true;
            console.log('✅ Scheduled wallet audit system started successfully!');
            console.log('');
            console.log('📋 Available commands:');
            console.log('  - npm run scheduler:status    (check schedule status)');
            console.log('  - npm run scheduler:scale <N> (scale to N workers)');
            console.log('  - npm run scheduler:pause     (pause schedule)');
            console.log('  - npm run scheduler:resume    (resume schedule)');
            console.log('  - npm run scheduler:trigger   (trigger immediate run)');
            console.log('  - npm run scheduler:stop      (stop schedule and workers)');
            console.log('');

        } catch (error) {
            console.error('❌ Failed to start scheduled audit:', error);
            throw error;
        }
    }

    async createSchedule() {
        console.log('📅 Creating Temporal schedule...');
        
        try {
            const handle = await this.client.schedule.create({
                scheduleId: this.scheduleId,
                policies: {
                    catchupWindow: '1 minute',
                    overlap: 'SKIP', // Skip if previous run is still executing
                },
                spec: {
                    intervals: [
                        {
                            every: '3 minutes',
                        },
                    ],
                },
                action: {
                    type: 'startWorkflow',
                    workflowType: processAllWallets,
                    workflowId: `wallet-audit-${Date.now()}`,
                    taskQueue: 'wallet-processing',
                    args: [this.currentWorkerCount],
                },
            });

            console.log('✅ Schedule created successfully');
            
        } catch (error) {
            if (error.message.includes('already exists')) {
                console.log('📅 Schedule already exists, updating configuration...');
                await this.updateSchedule();
            } else {
                throw error;
            }
        }
    }

    async updateSchedule() {
        console.log(`🔄 Updating schedule with ${this.currentWorkerCount} workers...`);
        
        try {
            const handle = this.client.schedule.getHandle(this.scheduleId);
            
            await handle.update((input) => {
                // We need to return the complete schedule structure
                return {
                    spec: {
                        intervals: [
                            {
                                every: 3 * 60 * 1000 // 3 minutes in milliseconds
                            }
                        ]
                    },
                    action: {
                        type: 'startWorkflow',
                        workflowType: processAllWallets,
                        workflowId: `wallet-audit-${Date.now()}`,
                        taskQueue: 'wallet-processing',
                        args: [this.currentWorkerCount],
                    },
                    policies: {
                        overlap: 'SKIP',
                        catchupWindow: 60 * 1000 // 1 minute in milliseconds
                    }
                };
            });

            console.log('✅ Schedule updated successfully');
            
        } catch (error) {
            console.error('❌ Failed to update schedule:', error);
            throw error;
        }
    }

    async scaleWorkers(newWorkerCount) {
        if (!this.isRunning) {
            throw new Error('Scheduler is not running. Start it first with npm run scheduler:start');
        }

        console.log(`📈 Scaling workers from ${this.currentWorkerCount} to ${newWorkerCount}...`);
        
        try {
            // Update worker count
            this.currentWorkerCount = newWorkerCount;
            
            // Scale workers
            await this.workerManager.startWorkers(newWorkerCount);
            
            // Update the schedule with new worker count
            await this.updateSchedule();
            
            console.log(`✅ Successfully scaled to ${newWorkerCount} workers`);
            console.log(`📅 Next scheduled run will use ${newWorkerCount} workers`);
            
        } catch (error) {
            console.error('❌ Failed to scale workers:', error);
            throw error;
        }
    }

    async getScheduleStatus() {
        try {
            const handle = this.client.schedule.getHandle(this.scheduleId);
            const description = await handle.describe();

            // Debug: log the full description object
            console.log('DEBUG: Full schedule description:', JSON.stringify(description, null, 2));

            // Use the correct structure based on debug output
            console.log('📋 Schedule Status:');
            console.log(`🆔 Schedule ID: ${description.scheduleId || this.scheduleId}`);
            console.log(`📅 State: ${description.state?.paused ? 'PAUSED' : 'ACTIVE'}`);
            console.log(`⏰ Next Run: ${description.info?.nextActionTimes?.[0] || 'Not scheduled'}`);
            console.log(`👥 Current Workers: ${this.currentWorkerCount}`);
            console.log(`🔄 Overlap Policy: ${description.policies?.overlap || 'SKIP'}`);
            console.log(`⏱️  Catchup Window: ${description.policies?.catchupWindow || '1 minute'}`);

            if (description.info?.recentActions) {
                console.log(`📊 Recent Actions: ${description.info.recentActions.length}`);
                description.info.recentActions.slice(0, 5).forEach((action, index) => {
                    console.log(`  ${index + 1}. ${action.scheduledTime} - ${action.actualTime}`);
                });
            }
        } catch (error) {
            console.error('❌ Failed to get schedule status:', error);
            throw error;
        }
    }

    async pauseSchedule() {
        console.log('⏸️  Pausing schedule...');
        
        try {
            const handle = this.client.schedule.getHandle(this.scheduleId);
            await handle.pause('Paused by user');
            console.log('✅ Schedule paused successfully');
            
        } catch (error) {
            console.error('❌ Failed to pause schedule:', error);
            throw error;
        }
    }

    async resumeSchedule() {
        console.log('▶️  Resuming schedule...');
        
        try {
            const handle = this.client.schedule.getHandle(this.scheduleId);
            await handle.unpause();
            console.log('✅ Schedule resumed successfully');
            
        } catch (error) {
            console.error('❌ Failed to resume schedule:', error);
            throw error;
        }
    }

    async triggerImmediateRun() {
        console.log('🚀 Triggering immediate workflow run...');
        
        try {
            const handle = this.client.schedule.getHandle(this.scheduleId);
            await handle.trigger();
            console.log('✅ Immediate run triggered successfully');
            
        } catch (error) {
            console.error('❌ Failed to trigger immediate run:', error);
            throw error;
        }
    }

    async stopScheduledAudit() {
        console.log('🛑 Stopping scheduled wallet audit system...');
        
        try {
            // Delete the schedule
            const handle = this.client.schedule.getHandle(this.scheduleId);
            await handle.delete();
            console.log('✅ Schedule deleted successfully');
            
            // Stop all workers
            await this.workerManager.stopAllWorkers();
            console.log('✅ All workers stopped successfully');
            
            this.isRunning = false;
            console.log('✅ Scheduled wallet audit system stopped');
            
        } catch (error) {
            console.error('❌ Failed to stop scheduled audit:', error);
            throw error;
        }
    }

    async listSchedules() {
        try {
            const schedules = await this.client.schedule.list();
            
            console.log('📋 Available Schedules:');
            if (schedules.length === 0) {
                console.log('  No schedules found');
            } else {
                for await (const schedule of schedules) {
                    console.log(`  🆔 ${schedule.id} - ${schedule.schedule.state?.note || 'ACTIVE'}`);
                }
            }
            
        } catch (error) {
            console.error('❌ Failed to list schedules:', error);
            throw error;
        }
    }
}

// Export for use in other modules
module.exports = { ScheduledWalletClient };

// Allow running from command line
if (require.main === module) {
    const command = process.argv[2];
    const arg = process.argv[3];
    
    const scheduler = new ScheduledWalletClient();
    
    async function main() {
        try {
            switch (command) {
                case 'start':
                    await scheduler.startScheduledAudit();
                    break;
                    
                case 'scale':
                    const workerCount = arg ? parseInt(arg) : null;
                    if (!workerCount || isNaN(workerCount) || workerCount < 1) {
                        console.error('❌ Please provide a valid number of workers');
                        console.error('Usage: node client/scheduled-wallet-client.js scale <number_of_workers>');
                        process.exit(1);
                    }
                    await scheduler.scaleWorkers(workerCount);
                    break;
                    
                case 'status':
                    await scheduler.getScheduleStatus();
                    break;
                    
                case 'pause':
                    await scheduler.pauseSchedule();
                    break;
                    
                case 'resume':
                    await scheduler.resumeSchedule();
                    break;
                    
                case 'trigger':
                    await scheduler.triggerImmediateRun();
                    break;
                    
                case 'stop':
                    await scheduler.stopScheduledAudit();
                    break;
                    
                case 'list':
                    await scheduler.listSchedules();
                    break;
                    
                default:
                    console.error('❌ Invalid command');
                    console.error('Usage: node client/scheduled-wallet-client.js <command> [args]');
                    console.error('Commands:');
                    console.error('  start                    - Start scheduled audit');
                    console.error('  scale <worker_count>     - Scale to N workers');
                    console.error('  status                   - Check schedule status');
                    console.error('  pause                    - Pause schedule');
                    console.error('  resume                   - Resume schedule');
                    console.error('  trigger                  - Trigger immediate run');
                    console.error('  stop                     - Stop schedule and workers');
                    console.error('  list                     - List all schedules');
                    console.error('Examples:');
                    console.error('  node client/scheduled-wallet-client.js start');
                    console.error('  node client/scheduled-wallet-client.js scale 8');
                    console.error('  node client/scheduled-wallet-client.js status');
                    process.exit(1);
            }
        } catch (error) {
            console.error('❌ Error:', error);
            process.exit(1);
        }
    }
    
    main();
} 