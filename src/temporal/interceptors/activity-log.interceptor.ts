import type { ActivityInterceptorsFactory } from "@temporalio/worker";

import { createLogModel } from "@/infra/logger/col-logger";

type TraceContext = {
  correlatorId?: string;
};

export const activityLogInterceptor: ActivityInterceptorsFactory = (ctx) => ({
  inbound: {
    async execute(input, next) {
      const { activityType: activityName, workflowExecution } = ctx.info;
      const txid = extractCorrelatorId(input.args) ?? workflowExecution?.workflowId;
      const log = createLogModel({ txid });
      try {
        const result = await next(input);
        log.logStep(`Activity ${activityName} completed`, {
          activity_name: activityName,
          result_code: "200",
          step_request: { args: input.args },
          step_response: result,
        });

        return result;
      } catch (err) {
        log.logStep(`Activity ${activityName} failed`, {
          activity_name: activityName,
          error: err,
        });
        throw err;
      }
    },
  },
});

function extractCorrelatorId(args: unknown[]): string | undefined {
  for (const arg of args) {
    const correlatorId = pickCorrelatorId(arg);
    if (correlatorId) return correlatorId;
  }
  return undefined;
}

function pickCorrelatorId(value: unknown): string | undefined {
  if (!isPlainObject(value)) return undefined;
  return (value as TraceContext).correlatorId?.trim() || undefined;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
