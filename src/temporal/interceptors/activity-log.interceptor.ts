import type { ActivityInterceptorsFactory } from "@temporalio/worker";

import { createLogModel, type LogModel } from "@/infra/logger/col-logger";
import { getNonEmptyString, isPlainObject } from "@/utils/object";

export const activityLogInterceptor: ActivityInterceptorsFactory = (ctx) => ({
  inbound: {
    async execute(input, next) {
      const activityName = ctx.info.activityType;
      const txid = extractCorrelatorId(input.args) ?? ctx.info.workflowExecution?.workflowId;
      const log = createLogModel({ txid });

      try {
        const result = await next(input);
        logSuccess(log, activityName, input.args, result);
        return result;
      } catch (err) {
        logFailure(log, activityName, input.args, err);
        throw err;
      }
    },
  },
});

function logSuccess(log: LogModel, activityName: string, args: unknown[], result: unknown) {
  log.logStep(`Activity ${activityName} completed`, {
    activity_name: activityName,
    result_code: "200",
    step_request: { args },
    step_response: result,
  });
}

function logFailure(log: LogModel, activityName: string, args: unknown[], err: unknown) {
  const message = `Activity ${activityName} failed`;

  if (isHttpClientError(err)) {
    log.logStep(message, { activity_name: activityName, error: err });
    return;
  }

  log.logStep(message, {
    activity_name: activityName,
    error: err,
    step_request: { args },
    step_response: getFailureStepResponse(err),
  });
}

function extractCorrelatorId(args: unknown[]): string | undefined {
  for (const arg of args) {
    if (!isPlainObject(arg)) continue;
    const id = getNonEmptyString(arg["correlatorId"])?.trim();
    if (id) return id;
  }
  return undefined;
}

function isHttpClientError(err: unknown): boolean {
  return isPlainObject(err) && err["isAxiosError"] === true;
}

function getFailureStepResponse(err: unknown): unknown {
  return isApplicationFailure(err) ? formatApplicationFailure(err) : err;
}

function isApplicationFailure(err: unknown): err is Record<string, unknown> {
  return isPlainObject(err) && err["name"] === "ApplicationFailure";
}

function formatApplicationFailure(err: Record<string, unknown>): unknown {
  return {
    name: getNonEmptyString(err["name"]),
    message: getNonEmptyString(err["message"]),
    type: getNonEmptyString(err["type"]),
    nonRetryable: err["nonRetryable"] === true,
    details: Array.isArray(err["details"]) ? err["details"] : undefined,
  };
}
