// Jest runs many suites in parallel, each registering process listeners (exit, SIGTERM, etc.)
// Raise the limit to prevent MaxListenersExceededWarning from Jest's own worker management.
process.setMaxListeners(100);

// Minimal env for modules that parse env on import
process.env.NODE_ENV = process.env.NODE_ENV || "test";
process.env.APP_ENV = process.env.APP_ENV || "dev";
process.env.LOG_LEVEL = process.env.LOG_LEVEL || "info";
process.env.LOG_PATH = process.env.LOG_PATH || "./logs";
process.env.LOG_TO_FILE = process.env.LOG_TO_FILE || "false";
process.env.LOG_CHANNEL = process.env.LOG_CHANNEL || "abc";
process.env.LOG_PRODUCT = process.env.LOG_PRODUCT || "xyz";
process.env.SERVICE_TYPE = process.env.SERVICE_TYPE || "prebook";

process.env.AWS_REGION = process.env.AWS_REGION || "us-east-1";
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || "test";
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || "test";
process.env.SQS_ENDPOINT = process.env.SQS_ENDPOINT || "http://localstack:4566";

process.env.SQS_QUEUE_NAMES = process.env.SQS_QUEUE_NAMES || "dummy-queue";
process.env.SQS_DLQ_SUFFIX = process.env.SQS_DLQ_SUFFIX || "-dlq";
process.env.AUTO_CREATE_QUEUES = process.env.AUTO_CREATE_QUEUES || "false";

process.env.SQS_POLLING_WAIT_SECS = process.env.SQS_POLLING_WAIT_SECS || "20";
process.env.SQS_VISIBILITY_TIMEOUT_SECS = process.env.SQS_VISIBILITY_TIMEOUT_SECS || "600";
process.env.SQS_BATCH_SIZE = process.env.SQS_BATCH_SIZE || "10";
process.env.CONCURRENCY = process.env.CONCURRENCY || "1";

process.env.HTTP_TIMEOUT_MS = process.env.HTTP_TIMEOUT_MS || "10000";
process.env.HEALTHCHECK_PORT = process.env.HEALTHCHECK_PORT || "3000";
process.env.SPAWN_TEMPORAL_WORKER = process.env.SPAWN_TEMPORAL_WORKER || "false";

// Commercetools required vars for env parsing during module import
process.env.CTP_AUTH_URL =
  process.env.CTP_AUTH_URL || "https://auth.europe-west1.gcp.commercetools.com";
process.env.CTP_API_URL =
  process.env.CTP_API_URL || "https://api.europe-west1.gcp.commercetools.com";
process.env.CTP_CLIENT_ID = process.env.CTP_CLIENT_ID || "test-ct-client-id";
process.env.CTP_CLIENT_SECRET = process.env.CTP_CLIENT_SECRET || "test-ct-client-secret";
process.env.CTP_PROJECT_KEY = process.env.CTP_PROJECT_KEY || "test-project";
process.env.CTP_SCOPES = process.env.CTP_SCOPES || "manage_project:test-project";

process.env.TEMPORAL_ADDRESS = process.env.TEMPORAL_ADDRESS || "temporal:7233";
process.env.TEMPORAL_NAMESPACE = process.env.TEMPORAL_NAMESPACE || "default";
process.env.TEMPORAL_TASK_QUEUE_DUMMY_1 =
  process.env.TEMPORAL_TASK_QUEUE_DUMMY_1 || "dummy-1-task-queue";
process.env.TEMPORAL_TASK_QUEUE_DUMMY_2 =
  process.env.TEMPORAL_TASK_QUEUE_DUMMY_2 || "dummy-2-task-queue";
process.env.TEMPORAL_MAX_ACTIVITY_TASKS = process.env.TEMPORAL_MAX_ACTIVITY_TASKS || "5";
process.env.TEMPORAL_MAX_WORKFLOW_TASKS = process.env.TEMPORAL_MAX_WORKFLOW_TASKS || "5";
process.env.TEMPORAL_CONNECTION_TIMEOUT = process.env.TEMPORAL_CONNECTION_TIMEOUT || "30000";
process.env.TEMPORAL_RETRY_ATTEMPTS = process.env.TEMPORAL_RETRY_ATTEMPTS || "3";
process.env.TEMPORAL_RETRY_DELAY = process.env.TEMPORAL_RETRY_DELAY || "5000";
process.env.TEMPORAL_TLS_ENABLED = process.env.TEMPORAL_TLS_ENABLED || "false";
