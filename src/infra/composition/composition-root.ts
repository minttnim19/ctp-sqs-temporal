import { DummyWorkflowDispatcher } from "@/application/usecases/dummy-workflow-dispatcher";
import { ScheduledWorkflowDispatcher } from "@/application/usecases/scheduled-workflow-dispatcher";
import { env } from "@/config/env";
import { registerQueueHandler, type QueueHandlerRegistry } from "@/infra/aws/queue-routing";
import { ColAppLoggerFactory } from "@/infra/logger/app-logger-adapter";
import { TemporalWorkflowStarter } from "@/infra/temporal/temporal-workflow-starter";

export type AppComposition = {
  queueHandlers: QueueHandlerRegistry;
};

export function createComposition(): AppComposition {
  const workflowStarter = new TemporalWorkflowStarter();
  const loggerFactory = new ColAppLoggerFactory();

  return {
    queueHandlers: {
      dummy: registerQueueHandler(
        new DummyWorkflowDispatcher(workflowStarter, loggerFactory, {
          workflowName: "DummyWorkflow",
          taskQueue: env.TEMPORAL_TASK_QUEUE_DUMMY_1,
          retryAttempts: env.TEMPORAL_RETRY_ATTEMPTS,
          retryDelayMs: env.TEMPORAL_RETRY_DELAY,
        }),
      ),
      "scheduled-dummy": registerQueueHandler(
        new ScheduledWorkflowDispatcher(workflowStarter, loggerFactory, {
          workflowName: "ScheduledJobWorkflow",
          taskQueue: env.TEMPORAL_TASK_QUEUE_SCHEDULED,
          retryAttempts: env.TEMPORAL_RETRY_ATTEMPTS,
          retryDelayMs: env.TEMPORAL_RETRY_DELAY,
        }),
      ),
    },
  };
}
