import { Hono } from 'hono';
import { redis } from '@devvit/web/server';

export const api = new Hono();

const FLOWS_KEY = 'automod:flows';

api.get('/flows', async (c) => {
  try {
    const raw = await redis.get(FLOWS_KEY);
    const flows = raw ? JSON.parse(raw) : [];
    return c.json({ flows });
  } catch (err) {
    console.error('Error fetching flows:', err);
    return c.json({ flows: [], error: 'Failed to load flows' }, 500);
  }
});

api.post('/flows', async (c) => {
  try {
    const body = await c.req.json();
    if (body.flows && Array.isArray(body.flows)) {
      await redis.set(FLOWS_KEY, JSON.stringify(body.flows));
    }
    return c.json({ success: true });
  } catch (err) {
    console.error('Error saving flows:', err);
    return c.json({ success: false, error: 'Failed to save flows' }, 500);
  }
});
