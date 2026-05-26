import type { IncomingMessage, Server, ServerResponse } from "node:http";
import { EventEmitter } from "node:events";

jest.mock("@/infra/logger/col-logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { createHealthHandler } from "@/infra/healthcheck/health-server";
import { logger } from "@/infra/logger/col-logger";

const mockLogger = logger as jest.Mocked<typeof logger>;

type InvokeOptions = {
  method?: string;
  url?: string;
  body?: unknown;
  bodyChunks?: Array<string | Buffer>;
};

type InvocationResult = {
  status: number;
  body: unknown;
  headers: Record<string, string>;
};

function makePoller(isRunning: boolean) {
  return { isRunning: () => isRunning } as any;
}

async function invokeHandler(
  handler: ReturnType<typeof createHealthHandler>,
  options: InvokeOptions = {},
): Promise<InvocationResult> {
  let status = 200;
  let headers: Record<string, string> = {};
  let bodyText = "";

  const chunks =
    options.bodyChunks ??
    (options.body !== undefined ? [Buffer.from(JSON.stringify(options.body))] : []);

  const req = {
    method: options.method,
    url: options.url,
    async *[Symbol.asyncIterator]() {
      for (const chunk of chunks) {
        yield chunk;
      }
    },
  } as unknown as IncomingMessage;

  const res = {
    writeHead(code: number, nextHeaders?: Record<string, string>) {
      status = code;
      headers = nextHeaders ?? {};
    },
    end(payload?: string) {
      bodyText = payload ?? "";
    },
  } as unknown as ServerResponse<IncomingMessage>;

  await handler(req, res);

  let body: unknown = null;
  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = bodyText;
    }
  }

  return { status, body, headers };
}

describe("createHealthHandler", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("health endpoints", () => {
    it("returns 200 with status=ok when all pollers running", async () => {
      const handler = createHealthHandler({ pollers: [makePoller(true), makePoller(true)] });
      const res = await invokeHandler(handler, { method: "GET", url: "/health" });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "ok" });
    });

    it("returns 503 with status=error when a poller is not running", async () => {
      const handler = createHealthHandler({ pollers: [makePoller(true), makePoller(false)] });
      const res = await invokeHandler(handler, { method: "GET", url: "/health" });
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ status: "error" });
    });

    it("returns 503 when pollers array is empty", async () => {
      const handler = createHealthHandler({ pollers: [] });
      const res = await invokeHandler(handler, { method: "GET", url: "/health" });
      expect(res.status).toBe(503);
    });

    it("GET / behaves the same as /health", async () => {
      const handler = createHealthHandler({ pollers: [makePoller(true)] });
      const res = await invokeHandler(handler, { method: "GET", url: "/" });
      expect(res.status).toBe(200);
    });

    it("GET /healthz behaves the same as /health", async () => {
      const handler = createHealthHandler({ pollers: [makePoller(true)] });
      const res = await invokeHandler(handler, { method: "GET", url: "/healthz" });
      expect(res.status).toBe(200);
    });

    it("HEAD /health returns empty body when healthy", async () => {
      const handler = createHealthHandler({ pollers: [makePoller(true)] });
      const res = await invokeHandler(handler, { method: "HEAD", url: "/health" });
      expect(res.status).toBe(200);
      expect(res.body).toBeNull();
    });

    it("HEAD /health returns 503 when not healthy", async () => {
      const handler = createHealthHandler({ pollers: [makePoller(false)] });
      const res = await invokeHandler(handler, { method: "HEAD", url: "/health" });
      expect(res.status).toBe(503);
    });

    it("POST /health returns 405 with Allow header", async () => {
      const handler = createHealthHandler({ pollers: [makePoller(true)] });
      const res = await invokeHandler(handler, { method: "POST", url: "/health" });
      expect(res.status).toBe(405);
      expect(res.headers).toMatchObject({ Allow: "GET, HEAD" });
    });

    it("returns 404 for unknown paths", async () => {
      const handler = createHealthHandler({ pollers: [makePoller(true)] });
      const res = await invokeHandler(handler, { method: "GET", url: "/unknown" });
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ status: "not_found" });
    });

    it("temporalHealth ok=true keeps 200", async () => {
      const handler = createHealthHandler({
        pollers: [makePoller(true)],
        temporalHealth: async () => ({ ok: true }),
      });
      const res = await invokeHandler(handler, { method: "GET", url: "/health" });
      expect(res.status).toBe(200);
    });

    it("temporalHealth ok=false downgrades to 503", async () => {
      const handler = createHealthHandler({
        pollers: [makePoller(true)],
        temporalHealth: async () => ({ ok: false }),
      });
      const res = await invokeHandler(handler, { method: "GET", url: "/health" });
      expect(res.status).toBe(503);
    });

    it("defaults missing method and url to GET /", async () => {
      const handler = createHealthHandler({ pollers: [] });
      const res = await invokeHandler(handler);
      expect(res.status).toBe(503);
      expect(res.body).toMatchObject({ status: "error" });
    });
  });

  describe("/api/manual endpoint", () => {
    it("returns 403 when manualApi is not provided", async () => {
      const handler = createHealthHandler({ pollers: [] });
      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        body: { queueName: "q", message: {} },
      });
      expect(res.status).toBe(403);
      expect(res.body).toMatchObject({ error: "manual_api_disabled" });
    });

    it("returns 403 when manualApi.enabled is false", async () => {
      const handler = createHealthHandler({
        pollers: [],
        manualApi: { enabled: false, resolveHandler: () => undefined },
      });
      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        body: { queueName: "q", message: {} },
      });
      expect(res.status).toBe(403);
    });

    it("returns 405 for GET /api/manual when enabled", async () => {
      const handler = createHealthHandler({
        pollers: [],
        manualApi: { enabled: true, resolveHandler: () => undefined },
      });
      const res = await invokeHandler(handler, { method: "GET", url: "/api/manual" });
      expect(res.status).toBe(405);
      expect(res.body).toMatchObject({ error: "method_not_allowed" });
      expect(res.headers).toMatchObject({ Allow: "POST" });
    });

    it("returns 400 when body is empty", async () => {
      const handler = createHealthHandler({
        pollers: [],
        manualApi: { enabled: true, resolveHandler: () => undefined },
      });
      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        bodyChunks: [],
      });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "body_required" });
    });

    it("returns 400 for invalid JSON body", async () => {
      const handler = createHealthHandler({
        pollers: [],
        manualApi: { enabled: true, resolveHandler: () => undefined },
      });
      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        bodyChunks: ["not-json"],
      });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "invalid_json" });
    });

    it("returns 400 when queueName is missing", async () => {
      const handler = createHealthHandler({
        pollers: [],
        manualApi: { enabled: true, resolveHandler: () => undefined },
      });
      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        body: { message: { foo: "bar" } },
      });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "queueName (string) is required" });
    });

    it("returns 400 when queueName is not a string", async () => {
      const handler = createHealthHandler({
        pollers: [],
        manualApi: { enabled: true, resolveHandler: () => undefined },
      });
      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        body: { queueName: 123, message: {} },
      });
      expect(res.status).toBe(400);
    });

    it("returns 400 when message is missing", async () => {
      const handler = createHealthHandler({
        pollers: [],
        manualApi: { enabled: true, resolveHandler: () => undefined },
      });
      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        body: { queueName: "my-queue" },
      });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "message is required" });
    });

    it("returns 400 when attributes is not a plain object", async () => {
      const handler = createHealthHandler({
        pollers: [],
        manualApi: { enabled: true, resolveHandler: () => undefined },
      });
      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        body: { queueName: "my-queue", message: {}, attributes: ["not", "an", "object"] },
      });
      expect(res.status).toBe(400);
      expect(res.body).toMatchObject({ error: "attributes must be an object" });
    });

    it("returns 404 when no handler found for queueName", async () => {
      const handler = createHealthHandler({
        pollers: [],
        manualApi: { enabled: true, resolveHandler: () => undefined },
      });
      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        body: { queueName: "unknown-queue", message: {} },
      });
      expect(res.status).toBe(404);
      expect(res.body).toMatchObject({ error: "handler_not_found" });
    });

    it("returns 200 and calls handler when valid request with matching handler", async () => {
      const mockHandle = jest.fn().mockResolvedValue(undefined);
      const handler = createHealthHandler({
        pollers: [],
        manualApi: {
          enabled: true,
          resolveHandler: () => ({ handle: mockHandle }),
        },
      });

      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        body: { queueName: "my-queue", message: { foo: "bar" } },
      });

      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ status: "ok" });
      expect(mockHandle).toHaveBeenCalledWith(
        { foo: "bar" },
        expect.objectContaining({
          messageId: expect.stringMatching(/^manual-\d+$/),
          receiptHandle: "",
        }),
      );
    });

    it("returns 200 with attributes normalized to string values", async () => {
      const mockHandle = jest.fn().mockResolvedValue(undefined);
      const handler = createHealthHandler({
        pollers: [],
        manualApi: {
          enabled: true,
          resolveHandler: () => ({ handle: mockHandle }),
        },
      });

      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        body: { queueName: "q", message: {}, attributes: { key1: "val1", key2: 42 } },
      });

      expect(res.status).toBe(200);
      expect(mockHandle).toHaveBeenCalledWith(
        {},
        expect.objectContaining({ attributes: { key1: "val1", key2: "42" } }),
      );
    });

    it("returns 500 when handler.handle throws", async () => {
      const mockHandle = jest.fn().mockRejectedValue(new Error("handler error"));
      const handler = createHealthHandler({
        pollers: [],
        manualApi: {
          enabled: true,
          resolveHandler: () => ({ handle: mockHandle }),
        },
      });

      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        body: { queueName: "q", message: {} },
      });

      expect(res.status).toBe(500);
      expect(res.body).toMatchObject({ error: "handle_failed" });
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err: expect.any(Error), queueName: "q" }),
        "Manual API handle failed",
      );
    });

    it("returns 413 when body exceeds 1MB", async () => {
      const handler = createHealthHandler({
        pollers: [],
        manualApi: { enabled: true, resolveHandler: () => undefined },
      });
      const largeBody = Buffer.alloc(1_100_000, "x");
      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        bodyChunks: [largeBody],
      });
      expect(res.status).toBe(413);
    });

    it("accepts non-Buffer request chunks for manual API bodies", async () => {
      const mockHandle = jest.fn().mockResolvedValue(undefined);
      const handler = createHealthHandler({
        pollers: [],
        manualApi: {
          enabled: true,
          resolveHandler: () => ({ handle: mockHandle }),
        },
      });

      const res = await invokeHandler(handler, {
        method: "POST",
        url: "/api/manual",
        bodyChunks: [JSON.stringify({ queueName: "q", message: { ok: true } })],
      });

      expect(res.status).toBe(200);
      expect(mockHandle).toHaveBeenCalledWith(
        { ok: true },
        expect.objectContaining({ receiptHandle: "" }),
      );
    });
  });
});

describe("startHealthServer", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it("logs health check server listening on start", async () => {
    await jest.isolateModulesAsync(async () => {
      const createServerMock = jest.fn(() => {
        const server = new EventEmitter() as Server;
        Object.assign(server, {
          listen: jest.fn((_: number, cb?: () => void) => cb?.()),
          on: jest.fn(),
        });
        return server;
      });

      jest.doMock("node:http", () => {
        const actual = jest.requireActual("node:http");
        return { ...actual, createServer: createServerMock };
      });

      const { startHealthServer: start } = await import("@/infra/healthcheck/health-server");
      start({ pollers: [], port: 1234 });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ port: 1234 }),
        "Health check server listening",
      );
    });
  });

  it("logs error when server emits error event", async () => {
    await jest.isolateModulesAsync(async () => {
      let errorHandler: ((err: Error) => void) | undefined;
      const createServerMock = jest.fn(() => {
        const server = new EventEmitter() as Server;
        Object.assign(server, {
          listen: jest.fn(),
          on: jest.fn((event: string, cb: (err: Error) => void) => {
            if (event === "error") errorHandler = cb;
            return server;
          }),
        });
        return server;
      });

      jest.doMock("node:http", () => {
        const actual = jest.requireActual("node:http");
        return { ...actual, createServer: createServerMock };
      });

      const { startHealthServer: start } = await import("@/infra/healthcheck/health-server");
      start({ pollers: [], port: 0 });

      const err = new Error("test error");
      errorHandler?.(err);

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({ err }),
        "Health check server error",
      );
    });
  });
});
