import type { Message, MessageAttributeValue } from "@aws-sdk/client-sqs";

import type {
  InboundMessage,
  MessageAttribute,
  MessageMetadata,
} from "@/application/models/inbound-message";
import { safelyParse, unwrapSnsEnvelope } from "@/utils/common";

export function mapSqsMessage<T>(message: Message): InboundMessage<T> {
  const unwrapped = unwrapSnsEnvelope(message.Body);
  return {
    payload: safelyParse<T>(unwrapped),
    metadata: mapSqsMetadata(message),
  };
}

function mapSqsMetadata(message: Message): MessageMetadata {
  return {
    messageId: message.MessageId ?? "",
    receiptHandle: message.ReceiptHandle ?? "",
    attributes: message.Attributes ? { ...message.Attributes } : {},
    messageAttributes: mapMessageAttributes(message.MessageAttributes ?? {}),
  };
}

function mapMessageAttributes(
  attributes: Record<string, MessageAttributeValue>,
): Record<string, MessageAttribute> {
  return Object.fromEntries(
    Object.entries(attributes).map(([key, value]) => [
      key,
      {
        StringValue: value.StringValue,
        BinaryValue: value.BinaryValue,
        StringListValues: value.StringListValues,
        BinaryListValues: value.BinaryListValues,
        DataType: value.DataType,
      },
    ]),
  );
}
