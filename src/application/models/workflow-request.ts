export type WorkflowRetryPolicy = {
  maximumAttempts: number;
  initialIntervalMs: number;
};

export type StartWorkflowRequest<TArgs extends unknown[] = unknown[]> = {
  workflowName: string;
  workflowId: string;
  taskQueue: string;
  args: TArgs;
  correlationId?: string;
  retryPolicy?: WorkflowRetryPolicy;
};
