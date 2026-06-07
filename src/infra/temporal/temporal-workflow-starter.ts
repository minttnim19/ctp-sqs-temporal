import type { StartWorkflowRequest } from "@/application/models/workflow-request";
import type { WorkflowStarter } from "@/application/ports/workflow-starter";
import { getTemporalClient } from "@/infra/temporal/temporal-client";

export class TemporalWorkflowStarter implements WorkflowStarter {
  async startWorkflow<TArgs extends unknown[]>(
    request: StartWorkflowRequest<TArgs>,
  ): Promise<void> {
    const client = await getTemporalClient();
    await client.workflow.start(request.workflowName, {
      taskQueue: request.taskQueue,
      workflowId: request.workflowId,
      args: request.args,
    });
  }
}
