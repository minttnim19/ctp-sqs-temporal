// Mock logger to keep output clean
jest.mock("@/infra/logger/col-logger", () => ({
  logger: {
    warn: jest.fn(),
    error: jest.fn(),
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
} from "@/infra/http/http-client";
import { logger } from "@/infra/logger/col-logger";

const rejectAsError = (reason: Error): Promise<never> => Promise.reject(reason);

describe("infra/http/http-client - interceptors", () => {
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
        data: { hasMeta: Boolean((config as any).metadata?.start) },
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
  });
});

describe("infra/http/http-client - logging interceptors", () => {
  it("logs error on axios error", async () => {
    const client = createHttpClient({ baseURL: "https://example.com" });
    const axiosLikeError: any = new Error("boom");
    axiosLikeError.isAxiosError = true;
    axiosLikeError.config = { url: "/err" };
    axiosLikeError.response = { status: 503 };

    await expect(
      client.get("/err", {
        adapter: async () => {
          throw axiosLikeError;
        },
      }),
    ).rejects.toThrow("boom");

    const errorCall = (logger.error as jest.Mock).mock.calls.find(
      (c) => c[1] === "HTTP request failed",
    );
    expect(errorCall?.[0]).toMatchObject({
      message: "boom",
      url: "/err",
      status: 503,
    });
  });

  it("logs error with undefined ms when metadata start missing", async () => {
    (logger.error as jest.Mock).mockClear();
    const client = createHttpClient({ baseURL: "https://example.com" });
    const axiosLikeError: any = new Error("oops");
    axiosLikeError.isAxiosError = true;
    axiosLikeError.config = { url: "/err", metadata: {} };
    axiosLikeError.response = { status: 500 };

    await expect(
      client.get("/err", {
        adapter: async () => {
          throw axiosLikeError;
        },
      }),
    ).rejects.toThrow("oops");

    const errorCall = (logger.error as jest.Mock).mock.calls.find(
      (c) => c[1] === "HTTP request failed",
    );
    expect(errorCall?.[0]).toMatchObject({ url: "/err", status: 500, ms: undefined });
  });

  it("logs error with minimal data when axios error config is undefined", async () => {
    (logger.error as jest.Mock).mockClear();
    const client = createHttpClient({ baseURL: "https://example.com" });
    const axiosLikeError: any = new Error("cfg missing");
    axiosLikeError.isAxiosError = true;
    delete axiosLikeError.config;
    await expect(
      client.get("/err", {
        adapter: async () => {
          throw axiosLikeError;
        },
      }),
    ).rejects.toThrow("cfg missing");
    const errorCall = (logger.error as jest.Mock).mock.calls.find(
      (c) => c[1] === "HTTP request failed",
    );
    expect(errorCall?.[0]).toMatchObject({
      message: "cfg missing",
      url: undefined,
      status: undefined,
    });
  });

  it("logs error with computed ms when metadata start exists", async () => {
    (logger.error as jest.Mock).mockClear();
    const client = createHttpClient({ baseURL: "https://example.com" });
    const axiosLikeError: any = new Error("timed");
    axiosLikeError.isAxiosError = true;
    axiosLikeError.config = { url: "/err", metadata: { start: Date.now() - 5 } };
    axiosLikeError.response = { status: 404 };

    await expect(
      client.get("/err", {
        adapter: async () => {
          throw axiosLikeError;
        },
      }),
    ).rejects.toThrow("timed");

    const errorCall = (logger.error as jest.Mock).mock.calls.find(
      (c) => c[1] === "HTTP request failed",
    );
    expect(errorCall?.[0]).toMatchObject({ url: "/err", status: 404 });
    expect(typeof errorCall?.[0]?.ms).toBe("number");
    expect(errorCall?.[0]?.ms).toBeGreaterThanOrEqual(0);
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
});
