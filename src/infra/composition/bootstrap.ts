import type { ChildProcess } from "node:child_process";

import { env, getQueueNames } from "@/config/env";
import { ensureQueues, getQueueUrl as fetchQueueUrl } from "@/infra/aws/queue-setup";
import { getQueueHandler } from "@/infra/aws/queue-routing";
import { sqsClient } from "@/infra/aws/sqs-client";
import { mapSqsMessage } from "@/infra/aws/sqs-message-mapper";
import { SqsPoller } from "@/infra/aws/sqs-poller";
import { createComposition } from "@/infra/composition/composition-root";
import { startHealthServer } from "@/infra/healthcheck/health-server";
import { logger } from "@/infra/logger/col-logger";
import {
  startTemporalWorkers,
  stopWorkers,
  type WorkerRole,
} from "@/infra/temporal/temporal-supervisor";

export async function bootstrap() {
  let workerProcesses: Map<WorkerRole, ChildProcess> = new Map();
  let isShuttingDown = false;
  let isRestartingWorkers = false;

  const composition = createComposition();
  const getHandler = (queueName: string) =>
    getQueueHandler(queueName, env.APP_ENV, composition.queueHandlers);

  const isLocal = env.NODE_ENV !== "production" && Boolean(env.SQS_ENDPOINT);
  const allowAutoCreateQueues = env.AUTO_CREATE_QUEUES && isLocal;

  const queueNames = getQueueNames(env);

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
    const useCase = getHandler(name);
    if (!useCase) {
      logger.warn({ queue: name }, "No handler mapped for queue; skipping");
      continue;
    }

    const queueUrl = await getQueueUrlForName(name, allowAutoCreateQueues, env.SQS_DLQ_SUFFIX);

    const poller = new SqsPoller(
      sqsClient,
      queueUrl,
      async (raw) => {
        const inbound = mapSqsMessage<unknown>(raw);
        await useCase.handle(inbound.payload, inbound.metadata);
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

  workerProcesses = startTemporalWorkers(() => isShuttingDown);

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
      getHandler,
    },
  });

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

export async function getQueueUrlForName(
  name: string,
  allowAutoCreateQueues: boolean,
  dlqSuffix: string,
): Promise<string> {
  if (allowAutoCreateQueues) {
    const ensured = await ensureQueues(sqsClient, name, name + dlqSuffix);
    return ensured.mainUrl;
  }
  return fetchQueueUrl(sqsClient, name);
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
