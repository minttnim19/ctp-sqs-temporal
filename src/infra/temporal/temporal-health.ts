import { getTemporalConnection } from "@/infra/temporal/temporal-client";
import { logger } from "@/infra/logger/col-logger";

const TEMPORAL_WORKFLOW_SERVICE = "temporal.api.workflowservice.v1.WorkflowService";
const SERVING_STATUS = 1; // grpc.health.v1.HealthCheckResponse.ServingStatus.SERVING

export async function checkTemporalHealth(): Promise<{
  ok: boolean;
  status?: string;
  error?: string;
}> {
  try {
    const connection = await getTemporalConnection();
    const response = await connection.healthService.check({
      service: TEMPORAL_WORKFLOW_SERVICE,
    });
    const serving = response.status === SERVING_STATUS;
    return {
      ok: serving,
      status: serving ? "serving" : `status_${response.status}`,
    };
  } catch (err) {
    logger.warn({ err }, "Temporal health check failed");
    return { ok: false, error: "health_check_failed" };
  }
}
