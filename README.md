# Upsale Event

Node.js + TypeScript SQS consumer that routes queue messages to application use cases and starts Temporal workflows. The current repo maps dummy queue messages to `DummyWorkflowDispatcher`, which dispatches `DummyWorkflow`.

## Queue Routing

Queue routing is resolved by base name. Environment suffixes such as `-dev` and FIFO suffixes such as `.fifo` are ignored.

- `dummy` / `dummy-dev` / `dummy.fifo` -> `DummyWorkflowDispatcher`
- `scheduled-dummy` / `scheduled-dummy-dev` / `scheduled-dummy.fifo` -> `ScheduledWorkflowDispatcher`

If a queue name is not mapped, the poller logs the queue and skips it.

## EventBridge Scheduler To SQS

For EventBridge Scheduler targets, this service expects an empty SQS message body. The message only triggers the scheduled workflow.

Example Scheduler input:

```json
{}
```

The scheduled use case starts `ScheduledJobWorkflow` through the workflow starter port and uses `scheduled:${Date.now()}` as the workflow id.

## Local Development

Prerequisites: Docker and Docker Compose. Optional for host development: Node.js 24.15.0 and npm.

1. Install dependencies: `npm ci`
2. Copy env: `cp .env.example .env`
3. Start services: `docker compose up -d --build`

Notes:

- LocalStack is available at `http://localhost:4566` from the host and `http://localstack:4566` inside Docker.
- Queue auto-creation is local-only. It requires `AUTO_CREATE_QUEUES=true`, `SQS_ENDPOINT` set, and `NODE_ENV` not equal to `production`.
- `npm run dev` performs a one-time build before running. Restart it after TypeScript changes.
- Temporal uses the `postgres` service from `docker-compose.yml`.

## Health Check

- In Docker: `wget -qO- http://127.0.0.1:3000/healthz`
- On host: `http://localhost:3000/healthz`

The health endpoints `/`, `/health`, and `/healthz` return `200 OK` with plain text `ok`.

## Manual API

In development, the health server also exposes `POST /api/manual` for manually invoking a mapped handler.

Example:

```bash
curl -X POST http://localhost:3000/api/manual \
  -H "Content-Type: application/json" \
  -d '{
    "queueName": "dummy-dev",
    "message": {
      "id": "msg-1",
      "type": "OrderCreated",
      "version": 1,
      "resource": { "id": "resource-1", "typeId": "order" }
    }
  }'
```

## Temporal Workers

The main process starts supervised Temporal worker child processes when `SPAWN_TEMPORAL_WORKER=true`.

Send `SIGUSR2` to the main process to restart supervised worker processes:

```bash
kubectl exec -n <ns> <pod> -- kill -USR2 1
```

For direct worker execution, supported worker roles are:

- `all`
- `dummy1`
- `dummy2`
- `scheduled`

Example:

```bash
node dist/temporal/worker.js --role dummy1
```

Check logs for:

- `Temporal worker spawned`
- `Temporal dummy1 worker started`
- `Temporal dummy2 worker started`
- `Temporal scheduled worker started`
- Temporal SDK worker state changes for `TEMPORAL_TASK_QUEUE_DUMMY_1`, `TEMPORAL_TASK_QUEUE_DUMMY_2`, and `TEMPORAL_TASK_QUEUE_SCHEDULED`

## Environment

`src/config/env.ts` validates environment variables on startup.

Required:

- `SQS_QUEUE_NAMES`: comma-separated queue names to poll
- `CTP_CLIENT_ID`
- `CTP_CLIENT_SECRET`
- `CTP_PROJECT_KEY`
- `CTP_SCOPES`

Required values with defaults:

- `NODE_ENV`: `development`, `test`, or `production`
- `APP_ENV`: environment suffix used by queue resolution, default `dev`
- `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`
- `SQS_DLQ_SUFFIX`
- `SQS_POLLING_WAIT_SECS`, `SQS_VISIBILITY_TIMEOUT_SECS`, `SQS_BATCH_SIZE`, `CONCURRENCY`
- `LOG_LEVEL`, `LOG_CHANNEL`, `LOG_PRODUCT`, `LOG_PATH`, `LOG_TO_FILE`, `SERVICE_TYPE`
- `HTTP_TIMEOUT_MS`, `HEALTHCHECK_PORT`
- `TEMPORAL_ADDRESS`, `TEMPORAL_NAMESPACE`, `TEMPORAL_TASK_QUEUE_DUMMY_1`, `TEMPORAL_TASK_QUEUE_DUMMY_2`, `TEMPORAL_TASK_QUEUE_SCHEDULED`
- `TEMPORAL_MAX_ACTIVITY_TASKS`, `TEMPORAL_MAX_WORKFLOW_TASKS`
- `TEMPORAL_CONNECTION_TIMEOUT`, `TEMPORAL_RETRY_ATTEMPTS`, `TEMPORAL_RETRY_DELAY`
- `TEMPORAL_TLS_ENABLED`
- `SPAWN_TEMPORAL_WORKER`
- `CTP_AUTH_URL`, `CTP_API_URL`

Optional:

- `SQS_ENDPOINT`: LocalStack/custom SQS endpoint
- `TEMPORAL_WORKER_ROLE`: `all`, `dummy1`, `dummy2`, or `scheduled` when running the worker directly
- `TEMPORAL_TLS_SERVER_NAME`
- `TEMPORAL_TLS_CLIENT_CERT`
- `TEMPORAL_TLS_CLIENT_KEY`
- `TEMPORAL_TLS_CA_CERT`

## Logging

`src/infra/logger/col-logger.ts` emits Splunk-friendly time fields through Pino:

- `time`: epoch seconds as a number
- `@timestamp`: ISO timestamp
- `timestamp`: ISO timestamp

`createLogModel` accepts `txid`, `channel`, `service_type`, `product`, and `started_at`. `channel` defaults to `LOG_CHANNEL`. `service_type` uses the trimmed `SERVICE_TYPE` value when present, otherwise it falls back to `LOG_PRODUCT`.

## Scripts

```bash
npm run build
npm test
npm run lint
npm run lint:architecture
npm run dev
```

## Folder Structure

```text
.
├─ src/
│  ├─ main.ts                         # Process entrypoint
│  ├─ config/env.ts                   # Env parsing/validation
│  ├─ application/                    # Ports, models, and use cases
│  ├─ infra/aws/                      # SQS clients, queue setup, poller
│  ├─ infra/composition/              # Bootstrap and dependency composition
│  ├─ infra/healthcheck/              # Health and manual API server
│  ├─ infra/logger/                   # Structured logging
│  ├─ infra/temporal/                 # Temporal client, workflow starter, worker supervisor
│  └─ temporal/                       # Temporal worker, workflows, activities
├─ docker-compose.yml                 # LocalStack, Temporal, Postgres, app
├─ .env.example                       # Sample env for local development
└─ Dockerfile                         # Runtime image
```

## Architecture

The application layer owns use cases, ports, and internal message/workflow models. It must not import infrastructure, runtime config, or external SDK clients directly. SQS, logger, composition, and Temporal SDK integration live in `infra`; `src/main.ts` only calls the infrastructure bootstrap entrypoint.

## Troubleshooting

- `ENOTFOUND localstack` on host: set `SQS_ENDPOINT=http://localhost:4566`
- `NonExistentQueue`: set `AUTO_CREATE_QUEUES=true` locally or pre-create queues
- No messages are processed: verify `SQS_QUEUE_NAMES` resolves to a mapped queue such as `dummy-dev`
- Health check returns `503`: verify at least one mapped poller is running and Temporal is reachable
