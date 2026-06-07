import "dotenv/config";
import { z } from "zod";

export function normalizeBoolFromEnv(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }

  const normalized = value.trim().toLowerCase();
  if (["1", "true", "y", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "n", "no", "off", ""].includes(normalized)) return false;
  return value;
}

export function normalizeCsvEnv(value: unknown): string[] {
  if (typeof value !== "string") {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

const BoolFromEnv = z.preprocess(normalizeBoolFromEnv, z.boolean());

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_ENV: z.string().default("dev"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  LOG_CHANNEL: z.string().default("ecp"),
  LOG_PRODUCT: z.string().default("ecp"),
  LOG_PATH: z.string().default("./logs"),
  LOG_TO_FILE: BoolFromEnv.default(false),
  SERVICE_TYPE: z.string().default(""),

  AWS_REGION: z.string().default("us-east-1"),
  AWS_ACCESS_KEY_ID: z.string().default("test"),
  AWS_SECRET_ACCESS_KEY: z.string().default("test"),
  SQS_ENDPOINT: z.string().optional(), // e.g. http://localstack:4566

  // AWS_S3_BUCKET: z.string().default("test-bucket"),
  // AWS_S3_ENDPOINT: z.string().optional(),
  // AWS_S3_FORCE_PATH_STYLE: BoolFromEnv.default(false),
  // AWS_S3_PRESIGN_EXPIRES_IN: z.coerce
  //   .number()
  //   .int()
  //   .positive()
  //   .max(7 * 24 * 60 * 60)
  //   .default(3600),

  SQS_QUEUE_NAMES: z.string(),
  SQS_DLQ_SUFFIX: z.string().default("-dlq"),
  AUTO_CREATE_QUEUES: BoolFromEnv.default(false),

  SQS_POLLING_WAIT_SECS: z.coerce.number().min(1).max(20).default(20),
  SQS_VISIBILITY_TIMEOUT_SECS: z.coerce.number().min(1).default(60),
  SQS_BATCH_SIZE: z.coerce.number().min(1).max(10).default(10),
  CONCURRENCY: z.coerce.number().min(1).default(10),

  // Temporal
  TEMPORAL_ADDRESS: z.string().default("temporal:7233"),
  TEMPORAL_NAMESPACE: z.string().default("default"),
  TEMPORAL_TASK_QUEUE_DUMMY_1: z.string().default("dummy-1-task-queue"),
  TEMPORAL_TASK_QUEUE_DUMMY_2: z.string().default("dummy-2-task-queue"),
  TEMPORAL_TASK_QUEUE_SCHEDULED: z.string().default("scheduled-task-queue"),
  // TEMPORAL_TASK_QUEUE_PREBOOK_JOB: z.string().default("prebook-job-task-queue"),
  // TEMPORAL_TASK_QUEUE_PREBOOK_S3_UPLOAD: z.string().default("prebook-s3-upload-task-queue"),
  // TEMPORAL_TASK_QUEUE_PREBOOK_S3_EXPORT: z.string().default("prebook-s3-export-task-queue"),
  TEMPORAL_MAX_ACTIVITY_TASKS: z.coerce.number().min(1).default(5),
  TEMPORAL_MAX_WORKFLOW_TASKS: z.coerce.number().min(1).default(5),
  TEMPORAL_CONNECTION_TIMEOUT: z.coerce.number().min(1000).default(30000),
  TEMPORAL_RETRY_ATTEMPTS: z.coerce.number().min(1).default(3),
  TEMPORAL_RETRY_DELAY: z.coerce.number().min(0).default(5000),
  TEMPORAL_WORKER_ROLE: z.enum(["all", "dummy1", "dummy2", "scheduled"]).optional(),
  TEMPORAL_TLS_ENABLED: BoolFromEnv.default(false),
  TEMPORAL_TLS_SERVER_NAME: z.string().optional(),
  TEMPORAL_TLS_CLIENT_CERT: z.string().optional(),
  TEMPORAL_TLS_CLIENT_KEY: z.string().optional(),
  TEMPORAL_TLS_CA_CERT: z.string().optional(),

  // HTTP client
  // APIGW_BASE_URL: z.url(),
  // APIGW_CLIENT_ID: z.string().min(1),
  // APIGW_CLIENT_SECRET: z.string().min(1),

  // TSM Backend
  // TSM_BASE_URL: z.url().default("https://omnichannel-uat5.truecorp.co.th"),
  // TSM_INV_PREFIX: z.string().default(""),
  // TSM_PAGO_PREFIX: z.string().default(""),
  // TSM_PAGO_WEB_PREFIX: z.string().default("/uat/set5"),
  // TSM_CLIENT_ID: z.string().default(""),
  // TSM_CLIENT_SECRET: z.string().default(""),
  // TSM_WEB_METHOD_CHANNEL: z.string().default("SMARTUI_WEB"),

  // Omnichannel
  // OMNICHANNEL_BASE_URL: z.url(),
  // OMNICHANNEL_API_KEY: z.string().min(1),

  // OmniChannel 3CJ Messaging (Email)
  // OMNICHANNEL_3CJ_EMAIL_VERSION: z.string().default("1"),
  // OMNICHANNEL_3CJ_EMAIL_CHANNEL: z.string(),
  // OMNICHANNEL_3CJ_EMAIL_LANGUAGE: z.string().default("TH"),
  // OMNICHANNEL_3CJ_EMAIL_SENDER: z.string(),
  // OMNICHANNEL_3CJ_EMAIL_DRO: BoolFromEnv.default(false),
  // OMNICHANNEL_3CJ_EMAIL_TEMPLATE_ID: z.string(),
  // OMNICHANNEL_3CJ_EMAIL_DELETE_FILE: BoolFromEnv.default(false),

  // Payment Mapping config
  // MAPPING_PAYMENT_CCW: z.string().default("CCW"),
  // MAPPING_PAYMENT_TMN: z.string().default("TMN Wallet"),
  // MAPPING_PAYMENT_QR: z.string().default("QR PROMPTPAY"),

  HTTP_TIMEOUT_MS: z.coerce.number().min(1).default(10000),
  HEALTHCHECK_PORT: z.coerce.number().min(1).max(65535).default(3000),
  SPAWN_TEMPORAL_WORKER: BoolFromEnv.default(true),

  // Commercetools (optional)
  CTP_AUTH_URL: z.url().default("https://auth.europe-west1.gcp.commercetools.com"),
  CTP_API_URL: z.url().default("https://api.europe-west1.gcp.commercetools.com"),
  CTP_CLIENT_ID: z.string(),
  CTP_CLIENT_SECRET: z.string(),
  CTP_PROJECT_KEY: z.string(),
  CTP_SCOPES: z.string(),

  // Contentstack (optional)
  // CS_AUTHORIZATION: z.string(),
  // CS_API_KEY: z.string(),
  // CS_REGION: z.string().default("us"),
  // CS_BRANCH: z.string().default("main"),
  // CS_ENVIRONMENTS: CsvToStringArray,

  // Database
  // DATABASE_URL: z.url(),
  // DB_POOL_MIN: z.coerce.number().default(2),
  // DB_POOL_MAX: z.coerce.number().default(10),

  // Cache (Redis/ElastiCache)
  // REDIS_URL: z.url().default("redis://redis:6379/0"),
  // REDIS_CLUSTER_MODE: BoolFromEnv.default(false),
  // REDIS_NODES: z.string().optional(), // csv of host:port,host:port
  // REDIS_TLS: BoolFromEnv.default(false),
  // REDIS_USERNAME: z.string().optional(),
  // REDIS_PASSWORD: z.string().optional(),

  // Configs
  // CONFIG_EMAIL_WW_KEY: z.string(),
  // CONFIG_EMAIL_TUC_KEY: z.string(),
});

export const env = EnvSchema.parse(process.env);

export function resolveQueueNames(envObj = env): string[] {
  if (envObj.SQS_QUEUE_NAMES && envObj.SQS_QUEUE_NAMES.trim().length > 0) {
    return envObj.SQS_QUEUE_NAMES.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}
