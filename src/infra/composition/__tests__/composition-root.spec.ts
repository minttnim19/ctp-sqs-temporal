describe("composition-root", () => {
  it("registers queue handlers with configured workflow options", async () => {
    const registerQueueHandler = jest.fn((handler, mapPayload) => ({ handler, mapPayload }));
    const workflowStarterInstance = { starter: true };
    const loggerFactoryInstance = { loggerFactory: true };
    const temporalWorkflowStarter = jest.fn(() => workflowStarterInstance);
    const colAppLoggerFactory = jest.fn(() => loggerFactoryInstance);
    const dummyWorkflowDispatcher = jest.fn();
    const scheduledWorkflowDispatcher = jest.fn();

    await jest.isolateModulesAsync(async () => {
      jest.doMock("@/config/env", () => ({
        env: {
          TEMPORAL_TASK_QUEUE_DUMMY_1: "dummy-task-queue",
          TEMPORAL_TASK_QUEUE_SCHEDULED: "scheduled-task-queue",
          TEMPORAL_RETRY_ATTEMPTS: 5,
          TEMPORAL_RETRY_DELAY: 2500,
        },
      }));
      jest.doMock("@/infra/aws/queue-routing", () => ({ registerQueueHandler }));
      jest.doMock("@/infra/temporal/temporal-workflow-starter", () => ({
        TemporalWorkflowStarter: temporalWorkflowStarter,
      }));
      jest.doMock("@/infra/logger/app-logger-adapter", () => ({
        ColAppLoggerFactory: colAppLoggerFactory,
      }));
      jest.doMock("@/application/usecases/dummy-workflow-dispatcher", () => ({
        DummyWorkflowDispatcher: dummyWorkflowDispatcher,
      }));
      jest.doMock("@/application/usecases/scheduled-workflow-dispatcher", () => ({
        ScheduledWorkflowDispatcher: scheduledWorkflowDispatcher,
      }));

      const { createComposition } = await import("@/infra/composition/composition-root");
      const composition = createComposition();

      expect(temporalWorkflowStarter).toHaveBeenCalledTimes(1);
      expect(colAppLoggerFactory).toHaveBeenCalledTimes(1);
      expect(dummyWorkflowDispatcher).toHaveBeenCalledWith(
        workflowStarterInstance,
        loggerFactoryInstance,
        {
          workflowName: "DummyWorkflow",
          taskQueue: "dummy-task-queue",
          retryAttempts: 5,
          retryDelayMs: 2500,
        },
      );
      expect(scheduledWorkflowDispatcher).toHaveBeenCalledWith(
        workflowStarterInstance,
        loggerFactoryInstance,
        {
          workflowName: "ScheduledJobWorkflow",
          taskQueue: "scheduled-task-queue",
          retryAttempts: 5,
          retryDelayMs: 2500,
        },
      );
      expect(registerQueueHandler).toHaveBeenCalledTimes(2);
      expect(Object.keys(composition.queueHandlers)).toEqual(["dummy", "scheduled-dummy"]);
    });
  });
});
