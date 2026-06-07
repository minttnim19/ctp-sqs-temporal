import type { MessageMetadata } from "@/application/models/inbound-message";

export type MessageMeta = MessageMetadata;

export interface MessageHandler<T> {
  handle(message: T, meta: MessageMeta): Promise<void>;
}
