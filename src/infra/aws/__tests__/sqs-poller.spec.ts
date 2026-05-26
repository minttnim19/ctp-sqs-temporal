// Mock logger and sleep
jest.mock("@/infra/logger/col-logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));
const sleepMock = jest.fn(() => Promise.resolve());
jest.mock("@/utils/sleep", () => ({ sleep: (...args: any[]) => (sleepMock as any)(...args) }));

import {
  DeleteMessageCommand,
  Message,
  ReceiveMessageCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

import { SqsPoller } from "@/infra/aws/sqs-poller";

describe("infra/aws/sqs-poller - lifecycle", () => {
  it("reflects running state for start/stop", async () => {
    const sqs = { send: jest.fn() } as unknown as SQSClient;
    const handler = jest.fn(async () => {});
    const poller = new SqsPoller(sqs, "q-url", handler, {
      batchSize: 1,
      waitTimeSeconds: 1,
      visibilityTimeoutSeconds: 30,
      concurrency: 1,
    });

    expect(poller.isRunning()).toBe(false);

    const loopSpy = jest.spyOn(poller as any, "loop").mockResolvedValueOnce(undefined);

    poller.start();
    expect(poller.isRunning()).toBe(true);

    await Promise.resolve();

    poller.stop();
    expect(poller.isRunning()).toBe(false);
    expect(loopSpy).toHaveBeenCalledTimes(1);

    loopSpy.mockRestore();
  });
});

describe("infra/aws/sqs-poller - processWithConcurrency", () => {
  const { logger } = jest.requireMock("@/infra/logger/col-logger");

  it("deletes messages on success and keeps on failure", async () => {
    const send = jest.fn(async (cmd: any) => {
      if (cmd instanceof DeleteMessageCommand) return {} as any;
      return {} as any;
    });
    const sqs = { send } as unknown as SQSClient;
    const handler = jest.fn(async (msg: Message) => {
      if (msg.Body === "bad") throw new Error("fail");
    });
    const poller = new SqsPoller(sqs, "q-url", handler, {
      batchSize: 10,
      waitTimeSeconds: 1,
      visibilityTimeoutSeconds: 30,
      concurrency: 3,
    });

    const messages: Message[] = [
      { MessageId: "1", Body: "ok", ReceiptHandle: "rh-1" },
      { MessageId: "2", Body: "bad", ReceiptHandle: "rh-2" },
      { MessageId: "3", Body: "ok", ReceiptHandle: "rh-3" },
    ];

    // call private via any casting
    await (poller as any).processWithConcurrency(messages, 5);

    expect(handler).toHaveBeenCalledTimes(3);
    // Delete only for ok messages
    const deleteCalls = send.mock.calls.filter(([cmd]) => cmd instanceof DeleteMessageCommand);
    expect(deleteCalls).toHaveLength(2);
  });

  it("does not delete when ReceiptHandle is missing", async () => {
    const send = jest.fn(async (cmd: any) => {
      if (cmd instanceof DeleteMessageCommand) return {} as any;
      return {} as any;
    });
    const sqs = { send } as unknown as SQSClient;
    const handler = jest.fn(async () => {});
    const poller = new SqsPoller(sqs, "q-url", handler, {
      batchSize: 10,
      waitTimeSeconds: 1,
      visibilityTimeoutSeconds: 30,
      concurrency: 3,
    });

    const messages: Message[] = [
      { MessageId: "1", Body: "ok" },
      { MessageId: "2", Body: "ok", ReceiptHandle: "rh-2" },
    ];

    await (poller as any).processWithConcurrency(messages, 5);

    // One message without handle should not trigger delete
    const deleteCalls = send.mock.calls.filter(([cmd]) => cmd instanceof DeleteMessageCommand);
    expect(deleteCalls).toHaveLength(1);
  });

  it("skips processing when concurrency is less than 1", async () => {
    logger.warn.mockClear();
    const send = jest.fn(async () => ({}) as any);
    const sqs = { send } as unknown as SQSClient;
    const handler = jest.fn(async () => {});
    const poller = new SqsPoller(sqs, "q-url", handler, {
      batchSize: 10,
      waitTimeSeconds: 1,
      visibilityTimeoutSeconds: 30,
      concurrency: 0,
    });

    const messages: Message[] = [{ MessageId: "1", Body: "ok", ReceiptHandle: "rh-1" }];

    await (poller as any).processWithConcurrency(messages, 0);

    expect(handler).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(
      { concurrency: 0, queueUrl: "q-url" },
      "SQS Poller concurrency is less than 1; skipping batch",
    );
  });
});

describe("infra/aws/sqs-poller - loop", () => {
  const { logger } = jest.requireMock("@/infra/logger/col-logger");

  it("backs off on receive error (calls sleep)", async () => {
    sleepMock.mockClear();
    let attempts = 0;
    const send = jest.fn(async (cmd: any) => {
      if (cmd instanceof ReceiveMessageCommand) {
        attempts += 1;
        if (attempts === 1) throw new Error("network");
        return await new Promise((r) => setTimeout(() => r({ Messages: [] } as any), 1));
      }
      return {} as any;
    });
    const sqs = { send } as unknown as SQSClient;
    const handler = jest.fn(async () => {});
    const poller = new SqsPoller(sqs, "q-url", handler, {
      batchSize: 1,
      waitTimeSeconds: 1,
      visibilityTimeoutSeconds: 30,
      concurrency: 1,
    });
    poller.start();
    setTimeout(() => poller.stop(), 10);
    await new Promise((r) => setTimeout(r, 30));
    expect(sleepMock).toHaveBeenCalled();
  });

  it("logs when loop crashes", async () => {
    const loopError = new Error("loop failure");
    const send = jest.fn(async () => ({ Messages: [] }));
    const sqs = { send } as unknown as SQSClient;
    const handler = jest.fn(async () => {});
    const poller = new SqsPoller(sqs, "q-url", handler, {
      batchSize: 1,
      waitTimeSeconds: 1,
      visibilityTimeoutSeconds: 30,
      concurrency: 1,
    });

    jest.spyOn<any, any>(poller as any, "loop").mockRejectedValueOnce(loopError);

    poller.start();
    await Promise.resolve();

    expect(logger.error).toHaveBeenCalledWith({ err: loopError }, "Poller crashed");
  });

  it("requests message and queue attributes during receive", async () => {
    const cfg = {
      batchSize: 2,
      waitTimeSeconds: 5,
      visibilityTimeoutSeconds: 45,
      concurrency: 1,
    };
    const handler = jest.fn(async () => {});
    const send = jest.fn(async (cmd: any) => {
      if (cmd instanceof ReceiveMessageCommand) {
        poller.stop();
        return { Messages: [] } as any;
      }
      return {} as any;
    });
    const sqs = { send } as unknown as SQSClient;
    const poller = new SqsPoller(sqs, "q-url", handler, cfg);

    poller.start();
    await new Promise((resolve) => setTimeout(resolve, 10));

    const receiveCall = send.mock.calls.find(([cmd]) => cmd instanceof ReceiveMessageCommand);
    expect(receiveCall).toBeDefined();

    const [receiveCommand] = receiveCall!;
    expect(receiveCommand.input).toMatchObject({
      QueueUrl: "q-url",
      MaxNumberOfMessages: cfg.batchSize,
      WaitTimeSeconds: cfg.waitTimeSeconds,
      VisibilityTimeout: cfg.visibilityTimeoutSeconds,
      AttributeNames: ["All"],
      MessageAttributeNames: ["All"],
    });
  });

  it("processes messages via processWithConcurrency", async () => {
    const { logger } = jest.requireMock("@/infra/logger/col-logger");
    logger.info.mockClear();

    const messagesBatch = [{ MessageId: "m1", Body: "body", ReceiptHandle: "rh" }];
    const send = jest.fn(async (cmd: any) => {
      if (cmd instanceof ReceiveMessageCommand) {
        return { Messages: messagesBatch } as any;
      }
      return {} as any;
    });
    const sqs = { send } as unknown as SQSClient;
    const handler = jest.fn(async () => {});
    const poller = new SqsPoller(sqs, "q-url", handler, {
      batchSize: 1,
      waitTimeSeconds: 1,
      visibilityTimeoutSeconds: 30,
      concurrency: 2,
    });

    const processSpy = jest
      .spyOn(poller as any, "processWithConcurrency")
      .mockImplementationOnce(async (...args: unknown[]) => {
        const [msgs, concurrency] = args as [Message[], number];
        expect(msgs).toBe(messagesBatch);
        expect(concurrency).toBe(2);
        poller.stop();
      });

    poller.start();
    await new Promise((resolve) => setTimeout(resolve, 5));

    expect(processSpy).toHaveBeenCalledTimes(1);
    processSpy.mockRestore();
  });

  it("continues polling when ReceiveMessage returns no messages", async () => {
    const send = jest.fn(async (cmd: any) => {
      if (cmd instanceof ReceiveMessageCommand) {
        if (send.mock.calls.length === 1) {
          return {}; // undefined Messages
        }
        if (send.mock.calls.length === 2) {
          return { Messages: null }; // explicit null
        }
        poller.stop();
        return { Messages: [] };
      }
      return {} as any;
    });
    const sqs = { send } as unknown as SQSClient;
    const handler = jest.fn(async () => {});
    const poller = new SqsPoller(sqs, "q-url", handler, {
      batchSize: 1,
      waitTimeSeconds: 1,
      visibilityTimeoutSeconds: 30,
      concurrency: 1,
    });

    poller.start();
    await new Promise((resolve) => setTimeout(resolve, 10));

    // No processing occurs and handler is never called
    expect(handler).not.toHaveBeenCalled();
    // ReceiveMessage called >= 3 times (for {}, {Messages:null}, {Messages:[]})
    const receiveCalls = send.mock.calls.filter(([_cmd]) => _cmd instanceof ReceiveMessageCommand);
    expect(receiveCalls.length).toBeGreaterThanOrEqual(3);
  });
});
