export type MessageAttribute = {
  StringValue?: string;
  BinaryValue?: Uint8Array;
  StringListValues?: string[];
  BinaryListValues?: Uint8Array[];
  DataType?: string;
};

export type MessageMetadata = {
  messageId: string;
  receiptHandle: string;
  attributes?: Record<string, string>;
  messageAttributes?: Record<string, MessageAttribute>;
};

export type InboundMessage<T> = {
  payload: T;
  metadata: MessageMetadata;
};
