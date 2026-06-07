import type { Message } from "@aws-sdk/client-sqs";

import { mapSqsMessage } from "@/infra/aws/sqs-message-mapper";

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

  it("defaults missing metadata to empty values", () => {
    expect(mapSqsMessage({}).metadata).toEqual({
      messageId: "",
      receiptHandle: "",
      attributes: {},
      messageAttributes: {},
    });
  });
});
