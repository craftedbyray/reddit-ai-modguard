import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { FormField } from '@devvit/shared-types/shared/form.js';
import { reddit, redis } from '@devvit/web/server';
import { API_KEY_REDIS_KEY } from '../core/settings';

export const menu = new Hono();

const buildNukeFields = (targetId: string): FormField[] => [
  {
    name: 'targetId',
    label: 'Target ID',
    type: 'string',
    helpText: 'Auto-filled from the selected item.',
    required: true,
    defaultValue: targetId,
  },
  {
    name: 'remove',
    label: 'Remove comments',
    type: 'boolean',
    defaultValue: true,
  },
  {
    name: 'lock',
    label: 'Lock comments',
    type: 'boolean',
    defaultValue: false,
  },
  {
    name: 'skipDistinguished',
    label: 'Skip distinguished comments',
    type: 'boolean',
    defaultValue: false,
  },
];

const buildNukeForm = (title: string, targetId: string) => ({
  fields: buildNukeFields(targetId),
  title,
  acceptLabel: 'Mop',
  cancelLabel: 'Cancel',
});

menu.post('/mop-comment', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  console.log('request', request.targetId);
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'mopComment',
        form: buildNukeForm('Mop Comments', request.targetId),
      },
    },
    200
  );
});

menu.post('/mop-post', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'mopPost',
        form: buildNukeForm('Mop Post Comments', request.targetId),
      },
    },
    200
  );
});

menu.post('/manage-api-key', async (c) => {
  const existing = await redis.get(API_KEY_REDIS_KEY);
  const isConfigured = Boolean(existing && existing.trim());
  const fields: FormField[] = [
    {
      name: 'newKey',
      label: isConfigured ? 'New API Key (replaces current)' : 'API Key',
      type: 'string',
      isSecret: true,
      scope: 'app',
      required: false,
      helpText:
        "Input is masked. Leave empty and check 'Remove' below to delete the current key.",
      placeholder: 'sk-...',
    },
    {
      name: 'remove',
      label: 'Remove existing API key',
      type: 'boolean',
      defaultValue: false,
      helpText: 'If checked, the stored key is deleted and any value typed above is ignored.',
    },
  ];
  return c.json<UiResponse>(
    {
      showForm: {
        name: 'manageApiKey',
        form: {
          fields,
          title: isConfigured ? 'Manage API Key (currently configured)' : 'Set API Key',
          acceptLabel: 'Save',
          cancelLabel: 'Cancel',
        },
      },
    },
    200
  );
});

menu.post('/manage-agents', async (c) => {
  const request = await c.req.json<MenuItemRequest>();
  try {
    const subreddit = await reddit.getSubredditInfoById(request.targetId as `t5_${string}`);
    
    const post = await reddit.submitCustomPost({
      // We pass the subreddit name as fetched from the targetId
      subredditName: subreddit.name as string, 
      title: 'Multi-Agent Mod Dashboard [MOD ONLY]',
      entry: 'default',
    });

    // 大屏创建后，立即删除并锁定！
    // 这样普通用户就看不到它了，但版主依然可以通过直达链接进去。
    await post.remove(true); 
    await post.lock();

    return c.json<UiResponse>(
      {
        showToast: {
          text: 'Dashboard created! Taking you there...',
          appearance: 'success',
        },
        navigateTo: post.url
      },
      200
    );
  } catch (error: unknown) {
    console.error('Failed to create dashboard post', error);
    return c.json<UiResponse>(
      {
        showToast: {
          text: `Failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        },
      },
      200
    );
  }
});
