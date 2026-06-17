jest.mock("@/infra/temporal/temporal-client", () => ({
  getTemporalClient: jest.fn(),
}));

import { getTemporalClient } from "@/infra/temporal/temporal-client";
import { TemporalWorkflowStarter } from "@/infra/temporal/temporal-workflow-starter";

describe("TemporalWorkflowStarter", () => {
  it("maps workflow start requests to Temporal client calls", async () => {
    const start = jest.fn().mockResolvedValue(undefined);
    (getTemporalClient as jest.Mock).mockResolvedValue({
      workflow: { start },
    });

    const starter = new TemporalWorkflowStarter();

    await starter.startWorkflow({
      workflowName: "DummyWorkflow",
      taskQueue: "dummy-task-queue",
      workflowId: "dummy:order-1:1",
      correlationId: "tx-1",
      args: [{ resource: { id: "order-1" } }],
    });

    expect(start).toHaveBeenCalledWith("DummyWorkflow", {
      taskQueue: "dummy-task-queue",
      workflowId: "dummy:order-1:1",
      args: [{ resource: { id: "order-1" } }],
    });
  });
});
