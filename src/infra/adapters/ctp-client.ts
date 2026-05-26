import type { ByProjectKeyRequestBuilder } from "@commercetools/platform-sdk";
import { createApiBuilderFromCtpClient } from "@commercetools/platform-sdk";
import { ClientBuilder } from "@commercetools/sdk-client-v2";

import { env } from "@/config/env";
export interface CTHttpError {
  statusCode: number;
  message: string;
  body?: {
    message?: string;
    errors?: Array<{ code: string; message: string; currentVersion?: number }>;
  };
}
export class CommerceToolsClient {
  private static instance: CommerceToolsClient;
  public readonly apiRoot: ByProjectKeyRequestBuilder;

  private constructor() {
    const projectKey = env.CTP_PROJECT_KEY;

    const ctpClient = new ClientBuilder()
      .withProjectKey(projectKey)
      .withClientCredentialsFlow({
        host: env.CTP_AUTH_URL,
        projectKey,
        credentials: {
          clientId: env.CTP_CLIENT_ID,
          clientSecret: env.CTP_CLIENT_SECRET,
        },
        scopes: [env.CTP_SCOPES],
        fetch,
      })
      .withHttpMiddleware({
        host: env.CTP_API_URL,
        fetch,
      })
      .build();

    this.apiRoot = createApiBuilderFromCtpClient(ctpClient).withProjectKey({ projectKey });
  }

  public static getInstance(): CommerceToolsClient {
    if (!CommerceToolsClient.instance) {
      CommerceToolsClient.instance = new CommerceToolsClient();
    }
    return CommerceToolsClient.instance;
  }

  static isCTHttpError(error: unknown): error is CTHttpError {
    return (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof (error as CTHttpError).statusCode === "number"
    );
  }

  static isNotFound(error: unknown): boolean {
    return CommerceToolsClient.isCTHttpError(error) && error.statusCode === 404;
  }
}
