// Mock logger to keep output clean
const mockLogStep = jest.fn();
const mockCreateLogModel = jest.fn(() => ({ logStep: mockLogStep }));

jest.mock("@/infra/logger/col-logger", () => ({
  createLogModel: mockCreateLogModel,
  logger: {
    warn: jest.fn(),
  },
}));

import axios from "axios";

import {
  createHttpClient,
  httpClient,
  httpGet,
  httpPost,
  httpPut,
  httpDelete,
  type HttpRequestConfig,
} from "@/infra/http/http-client";
import { createLogModel, logger } from "@/infra/logger/col-logger";

const rejectAsError = (reason: Error): Promise<never> => Promise.reject(reason);

describe("infra/http/http-client - interceptors", () => {
  beforeEach(() => {
    mockLogStep.mockClear();
    mockCreateLogModel.mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("throws when relative URL is used without baseURL", async () => {
    const client = createHttpClient();
    await expect(client.get("/relative")).rejects.toThrow(
      'HTTP client called with relative URL "/relative" but no baseURL is set',
    );
  });

  it("allows absolute URL without baseURL and attaches metadata", async () => {
    const client = createHttpClient();
    const res = await client.get("https://example.com/ok", {
      adapter: async (config) => ({
        data: { hasMeta: Boolean((config as any).metadata) },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      }),
    });

    expect(res.data).toEqual({ hasMeta: true });
  });
});

describe("infra/http/http-client - wrappers", () => {
  beforeEach(() => {
    jest.spyOn(axios, "create"); // ensure module initialized
  });

  it("httpGet returns data", async () => {
    const spy = jest.spyOn(httpClient, "get").mockResolvedValue({ data: { ok: true } } as any);
    await expect(httpGet<any>("https://example.com")).resolves.toEqual({ ok: true });
    spy.mockRestore();
  });

  it("httpPost returns data", async () => {
    const spy = jest.spyOn(httpClient, "post").mockResolvedValue({ data: 1 } as any);
    await expect(httpPost<number>("https://example.com", { a: 1 })).resolves.toBe(1);
    spy.mockRestore();
  });

  it("httpPut returns data", async () => {
    const spy = jest.spyOn(httpClient, "put").mockResolvedValue({ data: "x" } as any);
    await expect(httpPut<string>("https://example.com", { a: 1 })).resolves.toBe("x");
    spy.mockRestore();
  });

  it("httpDelete returns data", async () => {
    const spy = jest.spyOn(httpClient, "delete").mockResolvedValue({ data: [1, 2] } as any);
    await expect(httpDelete<number[]>("https://example.com")).resolves.toEqual([1, 2]);
    spy.mockRestore();
  });

  it("createHttpClient passes options to axios.create", () => {
    const createSpy = jest.spyOn(axios, "create");
    createHttpClient({
      baseURL: "https://example.com",
      timeoutMs: 1234,
      headers: { "X-Test": "1" },
      rejectUnauthorized: false,
    });

    expect(createSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: "https://example.com",
        timeout: 1234,
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-Test": "1",
        }),
      }),
    );
    const createArg = createSpy.mock.calls[createSpy.mock.calls.length - 1]?.[0] as any;
    expect(createArg.httpsAgent.options.rejectUnauthorized).toBe(false);
  });
});

describe("infra/http/http-client - logging interceptors", () => {
  beforeEach(() => {
    mockLogStep.mockClear();
    mockCreateLogModel.mockClear();
  });

  it("logs successful response when txid metadata is provided", async () => {
    const client = createHttpClient({ baseURL: "https://example.com" });
    const config: HttpRequestConfig = {
      metadata: { txid: "tx-http" },
      adapter: async (requestConfig) => ({
        data: { ok: true },
        status: 201,
        statusText: "Created",
        headers: {},
        config: requestConfig,
      }),
    };

    await expect(client.post("/ok", { request: true }, config)).resolves.toMatchObject({
      data: { ok: true },
    });

    expect(createLogModel).toHaveBeenCalledWith({ txid: "tx-http" });
    expect(mockLogStep).toHaveBeenCalledWith("HTTP client request completed", {
      activity_name: "http-client-request",
      endpoint: "https://example.com/ok",
      method: "POST",
      step_request: { request: true },
      step_response: { ok: true },
      result_code: "201",
    });
  });

  it("creates log model with undefined txid when txid metadata is missing", async () => {
    const client = createHttpClient({ baseURL: "https://example.com" });

    await client.get("/ok", {
      adapter: async (config) => ({
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      }),
    });

    expect(createLogModel).toHaveBeenCalledWith({ txid: undefined });
    expect(mockLogStep).toHaveBeenCalledWith("HTTP client request completed", {
      activity_name: "http-client-request",
      endpoint: "https://example.com/ok",
      method: "GET",
      step_request: undefined,
      step_response: { ok: true },
      result_code: "200",
    });
  });

  it("uses baseURL as endpoint when request url is missing", async () => {
    const client = createHttpClient({ baseURL: "https://example.com" });

    await client.request({
      adapter: async (config) => ({
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      }),
    });

    expect(mockLogStep).toHaveBeenCalledWith("HTTP client request completed", {
      activity_name: "http-client-request",
      endpoint: "https://example.com",
      method: "GET",
      step_request: undefined,
      step_response: { ok: true },
      result_code: "200",
    });
  });

  it("uses empty endpoint when request config has no url", async () => {
    const client = createHttpClient();

    await client.request({
      method: undefined,
      adapter: async (config) => ({
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      }),
    });

    expect(mockLogStep).toHaveBeenCalledWith("HTTP client request completed", {
      activity_name: "http-client-request",
      endpoint: "",
      method: "GET",
      step_request: undefined,
      step_response: { ok: true },
      result_code: "200",
    });
  });

  it("logs axios error with request metadata when txid is provided", async () => {
    const client = createHttpClient({ baseURL: "https://example.com" });
    const axiosLikeError: any = new Error("boom");
    axiosLikeError.isAxiosError = true;
    axiosLikeError.response = { status: 503, data: { message: "downstream failed" } };
    const config: HttpRequestConfig = {
      metadata: { txid: "tx-http-error" },
      adapter: async (requestConfig) => {
        axiosLikeError.config = requestConfig;
        throw axiosLikeError;
      },
    };

    await expect(client.get("/err", config)).rejects.toThrow("boom");

    expect(createLogModel).toHaveBeenCalledWith({ txid: "tx-http-error" });
    expect(mockLogStep).toHaveBeenCalledWith("HTTP client request error", {
      activity_name: "http-client-request",
      error: axiosLikeError,
    });
  });

  it("logs warn on non-axios error", async () => {
    (logger.warn as jest.Mock).mockClear();
    const client = createHttpClient({ baseURL: "https://example.com" });
    const nonAxiosError = new Error("plain error");

    await expect(
      client.get("/err", {
        adapter: async () => {
          throw nonAxiosError;
        },
      }),
    ).rejects.toThrow("plain error");

    const warnCall = (logger.warn as jest.Mock).mock.calls.find(
      (c) => c[1] === "Unknown HTTP error",
    );
    expect(warnCall?.[0]).toMatchObject({ error: nonAxiosError });
  });

  it("converts non-Error with message to Error", async () => {
    (logger.warn as jest.Mock).mockClear();
    const client = createHttpClient({ baseURL: "https://example.com" });
    const nonErrorWithMessage = { message: "object message" };

    await expect(
      client.get("/err", {
        adapter: async () => {
          throw nonErrorWithMessage;
        },
      }),
    ).rejects.toThrow("object message");

    const warnCall = (logger.warn as jest.Mock).mock.calls.find(
      (c) => c[1] === "Unknown HTTP error",
    );
    expect(warnCall?.[0]).toMatchObject({ error: nonErrorWithMessage });
  });

  it("converts primitive error to Error", async () => {
    (logger.warn as jest.Mock).mockClear();
    const client = createHttpClient({ baseURL: "https://example.com" });
    const primitiveError = "primitive error" as unknown as Error;

    await expect(
      client.get("/err", {
        adapter: () => rejectAsError(primitiveError),
      }),
    ).rejects.toThrow("primitive error");

    const warnCall = (logger.warn as jest.Mock).mock.calls.find(
      (c) => c[1] === "Unknown HTTP error",
    );
    expect(warnCall?.[0]).toMatchObject({ error: "primitive error" });
  });

  it("defaults metadata method to GET when axios config has no method", async () => {
    await jest.isolateModulesAsync(async () => {
      let requestInterceptor: ((config: any) => any) | undefined;
      const createMock = jest.fn(() => ({
        interceptors: {
          request: {
            use: jest.fn((handler) => {
              requestInterceptor = handler;
            }),
          },
          response: { use: jest.fn() },
        },
      }));

      jest.doMock("axios", () => ({
        __esModule: true,
        default: { create: createMock },
        isAxiosError: jest.fn(),
      }));

      const { createHttpClient: createIsolatedHttpClient } =
        await import("@/infra/http/http-client");
      createIsolatedHttpClient();

      const config = requestInterceptor?.({
        baseURL: "https://example.com",
        url: "/default-method",
      });

      expect(config.metadata).toMatchObject({
        method: "GET",
        endpoint: "https://example.com/default-method",
      });
    });
  });
});
