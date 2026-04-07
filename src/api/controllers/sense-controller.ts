import { Request, Response, NextFunction } from 'express';
import { EntryService } from '../services/entry-service';
import { ValidationError } from '../../lib/errors';

export class SenseController {
  constructor(private service: EntryService) {}

  getById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) throw new ValidationError('Invalid sense ID');

      const result = await this.service.getSenseById(id);
      res.json(result);
    } catch (err) {
      next(err);
    }
  };
}
