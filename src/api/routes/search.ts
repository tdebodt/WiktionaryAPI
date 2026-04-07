import { Router } from 'express';
import { EntryController } from '../controllers/entry-controller';

export function searchRoutes(controller: EntryController): Router {
  const router = Router();
  router.get('/search', controller.search);
  return router;
}
