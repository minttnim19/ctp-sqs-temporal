import type { AppLogger, AppLoggerFactory, AppLogFields } from "@/application/ports/app-logger";
import { createLogModel } from "@/infra/logger/col-logger";

class ColAppLogger implements AppLogger {
  constructor(private readonly logModel: ReturnType<typeof createLogModel>) {}

  logStep(message: string, fields: AppLogFields): void {
    this.logModel.logStep(message, fields);
  }
}

export class ColAppLoggerFactory implements AppLoggerFactory {
  createLogger(context: { txid: string }): AppLogger {
    return new ColAppLogger(createLogModel({ txid: context.txid }));
  }
}
