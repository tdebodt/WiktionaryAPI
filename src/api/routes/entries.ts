import { Router, RequestHandler } from 'express';
import { EntryController } from '../controllers/entry-controller';

function cacheControl(value: string): RequestHandler {
  return (_req, res, next) => {
    res.set('Cache-Control', value);
    next();
  };
}

export function entryRoutes(controller: EntryController): Router {
  const router = Router();

  const stable = cacheControl('public, max-age=3600');
  const immutable = cacheControl('public, max-age=86400');
  const short = cacheControl('public, max-age=60');

  router.get('/editions', stable, controller.listEditions);
  router.get('/editions/:edition/languages', stable, controller.listLanguages);
  router.get('/editions/:edition/languages/:lang/entries', short, controller.listEntries);
  router.get('/editions/:edition/languages/:lang/entries/:lemma', immutable, controller.getEntry);
  router.get('/search', short, controller.search);

  return router;
}
