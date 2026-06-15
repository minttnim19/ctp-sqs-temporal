import { NativeConnection, Worker } from "@temporalio/worker";

import { env } from "@/config/env";
import { logger } from "@/infra/logger/col-logger";
import * as dummyActivities from "@/temporal/activities/dummy.activities";
import * as scheduledActivities from "@/temporal/activities/scheduled.activities";
import { activityLogInterceptor } from "@/temporal/interceptors/activity-log.interceptor";

type WorkerRole = "all" | "dummy1" | "dummy2" | "scheduled";

function getRoleFromArgv(): WorkerRole | undefined {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    if (current === "--role" && i + 1 < args.length) {
      return args[i + 1] as WorkerRole;
    }
    if (current.startsWith("--role=")) {
      return current.slice("--role=".length) as WorkerRole;
    }
  }
  return undefined;
}

function isWorkerRole(value: string): value is WorkerRole {
  return value === "all" || value === "dummy1" || value === "dummy2" || value === "scheduled";
}

async function run(): Promise<void> {
  try {
    const tls = env.TEMPORAL_TLS_ENABLED
      ? {
          serverNameOverride: env.TEMPORAL_TLS_SERVER_NAME,
          serverRootCACertificate: env.TEMPORAL_TLS_CA_CERT
            ? Buffer.from(env.TEMPORAL_TLS_CA_CERT)
            : undefined,
          clientCertPair:
            env.TEMPORAL_TLS_CLIENT_CERT && env.TEMPORAL_TLS_CLIENT_KEY
              ? {
                  crt: Buffer.from(env.TEMPORAL_TLS_CLIENT_CERT),
                  key: Buffer.from(env.TEMPORAL_TLS_CLIENT_KEY),
                }
              : undefined,
        }
      : false;

    const connection = await NativeConnection.connect({
      address: env.TEMPORAL_ADDRESS,
      tls,
    });

    const dummy1TaskQueue = env.TEMPORAL_TASK_QUEUE_DUMMY_1;
    const dummy2TaskQueue = env.TEMPORAL_TASK_QUEUE_DUMMY_2;
    const scheduledTaskQueue = env.TEMPORAL_TASK_QUEUE_SCHEDULED;

    const argvRole = getRoleFromArgv();
    const envRole = env.TEMPORAL_WORKER_ROLE;
    let role: WorkerRole = "all";

    if (envRole && isWorkerRole(envRole)) {
      role = envRole;
    }
    if (argvRole && !isWorkerRole(argvRole)) {
      logger.warn({ role: argvRole }, "Invalid worker role from argv; falling back to env");
    } else if (argvRole) {
      role = argvRole;
    }
    if (envRole && !isWorkerRole(envRole)) {
      logger.warn({ role: envRole }, "Invalid worker role from env; using default 'all'");
      if (!argvRole || !isWorkerRole(argvRole)) role = "all";
    }
    const workers: Worker[] = [];

    const createDummyWorker = async (taskQueue: string) =>
      Worker.create({
        connection,
        namespace: env.TEMPORAL_NAMESPACE,
        taskQueue,
        maxConcurrentActivityTaskExecutions: env.TEMPORAL_MAX_ACTIVITY_TASKS,
        maxConcurrentWorkflowTaskExecutions: env.TEMPORAL_MAX_WORKFLOW_TASKS,
        workflowsPath: require.resolve("./workflows"),
        interceptors: {
          activity: [activityLogInterceptor],
        },
        activities: {
          ...dummyActivities,
          ...scheduledActivities,
        },

        // Add additional worker options
        shutdownGraceTime: "30s",
        shutdownForceTime: "60s",
      });

    if (role === "all" || role === "dummy1") {
      workers.push(await createDummyWorker(dummy1TaskQueue));
    }

    if (role === "all" || role === "dummy2") {
      workers.push(await createDummyWorker(dummy2TaskQueue));
    }

    if (role === "all" || role === "scheduled") {
      workers.push(await createDummyWorker(scheduledTaskQueue));
    }

    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;

      logger.warn({ signal }, "Temporal worker shutting down");
      try {
        await Promise.all(workers.map((worker) => Promise.resolve(worker.shutdown())));
        logger.info("Temporal worker shut down successfully");
        process.exit(0);
      } catch (err) {
        logger.error({ err }, "Error during Temporal worker shutdown");
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => void shutdown("SIGTERM"));
    process.on("SIGINT", () => void shutdown("SIGINT"));

    process.on("uncaughtException", (err) => {
      logger.error({ err }, "Uncaught exception in Temporal worker");
      void shutdown("uncaughtException");
    });

    process.on("unhandledRejection", (reason) => {
      logger.error({ err: reason }, "Unhandled rejection in Temporal worker");
      void shutdown("unhandledRejection");
    });

    if (role === "all" || role === "dummy1") {
      logger.info(
        {
          address: env.TEMPORAL_ADDRESS,
          namespace: env.TEMPORAL_NAMESPACE,
          taskQueue: dummy1TaskQueue,
        },
        "Temporal dummy1 worker started",
      );
    }

    if (role === "all" || role === "dummy2") {
      logger.info(
        {
          address: env.TEMPORAL_ADDRESS,
          namespace: env.TEMPORAL_NAMESPACE,
          taskQueue: dummy2TaskQueue,
        },
        "Temporal dummy2 worker started",
      );
    }

    if (role === "all" || role === "scheduled") {
      logger.info(
        {
          address: env.TEMPORAL_ADDRESS,
          namespace: env.TEMPORAL_NAMESPACE,
          taskQueue: scheduledTaskQueue,
        },
        "Temporal scheduled worker started",
      );
    }

    await Promise.all(workers.map((worker) => worker.run()));
  } catch (err) {
    logger.error({ err }, "Temporal worker failed to start");
    process.exit(1);
  }
}

void run();
