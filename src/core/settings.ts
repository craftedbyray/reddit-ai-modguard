import { redis, settings } from '@devvit/web/server';

export const API_KEY_REDIS_KEY = 'config:apiKey';

export interface AgentConfig {
  apiKey: string;
  baseUrl: string;
  modelName: string;
}

export async function getAgentConfig(): Promise<AgentConfig> {
  const redisKey = await redis.get(API_KEY_REDIS_KEY);
  const settingsKey = (await settings.get('apiKey')) as string | undefined;
  const apiKey = (redisKey?.trim() || settingsKey?.trim() || '');

  const baseUrl = await settings.get('baseUrl') as string | undefined;
  const modelName = await settings.get('modelName') as string | undefined;

  return {
    apiKey,
    baseUrl: baseUrl?.trim() || 'https://api.openai.com/v1',
    modelName: modelName?.trim() || 'gpt-4o-mini',
  };
}
