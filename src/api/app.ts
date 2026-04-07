import express from 'express';
import { Pool } from 'pg';
import { healthRoutes } from './routes/health';
import { entryRoutes } from './routes/entries';
import { searchRoutes } from './routes/search';
import { senseRoutes } from './routes/senses';
import { EntryController } from './controllers/entry-controller';
import { SenseController } from './controllers/sense-controller';
import { EntryService } from './services/entry-service';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';

export function createApp(pool: Pool): express.Application {
  const app = express();

  app.use(express.json());
  app.use(requestLogger);

  const entryService = new EntryService(pool);
  const entryController = new EntryController(entryService);
  const senseController = new SenseController(entryService);

  app.use(healthRoutes());
  app.use(entryRoutes(entryController));
  app.use(searchRoutes(entryController));
  app.use(senseRoutes(senseController));

  app.use(errorHandler);

  return app;
}
