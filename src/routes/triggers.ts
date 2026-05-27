import { Hono } from 'hono';
import type {
  OnAppInstallRequest,
  OnPostSubmitRequest,
  OnCommentSubmitRequest,
  TriggerResponse,
} from '@devvit/web/shared';
import { reddit, redis } from '@devvit/web/server';
import { getAgentConfig } from '../core/settings';
import type { T1, T3 } from '@devvit/shared-types/tid.js';

export const triggers = new Hono();

const FLOWS_KEY = 'automod:flows';

// ── Types (mirrored from client, no import to keep server bundle clean) ───────

type ActionType =
  | 'remove'
  | 'spam'
  | 'filter'
  | 'lock'
  | 'approve'
  | 'flair'
  | 'warn'
  | 'ban'
  | 'mute';
type ScopeType = 'post' | 'comment' | 'both';

type CheckMode = 'llm' | 'strike';
type CompareOp = '>=' | '>' | '<=' | '<' | '==';
interface CheckNodeData {
  label: string;
  mode?: CheckMode;
  prompt?: string;
  strikeLabel?: string;
  threshold?: number;
  operator?: CompareOp;
}
interface ActionNodeData {
  action: ActionType;
  label: string;
  flairText?: string;
  warnMessage?: string;
  banDuration?: number;
  strikeLabel?: string;
}

const STRIKES_LABELS_KEY = 'strike:_labels';
const strikeKey = (label: string) => `strike:${label}`;
const STRIKE_LABEL_REGEX = /^[a-z0-9_-]{1,30}$/;
const MOD_LOG_KEY = 'modlog';

function compareScore(
  score: number,
  op: CompareOp | undefined,
  threshold: number | undefined
): boolean {
  const t = threshold ?? 0;
  switch (op ?? '>=') {
    case '>=':
      return score >= t;
    case '>':
      return score > t;
    case '<=':
      return score <= t;
    case '<':
      return score < t;
    case '==':
      return score === t;
  }
}
interface RFNode {
  id: string;
  type: 'check' | 'action';
  position: { x: number; y: number };
  data: CheckNodeData | ActionNodeData;
}
interface RFEdge {
  id: string;
  source: string;
  sourceHandle: 'yes' | 'no' | 'next';
  target: string;
}
interface ModerationFlow {
  id: string;
  name: string;
  scope: ScopeType;
  isActive: boolean;
  nodes: RFNode[];
  edges: RFEdge[];
}

// ── LLM call ─────────────────────────────────────────────────────────────────

interface LLMVerdict {
  violation: boolean;
  reason: string;
}

async function callLLM(
  apiKey: string,
  baseUrl: string,
  modelName: string,
  prompt: string,
  content: string
): Promise<LLMVerdict> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: modelName,
      temperature: 0,
      max_tokens: 500,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a content classifier. Your job is to evaluate user-generated content against a moderation rule and respond with structured JSON. You are not endorsing or producing the content — you are analyzing it for a moderation system.\n\nRule:\n${prompt}\n\nRespond ONLY with valid JSON: {"violation": true, "reason": "brief explanation"} or {"violation": false, "reason": "brief explanation"}. Reason must be under 20 words.`,
        },
        { role: 'user', content: `Content to classify:\n\n${content}` },
      ],
    }),
  });
  const rawBody = await res.text();
  console.log(`[LLM] status=${res.status} rawResponse=${rawBody}`);
  if (!res.ok) throw new Error(`LLM API ${res.status}: ${rawBody}`);
  const data = JSON.parse(rawBody) as {
    choices: { message: { content: string }; finish_reason?: string }[];
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  const finishReason = data.choices?.[0]?.finish_reason;
  console.log(
    `[LLM] finish_reason=${finishReason} content=${JSON.stringify(text)}`
  );
  const match = text.match(/\{[\s\S]*\}/);
  if (!match)
    throw new Error(
      `No JSON in LLM response (finish_reason=${finishReason}): ${text}`
    );
  return JSON.parse(match[0]) as LLMVerdict;
}

// ── DAG traversal ─────────────────────────────────────────────────────────────

async function traverseFlow(
  flow: ModerationFlow,
  content: string,
  config: { apiKey: string; baseUrl: string; modelName: string },
  context: {
    postId?: T3;
    commentId?: T1;
    subredditName: string;
    authorName?: string;
    postTitle?: string;
    postBody?: string;
  }
): Promise<void> {
  const log = {
    _id: Math.random().toString(36).slice(2, 7),
    ts: Date.now(),
    author: context.authorName ?? 'unknown',
    preview: content.slice(0, 120).replace(/\n/g, ' '),
    flowId: flow.id,
    flowName: flow.name,
    violation: false,
    reason: '',
    actions: [] as string[],
    contentType: (context.commentId ? 'comment' : 'post') as 'post' | 'comment',
  };

  try {
    const nodeMap = new Map(flow.nodes.map((n) => [n.id, n]));

    // Find root: node with no incoming edges
    const hasIncoming = new Set(flow.edges.map((e) => e.target));
    const root = flow.nodes.find((n) => !hasIncoming.has(n.id));
    if (!root) {
      console.warn(`[${flow.name}] No root node found`);
      return;
    }

    let current: RFNode | undefined = root;
    let depth = 0;
    let lastReason = '';

    while (current && depth < 20) {
      depth++;

      if (current.type === 'action') {
        const actionData = current.data as ActionNodeData;
        log.actions.push(actionData.action);
        await executeAction(actionData, context, lastReason);
        const nextEdge = flow.edges.find(
          (e) => e.source === current!.id && e.sourceHandle === 'next'
        );
        if (!nextEdge) return;
        current = nodeMap.get(nextEdge.target);
        continue;
      }

      // Check node: route by mode
      const data = current.data as CheckNodeData;
      const mode: CheckMode = data.mode ?? 'llm';

      let passed: boolean;

      if (mode === 'strike') {
        const slabel = (data.strikeLabel ?? '').trim();
        if (!slabel || !STRIKE_LABEL_REGEX.test(slabel)) {
          console.warn(
            `[${flow.name}] Strike check "${data.label}" has invalid label "${slabel}", skipping`
          );
          return;
        }
        const score = context.authorName
          ? ((await redis.zScore(strikeKey(slabel), context.authorName)) ?? 0)
          : 0;
        passed = compareScore(score, data.operator, data.threshold);
        console.log(
          `[${flow.name}] strike-check "${data.label}" (${slabel}): score=${score} ${data.operator ?? '>='} ${data.threshold ?? 0} → ${passed}`
        );
        lastReason = `User has ${score} ${slabel} strikes (threshold ${data.operator ?? '>='} ${data.threshold ?? 0})`;
        if (passed && !log.violation) {
          log.violation = true;
          log.reason = lastReason;
        }
      } else {
        if (!data.prompt?.trim()) {
          console.warn(
            `[${flow.name}] Node "${data.label}" has no prompt, skipping`
          );
          return;
        }
        let verdict: LLMVerdict;
        try {
          verdict = await callLLM(
            config.apiKey,
            config.baseUrl,
            config.modelName,
            data.prompt,
            content
          );
        } catch (err) {
          console.error(`[${flow.name}] LLM error at "${data.label}":`, err);
          return;
        }
        console.log(
          `[${flow.name}] "${data.label}": violation=${verdict.violation} — ${verdict.reason}`
        );
        lastReason = verdict.reason;
        passed = verdict.violation;
        if (passed && !log.violation) {
          log.violation = true;
          log.reason = verdict.reason;
        }
      }

      const handle: 'yes' | 'no' = passed ? 'yes' : 'no';
      const edge = flow.edges.find(
        (e) => e.source === current!.id && e.sourceHandle === handle
      );
      if (!edge) return; // dead end, no action

      current = nodeMap.get(edge.target);
    }
  } finally {
    try {
      await redis.zAdd(MOD_LOG_KEY, { member: JSON.stringify(log), score: log.ts });
      await redis.zRemRangeByScore(MOD_LOG_KEY, 0, Date.now() - 30 * 24 * 60 * 60 * 1000);
    } catch (err) {
      console.error('[modlog] Failed to write log entry:', err);
    }
  }
}

// ── Action executor ───────────────────────────────────────────────────────────

async function executeAction(
  data: ActionNodeData,
  ctx: {
    postId?: T3;
    commentId?: T1;
    subredditName: string;
    authorName?: string;
    postTitle?: string;
    postBody?: string;
  },
  reason: string
) {
  const thingId = ctx.commentId ?? ctx.postId;
  if (!thingId) return;
  const modNote = `[AI Mod] ${reason}`.slice(0, 100);

  console.log(`[Action] ${data.action} on ${thingId}`);

  try {
    switch (data.action) {
      case 'remove':
        await reddit.remove(thingId, false);
        await addRemovalNote(ctx, modNote);
        break;

      case 'spam':
        await reddit.remove(thingId, true);
        await addRemovalNote(ctx, modNote);
        break;

      case 'filter':
        if (ctx.postId) {
          const p = await reddit.getPostById(ctx.postId);
          await p.filter();
        } else if (ctx.commentId) {
          const c = await reddit.getCommentById(ctx.commentId);
          await c.filter();
        }
        break;

      case 'lock':
        if (ctx.postId) {
          const p = await reddit.getPostById(ctx.postId);
          await p.lock();
        } else if (ctx.commentId) {
          const c = await reddit.getCommentById(ctx.commentId);
          await c.lock();
        }
        break;

      case 'approve':
        await reddit.approve(thingId);
        break;

      case 'flair':
        if (ctx.postId) {
          await reddit.setPostFlair({
            subredditName: ctx.subredditName,
            postId: ctx.postId,
            text: data.flairText || '⚠️ AI Flagged',
          });
        }
        break;

      case 'warn': {
        const parts = [
          `**Content ID:** ${thingId}`,
          ctx.authorName ? `**Author:** u/${ctx.authorName}` : '',
          ctx.postTitle ? `**Post Title:** ${ctx.postTitle}` : '',
          ctx.postBody ? `**Post Content:**\n${ctx.postBody}` : '',
          `**AI Reason:** ${reason || 'N/A'}`,
          data.warnMessage ? `**Mod Note:** ${data.warnMessage}` : '',
        ].filter(Boolean);
        await reddit.modMail.createConversation({
          subredditName: ctx.subredditName,
          subject: '[AI Mod] Content flagged for review',
          body: parts.join('\n\n'),
          to: null,
        });
        break;
      }

      case 'ban':
        if (ctx.authorName) {
          await reddit.banUser({
            subredditName: ctx.subredditName,
            username: ctx.authorName,
            duration:
              data.banDuration && data.banDuration > 0
                ? data.banDuration
                : undefined,
            note: 'Banned by AI Mod Guardian',
          });
        }
        break;

      case 'mute':
        if (ctx.authorName) {
          await reddit.muteUser({
            subredditName: ctx.subredditName,
            username: ctx.authorName,
          });
        }
        break;

      case 'strike': {
        const slabel = (data.strikeLabel ?? '').trim();
        if (ctx.authorName && slabel && STRIKE_LABEL_REGEX.test(slabel)) {
          await redis.zIncrBy(strikeKey(slabel), ctx.authorName, 1);
          await redis.zAdd(STRIKES_LABELS_KEY, {
            member: slabel,
            score: Date.now(),
          });
          console.log(
            `[Action] strike +1 on u/${ctx.authorName} (label=${slabel})`
          );
        } else {
          console.warn(
            `[Action] strike skipped: invalid label "${slabel}" or no author`
          );
        }
        break;
      }
    }
  } catch (err) {
    console.error(`[Action] ${data.action} failed:`, err);
  }
}

async function addRemovalNote(
  ctx: { postId?: T3; commentId?: T1 },
  modNote: string
) {
  try {
    if (ctx.postId) {
      const p = await reddit.getPostById(ctx.postId);
      await p.addRemovalNote({ reasonId: '', modNote });
    } else if (ctx.commentId) {
      const c = await reddit.getCommentById(ctx.commentId);
      await c.addRemovalNote({ reasonId: '', modNote });
    }
  } catch (err) {
    console.error('[Action] addRemovalNote failed:', err);
  }
}

// ── Load active flows ─────────────────────────────────────────────────────────

async function loadFlows(scope: 'post' | 'comment'): Promise<ModerationFlow[]> {
  const raw = await redis.get(FLOWS_KEY);
  if (!raw) return [];
  const all: ModerationFlow[] = JSON.parse(raw);
  return all.filter(
    (f) => f.isActive && (f.scope === scope || f.scope === 'both')
  );
}

// ── Trigger handlers ──────────────────────────────────────────────────────────

triggers.post('/on-app-install', async (c) => {
  const input = await c.req.json<OnAppInstallRequest>();
  console.log('[ai-guard] Installed to r/' + input.subreddit?.name);
  return c.json<TriggerResponse>({}, 200);
});

triggers.post('/on-post-submit', async (c) => {
  const event = await c.req.json<OnPostSubmitRequest>();
  const post = event.post;
  const subredditName = event.subreddit?.name ?? '';
  if (!post?.id || !subredditName) return c.json<TriggerResponse>({}, 200);

  const postId = (post.id.startsWith('t3_') ? post.id : `t3_${post.id}`) as T3;
  const content = `Title: ${post.title}\n\nBody: ${post.selftext ?? ''}`.trim();
  console.log(`[AI Engine] Post: "${post.title}"`);

  try {
    const config = await getAgentConfig();
    if (!config.apiKey) return c.json<TriggerResponse>({}, 200);

    const flows = await loadFlows('post');
    for (const flow of flows) {
      try {
        await traverseFlow(flow, content, config, {
          postId,
          subredditName,
          authorName: event.author?.name,
          postTitle: post.title,
          postBody: post.selftext ?? '',
        });
      } catch (err) {
        console.error(`[${flow.name}] Error:`, err);
      }
    }
  } catch (err) {
    console.error('[AI Engine] on-post-submit error:', err);
  }

  return c.json<TriggerResponse>({}, 200);
});

triggers.post('/on-comment-submit', async (c) => {
  const event = await c.req.json<OnCommentSubmitRequest>();
  const comment = event.comment;
  const subredditName = event.subreddit?.name ?? '';
  if (!comment?.id || !subredditName) return c.json<TriggerResponse>({}, 200);

  const commentId = (
    comment.id.startsWith('t1_') ? comment.id : `t1_${comment.id}`
  ) as T1;
  const content = comment.body ?? '';
  console.log(`[AI Engine] Comment: ${comment.id}`);

  try {
    const config = await getAgentConfig();
    if (!config.apiKey) return c.json<TriggerResponse>({}, 200);

    const flows = await loadFlows('comment');
    for (const flow of flows) {
      try {
        await traverseFlow(flow, content, config, {
          commentId,
          subredditName,
          authorName: event.author?.name,
          postBody: comment.body ?? '',
        });
      } catch (err) {
        console.error(`[${flow.name}] Error:`, err);
      }
    }
  } catch (err) {
    console.error('[AI Engine] on-comment-submit error:', err);
  }

  return c.json<TriggerResponse>({}, 200);
});
