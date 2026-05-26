import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

import { logger } from "@/infra/logger/col-logger";
import { sleep } from "@/utils/sleep";

type HandleFn = (msg: Message) => Promise<void>;

export type PollerConfig = {
  batchSize: number;
  waitTimeSeconds: number;
  visibilityTimeoutSeconds: number;
  concurrency: number;
};

export class SqsPoller {
  private stopped = true;

  constructor(
    private readonly sqs: SQSClient,
    private readonly queueUrl: string,
    private readonly handler: HandleFn,
    private readonly cfg: PollerConfig,
  ) {}

  start() {
    this.stopped = false;
    this.loop().catch((err) => logger.error({ err }, "Poller crashed"));
  }

  stop() {
    this.stopped = true;
  }

  isRunning() {
    return !this.stopped;
  }

  private async loop() {
    logger.info("SQS Poller started");
    while (!this.stopped) {
      try {
        const res = await this.sqs.send(
          new ReceiveMessageCommand({
            QueueUrl: this.queueUrl,
            MaxNumberOfMessages: this.cfg.batchSize,
            WaitTimeSeconds: this.cfg.waitTimeSeconds,
            VisibilityTimeout: this.cfg.visibilityTimeoutSeconds,
            AttributeNames: ["All"],
            MessageAttributeNames: ["All"],
          }),
        );

        const messages = res.Messages ?? [];
        if (messages.length === 0) {
          continue; // long poll timed out; immediately poll again
        }

        // Process with concurrency control
        await this.processWithConcurrency(messages, this.cfg.concurrency);
      } catch (err) {
        logger.error({ err }, "ReceiveMessage failed; backing off");
        await sleep(1000);
      }
    }
    logger.info("SQS Poller stopped");
  }

  private async processWithConcurrency(messages: Message[], limit: number) {
    if (limit < 1) {
      logger.warn(
        { concurrency: limit, queueUrl: this.queueUrl },
        "SQS Poller concurrency is less than 1; skipping batch",
      );
      return;
    }
    const queue = [...messages];
    const workers = Math.min(limit, queue.length);
    const runWorker = async () => {
      for (;;) {
        const msg = queue.shift();
        if (!msg) return;
        try {
          await this.handler(msg);
          if (msg.ReceiptHandle) {
            await this.sqs.send(
              new DeleteMessageCommand({
                QueueUrl: this.queueUrl,
                ReceiptHandle: msg.ReceiptHandle,
              }),
            );
          }
        } catch (err) {
          // Do not delete; message will be retried (or go to DLQ via redrive policy)
          logger.error({ err, messageId: msg.MessageId }, "Message processing failed");
        }
      }
    };
    await Promise.all(Array.from({ length: workers }, () => runWorker()));
  }
}
