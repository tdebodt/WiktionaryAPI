import { Router } from 'express';
import { EntryController } from '../controllers/entry-controller';

export function entryRoutes(controller: EntryController): Router {
  const router = Router();
  router.get('/entries/:lemma', controller.getByLemma);
  return router;
}
