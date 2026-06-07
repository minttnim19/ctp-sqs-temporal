import type { Message } from "@commercetools/platform-sdk";

import type { AppLoggerFactory } from "@/application/ports/app-logger";
import type { MessageHandler, MessageMeta } from "@/application/ports/message-handler";
import type { WorkflowStarter } from "@/application/ports/workflow-starter";

export type DummyWorkflowDispatcherOptions = {
  workflowName: string;
  taskQueue: string;
  retryAttempts: number;
  retryDelayMs: number;
};

export class DummyWorkflowDispatcher implements MessageHandler<Message> {
  constructor(
    private readonly workflowStarter: WorkflowStarter,
    private readonly loggerFactory: AppLoggerFactory,
    private readonly options: DummyWorkflowDispatcherOptions,
  ) {}

  async handle(message: Message, meta: MessageMeta): Promise<void> {
    const workflowId = `dummy:${message.resource.id}:${message.version}`;
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
        retryPolicy: {
          maximumAttempts: this.options.retryAttempts,
          initialIntervalMs: this.options.retryDelayMs,
        },
      });
      log.logStep("DummyWorkflowDispatcher dispatched", {
        activity_name: "DummyWorkflowDispatcher",
      });
    } catch (err) {
      log.logStep("DummyWorkflowDispatcher failed", {
        activity_name: "DummyWorkflowDispatcher",
        error: err,
      });
      throw err;
    }
  }
}
