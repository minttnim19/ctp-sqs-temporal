import { MessageAttributeValue, MessageSystemAttributeName } from "@aws-sdk/client-sqs";

export type MessageMeta = {
  messageId: string;
  receiptHandle: string;
  attributes?: Partial<Record<MessageSystemAttributeName, string>>;
  messageAttributes?: Record<string, MessageAttributeValue>;
};

export interface MessageHandler<T> {
  handle(message: T, meta: MessageMeta): Promise<void>;
}
