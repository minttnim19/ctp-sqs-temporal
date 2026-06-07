jest.mock("@/infra/logger/col-logger", () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("@/temporal/activities/dummy.activities", () => ({}));
jest.mock("@/temporal/activities/scheduled.activities", () => ({}));
jest.mock("@/temporal/interceptors/activity-log.interceptor", () => ({
  activityLogInterceptor: {},
}));

describe("temporal/worker", () => {
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const baseEnv = {
    TEMPORAL_TLS_ENABLED: false,
    TEMPORAL_TLS_SERVER_NAME: undefined,
    TEMPORAL_TLS_CA_CERT: undefined,
    TEMPORAL_TLS_CLIENT_CERT: undefined,
    TEMPORAL_TLS_CLIENT_KEY: undefined,
    TEMPORAL_ADDRESS: "temporal:7233",
    TEMPORAL_NAMESPACE: "default",
    TEMPORAL_TASK_QUEUE_DUMMY_1: "q-dummy-1",
    TEMPORAL_TASK_QUEUE_DUMMY_2: "q-dummy-2",
    TEMPORAL_TASK_QUEUE_SCHEDULED: "q-scheduled",
    TEMPORAL_MAX_ACTIVITY_TASKS: 5,
    TEMPORAL_MAX_WORKFLOW_TASKS: 5,
    TEMPORAL_WORKER_ROLE: "all",
  };

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("uncaughtException");
    process.removeAllListeners("unhandledRejection");
  });

  it("starts dummy1, dummy2, and scheduled workers for all role", async () => {
    await jest.isolateModulesAsync(async () => {
      const connection = { close: jest.fn() };
      const connectMock = jest.fn(async () => connection);
      const runMock = jest.fn(async () => undefined);
      const createMock = jest.fn(async () => ({
        run: runMock,
        shutdown: jest.fn(async () => undefined),
      }));

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: connectMock },
        Worker: { create: createMock },
      }));

      jest.doMock("@/config/env", () => ({ env: baseEnv }));

      await import("@/temporal/worker");
      await flush();

      expect(connectMock).toHaveBeenCalledTimes(1);
      expect(createMock).toHaveBeenCalledTimes(3);
      const createCall = (createMock.mock.calls as any[])[0][0];
      expect(createCall).toMatchObject({
        connection,
        namespace: "default",
        taskQueue: "q-dummy-1",
        maxConcurrentActivityTaskExecutions: 5,
        maxConcurrentWorkflowTaskExecutions: 5,
      });
      expect((createMock.mock.calls as any[])[1][0].taskQueue).toBe("q-dummy-2");
      expect((createMock.mock.calls as any[])[2][0].taskQueue).toBe("q-scheduled");
      expect(runMock).toHaveBeenCalledTimes(3);
    });
  });

  it("starts dummy1 worker for dummy1 role from argv", async () => {
    await jest.isolateModulesAsync(async () => {
      const originalArgv = process.argv;
      process.argv = ["node", "worker.js", "--role=dummy1"];
      const createMock = jest.fn(async () => ({
        run: jest.fn(async () => undefined),
        shutdown: jest.fn(async () => undefined),
      }));

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: jest.fn(async () => ({ close: jest.fn() })) },
        Worker: { create: createMock },
      }));

      jest.doMock("@/config/env", () => ({
        env: { ...baseEnv, TEMPORAL_WORKER_ROLE: undefined },
      }));

      await import("@/temporal/worker");
      await flush();

      expect(createMock).toHaveBeenCalledTimes(1);
      expect((createMock.mock.calls as any[])[0][0].taskQueue).toBe("q-dummy-1");
      process.argv = originalArgv;
    });
  });

  it("starts dummy2 worker for dummy2 role from argv", async () => {
    await jest.isolateModulesAsync(async () => {
      const originalArgv = process.argv;
      process.argv = ["node", "worker.js", "--role=dummy2"];
      const createMock = jest.fn(async () => ({
        run: jest.fn(async () => undefined),
        shutdown: jest.fn(async () => undefined),
      }));

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: jest.fn(async () => ({ close: jest.fn() })) },
        Worker: { create: createMock },
      }));

      jest.doMock("@/config/env", () => ({
        env: { ...baseEnv, TEMPORAL_WORKER_ROLE: undefined },
      }));

      await import("@/temporal/worker");
      await flush();

      expect(createMock).toHaveBeenCalledTimes(1);
      expect((createMock.mock.calls as any[])[0][0].taskQueue).toBe("q-dummy-2");
      process.argv = originalArgv;
    });
  });

  it("starts scheduled worker for scheduled role from argv", async () => {
    await jest.isolateModulesAsync(async () => {
      const originalArgv = process.argv;
      process.argv = ["node", "worker.js", "--role=scheduled"];
      const createMock = jest.fn(async () => ({
        run: jest.fn(async () => undefined),
        shutdown: jest.fn(async () => undefined),
      }));

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: jest.fn(async () => ({ close: jest.fn() })) },
        Worker: { create: createMock },
      }));

      jest.doMock("@/config/env", () => ({
        env: { ...baseEnv, TEMPORAL_WORKER_ROLE: undefined },
      }));

      await import("@/temporal/worker");
      await flush();

      expect(createMock).toHaveBeenCalledTimes(1);
      expect((createMock.mock.calls as any[])[0][0].taskQueue).toBe("q-scheduled");
      process.argv = originalArgv;
    });
  });

  it("warns when invalid role from argv and falls back to env", async () => {
    await jest.isolateModulesAsync(async () => {
      const { logger } = jest.requireMock("@/infra/logger/col-logger");
      const originalArgv = process.argv;
      process.argv = ["node", "worker.js", "--role", "prebook_job"];
      const createMock = jest.fn(async () => ({
        run: jest.fn(async () => undefined),
        shutdown: jest.fn(async () => undefined),
      }));

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: jest.fn(async () => ({ close: jest.fn() })) },
        Worker: { create: createMock },
      }));

      jest.doMock("@/config/env", () => ({
        env: { ...baseEnv, TEMPORAL_WORKER_ROLE: "dummy1" },
      }));

      await import("@/temporal/worker");
      await flush();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ role: "prebook_job" }),
        "Invalid worker role from argv; falling back to env",
      );
      expect(createMock).toHaveBeenCalledTimes(1);
      process.argv = originalArgv;
    });
  });

  it("warns when invalid env role and uses all workers", async () => {
    await jest.isolateModulesAsync(async () => {
      const { logger } = jest.requireMock("@/infra/logger/col-logger");
      const originalArgv = process.argv;
      process.argv = ["node", "worker.js"];
      const createMock = jest.fn(async () => ({
        run: jest.fn(async () => undefined),
        shutdown: jest.fn(async () => undefined),
      }));

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: jest.fn(async () => ({ close: jest.fn() })) },
        Worker: { create: createMock },
      }));

      jest.doMock("@/config/env", () => ({
        env: { ...baseEnv, TEMPORAL_WORKER_ROLE: "unknown" },
      }));

      await import("@/temporal/worker");
      await flush();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.objectContaining({ role: "unknown" }),
        "Invalid worker role from env; using default 'all'",
      );
      expect(createMock).toHaveBeenCalledTimes(3);
      process.argv = originalArgv;
    });
  });

  it("uses env role when argv has unrelated flags", async () => {
    await jest.isolateModulesAsync(async () => {
      const originalArgv = process.argv;
      process.argv = ["node", "worker.js", "--verbose"];
      const createMock = jest.fn(async () => ({
        run: jest.fn(async () => undefined),
        shutdown: jest.fn(async () => undefined),
      }));

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: jest.fn(async () => ({ close: jest.fn() })) },
        Worker: { create: createMock },
      }));

      jest.doMock("@/config/env", () => ({
        env: { ...baseEnv, TEMPORAL_WORKER_ROLE: "dummy1" },
      }));

      await import("@/temporal/worker");
      await flush();

      expect(createMock).toHaveBeenCalledTimes(1);
      expect((createMock.mock.calls as any[])[0][0].taskQueue).toBe("q-dummy-1");
      process.argv = originalArgv;
    });
  });

  it("keeps a valid argv role when env role is invalid", async () => {
    await jest.isolateModulesAsync(async () => {
      const originalArgv = process.argv;
      process.argv = ["node", "worker.js", "--role", "dummy2"];
      const createMock = jest.fn(async () => ({
        run: jest.fn(async () => undefined),
        shutdown: jest.fn(async () => undefined),
      }));

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: jest.fn(async () => ({ close: jest.fn() })) },
        Worker: { create: createMock },
      }));

      jest.doMock("@/config/env", () => ({
        env: { ...baseEnv, TEMPORAL_WORKER_ROLE: "unknown" },
      }));

      await import("@/temporal/worker");
      await flush();

      expect(createMock).toHaveBeenCalledTimes(1);
      expect((createMock.mock.calls as any[])[0][0].taskQueue).toBe("q-dummy-2");
      process.argv = originalArgv;
    });
  });

  it("gracefully shuts down on SIGTERM", async () => {
    await jest.isolateModulesAsync(async () => {
      const handlers: Record<string, () => void> = {};
      const onSpy = jest.spyOn(process, "on").mockImplementation((event: any, cb: any) => {
        handlers[event] = cb;
        return process;
      });
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
      const shutdownMock = jest.fn(async () => undefined);

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: jest.fn(async () => ({ close: jest.fn() })) },
        Worker: {
          create: jest.fn(async () => ({
            run: jest.fn(async () => undefined),
            shutdown: shutdownMock,
          })),
        },
      }));

      jest.doMock("@/config/env", () => ({ env: baseEnv }));

      await import("@/temporal/worker");
      await flush();

      handlers.SIGTERM?.();
      await flush();

      expect(shutdownMock).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
      onSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  it("ignores repeated shutdown signals", async () => {
    await jest.isolateModulesAsync(async () => {
      const handlers: Record<string, () => void> = {};
      const onSpy = jest.spyOn(process, "on").mockImplementation((event: any, cb: any) => {
        handlers[event] = cb;
        return process;
      });
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
      const shutdownMock = jest.fn(async () => undefined);

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: jest.fn(async () => ({ close: jest.fn() })) },
        Worker: {
          create: jest.fn(async () => ({
            run: jest.fn(async () => undefined),
            shutdown: shutdownMock,
          })),
        },
      }));

      jest.doMock("@/config/env", () => ({ env: { ...baseEnv, TEMPORAL_WORKER_ROLE: "dummy1" } }));

      await import("@/temporal/worker");
      await flush();

      handlers.SIGTERM?.();
      handlers.SIGTERM?.();
      await flush();

      expect(shutdownMock).toHaveBeenCalledTimes(1);
      expect(exitSpy).toHaveBeenCalledTimes(1);
      onSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  it("exits with error when shutdown fails", async () => {
    await jest.isolateModulesAsync(async () => {
      const handlers: Record<string, () => void> = {};
      const onSpy = jest.spyOn(process, "on").mockImplementation((event: any, cb: any) => {
        handlers[event] = cb;
        return process;
      });
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
      const shutdownError = new Error("shutdown fail");
      const shutdownMock = jest.fn(async () => {
        throw shutdownError;
      });

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: jest.fn(async () => ({ close: jest.fn() })) },
        Worker: {
          create: jest.fn(async () => ({
            run: jest.fn(async () => undefined),
            shutdown: shutdownMock,
          })),
        },
      }));

      jest.doMock("@/config/env", () => ({ env: { ...baseEnv, TEMPORAL_WORKER_ROLE: "dummy1" } }));

      await import("@/temporal/worker");
      await flush();

      handlers.SIGINT?.();
      await flush();

      expect(shutdownMock).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(1);
      onSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  it("logs uncaught exceptions and starts shutdown", async () => {
    await jest.isolateModulesAsync(async () => {
      const { logger } = jest.requireMock("@/infra/logger/col-logger");
      const handlers: Record<string, (err: Error) => void> = {};
      const onSpy = jest.spyOn(process, "on").mockImplementation((event: any, cb: any) => {
        handlers[event] = cb;
        return process;
      });
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
      const shutdownMock = jest.fn(async () => undefined);
      const err = new Error("boom");

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: jest.fn(async () => ({ close: jest.fn() })) },
        Worker: {
          create: jest.fn(async () => ({
            run: jest.fn(async () => undefined),
            shutdown: shutdownMock,
          })),
        },
      }));

      jest.doMock("@/config/env", () => ({ env: { ...baseEnv, TEMPORAL_WORKER_ROLE: "dummy1" } }));

      await import("@/temporal/worker");
      await flush();

      handlers.uncaughtException?.(err);
      await flush();

      expect(logger.error).toHaveBeenCalledWith({ err }, "Uncaught exception in Temporal worker");
      expect(shutdownMock).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
      onSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  it("logs unhandled rejections and starts shutdown", async () => {
    await jest.isolateModulesAsync(async () => {
      const { logger } = jest.requireMock("@/infra/logger/col-logger");
      const handlers: Record<string, (reason: unknown) => void> = {};
      const onSpy = jest.spyOn(process, "on").mockImplementation((event: any, cb: any) => {
        handlers[event] = cb;
        return process;
      });
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
      const shutdownMock = jest.fn(async () => undefined);
      const reason = "bad promise";

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: jest.fn(async () => ({ close: jest.fn() })) },
        Worker: {
          create: jest.fn(async () => ({
            run: jest.fn(async () => undefined),
            shutdown: shutdownMock,
          })),
        },
      }));

      jest.doMock("@/config/env", () => ({ env: { ...baseEnv, TEMPORAL_WORKER_ROLE: "dummy1" } }));

      await import("@/temporal/worker");
      await flush();

      handlers.unhandledRejection?.(reason);
      await flush();

      expect(logger.error).toHaveBeenCalledWith(
        { err: reason },
        "Unhandled rejection in Temporal worker",
      );
      expect(shutdownMock).toHaveBeenCalled();
      expect(exitSpy).toHaveBeenCalledWith(0);
      onSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });

  it("exits with error when startup fails", async () => {
    await jest.isolateModulesAsync(async () => {
      const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);
      const connectMock = jest.fn(async () => {
        throw new Error("connect fail");
      });

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: connectMock },
        Worker: { create: jest.fn() },
      }));

      jest.doMock("@/config/env", () => ({ env: baseEnv }));

      await import("@/temporal/worker");
      await flush();

      expect(exitSpy).toHaveBeenCalledWith(1);
      exitSpy.mockRestore();
    });
  });

  it("passes tls options to NativeConnection when enabled", async () => {
    await jest.isolateModulesAsync(async () => {
      const connectMock = jest.fn(async () => ({ close: jest.fn() }));

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: connectMock },
        Worker: {
          create: jest.fn(async () => ({
            run: jest.fn(async () => undefined),
            shutdown: jest.fn(async () => undefined),
          })),
        },
      }));

      jest.doMock("@/config/env", () => ({
        env: {
          ...baseEnv,
          TEMPORAL_TLS_ENABLED: true,
          TEMPORAL_TLS_SERVER_NAME: "srv",
          TEMPORAL_TLS_CA_CERT: "ca",
          TEMPORAL_TLS_CLIENT_CERT: "client-cert",
          TEMPORAL_TLS_CLIENT_KEY: "client-key",
        },
      }));

      await import("@/temporal/worker");
      await flush();

      const call = (connectMock.mock.calls as any[])[0][0];
      expect(call.tls.serverNameOverride).toBe("srv");
      expect(Buffer.isBuffer(call.tls.serverRootCACertificate)).toBe(true);
      expect(Buffer.isBuffer(call.tls.clientCertPair.crt)).toBe(true);
      expect(Buffer.isBuffer(call.tls.clientCertPair.key)).toBe(true);
    });
  });

  it("passes undefined optional tls fields when tls is enabled without cert values", async () => {
    await jest.isolateModulesAsync(async () => {
      const connectMock = jest.fn(async () => ({ close: jest.fn() }));

      jest.doMock("@temporalio/worker", () => ({
        NativeConnection: { connect: connectMock },
        Worker: {
          create: jest.fn(async () => ({
            run: jest.fn(async () => undefined),
            shutdown: jest.fn(async () => undefined),
          })),
        },
      }));

      jest.doMock("@/config/env", () => ({
        env: {
          ...baseEnv,
          TEMPORAL_TLS_ENABLED: true,
          TEMPORAL_TLS_SERVER_NAME: undefined,
          TEMPORAL_TLS_CA_CERT: undefined,
          TEMPORAL_TLS_CLIENT_CERT: "client-cert",
          TEMPORAL_TLS_CLIENT_KEY: undefined,
        },
      }));

      await import("@/temporal/worker");
      await flush();

      const call = (connectMock.mock.calls as any[])[0][0];
      expect(call.tls.serverRootCACertificate).toBeUndefined();
      expect(call.tls.clientCertPair).toBeUndefined();
    });
  });
});
