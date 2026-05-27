import { ensureQueues, getQueueUrl } from "@/infra/aws/queue-setup";

jest.mock("@/config/env", () => ({
  env: {
    NODE_ENV: "development",
    SQS_ENDPOINT: "http://localhost:4566",
    AUTO_CREATE_QUEUES: true,
    SQS_DL_SUFFIX: "-dlq",
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
jest.mock("@/application/handler-resolver", () => ({
  resolveHandler: jest.fn(() => ({ handle: jest.fn() })),
}));

describe("Bootstrap", () => {
  const { resolveQueueUrl, closeHealthServer } = jest.requireActual("@/application/bootstrap");

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
  });
});
