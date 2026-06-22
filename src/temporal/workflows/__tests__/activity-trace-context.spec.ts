const proxyActivitiesMock = jest.fn();

jest.mock("@temporalio/workflow", () => ({
  proxyActivities: proxyActivitiesMock,
}));

import { proxyActivities } from "@temporalio/workflow";

import { DummyWorkflow } from "@/temporal/workflows/dummy.workflow";
import { ScheduledJobWorkflow } from "@/temporal/workflows/scheduled-job.workflow";

describe("workflow activity trace context", () => {
  beforeEach(() => {
    proxyActivitiesMock.mockReset();
  });

  it("passes correlatorId from DummyWorkflow options to the activity", async () => {
    const dummyActivity = jest.fn().mockResolvedValue({ success: true, data: { message: "ok" } });
    proxyActivitiesMock.mockReturnValue({ dummyActivity });

    await DummyWorkflow({} as never, {
      retryAttempts: 2,
      retryDelayMs: 1000,
      correlatorId: "corr-123",
    });

    expect(proxyActivities).toHaveBeenCalledWith({
      startToCloseTimeout: "10 minutes",
      retry: {
        maximumAttempts: 2,
        initialInterval: "1000ms",
      },
    });
    expect(dummyActivity).toHaveBeenCalledWith({ correlatorId: "corr-123" });
  });

  it("passes correlatorId from ScheduledJobWorkflow options to the activity", async () => {
    const scheduledActivity = jest
      .fn()
      .mockResolvedValue({ success: true, data: { message: "ok" } });
    proxyActivitiesMock.mockReturnValue({ scheduledActivity });

    await ScheduledJobWorkflow({}, { correlatorId: "corr-456" });

    expect(scheduledActivity).toHaveBeenCalledWith({ correlatorId: "corr-456" });
  });

  it("omits trace context when correlatorId is not available", async () => {
    const dummyActivity = jest.fn().mockResolvedValue({ success: true, data: { message: "ok" } });
    proxyActivitiesMock.mockReturnValue({ dummyActivity });

    await DummyWorkflow({} as never);

    expect(dummyActivity).toHaveBeenCalledWith(undefined);
  });
});
