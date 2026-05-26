export type ActivityError = {
  code: string;
  message: string;
  timestamp?: string;
  details?: unknown;
};

export type ActivityResult<T> =
  | {
      success: true;
      data: T;
      error?: never;
    }
  | {
      success: false;
      data?: never;
      error: ActivityError;
    };
