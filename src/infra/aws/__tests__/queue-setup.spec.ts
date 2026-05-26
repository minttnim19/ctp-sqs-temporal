// Mock logger
jest.mock("@/infra/logger/col-logger", () => ({ logger: { info: jest.fn(), error: jest.fn() } }));

import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

import { ensureQueues, getQueueUrl } from "@/infra/aws/queue-setup";

function createFakeClient() {
  const calls: any[] = [];
  const send = jest.fn(async (cmd: any) => {
    calls.push(cmd);
    if (cmd instanceof CreateQueueCommand) {
      return {};
    }
    if (cmd instanceof GetQueueUrlCommand) {
      const name = (cmd as any).input.QueueName;
      return { QueueUrl: `${name}-url` } as any;
    }
    if (cmd instanceof GetQueueAttributesCommand) {
      return { Attributes: { QueueArn: "arn:aws:sqs:::dlq" } } as any;
    }
    throw new Error("Unknown command");
  });
  return { client: { send } as unknown as SQSClient, calls, send };
}

describe("infra/aws/queue-setup", () => {
  it("ensureQueues creates dlq then main with redrive policy and returns urls", async () => {
    const { client, calls } = createFakeClient();
    const res = await ensureQueues(client, "main-q", "main-q-dlq");
    expect(res).toEqual({ mainUrl: "main-q-url", dlqUrl: "main-q-dlq-url" });
    // First call is CreateQueue for DLQ, later CreateQueue for main
    expect(calls.some((c) => c instanceof CreateQueueCommand)).toBe(true);
    const mainCreate = calls.find(
      (c) => c instanceof CreateQueueCommand && (c as any).input.QueueName === "main-q",
    ) as CreateQueueCommand;
    expect(mainCreate).toBeTruthy();
    expect((mainCreate as any).input.Attributes.RedrivePolicy).toContain("deadLetterTargetArn");
  });

  it("getQueueUrl returns queue URL", async () => {
    const { client } = createFakeClient();
    await expect(getQueueUrl(client, "q1")).resolves.toBe("q1-url");
  });

  it("throws when QueueUrl is missing", async () => {
    const send = jest.fn(async (cmd: any) => {
      if (cmd instanceof GetQueueUrlCommand) return { QueueUrl: undefined } as any;
      return {} as any;
    });
    const client = { send } as unknown as SQSClient;
    await expect(getQueueUrl(client, "q-missing")).rejects.toThrow("SQS queue URL not found");
  });

  it("throws when QueueArn is missing in ensureQueues", async () => {
    const send = jest.fn(async (cmd: any) => {
      if (cmd instanceof CreateQueueCommand) return {} as any;
      if (cmd instanceof GetQueueUrlCommand)
        return { QueueUrl: (cmd as any).input.QueueName + "-url" } as any;
      if (cmd instanceof GetQueueAttributesCommand) return { Attributes: {} } as any;
      return {} as any;
    });
    const client = { send } as unknown as SQSClient;
    await expect(ensureQueues(client, "main", "main-dlq")).rejects.toThrow("QueueArn");
  });
});
