jest.mock("@/infra/logger/col-logger", () => ({
  logger: { warn: jest.fn() },
}));

describe("infra/temporal/temporal-health", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
  });

  it("returns ok when health service is serving", async () => {
    await jest.isolateModulesAsync(async () => {
      const checkMock = jest.fn(async () => ({ status: 1 }));
      jest.doMock("@/infra/temporal/temporal-client", () => ({
        getTemporalConnection: jest.fn(async () => ({
          healthService: { check: checkMock },
        })),
      }));

      const { checkTemporalHealth } = await import("@/infra/temporal/temporal-health");
      const result = await checkTemporalHealth();
      expect(checkMock).toHaveBeenCalledWith({
        service: "temporal.api.workflowservice.v1.WorkflowService",
      });
      expect(result).toEqual({ ok: true, status: "serving" });
    });
  });

  it("returns error when health service is not serving", async () => {
    await jest.isolateModulesAsync(async () => {
      const checkMock = jest.fn(async () => ({ status: 2 }));
      jest.doMock("@/infra/temporal/temporal-client", () => ({
        getTemporalConnection: jest.fn(async () => ({
          healthService: { check: checkMock },
        })),
      }));

      const { checkTemporalHealth } = await import("@/infra/temporal/temporal-health");
      const result = await checkTemporalHealth();
      expect(result).toEqual({ ok: false, status: "status_2" });
    });
  });

  it("returns error when health check throws", async () => {
    const { logger } = jest.requireMock("@/infra/logger/col-logger");

    await jest.isolateModulesAsync(async () => {
      const checkMock = jest.fn(async () => {
        throw new Error("boom");
      });
      jest.doMock("@/infra/temporal/temporal-client", () => ({
        getTemporalConnection: jest.fn(async () => ({
          healthService: { check: checkMock },
        })),
      }));

      const { checkTemporalHealth } = await import("@/infra/temporal/temporal-health");
      const result = await checkTemporalHealth();
      expect(result).toEqual({ ok: false, error: "health_check_failed" });
      expect(logger.warn).toHaveBeenCalled();
    });
  });
});
