import { Message } from "@commercetools/platform-sdk";

import { MessageHandler, MessageMeta } from "@/application/ports/message-handler";
import { getTemporalClient } from "@/infra/temporal/temporal-client";
import { env } from "@/config/env";
import { createLogModel } from "@/infra/logger/col-logger";

export class ProcessDummy implements MessageHandler<Message> {
  async handle(message: Message, meta: MessageMeta): Promise<void> {
    const client = await getTemporalClient();
    const workflowId = `dummy:${message.resource.id}:${message.version}`;
    const correlatorId = meta.messageAttributes?.correlatorId?.StringValue?.trim();
    const taskQueue = env.TEMPORAL_TASK_QUEUE_DUMMY_1;
    const log = createLogModel({ txid: correlatorId ?? workflowId });

    try {
      await client.workflow.start("DummyWorkflow", {
        taskQueue,
        workflowId,
        args: [
          message,
          {
            retryAttempts: env.TEMPORAL_RETRY_ATTEMPTS,
            retryDelayMs: env.TEMPORAL_RETRY_DELAY,
            correlatorId,
          },
        ],
      });
      log.logStep("ProcessDummy started", {
        activity_name: "ProcessDummy",
      });
    } catch (err) {
      log.logStep("ProcessDummy failed", {
        activity_name: "ProcessDummy",
        error: err,
      });
      throw err;
    }
  }
}
