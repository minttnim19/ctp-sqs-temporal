import { Message } from "@commercetools/platform-sdk";
import type { S3Event } from "aws-lambda";

import type { MessageHandler } from "@/application/ports/message-handler";
import { env } from "@/config/env";
import { ProcessDummy } from "@/application/usecases/process-dummy";

export type AllowEventMessage = Message | S3Event;

export function resolveHandler(queueName: string): MessageHandler<AllowEventMessage> | undefined {
  const map: Record<string, () => MessageHandler<AllowEventMessage>> = {
    dummy: () => new ProcessDummy(),
    // Add more mappings as needed
  };

  const rawKey = queueName.trim().toLowerCase().split(".")[0];
  const appEnv = env.APP_ENV.trim().toLowerCase();
  const sanitizedKey = rawKey
    .split("-")
    .filter(Boolean)
    .filter((segment) => segment !== appEnv)
    .join("-");

  const lookupKey = sanitizedKey || rawKey;
  const factory = map[lookupKey];

  return factory ? factory() : undefined;
}
