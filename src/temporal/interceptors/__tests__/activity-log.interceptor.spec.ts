const mockLogStep = jest.fn();
const mockCreateLogModel = jest.fn(() => ({ logStep: mockLogStep }));

jest.mock("@/infra/logger/col-logger", () => ({
  createLogModel: mockCreateLogModel,
}));

import { activityLogInterceptor } from "@/temporal/interceptors/activity-log.interceptor";

function makeCtx(workflowId: string, activityType: string) {
  return {
    info: {
      workflowExecution: { workflowId },
      activityType,
    },
  };
}

describe("activityLogInterceptor", () => {
  beforeEach(() => {
    mockLogStep.mockReset();
    mockCreateLogModel.mockClear();
  });

  it("calls next and logs completion on success", async () => {
    const ctx = makeCtx("wf-123", "myActivity");
    const interceptors = activityLogInterceptor(ctx as any);
    const mockResult = { outcome: "success" };
    const next = jest.fn().mockResolvedValue(mockResult);
    const input = { args: ["arg1"] } as any;

    const result = await interceptors.inbound!.execute!(input, next);

    expect(next).toHaveBeenCalledWith(input);
    expect(result).toBe(mockResult);
    expect(mockCreateLogModel).toHaveBeenCalledWith({ txid: "wf-123" });
    expect(mockLogStep).toHaveBeenCalledWith(
      "Activity myActivity completed",
      expect.objectContaining({
        activity_name: "myActivity",
        result_code: "200",
        step_request: { args: ["arg1"] },
        step_response: mockResult,
      }),
    );
  });

  it("uses correlatorId from args when present", async () => {
    const ctx = makeCtx("wf-123", "myActivity");
    const interceptors = activityLogInterceptor(ctx as any);
    const next = jest.fn().mockResolvedValue("ok");
    const input = {
      args: [null, ["ignored"], { correlatorId: "  corr-123  " }],
    } as any;

    await interceptors.inbound!.execute!(input, next);

    expect(mockCreateLogModel).toHaveBeenCalledWith({ txid: "corr-123" });
  });

  it("falls back to workflowId when args do not contain a usable correlatorId", async () => {
    const ctx = makeCtx("wf-fallback", "myActivity");
    const interceptors = activityLogInterceptor(ctx as any);
    const next = jest.fn().mockResolvedValue("ok");
    const input = {
      args: [{ correlatorId: "   " }, "ignored", 123],
    } as any;

    await interceptors.inbound!.execute!(input, next);

    expect(mockCreateLogModel).toHaveBeenCalledWith({ txid: "wf-fallback" });
  });

  it("logs failure and rethrows error", async () => {
    const ctx = makeCtx("wf-456", "failingActivity");
    const interceptors = activityLogInterceptor(ctx as any);
    const error = new Error("activity failed");
    const next = jest.fn().mockRejectedValue(error);
    const input = { args: [] } as any;

    await expect(interceptors.inbound!.execute!(input, next)).rejects.toThrow("activity failed");

    expect(mockLogStep).toHaveBeenCalledWith(
      "Activity failingActivity failed",
      expect.objectContaining({
        activity_name: "failingActivity",
        error,
      }),
    );
  });
});
