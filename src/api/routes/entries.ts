import { Router } from 'express';
import { EntryController } from '../controllers/entry-controller';

export function entryRoutes(controller: EntryController): Router {
  const router = Router();

  router.get('/editions', controller.listEditions);
  router.get('/editions/:edition/languages', controller.listLanguages);
  router.get('/editions/:edition/languages/:lang/entries', controller.listEntries);
  router.get('/editions/:edition/languages/:lang/entries/:lemma', controller.getEntry);
  router.get('/search', controller.search);

  return router;
}
