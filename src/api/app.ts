import express from 'express';
import { Pool } from 'pg';
import { healthRoutes } from './routes/health';
import { entryRoutes } from './routes/entries';
import { EntryController } from './controllers/entry-controller';
import { EntryService } from './services/entry-service';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';

export function createApp(pool: Pool): express.Application {
  const app = express();

  app.use(express.json());
  app.use((_req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });
  app.use(requestLogger);

  const entryService = new EntryService(pool);
  const entryController = new EntryController(entryService);

  app.use(healthRoutes());
  app.use(entryRoutes(entryController));

  app.use(errorHandler);

  return app;
}
