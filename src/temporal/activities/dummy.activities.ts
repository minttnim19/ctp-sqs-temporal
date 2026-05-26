import type { ActivityResult } from "@/domain/api-response";

export async function dummyActivity(): Promise<ActivityResult<{ message: string }>> {
  return {
    success: true,
    data: {
      message: "This is a dummy activity",
    },
  };
}
