import type { ActivityResult } from "@/domain/api-response";

export async function scheduledActivity(): Promise<ActivityResult<{ message: string }>> {
  return {
    success: true,
    data: {
      message: "This is a scheduled activity",
    },
  };
}
