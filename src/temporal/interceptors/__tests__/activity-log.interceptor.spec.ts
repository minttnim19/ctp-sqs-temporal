const mockLogStep = jest.fn();
const mockCreateLogModel = jest.fn(() => ({ logStep: mockLogStep }));

jest.mock("@/infra/logger/col-logger", () => ({
  createLogModel: mockCreateLogModel,
}));

import { ApplicationFailure } from "@temporalio/common";

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

  it("logs http-client failure with error only and rethrows error", async () => {
    const ctx = makeCtx("wf-456", "failingActivity");
    const interceptors = activityLogInterceptor(ctx as any);
    const error = new Error("activity failed");
    Object.assign(error, { isAxiosError: true });
    const next = jest.fn().mockRejectedValue(error);
    const input = { args: [] } as any;

    await expect(interceptors.inbound!.execute!(input, next)).rejects.toThrow("activity failed");

    expect(mockLogStep).toHaveBeenCalledWith("Activity failingActivity failed", {
      activity_name: "failingActivity",
      error,
    });
  });

  it("logs request and response details for application failure", async () => {
    const ctx = makeCtx("wf-789", "thirdPartyActivity");
    const interceptors = activityLogInterceptor(ctx as any);
    const error = ApplicationFailure.create({ message: "Bad request to external API" });
    const next = jest.fn().mockRejectedValue(error);
    const input = { args: [{ id: "order-1" }] } as any;

    await expect(interceptors.inbound!.execute!(input, next)).rejects.toBe(error);

    expect(mockLogStep).toHaveBeenCalledWith("Activity thirdPartyActivity failed", {
      activity_name: "thirdPartyActivity",
      error,
      step_request: { args: [{ id: "order-1" }] },
      step_response: {
        name: "ApplicationFailure",
        message: "Bad request to external API",
        type: undefined,
        nonRetryable: false,
        details: undefined,
      },
    });
  });

  it("logs generic failure with original error as step response", async () => {
    const ctx = makeCtx("wf-999", "plainFailureActivity");
    const interceptors = activityLogInterceptor(ctx as any);
    const error = new Error("plain activity error");
    const next = jest.fn().mockRejectedValue(error);
    const input = { args: [{ correlatorId: "corr-999" }] } as any;

    await expect(interceptors.inbound!.execute!(input, next)).rejects.toBe(error);

    expect(mockLogStep).toHaveBeenCalledWith("Activity plainFailureActivity failed", {
      activity_name: "plainFailureActivity",
      error,
      step_request: { args: [{ correlatorId: "corr-999" }] },
      step_response: error,
    });
  });

  it("logs non-retryable application failure details", async () => {
    const ctx = makeCtx("wf-888", "nonRetryableActivity");
    const interceptors = activityLogInterceptor(ctx as any);
    const error = ApplicationFailure.nonRetryable("Do not retry", "BusinessError", {
      reason: "invalid",
    });
    const next = jest.fn().mockRejectedValue(error);
    const input = { args: [] } as any;

    await expect(interceptors.inbound!.execute!(input, next)).rejects.toBe(error);

    expect(mockLogStep).toHaveBeenCalledWith(
      "Activity nonRetryableActivity failed",
      expect.objectContaining({
        activity_name: "nonRetryableActivity",
        error,
        step_response: {
          name: "ApplicationFailure",
          message: "Do not retry",
          type: "BusinessError",
          nonRetryable: true,
          details: [{ reason: "invalid" }],
        },
      }),
    );
  });
});
