import { createServer, IncomingMessage, Server, ServerResponse } from "node:http";

import { logger } from "@/infra/logger/col-logger";
import type { SqsPoller } from "@/infra/aws/sqs-poller";
import type { MessageHandler } from "@/application/ports/message-handler";

type HealthServerOptions = {
  pollers: SqsPoller[];
  port: number;
  manualApi?: {
    enabled: boolean;
    resolveHandler: (queueName: string) => MessageHandler<unknown> | undefined;
  };
  temporalHealth?: () => Promise<TemporalHealthResult>;
};

type TemporalHealthResult = {
  ok: boolean;
  status?: string;
  error?: string;
};

const HEALTH_PATHS = new Set(["/", "/health", "/healthz"]);
const MANUAL_API_PATH = "/api/manual";
const MAX_BODY_BYTES = 1_000_000;

export function createHealthHandler({
  pollers,
  manualApi,
  temporalHealth,
}: Omit<HealthServerOptions, "port">) {
  return async (req: IncomingMessage, res: ServerResponse<IncomingMessage>) => {
    const method = req.method ?? "GET";
    const path = (req.url ?? "/").split("?")[0];

    if (path === MANUAL_API_PATH) {
      await handleManualApi(req, res, manualApi);
      return;
    }

    if (!HEALTH_PATHS.has(path)) {
      sendJson(res, 404, { status: "not_found" });
      return;
    }

    if (method !== "GET" && method !== "HEAD") {
      sendJson(res, 405, { status: "method_not_allowed" }, { Allow: "GET, HEAD" });
      return;
    }

    const runningPollers = pollers.filter((poller) => poller.isRunning()).length;
    const allRunning = pollers.length > 0 && runningPollers === pollers.length;
    const temporalResult = temporalHealth ? await temporalHealth() : undefined;
    const temporalOk = temporalResult ? temporalResult.ok : true;

    const response = {
      status: allRunning && temporalOk ? "ok" : "error",
      details: {
        pollersTotal: pollers.length,
        pollersRunning: runningPollers,
        temporal: temporalResult,
      },
    };

    const statusCode = allRunning && temporalOk ? 200 : 503;
    if (method === "HEAD") {
      res.writeHead(statusCode);
      res.end();
      return;
    }

    sendJson(res, statusCode, response);
  };
}

export function startHealthServer({
  pollers,
  port,
  manualApi,
  temporalHealth,
}: HealthServerOptions): Server {
  const server = createServer(createHealthHandler({ pollers, manualApi, temporalHealth }));

  server.listen(port, () => {
    logger.info({ port }, "Health check server listening");
  });

  server.on("error", (err) => {
    logger.error({ err }, "Health check server error");
  });

  return server;
}

async function handleManualApi(
  req: IncomingMessage,
  res: ServerResponse<IncomingMessage>,
  manualApi?: HealthServerOptions["manualApi"],
) {
  if (!manualApi?.enabled) {
    sendJson(res, 403, { error: "manual_api_disabled" });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "method_not_allowed" }, { Allow: "POST" });
    return;
  }

  const bodyResult = await readJsonBody(req, res);
  if (!bodyResult.ok) {
    sendJson(res, bodyResult.status, { error: bodyResult.error });
    return;
  }

  const body = bodyResult.body as Record<string, unknown>;
  const queueName = body.queueName;
  if (!queueName || typeof queueName !== "string") {
    sendJson(res, 400, { error: "queueName (string) is required" });
    return;
  }

  if (body.message === undefined) {
    sendJson(res, 400, { error: "message is required" });
    return;
  }

  let attributes: Record<string, string> | undefined;
  if (body.attributes !== undefined) {
    if (!isPlainObject(body.attributes)) {
      sendJson(res, 400, { error: "attributes must be an object" });
      return;
    }
    attributes = {};
    for (const [key, value] of Object.entries(body.attributes)) {
      attributes[key] = typeof value === "string" ? value : JSON.stringify(value);
    }
  }

  const handler = manualApi.resolveHandler(queueName);
  if (!handler) {
    sendJson(res, 404, { error: "handler_not_found" });
    return;
  }

  try {
    await handler.handle(body.message, {
      messageId: `manual-${Date.now()}`,
      receiptHandle: "",
      attributes,
    });
    sendJson(res, 200, { status: "ok" });
  } catch (err) {
    logger.error({ err, queueName }, "Manual API handle failed");
    sendJson(res, 500, { error: "handle_failed" });
  }
}

async function readJsonBody(
  req: IncomingMessage,
  _res: ServerResponse<IncomingMessage>,
): Promise<{ ok: true; body: unknown } | { ok: false; status: number; error: string }> {
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > MAX_BODY_BYTES) {
      return { ok: false, status: 413, error: "payload_too_large" };
    }
    chunks.push(buffer);
  }

  const text = Buffer.concat(chunks).toString("utf8").trim();
  if (!text) {
    return { ok: false, status: 400, error: "body_required" };
  }

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400, error: "invalid_json" };
  }
}

function sendJson(
  res: ServerResponse<IncomingMessage>,
  status: number,
  payload: unknown,
  headers: Record<string, string> = {},
) {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(payload));
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
