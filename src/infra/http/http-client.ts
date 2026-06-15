import { Agent as HttpAgent } from "node:http";
import { Agent as HttpsAgent } from "node:https";

import type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  InternalAxiosRequestConfig,
} from "axios";
import axios, { isAxiosError } from "axios";

import { env } from "@/config/env";
import { createLogModel, logger } from "@/infra/logger/col-logger";
import { toRecord } from "@/utils/object";

type LogModel = ReturnType<typeof createLogModel>;
type RequestMetadata = {
  txid?: string;
  logModel?: LogModel;
  method?: string;
  endpoint?: string;
  request?: unknown;
};
type InternalConfigWithMeta = InternalAxiosRequestConfig & { metadata?: RequestMetadata };
type ResponseConfigWithMeta = AxiosRequestConfig & { metadata?: RequestMetadata };

export type HttpClientOptions = {
  baseURL?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
  rejectUnauthorized?: boolean;
};

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  const record = toRecord(error);
  if (record && "message" in record) {
    return new Error(String(record.message));
  }
  return new Error(String(error));
}

function toEndpoint(baseURL?: string, url?: string): string {
  if (url && /^(?:[a-z]+:)?\/\//i.test(url)) return url;
  if (baseURL && url) return `${baseURL.replace(/\/$/, "")}/${url.replace(/^\//, "")}`;
  return url ?? baseURL ?? "";
}

function getLogModel(config: InternalConfigWithMeta): LogModel | undefined {
  return createLogModel({ txid: config.metadata?.txid });
}

function toMetadata(config: InternalConfigWithMeta): RequestMetadata {
  const { url, baseURL } = config;
  const method = config.method ?? "GET";

  return {
    logModel: getLogModel(config),
    method: method.toUpperCase(),
    endpoint: toEndpoint(baseURL, typeof url === "string" ? url : undefined),
    request: config.data,
  };
}

function createAxios(options?: HttpClientOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: options?.baseURL,
    timeout: options?.timeoutMs ?? env.HTTP_TIMEOUT_MS,
    httpAgent: new HttpAgent({ keepAlive: true }),
    httpsAgent: new HttpsAgent({
      keepAlive: true,
      rejectUnauthorized: options?.rejectUnauthorized ?? true,
    }),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options?.headers,
    },
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const { url, baseURL } = config;
    const cfg = config as InternalConfigWithMeta;
    cfg.metadata = toMetadata(cfg);

    // Guard: prevent relative path if no baseURL configured
    const isAbsolute = typeof url === "string" && /^(?:[a-z]+:)?\/\//i.test(url);
    if (!baseURL && url && !isAbsolute) {
      throw new Error(
        `HTTP client called with relative URL "${url}" but no baseURL is set. Pass an absolute URL or create a client with baseURL.`,
      );
    }
    return cfg;
  });

  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      const cfg = response.config as ResponseConfigWithMeta;
      const metadata = cfg.metadata;

      metadata?.logModel?.logStep("HTTP client request completed", {
        activity_name: "http-client-request",
        endpoint: metadata.endpoint,
        method: metadata.method,
        step_request: metadata.request,
        step_response: response.data,
        result_code: String(response.status),
      });

      return response;
    },
    (error: unknown) => {
      if (isAxiosError(error)) {
        const cfg = error.config as ResponseConfigWithMeta | undefined;
        cfg?.metadata?.logModel?.logStep("HTTP client request error", {
          activity_name: "http-client-request",
          error,
        });
      } else {
        logger.warn({ error }, "Unknown HTTP error");
      }

      return Promise.reject(toError(error));
    },
  );

  return instance;
}

export const httpClient: AxiosInstance = createAxios();

export type HttpRequestConfig = AxiosRequestConfig & {
  metadata?: RequestMetadata;
};

export function createHttpClient(options?: HttpClientOptions): AxiosInstance {
  return createAxios(options);
}

export async function httpGet<T = unknown>(url: string, config?: HttpRequestConfig): Promise<T> {
  const res = await httpClient.get<T>(url, config);
  return res.data;
}

export async function httpPost<T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: HttpRequestConfig,
): Promise<T> {
  const res = await httpClient.post<T>(url, body, config);
  return res.data;
}

export async function httpPut<T = unknown, B = unknown>(
  url: string,
  body?: B,
  config?: HttpRequestConfig,
): Promise<T> {
  const res = await httpClient.put<T>(url, body, config);
  return res.data;
}

export async function httpDelete<T = unknown>(url: string, config?: HttpRequestConfig): Promise<T> {
  const res = await httpClient.delete<T>(url, config);
  return res.data;
}
