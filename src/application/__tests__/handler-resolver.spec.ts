import { resolveHandler } from "@/application/handler-resolver";
import { ProcessDummy } from "@/application/usecases/process-dummy";

jest.mock("@/application/usecases/process-dummy");

describe("HandlerResolver", () => {
  it("should resolve ProcessDummy for dummy queue", () => {
    const handler = resolveHandler("dummy");
    expect(handler).toBeInstanceOf(ProcessDummy);
  });

  it("should resolve handler with environment segment in queue name", () => {
    const handler = resolveHandler("dev-dummy");
    expect(handler).toBeInstanceOf(ProcessDummy);
  });

  it("should ignore suffix after dot in queue name", () => {
    const handler = resolveHandler("dummy.fifo");
    expect(handler).toBeInstanceOf(ProcessDummy);
  });

  it("should return undefined for unknown queue name", () => {
    const handler = resolveHandler("unknown-queue");
    expect(handler).toBeUndefined();
  });

  it("should handle empty queue name", () => {
    const handler = resolveHandler("");
    expect(handler).toBeUndefined();
  });
});
