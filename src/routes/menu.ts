import { Hono } from 'hono';
import type { MenuItemRequest, UiResponse } from '@devvit/web/shared';
import type { FormField } from '@devvit/shared-types/shared/form.js';
import { reddit } from '@devvit/web/server';

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
