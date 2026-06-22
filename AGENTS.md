# Agent Instructions

@/Users/mint/.codex/RTK.md

This repository is a Node.js + TypeScript SQS consumer that routes queue messages to application use cases and starts Temporal workflows. Use these instructions for all AI-agent work in this repo.

## Shell Commands

- Target Node.js `24.15.0`, as declared in `package.json`.
- Prefer prefixing shell commands with `rtk` when it is available.
- If `rtk` is not installed or misparses a command with flags, run the equivalent command directly or through `rtk proxy`.
- Use `rg` or `rg --files` for searching before slower alternatives.

## Architecture Rules

- Preserve the dependency direction:
  - `src/application` owns use cases, ports, and internal message/workflow models.
  - `src/application` must not import from `src/infra`, runtime config, AWS SDK clients, Temporal SDK clients, or logger implementations.
  - `src/infra` owns AWS/SQS adapters, queue setup, pollers, Temporal SDK integration, logger adapters, health/manual API, config, and composition wiring.
  - `src/temporal` owns Temporal worker runtime, workflows, activities, and interceptors.
  - `src/main.ts` should stay thin and call the infrastructure bootstrap entrypoint.
- Keep application behavior behind ports such as `MessageHandler`, `WorkflowStarter`, and `AppLoggerFactory`.
- Keep environment-specific values and adapter construction in `src/infra/composition` or config/bootstrap code.
- Use `npm run lint:architecture` to catch application-layer imports that cross the boundary.

## Queue Handler and Workflow Pattern

Queue routing is resolved by base name. Environment suffixes such as `-dev` and FIFO suffixes such as `.fifo` are ignored.

When adding or changing a queue-driven flow, check the whole path:

- Queue routing: `src/infra/aws/queue-routing.ts`
- Handler registration and adapter wiring: `src/infra/composition/composition-root.ts`
- Use case or dispatcher: `src/application/usecases`
- Application ports/models: `src/application/ports` and `src/application/models`
- Temporal workflow/activity implementation: `src/temporal/workflows` and `src/temporal/activities`
- Worker role or task queue wiring: `src/temporal/worker.ts` and `src/infra/temporal`
- Tests for the changed behavior under the nearest `__tests__` directory

Do not preserve dummy or scheduled examples as product requirements. They are useful references for shape and wiring, but real queue names, workflow names, workflow ids, task queues, payloads, and retry behavior should come from the actual service contract.

If a task adds, removes, or renames a queue handler or workflow, update routing, composition, worker wiring, tests, README references, and env examples together when they are affected.

## Temporal Rules

- Keep workflows deterministic.
- Do not perform direct network calls, file system access, random value generation, wall-clock time reads, or other non-deterministic Node.js work inside workflow code.
- Put external I/O and side effects in activities or infrastructure adapters, then call them through Temporal activity APIs.
- Keep workflow inputs, activity inputs, and workflow ids stable and explicit. Do not derive production workflow contracts from dummy examples unless the task says to.
- When changing task queues, worker roles, workflow names, or activity registration, verify the matching worker and composition wiring.

## Configuration

- Environment variables are parsed and validated in `src/config/env.ts`.
- When adding, renaming, or removing env vars, update `src/config/env.ts`, `.env.example`, related tests, and README configuration notes together.
- Do not read `process.env` directly outside config/bootstrap code unless there is already a local pattern for that case.
- Keep local-only behavior, such as queue auto-creation through LocalStack, clearly guarded from production.

## Local Development and Docker

- Unit tests and most lint/build checks do not require Docker.
- Use Docker Compose for manual end-to-end checks that need LocalStack SQS, Temporal, Postgres, or the containerized application.
- Before changing local runtime behavior, check `docker-compose.yml`, `.env.example`, `Dockerfile`, and `localstack-init/`.
- LocalStack queue setup lives under `localstack-init/`; keep it aligned with `SQS_QUEUE_NAMES` and queue routing when local queues change.
- Temporal UI is exposed by Docker Compose for local inspection; do not make tests depend on it.

## Implementation Rules

- Read the relevant code path before editing.
- Prefer narrow, behavior-focused changes.
- Do not refactor unrelated files.
- Follow existing naming, import aliases, formatting, and test style.
- Add or update focused tests for changed behavior.
- Preserve structured logging, health endpoint, queue routing, retry, and Temporal workflow contracts unless the task explicitly changes them.
- Update `.env.example`, README, or other docs when config, commands, queue mappings, workflow behavior, health/manual API behavior, or local development flow changes.
- Do not introduce new dependencies unless the task clearly requires them.

## Planning

- For small, localized changes, proceed directly after reading the relevant files.
- For larger changes, first produce a short plan that lists:
  - files likely to change
  - architecture boundary considerations
  - tests to add or update
  - validation commands to run
- Do not implement a large refactor without an agreed plan.

## Persistent Plans

- For small localized changes, a chat plan and final summary are enough.
- For medium or large tasks, create or update a plan file under `docs/agent-plans/`.
- Name plan files with the date and task or feature slug, for example `docs/agent-plans/YYYY-MM-DD-add-order-workflow.md`.
- Keep persistent plans concise and update them when scope, decisions, files changed, or validation status changes.
- Do not create persistent plan files for trivial formatting, typo, or one-line fixes unless the user asks.
- A persistent plan should include:
  - goal
  - scope
  - checklist
  - decisions
  - files changed
  - validation
  - status
- If a task already has a plan file, update the existing file instead of creating a duplicate.

## Code Quality

- Keep functions focused, readable, and reasonably small; reduce cognitive complexity instead of adding deeply nested branching.
- Avoid duplicated code. Extract helpers only when they are genuinely reusable and fit an existing local module boundary.
- Avoid dead code, unused exports, unreachable branches, and unnecessary comments.
- Prefer explicit error handling and clear control flow over broad catches or silent fallbacks.
- Keep meaningful unit tests with changed behavior so coverage remains useful.
- If a change is likely to affect maintainability, coverage, or static-analysis results, mention the risk and the relevant validation command in the plan or final summary.

## Verification

Run the narrowest checks that prove the change. For implementation work, prefer:

```bash
rtk npm test
rtk npm run lint
rtk npm run lint:architecture
```

For production, build, env, Docker, or Temporal worker-impacting changes, also run:

```bash
rtk npm run build
```

If `rtk` is not available, run the same commands without the `rtk` prefix.

## Git Safety

- Check the working tree before editing.
- Do not revert or overwrite unrelated user changes.
- Do not use destructive git commands unless the user explicitly asks for them.
- Commit messages should follow Conventional Commits, for example `feat(workflows): add order dispatch workflow`.
