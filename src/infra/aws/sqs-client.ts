import { SQSClient } from "@aws-sdk/client-sqs";

import { env } from "@/config/env";

export const sqsClient = new SQSClient({
  region: env.AWS_REGION,
  endpoint: env.SQS_ENDPOINT, // Only used for LocalStack
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "test",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "test",
  },
});
