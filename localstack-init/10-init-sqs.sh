#!/usr/bin/env bash
set -euo pipefail

echo "[init] Creating SQS queue for LocalStack..."

# Defaults aligned with .env.example and code mapping
OUT_QUEUE_NAME=${OUT_QUEUE_NAME:-sandbox-sqs-out}
BUCKET_NAME=${AWS_S3_BUCKET:-test-bucket}
REGION=${AWS_REGION:-us-east-1}

# Create an output queue to receive SNS deliveries for verification
awslocal sqs create-queue --queue-name "$OUT_QUEUE_NAME" >/dev/null || true
OUT_QURL=$(awslocal sqs get-queue-url --queue-name "$OUT_QUEUE_NAME" --query QueueUrl --output text)
OUT_QARN=$(awslocal sqs get-queue-attributes --queue-url "$OUT_QURL" --attribute-names QueueArn --query Attributes.QueueArn --output text)
echo "[init] SQS output queue ensured: $OUT_QURL ($OUT_QARN)"