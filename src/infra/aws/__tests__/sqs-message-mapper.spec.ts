import type { Message } from "@aws-sdk/client-sqs";

import { getSnsEnvelopeMessageAttributes, mapSqsMessage } from "@/infra/aws/sqs-message-mapper";

describe("sqs-message-mapper", () => {
  it("maps a raw SQS body into an inbound message", () => {
    const message: Message = {
      MessageId: "message-1",
      ReceiptHandle: "receipt-1",
      Body: JSON.stringify({ hello: "world" }),
      Attributes: { ApproximateReceiveCount: "1" },
      MessageAttributes: {
        correlatorId: {
          DataType: "String",
          StringValue: "tx-1",
        },
      },
    };

    expect(mapSqsMessage(message)).toEqual({
      payload: { hello: "world" },
      metadata: {
        messageId: "message-1",
        receiptHandle: "receipt-1",
        attributes: { ApproximateReceiveCount: "1" },
        messageAttributes: {
          correlatorId: {
            DataType: "String",
            StringValue: "tx-1",
            BinaryListValues: undefined,
            BinaryValue: undefined,
            StringListValues: undefined,
          },
        },
      },
    });
  });

  it("unwraps SNS envelope bodies", () => {
    const message: Message = {
      Body: JSON.stringify({
        Type: "Notification",
        TopicArn: "arn",
        Message: JSON.stringify({ event: "created" }),
      }),
    };

    expect(mapSqsMessage(message).payload).toEqual({ event: "created" });
  });

  it("maps SNS envelope message attributes into SQS-like metadata", () => {
    const message: Message = {
      Body: JSON.stringify({
        Type: "Notification",
        TopicArn: "arn",
        Message: JSON.stringify({ event: "created" }),
        MessageAttributes: {
          correlatorId: {
            Type: "String",
            Value: "a6627cf4-c8de-4b8a-a141-1e1f97fc8a37",
          },
          type: {
            Type: "String.Array",
            Value: '["OrderCreated"]',
          },
        },
      }),
    };

    expect(mapSqsMessage(message).metadata.messageAttributes).toEqual({
      correlatorId: {
        DataType: "String",
        StringValue: "a6627cf4-c8de-4b8a-a141-1e1f97fc8a37",
      },
      type: {
        DataType: "String.Array",
        StringValue: '["OrderCreated"]',
      },
    });
  });

  it("merges SNS envelope and SQS record message attributes", () => {
    const message: Message = {
      Body: JSON.stringify({
        Type: "Notification",
        TopicArn: "arn",
        Message: JSON.stringify({ event: "created" }),
        MessageAttributes: {
          correlatorId: {
            Type: "String",
            Value: "from-sns-envelope",
          },
          journey: {
            Type: "String",
            Value: "prebook",
          },
        },
      }),
      MessageAttributes: {
        correlatorId: {
          DataType: "String",
          StringValue: "from-sqs-record",
        },
      },
    };

    expect(mapSqsMessage(message).metadata.messageAttributes).toEqual({
      correlatorId: {
        DataType: "String",
        StringValue: "from-sqs-record",
        BinaryListValues: undefined,
        BinaryValue: undefined,
        StringListValues: undefined,
      },
      journey: {
        DataType: "String",
        StringValue: "prebook",
      },
    });
  });

  it("extracts SNS envelope message attributes without unwrapping the body", () => {
    const body = JSON.stringify({
      Type: "Notification",
      TopicArn: "arn",
      Message: JSON.stringify({ event: "created" }),
      MessageAttributes: {
        correlatorId: {
          Type: "String",
          Value: "tx-1",
        },
      },
    });

    expect(getSnsEnvelopeMessageAttributes(body)).toEqual({
      correlatorId: {
        DataType: "String",
        StringValue: "tx-1",
      },
    });
  });

  it("defaults missing metadata to empty values", () => {
    expect(mapSqsMessage({}).metadata).toEqual({
      messageId: "",
      receiptHandle: "",
      attributes: {},
      messageAttributes: {},
    });
  });
});
