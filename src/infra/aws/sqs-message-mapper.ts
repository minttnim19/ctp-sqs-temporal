import type { Message, MessageAttributeValue } from "@aws-sdk/client-sqs";

import type {
  InboundMessage,
  MessageAttribute,
  MessageMetadata,
} from "@/application/models/inbound-message";
import { safelyParse, unwrapSnsEnvelope } from "@/utils/common";
import { parseJson } from "@/utils/json";
import { getStringField, isPlainObject, type UnknownRecord } from "@/utils/object";

export function mapSqsMessage<T>(message: Message): InboundMessage<T> {
  const bodyText = message.Body;
  const snsMessageAttributes = getSnsEnvelopeMessageAttributes(bodyText);
  const messageAttributes = message.MessageAttributes
    ? {
        ...snsMessageAttributes,
        ...mapMessageAttributes(message.MessageAttributes),
      }
    : snsMessageAttributes;
  const body = unwrapSnsEnvelope(bodyText);

  return {
    payload: safelyParse<T>(body),
    metadata: mapSqsMetadata(message, messageAttributes),
  };
}

function mapSqsMetadata(
  message: Message,
  messageAttributes: Record<string, MessageAttribute>,
): MessageMetadata {
  return {
    messageId: message.MessageId ?? "",
    receiptHandle: message.ReceiptHandle ?? "",
    attributes: message.Attributes ? { ...message.Attributes } : {},
    messageAttributes,
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

export function getSnsEnvelopeMessageAttributes(
  body: string | undefined,
): Record<string, MessageAttribute> {
  if (!body) return {};
  const envelope = parseJson(body);
  if (!isSnsEnvelope(envelope)) return {};

  return mapSnsMessageAttributes(envelope["MessageAttributes"]);
}

function isSnsEnvelope(value: unknown): value is UnknownRecord & { Message: string } {
  return (
    isPlainObject(value) &&
    getStringField(value, "Type") !== undefined &&
    "TopicArn" in value &&
    getStringField(value, "Message") !== undefined
  );
}

function mapSnsMessageAttributes(value: unknown): Record<string, MessageAttribute> {
  if (!isPlainObject(value)) return {};

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, attribute]) => {
      if (!isPlainObject(attribute)) return [];

      const type = attribute["Type"];
      const stringValue = attribute["Value"];
      if (typeof type !== "string" || typeof stringValue !== "string") return [];

      return [[key, { DataType: type, StringValue: stringValue }]];
    }),
  );
}
