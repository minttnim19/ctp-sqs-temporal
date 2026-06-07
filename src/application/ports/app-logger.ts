export type AppLogFields = {
  activity_name: string;
  [key: string]: unknown;
};

export interface AppLogger {
  logStep(message: string, fields: AppLogFields): void;
}

export interface AppLoggerFactory {
  createLogger(context: { txid: string }): AppLogger;
}
