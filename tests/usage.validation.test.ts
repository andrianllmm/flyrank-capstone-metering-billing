import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { app } from '../src/app.ts';

describe('GET /usage validation', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(app).get('/usage');
    expect(res.status).toBe(401);
  });

  it('rejects an unknown API key', async () => {
    const res = await request(app).get('/usage').set('Authorization', 'Bearer does-not-exist');
    expect(res.status).toBe(401);
  });
});
