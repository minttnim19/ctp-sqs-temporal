import { ensureQueues, getQueueUrl } from "@/infra/aws/queue-setup";

jest.mock("@/config/env", () => ({
  env: {
    NODE_ENV: "development",
    APP_ENV: "dev",
    SQS_ENDPOINT: "http://localhost:4566",
    AUTO_CREATE_QUEUES: true,
    SQS_DLQ_SUFFIX: "-dlq",
    HEALTHCHECK_PORT: 3000,
    SPAWN_TEMPORAL_WORKER: true,
    LOG_PATH: "./logs",
    LOG_TO_FILE: false,
    LOG_LEVEL: "info",
    LOG_CHANNEL: "abc",
    LOG_PRODUCT: "xyz",
    SERVICE_TYPE: "svc",
  },
  resolveQueueNames: jest.fn(() => ["q1"]),
}));

jest.mock("@/infra/aws/queue-setup");
jest.mock("@/infra/aws/sqs-client", () => ({ sqsClient: {} }));
jest.mock("@/infra/aws/sqs-poller");
jest.mock("@/infra/healthcheck/health-server", () => ({
  startHealthServer: jest.fn(() => ({ close: jest.fn((cb: any) => cb()) })),
}));
jest.mock("@/infra/temporal/temporal-supervisor", () => ({
  startTemporalWorkers: jest.fn(() => new Map()),
  stopWorkers: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/infra/logger/col-logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@/infra/composition/composition-root", () => ({
  createComposition: jest.fn(() => ({
    queueHandlers: {
      q1: { handle: jest.fn() },
    },
  })),
}));

describe("Bootstrap", () => {
  const { resolveQueueUrl, closeHealthServer } = jest.requireActual(
    "@/infra/composition/bootstrap",
  );

  describe("resolveQueueUrl", () => {
    it("should call ensureQueues when allowAutoCreateQueues is true", async () => {
      (ensureQueues as jest.Mock).mockResolvedValue({ mainUrl: "main-url" });
      const url = await resolveQueueUrl("q", true, "-dlq");
      expect(url).toBe("main-url");
    });

    it("should call getQueueUrl when allowAutoCreateQueues is false", async () => {
      (getQueueUrl as jest.Mock).mockResolvedValue("existing-url");
      const url = await resolveQueueUrl("q", false, "-dlq");
      expect(url).toBe("existing-url");
    });
  });

  describe("closeHealthServer", () => {
    it("should resolve when server closes successfully", async () => {
      const mockServer = { close: jest.fn((cb) => cb()) } as any;
      await expect(closeHealthServer(mockServer)).resolves.toBeUndefined();
    });

    it("should log and resolve when server close fails", async () => {
      const { logger } = jest.requireMock("@/infra/logger/col-logger");
      const err = new Error("close failed");
      const mockServer = { close: jest.fn((cb) => cb(err)) } as any;

      await expect(closeHealthServer(mockServer)).resolves.toBeUndefined();

      expect(logger.error).toHaveBeenCalledWith({ err }, "Health check server close failed");
    });
  });
});

describe("bootstrap runtime", () => {
  const firstShutdownProbe = (startTemporalWorkers: jest.Mock): (() => boolean) => {
    const call = startTemporalWorkers.mock.calls[0] as [() => boolean] | undefined;
    if (!call) {
      throw new Error("startTemporalWorkers was not called");
    }
    return call[0];
  };

  const importBootstrap = async ({
    envOverrides = {},
    queueNames = ["q1"],
    queueHandlers = { q1: { handle: jest.fn().mockResolvedValue(undefined) } },
    mappedMessage = { payload: { ok: true }, metadata: { messageId: "m1", receiptHandle: "rh" } },
  }: {
    envOverrides?: Record<string, unknown>;
    queueNames?: string[];
    queueHandlers?: Record<string, { handle: jest.Mock }>;
    mappedMessage?: unknown;
  } = {}) => {
    jest.resetModules();
    const pollers: any[] = [];
    const processHandlers: Record<string, (...args: any[]) => void> = {};
    const startHealthServer = jest.fn(() => ({ close: jest.fn((cb: any) => cb()) }));
    const startTemporalWorkers = jest.fn(() => new Map([["dummy1", { pid: 1 }]]));
    const stopWorkers = jest.fn().mockResolvedValue(undefined);
    const ensureQueues = jest.fn().mockResolvedValue({ mainUrl: "created-url" });
    const getQueueUrl = jest.fn().mockResolvedValue("existing-url");
    const mapSqsMessage = jest.fn(() => mappedMessage);
    const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    const processOnSpy = jest.spyOn(process, "on").mockImplementation((event: any, cb: any) => {
      processHandlers[event] = cb;
      return process;
    });
    const exitSpy = jest.spyOn(process, "exit").mockImplementation(() => undefined as never);

    class MockSqsPoller {
      stopped = false;

      constructor(
        public readonly sqs: unknown,
        public readonly queueUrl: string,
        public readonly handler: (raw: unknown) => Promise<void>,
        public readonly cfg: unknown,
      ) {
        pollers.push(this);
      }

      start = jest.fn();
      stop = jest.fn(() => {
        this.stopped = true;
      });
    }

    const env = {
      NODE_ENV: "development",
      APP_ENV: "dev",
      SQS_ENDPOINT: "http://localhost:4566",
      AUTO_CREATE_QUEUES: true,
      SQS_DLQ_SUFFIX: "-dlq",
      SQS_BATCH_SIZE: 10,
      SQS_POLLING_WAIT_SECS: 20,
      SQS_VISIBILITY_TIMEOUT_SECS: 60,
      CONCURRENCY: 5,
      HEALTHCHECK_PORT: 3000,
      SPAWN_TEMPORAL_WORKER: true,
      ...envOverrides,
    };

    jest.doMock("@/config/env", () => ({
      env,
      resolveQueueNames: jest.fn(() => queueNames),
    }));
    jest.doMock("@/infra/aws/queue-setup", () => ({ ensureQueues, getQueueUrl }));
    jest.doMock("@/infra/aws/queue-routing", () => ({
      resolveQueueHandler: jest.fn((queueName: string) => queueHandlers[queueName]),
    }));
    jest.doMock("@/infra/aws/sqs-client", () => ({ sqsClient: { name: "sqs" } }));
    jest.doMock("@/infra/aws/sqs-message-mapper", () => ({ mapSqsMessage }));
    jest.doMock("@/infra/aws/sqs-poller", () => ({ SqsPoller: MockSqsPoller }));
    jest.doMock("@/infra/composition/composition-root", () => ({
      createComposition: jest.fn(() => ({ queueHandlers })),
    }));
    jest.doMock("@/infra/healthcheck/health-server", () => ({ startHealthServer }));
    jest.doMock("@/infra/logger/col-logger", () => ({ logger }));
    jest.doMock("@/infra/temporal/temporal-supervisor", () => ({
      startTemporalWorkers,
      stopWorkers,
    }));

    const mod = await import("@/infra/composition/bootstrap");
    return {
      ...mod,
      pollers,
      processHandlers,
      processOnSpy,
      exitSpy,
      startHealthServer,
      startTemporalWorkers,
      stopWorkers,
      ensureQueues,
      getQueueUrl,
      mapSqsMessage,
      logger,
      queueHandlers,
    };
  };

  afterEach(() => {
    jest.restoreAllMocks();
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
    process.removeAllListeners("SIGUSR2");
  });

  it("creates pollers, maps SQS messages, starts workers, and starts health server", async () => {
    await jest.isolateModulesAsync(async () => {
      const ctx = await importBootstrap();

      await ctx.bootstrap();
      await ctx.pollers[0].handler({ Body: "{}" });

      expect(ctx.ensureQueues).toHaveBeenCalledWith(expect.anything(), "q1", "q1-dlq");
      expect(ctx.pollers).toHaveLength(1);
      expect(ctx.pollers[0].start).toHaveBeenCalledTimes(1);
      expect(ctx.mapSqsMessage).toHaveBeenCalledWith({ Body: "{}" });
      expect(ctx.queueHandlers.q1.handle).toHaveBeenCalledWith(
        { ok: true },
        { messageId: "m1", receiptHandle: "rh" },
      );
      expect(ctx.startTemporalWorkers).toHaveBeenCalledTimes(1);
      const isShuttingDown = firstShutdownProbe(ctx.startTemporalWorkers);
      expect(isShuttingDown()).toBe(false);
      expect(ctx.startHealthServer).toHaveBeenCalledWith({
        port: 3000,
        manualApi: {
          enabled: true,
          resolveHandler: expect.any(Function),
        },
      });
    });
  });

  it("warns and skips queues without handlers", async () => {
    await jest.isolateModulesAsync(async () => {
      const ctx = await importBootstrap({ queueNames: ["missing"], queueHandlers: {} });

      await ctx.bootstrap();

      expect(ctx.logger.warn).toHaveBeenCalledWith(
        { queue: "missing" },
        "No handler mapped for queue; skipping",
      );
      expect(ctx.pollers).toHaveLength(0);
    });
  });

  it("warns when auto-create is enabled outside local mode and uses existing queue url", async () => {
    await jest.isolateModulesAsync(async () => {
      const ctx = await importBootstrap({
        envOverrides: { NODE_ENV: "production", SQS_ENDPOINT: undefined },
      });

      await ctx.bootstrap();

      expect(ctx.logger.warn).toHaveBeenCalledWith(
        { nodeEnv: "production", sqsEndpoint: "" },
        "AUTO_CREATE_QUEUES is enabled but only honored on local (non-production with SQS_ENDPOINT). Falling back to existing queues.",
      );
      expect(ctx.getQueueUrl).toHaveBeenCalledWith(expect.anything(), "q1");
    });
  });

  it("handles SIGUSR2 restart paths", async () => {
    await jest.isolateModulesAsync(async () => {
      const ctx = await importBootstrap();

      await ctx.bootstrap();
      ctx.processHandlers.SIGUSR2();
      ctx.processHandlers.SIGUSR2();
      await Promise.resolve();

      expect(ctx.stopWorkers).toHaveBeenCalledTimes(1);
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        { signal: "SIGUSR2" },
        "SIGUSR2 received; restarting Temporal workers",
      );
      expect(ctx.logger.warn).toHaveBeenCalledWith(
        "Temporal worker restart already in progress; skipping",
      );
      await Promise.resolve();
      expect(ctx.logger.info).toHaveBeenCalledWith("Temporal workers restart completed");
    });
  });

  it("warns when SIGUSR2 restart is requested but worker spawning is disabled", async () => {
    await jest.isolateModulesAsync(async () => {
      const ctx = await importBootstrap({ envOverrides: { SPAWN_TEMPORAL_WORKER: false } });

      await ctx.bootstrap();
      ctx.processHandlers.SIGUSR2();

      expect(ctx.logger.warn).toHaveBeenCalledWith(
        "SPAWN_TEMPORAL_WORKER is disabled; cannot restart workers",
      );
      expect(ctx.stopWorkers).not.toHaveBeenCalled();
    });
  });

  it("stops pollers, workers, health server, and exits on SIGTERM once", async () => {
    await jest.isolateModulesAsync(async () => {
      const ctx = await importBootstrap();

      await ctx.bootstrap();
      const isShuttingDown = firstShutdownProbe(ctx.startTemporalWorkers);
      await ctx.processHandlers.SIGTERM();
      await ctx.processHandlers.SIGTERM();

      expect(isShuttingDown()).toBe(true);
      expect(ctx.pollers[0].stop).toHaveBeenCalledTimes(1);
      expect(ctx.stopWorkers).toHaveBeenCalledTimes(1);
      expect(ctx.exitSpy).toHaveBeenCalledWith(0);
    });
  });

  it("does not restart workers once shutdown has started", async () => {
    await jest.isolateModulesAsync(async () => {
      const ctx = await importBootstrap();

      await ctx.bootstrap();
      const shutdownPromise = ctx.processHandlers.SIGINT();
      ctx.processHandlers.SIGUSR2();
      await shutdownPromise;

      expect(ctx.stopWorkers).toHaveBeenCalledTimes(1);
    });
  });
});
