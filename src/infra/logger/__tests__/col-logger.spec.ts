import path from "node:path";

const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
};

const pinoMock = Object.assign(
  jest.fn(() => mockLogger),
  {
    transport: jest.fn(() => ({})),
    stdTimeFunctions: { isoTime: jest.fn() },
  },
);

jest.mock("pino", () => pinoMock);
jest.mock("node:crypto", () => ({ randomUUID: jest.fn(() => "uuid-123") }));
jest.mock("@/infra/logger/step-name-map", () => ({
  resolveStepName: jest.fn(() => "STEP_RESOLVED"),
}));

import { createLogModel, LogCategory } from "@/infra/logger/col-logger";
const { resolveStepName } = jest.requireMock(
  "@/infra/logger/step-name-map",
) as typeof import("@/infra/logger/step-name-map");

describe("col-logger", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const fixedTime = new Date("2024-01-01T00:00:10.000Z").getTime();
    jest.useFakeTimers().setSystemTime(fixedTime);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test("logIn logs order payload and a step log with kebab-case activity name", () => {
    const startedAt = new Date("2024-01-01T00:00:00.000Z").getTime();
    const model = createLogModel({
      txid: "tx-1",
      service_type: "svc",
      product: "prod",
      started_at: startedAt,
    });

    const circular: Record<string, unknown> = {};
    circular.self = circular;

    model.logIn("Create Order", {
      endpoint: "/orders/create",
      method: "post",
      request: circular,
      response: { ok: true },
      result_code: "200",
      search_key: "search-1",
      ref_id: "ref-1",
      remark: "note",
    });

    expect(mockLogger.info).toHaveBeenCalledTimes(2);

    const [orderPayload, orderMsg] = mockLogger.info.mock.calls[0];
    expect(orderMsg).toBe("Create Order");
    expect(orderPayload).toMatchObject({
      txid: "tx-1",
      step_txid: "tx-1",
      log_cat: LogCategory.ORDER,
      service_type: "prod_svc",
      result_indicator: "INPROGRESS",
      result_code: "200",
      result_desc: "success",
      elapsed_time: 10000,
      step_name: "tx-1",
      endpoint: "/orders/create",
      request: "[Circular or Non-serializable]",
      response: JSON.stringify({ ok: true }),
      search_key: "search-1",
      ref_id: "ref-1",
      remark: "note",
    });

    expect(resolveStepName).toHaveBeenCalledWith("create-order", "/orders/create", "post");

    const [stepPayload] = mockLogger.info.mock.calls[1];
    expect(stepPayload).toMatchObject({
      txid: "tx-1",
      log_cat: LogCategory.STEP,
      result_indicator: "SUCCESS",
      result_code: "200",
      result_desc: "success",
      step_name: "STEP_RESOLVED",
      endpoint: "/orders/create",
      step_request: "[Circular or Non-serializable]",
      step_response: JSON.stringify({ ok: true }),
    });
    expect(stepPayload.step_txid).toBe("tx-1_1704067210000");
  });

  test("logIn uses elapsed_time when started_at is falsy and default txid", () => {
    const model = createLogModel({ txid: "tx-default", started_at: 0 });

    model.logIn("Ping", { elapsed_time: 123 });

    const [orderPayload] = mockLogger.info.mock.calls[0];
    expect(orderPayload).toMatchObject({
      txid: "tx-default",
      elapsed_time: 123,
      result_code: "0",
      result_desc: "success",
    });
  });

  test("logIn generates txid when none provided", () => {
    const model = createLogModel();

    model.logIn("No Txid", { request: "x" });

    const [orderPayload] = mockLogger.info.mock.calls[0];
    expect(orderPayload).toMatchObject({
      txid: "uuid-123",
      request: "x",
    });
  });

  test("logIn uses elapsed_time fallback when started_at is falsy and elapsed_time missing", () => {
    const model = createLogModel({ started_at: 0 });

    model.logIn("No Elapsed", {});

    const [orderPayload] = mockLogger.info.mock.calls[0];
    expect(orderPayload).toMatchObject({
      elapsed_time: 0,
    });
  });

  test("logStep logs error details from axios-style error", () => {
    const model = createLogModel({ txid: "tx-err" });

    const axiosError = {
      isAxiosError: true,
      message: "boom",
      code: "ECONN",
      config: {
        url: "/orders/1",
        baseURL: "https://api.test",
        method: "get",
        headers: { "x-id": "1" },
        params: { q: "x" },
        data: { ok: true },
      },
      response: {
        status: 404,
        statusText: "Not Found",
        data: { error: true },
      },
    };

    model.logStep("Fetch Order", {
      txid: "tx-err",
      activity_name: "fetchOrder",
      error: axiosError,
      step_request: { ignored: true },
      step_response: { ignored: true },
    });

    expect(mockLogger.error).toHaveBeenCalledTimes(1);

    const [stepPayload, stepMsg] = mockLogger.error.mock.calls[0];
    expect(stepMsg).toBe("Fetch Order");
    expect(stepPayload).toMatchObject({
      txid: "tx-err",
      log_cat: LogCategory.STEP,
      result_indicator: "FAILED",
      result_code: "404",
      result_desc: "boom",
      step_name: "STEP_RESOLVED",
      endpoint: "/orders/1",
      step_request: JSON.stringify({
        headers: { "x-id": "1" },
        params: { q: "x" },
        data: { ok: true },
      }),
      step_response: JSON.stringify({
        status: 404,
        statusText: "Not Found",
        data: { error: true },
      }),
    });
    expect(resolveStepName).toHaveBeenCalledWith("fetchOrder", "/orders/1", "GET");
  });

  test("logStep handles axios error with missing config/response", () => {
    const model = createLogModel({ txid: "tx-missing" });

    model.logStep("Missing Config", {
      txid: "tx-missing",
      activity_name: "missingConfig",
      error: { isAxiosError: true, message: "" },
    });

    const [stepPayload] = mockLogger.error.mock.calls[0];
    expect(stepPayload).toMatchObject({
      txid: "tx-missing",
      result_code: "500",
      result_desc: "failed",
      endpoint: "",
      step_request: "",
      step_response: "",
    });
  });

  test("logStep handles axios error with relative url and non-string status fields", () => {
    const model = createLogModel({ txid: "tx-rel" });

    model.logStep("Relative Url", {
      txid: "tx-rel",
      activity_name: "relativeUrl",
      error: {
        isAxiosError: true,
        config: { url: "/relative", method: "get" },
        response: { status: "bad", statusText: 123, data: { ok: false } },
      },
    });

    const [stepPayload] = mockLogger.error.mock.calls[0];
    expect(stepPayload).toMatchObject({
      txid: "tx-rel",
      endpoint: "/relative",
      result_code: "500",
      result_desc: "failed",
    });
  });

  test("logError without error logs step info and error payload", () => {
    const model = createLogModel({ txid: "tx-out" });

    model.logError("Submit Order", {
      txid: "tx-out",
      endpoint: "/orders/create",
      method: "POST",
      request: { id: 1 },
      response: { ok: false },
      result_code: "400",
    });

    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.error).toHaveBeenCalledTimes(2);

    const [stepPayload] = mockLogger.error.mock.calls[0];
    expect(stepPayload).toMatchObject({
      txid: "tx-out",
      log_cat: LogCategory.STEP,
      result_indicator: "FAILED",
      result_code: "400",
      result_desc: "failed",
      step_name: "STEP_RESOLVED",
      endpoint: "/orders/create",
      step_request: JSON.stringify({ id: 1 }),
      step_response: JSON.stringify({ ok: false }),
    });

    const [errorPayload, errorMsg] = mockLogger.error.mock.calls[1];
    expect(errorMsg).toBe("Submit Order");
    expect(errorPayload).toMatchObject({
      txid: "tx-out",
      log_cat: LogCategory.ORDER,
      result_indicator: "FAILED",
      result_code: "400",
      result_desc: "failed",
      endpoint: "/orders/create",
      request: JSON.stringify({ id: 1 }),
      response: JSON.stringify({ ok: false }),
    });
  });

  test("logOut uses default txid when provided", () => {
    const model = createLogModel({ txid: "tx-fixed" });

    model.logOut("Complete", { endpoint: "/orders/complete" });

    const [orderPayload] = mockLogger.info.mock.calls[1];
    expect(orderPayload).toMatchObject({
      txid: "tx-fixed",
      endpoint: "/orders/complete",
    });
  });

  test("logOut uses fallback service_type, preserves string request, and kebab-cases activity", () => {
    const startedAt = new Date("1970-01-01T00:00:00.000Z").getTime();
    const model = createLogModel({
      service_type: "",
      product: "prod-x",
      started_at: startedAt,
    });

    model.logOut(
      "create-order.test",
      {
        endpoint: "/orders/create",
        method: "PUT",
        request: "raw",
        result_code: "",
      },
      LogCategory.STEP,
    );

    expect(resolveStepName).toHaveBeenCalledWith("create-order-test", "/orders/create", "PUT");
    expect(mockLogger.info).toHaveBeenCalledTimes(2);

    const [stepPayload] = mockLogger.info.mock.calls[0];
    expect(stepPayload).toMatchObject({
      result_indicator: "SUCCESS",
      result_code: "0",
      result_desc: "success",
    });

    const [orderPayload] = mockLogger.info.mock.calls[1];
    expect(orderPayload).toMatchObject({
      txid: "uuid-123",
      log_cat: LogCategory.STEP,
      service_type: "prod-x",
      result_indicator: "COMPLETED",
      result_code: "0",
      result_desc: "success",
      request: "raw",
      response: "",
    });
  });

  test("logOut kebab-case handles trailing separators", () => {
    const model = createLogModel({ txid: "tx-trail" });

    model.logOut("Trail-", { endpoint: "/orders/trail" });

    expect(resolveStepName).toHaveBeenCalledWith("trail", "/orders/trail", undefined);
  });

  test("logStep uses randomUUID and respects explicit log level", () => {
    const model = createLogModel();

    model.logStep(
      "Force Info",
      {
        activity_name: "forceInfo",
        endpoint: "/orders/force",
        method: "GET",
        step_request: null,
        step_response: undefined,
        result_code: "201",
      },
      "info",
    );

    expect(mockLogger.info).toHaveBeenCalledTimes(1);
    const [stepPayload] = mockLogger.info.mock.calls[0];
    expect(stepPayload).toMatchObject({
      txid: "uuid-123",
      result_code: "201",
      result_desc: "success",
      endpoint: "/orders/force",
      step_request: "",
      step_response: "",
    });
  });

  test("logStep captures non-axios error details and stack in remark", () => {
    const model = createLogModel({ txid: "tx-non-axios" });

    model.logStep("Handle Error", {
      txid: "tx-non-axios",
      activity_name: "handleError",
      error: { code: "E_TIMEOUT", message: "oops", stack: "stack-trace" },
    });

    const [stepPayload] = mockLogger.error.mock.calls[0];
    expect(stepPayload).toMatchObject({
      txid: "tx-non-axios",
      result_code: "500",
      result_desc: "oops",
      remark: "stack-trace",
    });
  });

  test("logStep handles non-axios error without code", () => {
    const model = createLogModel({ txid: "tx-base" });

    model.logStep("Base Error", {
      txid: "tx-base",
      activity_name: "baseError",
      error: { name: "MyError", message: 123, stack: "stack" },
    });

    const [stepPayload] = mockLogger.error.mock.calls[0];
    expect(stepPayload).toMatchObject({
      txid: "tx-base",
      result_code: "500",
      result_desc: "failed",
      remark: "stack",
    });
  });

  test("logError with non-object error falls back to defaults", () => {
    const model = createLogModel();

    model.logError("Weird Error", { error: "boom", remark: "note" });

    expect(mockLogger.error).toHaveBeenCalledTimes(2);
    const [stepPayload] = mockLogger.error.mock.calls[0];
    expect(stepPayload).toMatchObject({
      txid: "uuid-123",
      result_code: "500",
      result_desc: "failed",
      endpoint: "",
      step_request: "",
      step_response: "",
    });

    const [errorPayload] = mockLogger.error.mock.calls[1];
    expect(errorPayload).toMatchObject({
      txid: "uuid-123",
      result_code: "500",
      request: "",
      response: "",
      remark: "note",
    });
  });

  test("logError uses elapsed_time when started_at is falsy", () => {
    const model = createLogModel({ started_at: 0 });

    model.logError("Elapsed", { elapsed_time: 55 });

    const [errorPayload] = mockLogger.error.mock.calls[1];
    expect(errorPayload).toMatchObject({
      elapsed_time: 55,
    });
  });

  test("logError uses elapsed_time fallback when missing", () => {
    const model = createLogModel({ started_at: 0 });

    model.logError("No Elapsed", {});

    const [errorPayload] = mockLogger.error.mock.calls[0];
    expect(errorPayload).toMatchObject({
      elapsed_time: 0,
    });
  });

  test("logError uses axios error data with full URL and uppercased method", () => {
    const model = createLogModel({ txid: "tx-axios" });

    const axiosError = {
      isAxiosError: true,
      message: "bad",
      config: {
        url: "https://api2.test/orders/9",
        method: "put",
      },
      response: { status: 503, statusText: "Down", data: { fail: true } },
    };

    model.logError("Update Order", { txid: "tx-axios", error: axiosError });

    expect(resolveStepName).toHaveBeenCalledWith(
      "update-order",
      "https://api2.test/orders/9",
      "PUT",
    );
  });

  test("clone returns a new logger model", () => {
    const model = createLogModel({ txid: "tx-clone" });
    const cloned = model.clone();

    cloned.logIn("Clone Ping", { result_code: "204" });

    const [orderPayload] = mockLogger.info.mock.calls[0];
    expect(orderPayload).toMatchObject({
      txid: "tx-clone",
      result_code: "204",
      result_desc: "success",
    });
  });

  test("setupLogger enables file transport when LOG_TO_FILE is true", async () => {
    const originalEnv = process.env;
    process.env = {
      ...originalEnv,
      LOG_TO_FILE: "true",
      LOG_PATH: "./logs-test",
      LOG_CHANNEL: "ch",
      LOG_PRODUCT: "prod",
      SERVICE_TYPE: "svc",
      HOSTNAME: " host ",
    };

    jest.resetModules();
    const mockFs = {
      mkdirSync: jest.fn(),
      accessSync: jest.fn(),
      constants: { W_OK: 2 },
    };
    jest.doMock("node:fs", () => mockFs);

    await jest.isolateModulesAsync(async () => {
      await import("@/infra/logger/col-logger");
    });

    expect(mockFs.mkdirSync).toHaveBeenCalledTimes(1);
    expect(mockFs.accessSync).toHaveBeenCalledTimes(1);
    expect(pinoMock.transport).toHaveBeenCalledTimes(1);

    const transportArg = (
      pinoMock.transport.mock.calls as unknown as Array<
        [{ targets: Array<{ options: { file: string } }> }]
      >
    )[0][0];
    expect(transportArg.targets[0].options.file).toBe(
      path.join(path.resolve("./logs-test"), "app.host"),
    );
    const baseConfig = (pinoMock.mock.calls as unknown as Array<[unknown, unknown?]>)[0][0] as {
      timestamp: () => string;
      formatters: { level: (label: string) => { level: string } };
    };
    expect(baseConfig.timestamp()).toContain('"timestamp"');
    expect(baseConfig.formatters.level("info")).toEqual({ level: "INFO" });
    expect(pinoMock.mock.calls[0]).toHaveLength(2);

    jest.dontMock("node:fs");
    process.env = originalEnv;
  });

  test("setupLogger disables file transport when directory is not writable", async () => {
    const originalEnv = process.env;
    process.env = { ...originalEnv, LOG_TO_FILE: "true", LOG_PATH: "./logs-test" };

    jest.resetModules();
    const mockFs = {
      mkdirSync: jest.fn(() => {
        throw new Error("nope");
      }),
      accessSync: jest.fn(),
      constants: { W_OK: 2 },
    };
    jest.doMock("node:fs", () => mockFs);

    await jest.isolateModulesAsync(async () => {
      await import("@/infra/logger/col-logger");
    });

    expect(pinoMock.transport).not.toHaveBeenCalled();
    expect(pinoMock.mock.calls[0]).toHaveLength(1);

    jest.dontMock("node:fs");
    process.env = originalEnv;
  });

  test("setupLogger uses empty string when HOSTNAME is missing", async () => {
    const originalEnv = process.env;
    const { HOSTNAME: _removed, ...envWithoutHostname } = originalEnv;
    process.env = {
      ...envWithoutHostname,
      LOG_TO_FILE: "true",
      LOG_PATH: "./logs-no-host",
      LOG_LEVEL: "info",
      LOG_CHANNEL: "ch",
      LOG_PRODUCT: "prod",
    };

    jest.resetModules();
    const mockFs = {
      mkdirSync: jest.fn(),
      accessSync: jest.fn(),
      constants: { W_OK: 2 },
    };
    jest.doMock("node:fs", () => mockFs);

    await jest.isolateModulesAsync(async () => {
      await import("@/infra/logger/col-logger");
    });

    const transportCalls = pinoMock.transport.mock.calls as unknown as Array<
      [{ targets: Array<{ options: { file: string } }> }]
    >;
    const transportArg = transportCalls.find((call) =>
      call[0].targets[0].options.file.includes("logs-no-host"),
    )![0];

    expect(transportArg.targets[0].options.file.endsWith("app.")).toBe(true);

    jest.dontMock("node:fs");
    process.env = originalEnv;
  });
});
