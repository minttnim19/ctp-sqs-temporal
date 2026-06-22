import type { ActivityResult } from "@/domain/api-response";
import type { ActivityTraceContext } from "@/temporal/activities/activity-trace-context";

export async function scheduledActivity(
  _trace?: ActivityTraceContext,
): Promise<ActivityResult<{ message: string }>> {
  return {
    success: true,
    data: {
      message: "This is a scheduled activity",
    },
  };
}
