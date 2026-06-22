import type { Message, MessageAttributeValue } from "@aws-sdk/client-sqs";

import type {
  InboundMessage,
  MessageAttribute,
  MessageMetadata,
} from "@/application/models/inbound-message";
import { safelyParse } from "@/utils/common";
import { parseJson } from "@/utils/json";
import { getStringField, isPlainObject, type UnknownRecord } from "@/utils/object";

type SnsEnvelope = {
  message: string;
  messageAttributes: Record<string, MessageAttribute>;
};

export function mapSqsMessage<T>(message: Message): InboundMessage<T> {
  const snsEnvelope = parseSnsEnvelope(message.Body);
  const body = snsEnvelope?.message ?? message.Body;

  return {
    payload: safelyParse<T>(body),
    metadata: mapSqsMetadata(message, snsEnvelope?.messageAttributes ?? {}),
  };
}

function mapSqsMetadata(
  message: Message,
  snsMessageAttributes: Record<string, MessageAttribute>,
): MessageMetadata {
  const sqsMessageAttributes = mapMessageAttributes(message.MessageAttributes ?? {});

  return {
    messageId: message.MessageId ?? "",
    receiptHandle: message.ReceiptHandle ?? "",
    attributes: message.Attributes ? { ...message.Attributes } : {},
    messageAttributes: {
      ...snsMessageAttributes,
      ...sqsMessageAttributes,
    },
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

function parseSnsEnvelope(body: string | undefined): SnsEnvelope | undefined {
  if (!body) return undefined;

  const envelope = parseJson(body);
  if (!isSnsEnvelope(envelope)) return undefined;

  return {
    message: envelope["Message"],
    messageAttributes: mapSnsMessageAttributes(envelope["MessageAttributes"]),
  };
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
