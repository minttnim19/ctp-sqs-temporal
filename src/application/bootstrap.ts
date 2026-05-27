import type { ChildProcess } from "node:child_process";

import { env, resolveQueueNames } from "@/config/env";
import { ensureQueues, getQueueUrl } from "@/infra/aws/queue-setup";
import { sqsClient } from "@/infra/aws/sqs-client";
import { SqsPoller } from "@/infra/aws/sqs-poller";
import { startHealthServer } from "@/infra/healthcheck/health-server";
import { logger } from "@/infra/logger/col-logger";
import { safelyParse, unwrapSnsEnvelope } from "@/utils/common";
import {
  startTemporalWorkers,
  stopWorkers,
  type WorkerRole,
} from "@/infra/temporal/temporal-supervisor";
import { resolveHandler, type AllowEventMessage } from "@/application/handler-resolver";

export async function bootstrap() {
  let workerProcesses: Map<WorkerRole, ChildProcess> = new Map();
  let isShuttingDown = false;
  let isRestartingWorkers = false;

  const isLocal = env.NODE_ENV !== "production" && Boolean(env.SQS_ENDPOINT);
  const allowAutoCreateQueues = env.AUTO_CREATE_QUEUES && isLocal;

  const queueNames = resolveQueueNames(env);

  const pollers: SqsPoller[] = [];
  if (env.AUTO_CREATE_QUEUES && !allowAutoCreateQueues) {
    logger.warn(
      {
        nodeEnv: env.NODE_ENV,
        sqsEndpoint: env.SQS_ENDPOINT ?? "",
      },
      "AUTO_CREATE_QUEUES is enabled but only honored on local (non-production with SQS_ENDPOINT). Falling back to existing queues.",
    );
  }

  for (const name of queueNames) {
    const useCase = resolveHandler(name);
    if (!useCase) {
      logger.warn({ queue: name }, "No handler mapped for queue; skipping");
      continue;
    }

    const queueUrl = await resolveQueueUrl(name, allowAutoCreateQueues, env.SQS_DLQ_SUFFIX);

    const poller = new SqsPoller(
      sqsClient,
      queueUrl,
      async (raw) => {
        const bodyText = raw.Body;
        const unwrapped = unwrapSnsEnvelope(bodyText);
        const body = safelyParse<AllowEventMessage>(unwrapped);

        await useCase.handle(body, {
          messageId: raw.MessageId ?? "",
          receiptHandle: raw.ReceiptHandle ?? "",
          attributes: raw.Attributes ?? {},
          messageAttributes: raw.MessageAttributes ?? {},
        });
      },
      {
        batchSize: env.SQS_BATCH_SIZE,
        waitTimeSeconds: env.SQS_POLLING_WAIT_SECS,
        visibilityTimeoutSeconds: env.SQS_VISIBILITY_TIMEOUT_SECS,
        concurrency: env.CONCURRENCY,
      },
    );
    poller.start();
    pollers.push(poller);
  }

  // Temporal workers (supervised child processes)
  workerProcesses = startTemporalWorkers(() => isShuttingDown);

  // Manual restart signal for Temporal workers (single pod/container constraints)
  process.on("SIGUSR2", () => {
    if (isShuttingDown) return;
    if (!env.SPAWN_TEMPORAL_WORKER) {
      logger.warn("SPAWN_TEMPORAL_WORKER is disabled; cannot restart workers");
      return;
    }
    if (isRestartingWorkers) {
      logger.warn("Temporal worker restart already in progress; skipping");
      return;
    }
    isRestartingWorkers = true;
    logger.warn({ signal: "SIGUSR2" }, "SIGUSR2 received; restarting Temporal workers");
    void stopWorkers(workerProcesses, 1500)
      .then(() => {
        logger.info("Temporal workers restart completed");
      })
      .finally(() => {
        isRestartingWorkers = false;
      });
  });

  const healthServer = startHealthServer({
    port: env.HEALTHCHECK_PORT,
    manualApi: {
      enabled: env.NODE_ENV === "development",
      resolveHandler,
    },
  });

  // Graceful shutdown
  const shutdown = (signal: string) => async () => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info({ signal }, "Shutting down...");

    for (const poller of pollers) poller.stop();

    await stopWorkers(workerProcesses, 1500);
    await closeHealthServer(healthServer);
    process.exit(0);
  };

  process.on("SIGINT", shutdown("SIGINT"));
  process.on("SIGTERM", shutdown("SIGTERM"));
}

export async function resolveQueueUrl(
  name: string,
  allowAutoCreateQueues: boolean,
  dlqSuffix: string,
): Promise<string> {
  if (allowAutoCreateQueues) {
    const ensured = await ensureQueues(sqsClient, name, name + dlqSuffix);
    return ensured.mainUrl;
  }
  return getQueueUrl(sqsClient, name);
}

export async function closeHealthServer(
  server: ReturnType<typeof startHealthServer>,
): Promise<void> {
  await new Promise<void>((resolve) => {
    server.close((err) => {
      if (err) {
        logger.error({ err }, "Health check server close failed");
      }
      resolve();
    });
  });
}
