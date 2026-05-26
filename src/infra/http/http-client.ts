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
import { logger } from "@/infra/logger/col-logger";

type RequestMetadata = { start: number };
type InternalConfigWithMeta = InternalAxiosRequestConfig & { metadata?: RequestMetadata };
type ResponseConfigWithMeta = AxiosRequestConfig & { metadata?: RequestMetadata };

export type HttpClientOptions = {
  baseURL?: string;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

function toError(error: unknown): Error {
  if (error instanceof Error) return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return new Error(String((error as { message?: unknown }).message));
  }
  return new Error(String(error));
}

function createAxios(options?: HttpClientOptions): AxiosInstance {
  const instance = axios.create({
    baseURL: options?.baseURL,
    timeout: options?.timeoutMs ?? env.HTTP_TIMEOUT_MS,
    httpAgent: new HttpAgent({ keepAlive: true }),
    httpsAgent: new HttpsAgent({ keepAlive: true }),
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options?.headers,
    },
  });

  instance.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    const { url, baseURL } = config;
    const cfg = config as InternalConfigWithMeta;
    cfg.metadata = { start: Date.now() };

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
    (response: AxiosResponse) => response,
    (error: unknown) => {
      if (isAxiosError(error)) {
        const cfg = error.config as ResponseConfigWithMeta | undefined;
        const ms = cfg?.metadata?.start ? Date.now() - cfg.metadata.start : undefined;
        logger.error(
          {
            message: error.message,
            code: error.code,
            url: cfg?.url,
            status: error.response?.status,
            ms,
          },
          "HTTP request failed",
        );
      } else {
        logger.warn({ error }, "Unknown HTTP error");
      }

      return Promise.reject(toError(error));
    },
  );

  return instance;
}

export const httpClient: AxiosInstance = createAxios();

export type HttpRequestConfig = AxiosRequestConfig;

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
