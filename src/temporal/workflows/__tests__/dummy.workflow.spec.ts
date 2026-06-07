describe("DummyWorkflow", () => {
  it("runs dummy activity with workflow retry options", async () => {
    const dummyActivity = jest.fn().mockResolvedValue({
      success: true,
      data: { message: "ok" },
    });
    const proxyActivities = jest.fn(() => ({ dummyActivity }));

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@temporalio/workflow", () => ({ proxyActivities }));

      const { DummyWorkflow } = await import("@/temporal/workflows/dummy.workflow");
      const result = await DummyWorkflow(
        {
          id: "message-1",
          type: "OrderCreated",
          resource: { id: "order-1", typeId: "order" },
          version: 1,
          createdAt: "2026-06-07T10:00:00.000Z",
          lastModifiedAt: "2026-06-07T10:00:00.000Z",
          sequenceNumber: 1,
        } as any,
        { retryAttempts: 5, retryDelayMs: 2500 },
      );

      expect(result).toEqual({ success: true, data: { message: "ok" } });
      expect(proxyActivities).toHaveBeenCalledWith({
        startToCloseTimeout: "10 minutes",
        retry: {
          maximumAttempts: 5,
          initialInterval: "2500ms",
        },
      });
      expect(dummyActivity).toHaveBeenCalledTimes(1);
    });
  });

  it("uses default retry options", async () => {
    const dummyActivity = jest.fn().mockResolvedValue({
      success: true,
      data: { message: "ok" },
    });
    const proxyActivities = jest.fn(() => ({ dummyActivity }));

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@temporalio/workflow", () => ({ proxyActivities }));

      const { DummyWorkflow } = await import("@/temporal/workflows/dummy.workflow");
      await DummyWorkflow({} as any);

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
