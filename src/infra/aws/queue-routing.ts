import type { MessageHandler, MessageMeta } from "@/application/ports/message-handler";

export type RegisteredQueueHandler = {
  handle(payload: unknown, meta: MessageMeta): Promise<void>;
};
export type QueueHandlerRegistry = Record<string, RegisteredQueueHandler>;

export function registerQueueHandler<TMessage>(
  handler: MessageHandler<TMessage>,
  mapPayload: (payload: unknown) => TMessage = (payload) => payload as TMessage,
): RegisteredQueueHandler {
  return {
    handle(payload, meta) {
      return handler.handle(mapPayload(payload), meta);
    },
  };
}

export function getQueueHandler(
  queueName: string,
  appEnv: string,
  registry: QueueHandlerRegistry,
): RegisteredQueueHandler | undefined {
  const rawKey = queueName.trim().toLowerCase().split(".")[0];
  const normalizedAppEnv = appEnv.trim().toLowerCase();
  const sanitizedKey = rawKey
    .split("-")
    .filter(Boolean)
    .filter((segment) => segment !== normalizedAppEnv)
    .join("-");

  const lookupKey = sanitizedKey || rawKey;
  return registry[lookupKey];
}
