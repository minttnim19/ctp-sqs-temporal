import { proxyActivities } from "@temporalio/workflow";
import type { Message } from "@commercetools/platform-sdk";

import type { ActivityResult } from "@/domain/api-response";
import type { ActivityTraceContext } from "@/temporal/activities/activity-trace-context";
import type * as activities from "@/temporal/activities/dummy.activities";

export async function DummyWorkflow(
  _message: Message,
  options: {
    retryAttempts?: number;
    retryDelayMs?: number;
    correlatorId?: string;
  } = {},
): Promise<ActivityResult<{ message: string }>> {
  const { dummyActivity } = proxyActivities<typeof activities>({
    startToCloseTimeout: "10 minutes",
    retry: {
      maximumAttempts: options.retryAttempts ?? 3,
      initialInterval: `${options.retryDelayMs ?? 5000}ms`,
    },
  });

  const traceContext: ActivityTraceContext | undefined = options.correlatorId
    ? { correlatorId: options.correlatorId }
    : undefined;
  return dummyActivity(traceContext);
}
