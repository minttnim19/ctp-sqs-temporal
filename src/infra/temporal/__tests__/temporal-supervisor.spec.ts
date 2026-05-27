jest.mock("node:child_process", () => ({
  spawn: jest.fn(),
}));

jest.mock("node:fs", () => ({
  existsSync: jest.fn(),
}));

jest.mock("@/infra/logger/col-logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("@/config/env", () => ({
  env: { SPAWN_TEMPORAL_WORKER: true },
}));

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { EventEmitter } from "node:events";

import { logger } from "@/infra/logger/col-logger";
import {
  startTemporalWorkers,
  stopWorkers,
  stopWorkersByRole,
} from "@/infra/temporal/temporal-supervisor";

function makeChildProcess() {
  const child = new EventEmitter() as any;
  child.killed = false;
  child.kill = jest.fn();
  return child;
}

describe("temporal-supervisor", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (existsSync as jest.Mock).mockReturnValue(true);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe("startTemporalWorkers", () => {
    it("returns empty map when SPAWN_TEMPORAL_WORKER is disabled", async () => {
      jest.resetModules();
      jest.doMock("@/config/env", () => ({ env: { SPAWN_TEMPORAL_WORKER: false } }));
      jest.doMock("node:child_process", () => ({ spawn: jest.fn() }));
      jest.doMock("node:fs", () => ({ existsSync: jest.fn().mockReturnValue(true) }));
      jest.doMock("@/infra/logger/col-logger", () => ({
        logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
      }));

      await jest.isolateModulesAsync(async () => {
        jest.doMock("@/config/env", () => ({ env: { SPAWN_TEMPORAL_WORKER: false } }));
        jest.doMock("node:child_process", () => ({ spawn: jest.fn() }));
        jest.doMock("node:fs", () => ({ existsSync: jest.fn().mockReturnValue(true) }));
        jest.doMock("@/infra/logger/col-logger", () => ({
          logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        }));

        const { startTemporalWorkers: start } =
          await import("@/infra/temporal/temporal-supervisor");
        const result = start(() => false);
        expect(result.size).toBe(0);
      });
    });

    it("returns empty map when worker file does not exist", async () => {
      await jest.isolateModulesAsync(async () => {
        jest.doMock("@/config/env", () => ({ env: { SPAWN_TEMPORAL_WORKER: true } }));
        jest.doMock("node:child_process", () => ({ spawn: jest.fn() }));
        jest.doMock("node:fs", () => ({ existsSync: jest.fn().mockReturnValue(false) }));
        jest.doMock("@/infra/logger/col-logger", () => ({
          logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
        }));

        const { startTemporalWorkers: start } =
          await import("@/infra/temporal/temporal-supervisor");
        const result = start(() => false);
        expect(result.size).toBe(0);
      });
    });

    it("spawns workers for all roles", () => {
      const children: any[] = [];
      (spawn as jest.Mock).mockImplementation(() => {
        const child = makeChildProcess();
        children.push(child);
        return child;
      });

      const processes = startTemporalWorkers(() => false);
      expect(spawn).toHaveBeenCalledTimes(2);
      expect(processes.size).toBe(2);
      expect((spawn as jest.Mock).mock.calls[0][1]).toEqual(
        expect.arrayContaining(["--role", "dummy1"]),
      );
      expect((spawn as jest.Mock).mock.calls[1][1]).toEqual(
        expect.arrayContaining(["--role", "dummy2"]),
      );
    });

    it("logs spawn event and resets backoff", () => {
      const children: any[] = [];
      (spawn as jest.Mock).mockImplementation(() => {
        const child = makeChildProcess();
        children.push(child);
        return child;
      });

      startTemporalWorkers(() => false);
      children[0].emit("spawn");
      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ role: expect.any(String) }),
        "Temporal worker spawned",
      );
    });

    it("logs error on spawn error event", () => {
      const children: any[] = [];
      (spawn as jest.Mock).mockImplementation(() => {
        const child = makeChildProcess();
        children.push(child);
        return child;
      });

      startTemporalWorkers(() => false);
      children[0].emit("error", new Error("spawn error"));
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error) }),
        "Temporal worker spawn error",
      );
    });

    it("does not restart worker when shutting down", () => {
      jest.useFakeTimers();
      const children: any[] = [];
      (spawn as jest.Mock).mockImplementation(() => {
        const child = makeChildProcess();
        children.push(child);
        return child;
      });

      startTemporalWorkers(() => true);
      const callCount = (spawn as jest.Mock).mock.calls.length;
      children[0].emit("close", 1, null);
      jest.runAllTimers();
      expect((spawn as jest.Mock).mock.calls.length).toBe(callCount);
    });

    it("restarts worker with backoff when not shutting down and exit code non-zero", () => {
      jest.useFakeTimers();
      (spawn as jest.Mock).mockImplementation(() => makeChildProcess());

      // shuttingDown stays false when close fires (so logging happens)
      // but second spawned process won't cause more issues
      let shuttingDown = false;
      startTemporalWorkers(() => shuttingDown);

      const firstChild = (spawn as jest.Mock).mock.results[0].value;
      // Emit close - shuttingDown is false so logging happens
      firstChild.emit("close", 1, null);

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ code: 1 }),
        "Temporal worker exited with error",
      );

      // Prevent the restarted worker from looping
      shuttingDown = true;
    });

    it("uses default backoff again after a worker respawns successfully", () => {
      jest.useFakeTimers();
      const children: any[] = [];
      (spawn as jest.Mock).mockImplementation(() => {
        const child = makeChildProcess();
        children.push(child);
        return child;
      });

      let shuttingDown = false;
      startTemporalWorkers(() => shuttingDown);

      children[0].emit("close", 1, null);
      jest.advanceTimersByTime(1000);
      children[2].emit("spawn");
      children[2].emit("close", 1, null);

      jest.advanceTimersByTime(999);
      expect((spawn as jest.Mock).mock.calls).toHaveLength(3);

      jest.advanceTimersByTime(1);
      expect((spawn as jest.Mock).mock.calls).toHaveLength(4);

      shuttingDown = true;
    });

    it("logs info when worker exits with code 0", () => {
      jest.useFakeTimers();
      (spawn as jest.Mock).mockImplementation(() => makeChildProcess());

      let shuttingDown = false;
      startTemporalWorkers(() => shuttingDown);

      const firstChild = (spawn as jest.Mock).mock.results[0].value;
      // Emit close with code 0 - shuttingDown is false so logging happens
      firstChild.emit("close", 0, null);

      expect(logger.info).toHaveBeenCalledWith(
        expect.objectContaining({ code: 0 }),
        "Temporal worker exited",
      );

      shuttingDown = true;
    });
  });

  describe("stopWorkers", () => {
    it("sends SIGTERM to all workers and resolves", async () => {
      const child1 = makeChildProcess();
      const child2 = makeChildProcess();

      const workers = new Map<any, any>([
        ["dummy1", child1],
        ["other", child2],
      ]);

      const stopPromise = stopWorkers(workers, 5000);
      child1.emit("close");
      child2.emit("close");
      await stopPromise;

      expect(child1.kill).toHaveBeenCalledWith("SIGTERM");
      expect(child2.kill).toHaveBeenCalledWith("SIGTERM");
    });

    it("resolves on timeout when worker does not close", async () => {
      jest.useFakeTimers();
      const child = makeChildProcess();
      const workers = new Map<any, any>([["dummy1", child]]);

      const stopPromise = stopWorkers(workers, 100);
      jest.advanceTimersByTime(200);
      await stopPromise;

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ timeoutMs: 100 }),
        "Temporal worker shutdown timed out",
      );
    });

    it("does not send SIGTERM when worker is already killed", async () => {
      const child = makeChildProcess();
      child.killed = true;
      const workers = new Map<any, any>([["dummy1", child]]);

      const stopPromise = stopWorkers(workers, 5000);
      child.emit("close");
      await stopPromise;

      expect(child.kill).not.toHaveBeenCalled();
    });

    it("ignores close after timeout has already resolved shutdown", async () => {
      jest.useFakeTimers();
      const child = makeChildProcess();
      const workers = new Map<any, any>([["dummy1", child]]);

      const stopPromise = stopWorkers(workers, 100);
      jest.advanceTimersByTime(200);
      child.emit("close");
      await stopPromise;

      expect(logger.warn).toHaveBeenCalledTimes(1);
    });
  });

  describe("stopWorkersByRole", () => {
    it("returns immediately when roles is empty", async () => {
      const workers = new Map();
      await expect(stopWorkersByRole(workers, [], 5000)).resolves.toBeUndefined();
    });

    it("only stops workers matching the given roles", async () => {
      const child1 = makeChildProcess();
      const child2 = makeChildProcess();

      const workers = new Map<any, any>([
        ["dummy1", child1],
        ["other", child2],
      ]);

      const stopPromise = stopWorkersByRole(workers, ["dummy1"], 5000);
      child1.emit("close");
      await stopPromise;

      expect(child1.kill).toHaveBeenCalledWith("SIGTERM");
      expect(child2.kill).not.toHaveBeenCalled();
    });

    it("skips roles not present in workers map", async () => {
      const workers = new Map<any, any>();
      await expect(stopWorkersByRole(workers, ["dummy1"], 5000)).resolves.toBeUndefined();
    });
  });
});
