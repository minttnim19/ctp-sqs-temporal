import type { StartWorkflowRequest } from "@/application/models/workflow-request";

export interface WorkflowStarter {
  startWorkflow<TArgs extends unknown[]>(request: StartWorkflowRequest<TArgs>): Promise<void>;
}
