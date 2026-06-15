import { getQueueHandler, registerQueueHandler } from "@/infra/aws/queue-routing";

describe("queue-routing", () => {
  const dummyHandler = { handle: jest.fn() };
  const registry = { dummy: dummyHandler };

  it("resolves handler for base queue name", () => {
    expect(getQueueHandler("dummy", "dev", registry)).toBe(dummyHandler);
  });

  it("resolves handler with environment segment in queue name", () => {
    expect(getQueueHandler("dev-dummy", "dev", registry)).toBe(dummyHandler);
  });

  it("resolves scheduled handlers with environment segment in queue name", () => {
    const scheduledHandler = { handle: jest.fn() };
    expect(
      getQueueHandler("dev-scheduled-dummy", "dev", {
        ...registry,
        "scheduled-dummy": scheduledHandler,
      }),
    ).toBe(scheduledHandler);
  });

  it("ignores suffix after dot in queue name", () => {
    expect(getQueueHandler("dummy.fifo", "dev", registry)).toBe(dummyHandler);
  });

  it("returns undefined for unknown queue name", () => {
    expect(getQueueHandler("unknown-queue", "dev", registry)).toBeUndefined();
  });

  it("handles empty queue name", () => {
    expect(getQueueHandler("", "dev", registry)).toBeUndefined();
  });

  it("registers a handler with payload mapping", async () => {
    const handler = { handle: jest.fn().mockResolvedValue(undefined) };
    const registered = registerQueueHandler(handler, (payload) => ({
      mapped: payload,
    }));
    const meta = { messageId: "message-1", receiptHandle: "receipt-1" };

    await registered.handle("raw", meta);

    expect(handler.handle).toHaveBeenCalledWith({ mapped: "raw" }, meta);
  });

  it("registers a handler with default payload mapping", async () => {
    const handler = { handle: jest.fn().mockResolvedValue(undefined) };
    const registered = registerQueueHandler(handler);
    const meta = { messageId: "message-1", receiptHandle: "receipt-1" };
    const payload = { raw: true };

    await registered.handle(payload, meta);

    expect(handler.handle).toHaveBeenCalledWith(payload, meta);
  });
});
