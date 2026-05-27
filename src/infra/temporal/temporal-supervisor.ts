import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";

import { env } from "@/config/env";
import { logger } from "@/infra/logger/col-logger";

export type WorkerRole = "dummy1" | "dummy2";

const WORKER_ROLES: WorkerRole[] = ["dummy1", "dummy2"];

export function startTemporalWorkers(isShuttingDown: () => boolean): Map<WorkerRole, ChildProcess> {
  if (!env.SPAWN_TEMPORAL_WORKER) {
    logger.warn("SPAWN_TEMPORAL_WORKER is disabled; skipping Temporal worker");
    return new Map();
  }

  const workerPath = path.resolve(__dirname, "..", "..", "temporal", "worker.js");

  if (!existsSync(workerPath)) {
    logger.error(
      { workerPath },
      "Temporal worker not found. Build artifacts are required (run build).",
    );
    return new Map();
  }

  const command = process.execPath;
  const baseArgs = [workerPath];
  const processes = new Map<WorkerRole, ChildProcess>();
  const backoffByRole = new Map<WorkerRole, number>(WORKER_ROLES.map((role) => [role, 1000]));

  const spawnWorker = (role: WorkerRole) => {
    // Simple supervisor: restart worker with exponential backoff on exit.
    const args = [...baseArgs, "--role", role];
    const child = spawn(command, args, {
      stdio: "inherit",
      env: {
        ...process.env,
        SERVICE_NAME: `temporal-worker-${role}`,
        TEMPORAL_WORKER_ROLE: role,
      },
    });

    child.on("spawn", () => {
      backoffByRole.set(role, 1000);
      logger.info({ workerPath, role }, "Temporal worker spawned");
    });

    child.on("error", (err) => {
      logger.error({ err, role }, "Temporal worker spawn error");
    });

    child.on("close", (code, signal) => {
      processes.delete(role);
      if (isShuttingDown()) return;
      if (code === 0) {
        logger.info({ code, signal, role }, "Temporal worker exited");
      } else {
        logger.warn({ code, signal, role }, "Temporal worker exited with error");
      }

      const current = backoffByRole.get(role) as number;
      const next = Math.min(current * 2, 30000);
      backoffByRole.set(role, next);
      const restartTimer = setTimeout(() => spawnWorker(role), current);
      restartTimer.unref?.();
    });

    processes.set(role, child);
  };

  for (const role of WORKER_ROLES) spawnWorker(role);
  return processes;
}

export async function stopWorkers(
  workers: Map<WorkerRole, ChildProcess>,
  timeoutMs: number,
): Promise<void> {
  await stopWorkerList(Array.from(workers.entries()), timeoutMs);
}

export async function stopWorkersByRole(
  workers: Map<WorkerRole, ChildProcess>,
  roles: WorkerRole[],
  timeoutMs: number,
): Promise<void> {
  if (roles.length === 0) return;
  const list = roles
    .map((role) => {
      const worker = workers.get(role);
      return worker ? [role, worker] : undefined;
    })
    .filter((item): item is [WorkerRole, ChildProcess] => Boolean(item));
  await stopWorkerList(list, timeoutMs);
}

async function stopWorkerList(
  list: Array<[WorkerRole, ChildProcess]>,
  timeoutMs: number,
): Promise<void> {
  if (list.length === 0) return;

  await Promise.all(
    list.map(
      ([role, worker]) =>
        new Promise<void>((resolve) => {
          let settled = false;
          const finish = () => {
            if (settled) return;
            settled = true;
            resolve();
          };

          const timeout = setTimeout(() => {
            logger.warn({ timeoutMs, role }, "Temporal worker shutdown timed out");
            finish();
          }, timeoutMs);
          timeout.unref?.();
          worker.once("close", () => {
            clearTimeout(timeout);
            finish();
          });

          if (!worker.killed) worker.kill("SIGTERM");
        }),
    ),
  );
}
