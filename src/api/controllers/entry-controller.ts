import { Request, Response, NextFunction } from 'express';
import { EntryService, DictionaryEntry } from '../services/entry-service';
import { ValidationError, NotFoundError } from '../../lib/errors';
import { config } from '../../lib/config';
import { toSkosTurtle } from '../serializers/skos-turtle';

function getBaseUrl(req: Request): string {
  if (config.baseUrl) return config.baseUrl.replace(/\/$/, '');
  const proto = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  return `${proto}://${host}`;
}

function buildHref(req: Request, path: string, query?: Record<string, string | number>): string {
  const base = `${getBaseUrl(req)}${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null) params.set(k, String(v));
  }
  return `${base}?${params.toString()}`;
}

function entryPath(edition: string, lang: string, lemma: string): string {
  return `/editions/${edition}/languages/${lang}/entries/${encodeURIComponent(lemma)}`;
}

function withHref(req: Request, entry: DictionaryEntry) {
  const href = buildHref(req, entryPath(entry.sourceEdition, entry.langCode, entry.lemma));

  const formOf = entry.formOf.map((f) => ({
    ...f,
    href: buildHref(req, entryPath(entry.sourceEdition, entry.langCode, f.lemma)),
  }));

  const lexemes = entry.lexemes.map((lex) => ({
    ...lex,
    forms: lex.forms.map((f) => ({
      ...f,
      href: buildHref(req, entryPath(entry.sourceEdition, entry.langCode, f.form)),
    })),
  }));

  return { href, ...entry, formOf, lexemes };
}

export class EntryController {
  constructor(private service: EntryService) {}

  listEditions = async (
    _req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const editions = await this.service.listEditions();
      res.json({ editions });
    } catch (err) {
      next(err);
    }
  };

  listLanguages = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { edition } = req.params;
      const languages = await this.service.listLanguages(edition);
      res.json({ languages });
    } catch (err) {
      next(err);
    }
  };

  listEntries = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { edition, lang } = req.params;
      const lemma = req.query.lemma as string | undefined;
      const q = req.query.q as string | undefined;
      const pos = req.query.pos as string | undefined;

      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const { results, hasMore } = await this.service.getEntries(edition, lang, lemma, q, pos, limit, offset);

      const basePath = req.path;
      const baseQuery: Record<string, string | number> = {};
      if (q) baseQuery.q = q;
      if (lemma) baseQuery.lemma = lemma;
      if (pos) baseQuery.pos = pos;
      baseQuery.limit = limit;

      const self = buildHref(req, basePath, { ...baseQuery, offset });
      const next = hasMore ? buildHref(req, basePath, { ...baseQuery, offset: offset + limit }) : null;
      const prev = offset > 0 ? buildHref(req, basePath, { ...baseQuery, offset: Math.max(0, offset - limit) }) : null;
      const start = buildHref(req, basePath, { ...baseQuery });

      res.json({
        meta: { limit, offset },
        links: { self, next, prev, start },
        results: results.map((r) => withHref(req, r)),
      });
    } catch (err) {
      next(err);
    }
  };

  getEntry = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { edition, lang, lemma } = req.params;
      const result = await this.service.getEntry(edition, lang, decodeURIComponent(lemma));
      if (!result) throw new NotFoundError(`Entry not found: ${lemma}`);

      if (req.query.skos !== undefined) {
        const turtle = toSkosTurtle(result, getBaseUrl(req));
        res.set('Content-Type', 'text/turtle; charset=utf-8');
        res.send(turtle);
        return;
      }

      res.json(withHref(req, result));
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

      const edition = req.query.edition as string | undefined;
      const lang = req.query.lang as string | undefined;
      const pos = req.query.pos as string | undefined;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const { results, hasMore } = await this.service.search(q, edition, lang, pos, limit, offset);

      const baseQuery: Record<string, string | number> = { q };
      if (edition) baseQuery.edition = edition;
      if (lang) baseQuery.lang = lang;
      if (pos) baseQuery.pos = pos;
      baseQuery.limit = limit;

      const self = buildHref(req, '/search', { ...baseQuery, offset });
      const next = hasMore ? buildHref(req, '/search', { ...baseQuery, offset: offset + limit }) : null;
      const prev = offset > 0 ? buildHref(req, '/search', { ...baseQuery, offset: Math.max(0, offset - limit) }) : null;
      const start = buildHref(req, '/search', { ...baseQuery });

      res.json({
        meta: { limit, offset },
        links: { self, next, prev, start },
        results: results.map((r) => withHref(req, r)),
      });
    } catch (err) {
      next(err);
    }
  };
}
