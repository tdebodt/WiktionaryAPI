import { Router } from 'express';
import { SenseController } from '../controllers/sense-controller';

export function senseRoutes(controller: SenseController): Router {
  const router = Router();
  router.get('/senses/:id', controller.getById);
  return router;
}
