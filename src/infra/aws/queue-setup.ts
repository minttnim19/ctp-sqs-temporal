import {
  CreateQueueCommand,
  GetQueueAttributesCommand,
  GetQueueUrlCommand,
  SQSClient,
} from "@aws-sdk/client-sqs";

import { logger } from "@/infra/logger/col-logger";

async function fetchQueueUrl(client: SQSClient, queueName: string): Promise<string> {
  const res = await client.send(new GetQueueUrlCommand({ QueueName: queueName }));
  const url = res.QueueUrl;
  if (!url) throw new Error(`SQS queue URL not found for ${queueName}`);
  return url;
}

async function getQueueArn(client: SQSClient, queueUrl: string): Promise<string> {
  const res = await client.send(
    new GetQueueAttributesCommand({ QueueUrl: queueUrl, AttributeNames: ["QueueArn"] }),
  );
  const arn = res.Attributes?.QueueArn;
  if (!arn) throw new Error(`SQS QueueArn not found for URL ${queueUrl}`);
  return arn;
}

export async function ensureQueues(client: SQSClient, queueName: string, dlqName: string) {
  await client.send(new CreateQueueCommand({ QueueName: dlqName }));
  const dlqUrl = await fetchQueueUrl(client, dlqName);
  const dlqArn = await getQueueArn(client, dlqUrl);

  await client.send(
    new CreateQueueCommand({
      QueueName: queueName,
      Attributes: {
        RedrivePolicy: JSON.stringify({
          deadLetterTargetArn: dlqArn,
          maxReceiveCount: "5",
        }),
        ReceiveMessageWaitTimeSeconds: "20", // long polling default at queue level
        VisibilityTimeout: "60",
      },
    }),
  );

  const mainUrl = await fetchQueueUrl(client, queueName);

  logger.info({ mainUrl, dlqUrl }, "Queues ensured");
  return { mainUrl, dlqUrl };
}

export async function getQueueUrl(client: SQSClient, queueName: string) {
  const queueUrl = await fetchQueueUrl(client, queueName);
  logger.info({ queueName, queueUrl }, "Queue URL resolved");
  return queueUrl;
}
