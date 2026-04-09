import express from 'express';
import { Pool } from 'pg';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { healthRoutes } from './routes/health';
import { entryRoutes } from './routes/entries';
import { EntryController } from './controllers/entry-controller';
import { EntryService } from './services/entry-service';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';
import { config } from '../lib/config';

export function createApp(pool: Pool): express.Application {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: config.corsOrigin }));
  app.use(compression());
  app.use(rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  }));
  app.use(express.json());
  app.use(requestLogger);

  const entryService = new EntryService(pool);
  const entryController = new EntryController(entryService);

  app.use(healthRoutes());
  app.use(entryRoutes(entryController));

  app.use(errorHandler);

  return app;
}
