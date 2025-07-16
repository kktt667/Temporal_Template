module.exports = {
  // Queue processing activities
  consumeQueueEvents: require('./rlm-queue-processor').consumeQueueEvents,
  getPartialResults: require('./rlm-queue-processor').getPartialResults,

  // Worker management activities
  scaleRLMWorkers: require('./rlm-worker-manager').scaleRLMWorkers,
  getRLMWorkerStatus: require('./rlm-worker-manager').getRLMWorkerStatus,

  // Task distribution activities
  calculateProcessingPlan: require('./rlm-task-distributor').calculateProcessingPlan,
  distributeAndProcessTasks: require('./rlm-task-distributor').distributeAndProcessTasks,
  processSingleTask: require('./rlm-task-distributor').processSingleTask,

  // API processing activities
  processEvent: require('./rlm-api-processors').processEvent,
  processEventType: require('./rlm-api-processors').processEventType,
  processEventsRoundRobin: require('./rlm-api-processors').processEventsRoundRobin,
}; 