import { Request, Response, NextFunction } from 'express';
import { EntryService } from '../services/entry-service';
import { ValidationError } from '../../lib/errors';

export class EntryController {
  constructor(private service: EntryService) {}

  getByLemma = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { lemma } = req.params;
      const lang = (req.query.lang as string) || 'fr';
      const pos = req.query.pos as string | undefined;

      const results = await this.service.getByLemma(lemma, lang, pos);
      res.json({ lemma, results });
    } catch (err) {
      next(err);
    }
  };

  search = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const q = req.query.q as string;
      if (!q) throw new ValidationError('Query parameter "q" is required');

      const lang = req.query.lang as string | undefined;
      const pos = req.query.pos as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const results = await this.service.search(q, lang, pos, limit, offset);
      res.json({ query: q, limit, offset, results });
    } catch (err) {
      next(err);
    }
  };
}
