import { describe, it, expect } from 'vitest';
import request from 'supertest';
import express from 'express';
import { healthRoutes } from '../../src/api/routes/health';

describe('GET /health', () => {
  const app = express();
  app.use(healthRoutes());

  it('returns 200 with status ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.timestamp).toBeDefined();
  });
});
