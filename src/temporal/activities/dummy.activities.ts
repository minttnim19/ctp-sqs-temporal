import type { ActivityResult } from "@/domain/api-response";
import type { ActivityTraceContext } from "@/temporal/activities/activity-trace-context";

export async function dummyActivity(
  _trace?: ActivityTraceContext,
): Promise<ActivityResult<{ message: string }>> {
  return {
    success: true,
    data: {
      message: "This is a dummy activity",
    },
  };
}
