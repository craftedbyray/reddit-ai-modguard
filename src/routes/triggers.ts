import { Hono } from 'hono';
import type { OnAppInstallRequest, OnPostSubmitRequest, OnCommentSubmitRequest, TriggerResponse } from '@devvit/web/shared';
import { reddit, redis } from '@devvit/web/server';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();
  console.log('App installed to subreddit: r/' + input.subreddit?.name);

  return c.json<TriggerResponse>({ status: 'success' }, 200);
});

triggers.post('/on-post-submit', async (c) => {
  const event = await c.req.json<OnPostSubmitRequest>();
  console.log(`[AI Engine] New post submitted: ${event.post?.title}`);

  // TODO: Fetch AI Agents from Redis
  // TODO: Run LLM Inference
  // TODO: Execute moderation action
  
  return c.json<TriggerResponse>({ status: 'success' }, 200);
});

triggers.post('/on-comment-submit', async (c) => {
  const event = await c.req.json<OnCommentSubmitRequest>();
  console.log(`[AI Engine] New comment submitted: ${event.comment?.id}`);

  // TODO: Fetch AI Agents from Redis
  // TODO: Run LLM Inference
  // TODO: Execute moderation action

  return c.json<TriggerResponse>({ status: 'success' }, 200);
});
