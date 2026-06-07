import { proxyActivities } from "@temporalio/workflow";

import type { ActivityResult } from "@/domain/api-response";
import type * as activities from "@/temporal/activities/scheduled.activities";

export async function ScheduledJobWorkflow(
  _message: unknown,
  options: {
    retryAttempts?: number;
    retryDelayMs?: number;
    correlatorId?: string;
  } = {},
): Promise<ActivityResult<{ message: string }>> {
  const { scheduledActivity } = proxyActivities<typeof activities>({
    startToCloseTimeout: "10 minutes",
    retry: {
      maximumAttempts: options.retryAttempts ?? 3,
      initialInterval: `${options.retryDelayMs ?? 5000}ms`,
    },
  });

  return scheduledActivity();
}
