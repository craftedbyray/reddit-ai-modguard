import { Hono } from 'hono';
import { redis, reddit, context } from '@devvit/web/server';

export const api = new Hono();

// ── Auth ──────────────────────────────────────────────────────────────────────

api.get('/auth', async (c) => {
  try {
    const userId = context.userId;
    const subredditName = context.subredditName;
    console.log('[auth] userId:', userId, 'subreddit:', subredditName);
    if (!userId || !subredditName) {
      console.log('[auth] DENIED — missing context');
      return c.json({ isModerator: false });
    }
    const cacheKey = `auth:mod:${userId}:${subredditName}`;
    const cached = await redis.get(cacheKey);
    console.log('[auth] cache hit:', cached);
    if (cached === '1' || cached === '0') {
      console.log('[auth] returning cached:', cached === '1');
      return c.json({ isModerator: cached === '1' });
    }
    const mods = await reddit.getModerators({ subredditName }).all();
    const isMod = mods.some((m: { id: string }) => m.id === userId);
    console.log('[auth] fresh check isMod:', isMod, 'mod count:', mods.length);
    await redis.set(cacheKey, isMod ? '1' : '0');
    await redis.expire(cacheKey, 300);
    return c.json({ isModerator: isMod });
  } catch (err) {
    console.error('[auth] EXCEPTION:', err);
    return c.json({ isModerator: false });
  }
});

const FLOWS_KEY = 'automod:flows';
const STRIKES_LABELS_KEY = 'strike:_labels';
const strikeKey = (label: string) => `strike:${label}`;
const STRIKE_LABEL_REGEX = /^[a-z0-9_-]{1,30}$/;

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

// ── Strikes ──────────────────────────────────────────────────────────────────

api.get('/strikes/labels', async (c) => {
  try {
    const res = await redis.zRange(STRIKES_LABELS_KEY, 0, -1);
    const labels = res.map((m: { member: string }) => m.member);
    const counts = await Promise.all(labels.map(l => redis.zCard(strikeKey(l))));
    return c.json({
      labels: labels.map((name, i) => ({ name, userCount: counts[i] ?? 0 })),
    });
  } catch (err) {
    console.error('Error fetching strike labels:', err);
    return c.json({ labels: [], error: 'Failed to load labels' }, 500);
  }
});

api.post('/strikes/labels', async (c) => {
  try {
    const body = await c.req.json<{ name?: string }>();
    const name = (body.name ?? '').trim();
    if (!STRIKE_LABEL_REGEX.test(name)) {
      return c.json({ success: false, error: 'Invalid label (use a-z, 0-9, _, -; max 30 chars)' }, 400);
    }
    await redis.zAdd(STRIKES_LABELS_KEY, { member: name, score: Date.now() });
    return c.json({ success: true });
  } catch (err) {
    console.error('Error creating strike label:', err);
    return c.json({ success: false, error: 'Failed to create label' }, 500);
  }
});

api.get('/strikes/:label/ranking', async (c) => {
  try {
    const label = c.req.param('label');
    if (!STRIKE_LABEL_REGEX.test(label)) {
      return c.json({ ranking: [], error: 'Invalid label' }, 400);
    }
    const top = await redis.zRange(strikeKey(label), 0, 49, { by: 'rank', reverse: true });
    return c.json({
      ranking: top.map((m: { member: string; score: number }) => ({
        username: m.member,
        score: m.score,
      })),
    });
  } catch (err) {
    console.error('Error fetching strike ranking:', err);
    return c.json({ ranking: [], error: 'Failed to load ranking' }, 500);
  }
});

api.delete('/strikes/:label', async (c) => {
  try {
    const label = c.req.param('label');
    if (!STRIKE_LABEL_REGEX.test(label)) {
      return c.json({ success: false, error: 'Invalid label' }, 400);
    }
    await redis.del(strikeKey(label));
    await redis.zRem(STRIKES_LABELS_KEY, [label]);
    return c.json({ success: true });
  } catch (err) {
    console.error('Error deleting strike label:', err);
    return c.json({ success: false, error: 'Failed to delete label' }, 500);
  }
});

api.delete('/strikes/:label/users/:user', async (c) => {
  try {
    const label = c.req.param('label');
    const user = c.req.param('user');
    if (!STRIKE_LABEL_REGEX.test(label)) {
      return c.json({ success: false, error: 'Invalid label' }, 400);
    }
    await redis.zRem(strikeKey(label), [user]);
    return c.json({ success: true });
  } catch (err) {
    console.error('Error resetting user strikes:', err);
    return c.json({ success: false, error: 'Failed to reset' }, 500);
  }
});

// ── Mod Log ───────────────────────────────────────────────────────────────────

const MOD_LOG_KEY = 'modlog';
const LOG_PAGE_SIZE = 50;

api.get('/modlog', async (c) => {
  try {
    const page = Math.max(0, parseInt(c.req.query('page') ?? '0') || 0);
    const offset = page * LOG_PAGE_SIZE;
    const raw = await redis.zRange(MOD_LOG_KEY, offset, offset + LOG_PAGE_SIZE, { by: 'rank', reverse: true });
    const hasMore = raw.length > LOG_PAGE_SIZE;
    const slice = (hasMore ? raw.slice(0, LOG_PAGE_SIZE) : raw) as { member: string; score: number }[];
    const entries = slice
      .map((item) => {
        try {
          const entry = JSON.parse(item.member);
          // normalize old single-action format
          if (!Array.isArray(entry.actions)) {
            entry.actions = entry.action != null ? [entry.action] : [];
          }
          return entry;
        } catch { return null; }
      })
      .filter(Boolean);
    return c.json({ entries, page, hasMore });
  } catch (err) {
    console.error('Error fetching mod log:', err);
    return c.json({ entries: [], page: 0, hasMore: false, error: 'Failed to load log' }, 500);
  }
});
