import { Hono } from 'hono';
import { redis } from '@devvit/web/server';

export const api = new Hono();

const AGENTS_KEY = 'automod:agents';

// Get all configured agents
api.get('/agents', async (c) => {
  try {
    const agentsStr = await redis.get(AGENTS_KEY);
    const agents = agentsStr ? JSON.parse(agentsStr) : [];
    return c.json({ agents });
  } catch (err) {
    console.error('Error fetching agents:', err);
    return c.json({ agents: [], error: 'Failed to load agents' }, 500);
  }
});

// Save agents list
api.post('/agents', async (c) => {
  try {
    const body = await c.req.json();
    if (body.agents && Array.isArray(body.agents)) {
      await redis.set(AGENTS_KEY, JSON.stringify(body.agents));
    }
    return c.json({ success: true });
  } catch (err) {
    console.error('Error saving agents:', err);
    return c.json({ success: false, error: 'Failed to save agents' }, 500);
  }
});
