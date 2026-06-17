import type { AppLoggerFactory } from "@/application/ports/app-logger";
import type { MessageHandler, MessageMeta } from "@/application/ports/message-handler";
import type { WorkflowStarter } from "@/application/ports/workflow-starter";

export type ScheduledWorkflowDispatcherOptions = {
  workflowName: string;
  taskQueue: string;
  retryAttempts: number;
  retryDelayMs: number;
};

export class ScheduledWorkflowDispatcher implements MessageHandler<unknown> {
  constructor(
    private readonly workflowStarter: WorkflowStarter,
    private readonly loggerFactory: AppLoggerFactory,
    private readonly options: ScheduledWorkflowDispatcherOptions,
  ) {}

  async handle(message: unknown, meta: MessageMeta): Promise<void> {
    const workflowId = `scheduled:${Date.now()}`;
    const correlatorId = meta.messageAttributes?.correlatorId?.StringValue?.trim();
    const correlationId = correlatorId ?? workflowId;
    const log = this.loggerFactory.createLogger({ txid: correlationId });

    try {
      await this.workflowStarter.startWorkflow({
        workflowName: this.options.workflowName,
        taskQueue: this.options.taskQueue,
        workflowId,
        correlationId,
        args: [
          message,
          {
            retryAttempts: this.options.retryAttempts,
            retryDelayMs: this.options.retryDelayMs,
            correlatorId,
          },
        ],
      });
      log.logStep("ScheduledWorkflowDispatcher dispatched", {
        activity_name: "ScheduledWorkflowDispatcher",
      });
    } catch (err) {
      log.logStep("ScheduledWorkflowDispatcher failed", {
        activity_name: "ScheduledWorkflowDispatcher",
        error: err,
      });
      throw err;
    }
  }
}
