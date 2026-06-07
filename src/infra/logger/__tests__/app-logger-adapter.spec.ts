jest.mock("@/infra/logger/col-logger", () => ({
  createLogModel: jest.fn(),
}));

import { createLogModel } from "@/infra/logger/col-logger";
import { ColAppLoggerFactory } from "@/infra/logger/app-logger-adapter";

describe("ColAppLoggerFactory", () => {
  it("creates app logger backed by col logger txid", () => {
    const logStep = jest.fn();
    (createLogModel as jest.Mock).mockReturnValue({ logStep });

    const factory = new ColAppLoggerFactory();
    const logger = factory.createLogger({ txid: "tx-1" });

    logger.logStep("message", {
      activity_name: "DummyWorkflowDispatcher",
      resourceId: "order-1",
    });

    expect(createLogModel).toHaveBeenCalledWith({ txid: "tx-1" });
    expect(logStep).toHaveBeenCalledWith("message", {
      activity_name: "DummyWorkflowDispatcher",
      resourceId: "order-1",
    });
  });
});
