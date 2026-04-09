import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { EntryController } from '../../../src/api/controllers/entry-controller';
import { EntryService } from '../../../src/api/services/entry-service';
import { entryRoutes } from '../../../src/api/routes/entries';
import { errorHandler } from '../../../src/api/middleware/error-handler';

function createTestApp(service: EntryService) {
  const app = express();
  app.use(express.json());
  const controller = new EntryController(service);
  app.use(entryRoutes(controller));
  app.use(errorHandler);
  return app;
}

function mockService(overrides: Partial<EntryService> = {}): EntryService {
  return {
    listEditions: vi.fn().mockResolvedValue(['en', 'fr', 'nl']),
    listLanguages: vi.fn().mockResolvedValue(['en', 'fr']),
    getEntries: vi.fn().mockResolvedValue({ results: [], hasMore: false }),
    getEntry: vi.fn().mockResolvedValue(null),
    search: vi.fn().mockResolvedValue({ results: [], hasMore: false }),
    ...overrides,
  } as unknown as EntryService;
}

describe('EntryController input validation', () => {
  let service: EntryService;
  let app: express.Application;

  beforeEach(() => {
    service = mockService();
    app = createTestApp(service);
  });

  describe('listEntries param validation', () => {
    it('rejects negative limit', async () => {
      const res = await request(app).get('/editions/en/languages/en/entries?limit=-1');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects negative offset', async () => {
      const res = await request(app).get('/editions/en/languages/en/entries?offset=-5');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects limit over 100', async () => {
      const res = await request(app).get('/editions/en/languages/en/entries?limit=200');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('rejects non-numeric limit', async () => {
      const res = await request(app).get('/editions/en/languages/en/entries?limit=abc');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('accepts valid limit and offset', async () => {
      const res = await request(app).get('/editions/en/languages/en/entries?limit=50&offset=10');
      expect(res.status).toBe(200);
    });

    it('uses defaults when limit/offset omitted', async () => {
      const res = await request(app).get('/editions/en/languages/en/entries');
      expect(res.status).toBe(200);
      expect(res.body.meta.limit).toBe(20);
      expect(res.body.meta.offset).toBe(0);
    });

    it('rejects q longer than 200 characters', async () => {
      const longQ = 'a'.repeat(201);
      const res = await request(app).get(`/editions/en/languages/en/entries?q=${longQ}`);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('edition/lang validation', () => {
    it('rejects invalid edition format', async () => {
      const res = await request(app).get('/editions/123/languages');
      expect(res.status).toBe(400);
    });

    it('rejects edition with special characters', async () => {
      const res = await request(app).get('/editions/en%27/languages');
      expect(res.status).toBe(400);
    });

    it('returns 404 for unknown edition', async () => {
      const res = await request(app).get('/editions/xx/languages');
      expect(res.status).toBe(404);
    });

    it('rejects invalid lang format on entries', async () => {
      const res = await request(app).get('/editions/en/languages/12345/entries');
      expect(res.status).toBe(400);
    });
  });

  describe('search validation', () => {
    it('returns 400 when q is missing', async () => {
      const res = await request(app).get('/search');
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when q is too long', async () => {
      const longQ = 'a'.repeat(201);
      const res = await request(app).get(`/search?q=${longQ}`);
      expect(res.status).toBe(400);
    });

    it('rejects negative offset on search', async () => {
      const res = await request(app).get('/search?q=test&offset=-1');
      expect(res.status).toBe(400);
    });

    it('accepts valid search params', async () => {
      const res = await request(app).get('/search?q=house&limit=10&offset=0');
      expect(res.status).toBe(200);
    });
  });

  describe('getEntry', () => {
    it('returns 404 for missing entry', async () => {
      const res = await request(app).get('/editions/en/languages/en/entries/nonexistent');
      expect(res.status).toBe(404);
    });

    it('returns entry when found', async () => {
      service = mockService({
        getEntry: vi.fn().mockResolvedValue({
          lemma: 'house',
          langCode: 'en',
          langName: 'English',
          sourceEdition: 'en',
          formOf: [],
          lexemes: [{ pos: 'noun', etymologyIndex: 0, forms: [], senses: [] }],
        }),
      });
      app = createTestApp(service);

      const res = await request(app).get('/editions/en/languages/en/entries/house');
      expect(res.status).toBe(200);
      expect(res.body.lemma).toBe('house');
      expect(res.headers['vary']).toContain('Accept');
    });
  });

  describe('cache headers', () => {
    it('sets public max-age=3600 on editions', async () => {
      const res = await request(app).get('/editions');
      expect(res.headers['cache-control']).toBe('public, max-age=3600');
    });

    it('sets public max-age=60 on search', async () => {
      const res = await request(app).get('/search?q=test');
      expect(res.headers['cache-control']).toBe('public, max-age=60');
    });

    it('sets public max-age=86400 on singleton entry', async () => {
      service = mockService({
        getEntry: vi.fn().mockResolvedValue({
          lemma: 'test',
          langCode: 'en',
          langName: 'English',
          sourceEdition: 'en',
          formOf: [],
          lexemes: [],
        }),
      });
      app = createTestApp(service);
      const res = await request(app).get('/editions/en/languages/en/entries/test');
      expect(res.headers['cache-control']).toBe('public, max-age=86400');
    });
  });
});
