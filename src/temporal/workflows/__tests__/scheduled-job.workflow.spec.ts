describe("ScheduledJobWorkflow", () => {
  it("runs scheduled activity with workflow retry options", async () => {
    const scheduledActivity = jest.fn().mockResolvedValue({
      success: true,
      data: { message: "ok" },
    });
    const proxyActivities = jest.fn(() => ({ scheduledActivity }));

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@temporalio/workflow", () => ({ proxyActivities }));

      const { ScheduledJobWorkflow } = await import("@/temporal/workflows/scheduled-job.workflow");
      const result = await ScheduledJobWorkflow({}, { retryAttempts: 4, retryDelayMs: 3000 });

      expect(result).toEqual({ success: true, data: { message: "ok" } });
      expect(proxyActivities).toHaveBeenCalledWith({
        startToCloseTimeout: "10 minutes",
        retry: {
          maximumAttempts: 4,
          initialInterval: "3000ms",
        },
      });
      expect(scheduledActivity).toHaveBeenCalledTimes(1);
    });
  });

  it("uses default retry options", async () => {
    const scheduledActivity = jest.fn().mockResolvedValue({
      success: true,
      data: { message: "ok" },
    });
    const proxyActivities = jest.fn(() => ({ scheduledActivity }));

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@temporalio/workflow", () => ({ proxyActivities }));

      const { ScheduledJobWorkflow } = await import("@/temporal/workflows/scheduled-job.workflow");
      await ScheduledJobWorkflow({});

      expect(proxyActivities).toHaveBeenCalledWith({
        startToCloseTimeout: "10 minutes",
        retry: {
          maximumAttempts: 3,
          initialInterval: "5000ms",
        },
      });
    });
  });
});
