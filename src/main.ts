import { bootstrap } from "@/infra/composition/bootstrap";
import { logger } from "@/infra/logger/col-logger";

bootstrap().catch((err) => {
  logger.error(err);
  process.exit(1);
});
